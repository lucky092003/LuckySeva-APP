import type { LatLng } from '@/components/mapTypes';

export interface RouteResult {
  path: LatLng[];
  distanceKm: number;
  durationMin: number;
}

/* Module-level cache so the 60 s route refetch (and multiple screens) don't
   re-hit the OSRM demo server for the same pair of points. ~50 m buckets. */
const cache = new Map<string, { at: number; result: RouteResult }>();
const TTL_MS = 5 * 60 * 1000;

const bucket = (v: number) => Math.round(v * 500) / 500; // ~50 m

/**
 * Road route between two points via the public OSRM demo server (free, no
 * API key, no billing). Returns null when it fails — callers then fall back
 * to the simple straight-line rendering. Uses the car profile: the dedicated
 * bike profile isn't served by the public demo, and for a provider on a
 * two-wheeler the car roads are the realistic path anyway.
 */
export async function fetchRoute(from: LatLng, to: LatLng): Promise<RouteResult | null> {
  const key = `${bucket(from.latitude)},${bucket(from.longitude)}|${bucket(to.latitude)},${bucket(to.longitude)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.result;

  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
      `?overview=full&geometries=geojson&alternatives=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const result: RouteResult = {
      path: (coords as [number, number][]).map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
      distanceKm: route.distance / 1000,
      durationMin: Math.max(1, Math.round(route.duration / 60)),
    };
    cache.set(key, { at: Date.now(), result });
    // Keep the cache from growing without bound during long sessions.
    if (cache.size > 50) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return result;
  } catch {
    return null;
  }
}
