let pending: Promise<typeof window.google.maps> | null = null;

/**
 * Loads the Google Maps JavaScript API once per page and resolves with the
 * maps namespace. The key is restricted to the Maps JavaScript API in the
 * Cloud Console; the injected loader is the standard dynamic-import flow.
 */
export function loadGoogleMaps(apiKey: string): Promise<typeof window.google.maps> {
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const cbName = '__luckysevaMapsReady';
    const w = window as unknown as {
      google?: { maps?: unknown };
      [key: string]: unknown;
    };
    if (w.google?.maps) {
      resolve(w.google as typeof window.google.maps);
      return;
    }
    w[cbName] = () => {
      if (w.google?.maps) resolve(w.google as typeof window.google.maps);
      else reject(new Error('Google Maps loaded without a maps namespace'));
      delete w[cbName];
    };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${cbName}&v=weekly&loading=async`;
    s.async = true;
    s.defer = true;
    s.onerror = () => {
      pending = null;
      reject(new Error('Failed to load the Google Maps script'));
    };
    document.head.appendChild(s);
    // Safety net — some blockers never fire onerror.
    setTimeout(() => {
      if (!w.google?.maps) {
        pending = null;
        reject(new Error('Google Maps script timed out'));
      }
    }, 10000);
  });
  return pending;
}

declare global {
  // eslint-disable-next-line no-var
  var google: { maps: Record<string, unknown> } | undefined;
}
