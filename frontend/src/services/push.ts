/**
 * Best-effort browser push registration.
 *
 * Uses the Firebase compat CDN scripts rather than the npm SDK: the token is
 * the only thing we need and this keeps the bundle small and the dependency
 * list unchanged. If any piece is missing (no config, no service worker, no
 * permission, offline) this resolves to `null` and the app carries on. A push
 * failure must never block login or a booking.
 */

declare global {
  interface Window {
    firebase?: {
      initializeApp: (config: Record<string, string>) => unknown;
      app?: { name?: string };
      messaging?: () => {
        getToken: (messagingOpts: {
          vapidKey: string;
          serviceWorkerRegistration: ServiceWorkerRegistration;
        }) => Promise<string>;
      };
    };
    firebaseMessaging?: {
      getToken: (messagingOpts: {
        vapidKey: string;
        serviceWorkerRegistration: ServiceWorkerRegistration;
      }) => Promise<string>;
    };
  }
}

const CDN_BASE = 'https://www.gstatic.com/firebasejs/12.19.0';

let loadPromise: Promise<void> | null = null;

const injectScript = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') resolve();
      else {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error(`failed to load ${src}`)));
      }
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.loaded = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(script);
  });

const firebaseConfig = () => {
  const cfg = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  } as Record<string, string | undefined>;
  if (!cfg.apiKey || !cfg.projectId || !cfg.appId) return null;
  return cfg as Record<string, string>;
};

const ensureFirebase = async (): Promise<void> => {
  if (window.firebase?.messaging) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      await injectScript(`${CDN_BASE}/firebase-app-compat.js`);
      await injectScript(`${CDN_BASE}/firebase-messaging-compat.js`);
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  await loadPromise;
};

/** Registers the service worker and returns an FCM token, or null. */
export const getPushToken = async (): Promise<string | null> => {
  const cfg = firebaseConfig();
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!cfg || !vapidKey) return null;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  let registration: ServiceWorkerRegistration | undefined;
  try {
    registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
  if (!registration) return null;

  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch {
    return null;
  }
  if (permission !== 'granted') return null;

  try {
    await ensureFirebase();
    const fb = window.firebase;
    if (!fb?.messaging) return null;
    if (!fb.app) fb.initializeApp(cfg);
    const token = await fb.messaging().getToken({ vapidKey, serviceWorkerRegistration: registration });
    return token || null;
  } catch {
    return null;
  }
};

const platform = () => {
  if (typeof navigator === 'undefined') return 'web';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'web';
};

/**
 * Requests permission and registers the token with the backend.
 *
 * `register` is the already-authenticated API call for the current role, so a
 * 401 simply means "not signed in yet" and is swallowed.
 */
export const registerPush = async (
  register: (body: { token: string; platform: string }) => Promise<unknown>
): Promise<boolean> => {
  const token = await getPushToken();
  if (!token) return false;
  try {
    await register({ token, platform: platform() });
    return true;
  } catch {
    return false;
  }
};
