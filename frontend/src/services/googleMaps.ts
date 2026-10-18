/**
 * Loads the Google Maps JavaScript API once per page. The key is restricted
 * to the Maps JavaScript API in the Cloud Console; the injected loader is the
 * standard async flow. The resolved namespace is structural — callers write
 * their own minimal typings against it (see components/GoogleMap.tsx).
 */
type MapsNamespace = Record<string, unknown>;

/** Configured Maps JavaScript API key (may be undefined when unset). */
export const googleMapsKey =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || undefined;

let pending: Promise<MapsNamespace> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<MapsNamespace> {
  if (pending) return pending;
  pending = new Promise<MapsNamespace>((resolve, reject) => {
    const cbName = '__luckysevaMapsReady';
    const w = window as unknown as Record<string, unknown> & { google?: { maps?: MapsNamespace } };
    if (w.google?.maps) {
      resolve(w.google.maps);
      return;
    }
    w[cbName] = () => {
      if (w.google?.maps) {
        resolve(w.google.maps);
      } else {
        reject(new Error('Google Maps loaded without a maps namespace'));
      }
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
