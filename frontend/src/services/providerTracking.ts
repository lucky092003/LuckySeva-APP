import { useSyncExternalStore } from 'react';

/**
 * Location-sharing state for the provider app.
 *
 * `ProviderLocationPublisher` is an invisible component mounted by the shell, so
 * it has nowhere to render an error. A tiny external store lets it *report*
 * (permission denied, GPS switched off, fix lost) and lets any provider screen
 * subscribe and explain what the customer can and cannot see — without threading
 * context through the whole shell.
 */
export type LocationShareState = 'idle' | 'active' | 'denied' | 'unavailable';

export type LocationShareSnapshot = Readonly<{
  state: LocationShareState;
  detail: string | null;
}>;

let snapshot: LocationShareSnapshot = { state: 'idle', detail: null };
const listeners = new Set<() => void>();

export const setLocationShareState = (state: LocationShareState, detail: string | null = null) => {
  if (snapshot.state === state && snapshot.detail === detail) return;
  snapshot = { state, detail };
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => snapshot;

export const useLocationShareState = (): LocationShareSnapshot =>
  useSyncExternalStore(subscribe, getSnapshot);

export type LocationFix = { latitude: number; longitude: number; accuracy?: number };

export type LocationPermission =
  | { status: 'granted'; coords: LocationFix }
  | { status: 'denied' | 'unavailable' | 'unsupported' };

/**
 * One-shot permission request, used the moment a provider starts a journey so
 * the prompt appears in context (not on app launch) and the first position can
 * be published immediately rather than waiting for the background watcher.
 */
export async function requestLocationPermission(): Promise<LocationPermission> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return { status: 'unsupported' };
  }
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
    });
    const { latitude, longitude, accuracy } = position.coords;
    return {
      status: 'granted',
      coords: Number.isFinite(accuracy) ? { latitude, longitude, accuracy } : { latitude, longitude },
    };
  } catch (err) {
    // `1` is PERMISSION_DENIED in the Geolocation API. A denial is permanent
    // until the user changes it; the other codes usually mean no fix yet.
    const code = (err as { code?: number } | null)?.code;
    return code === 1 ? { status: 'denied' } : { status: 'unavailable' };
  }
}
