export interface LocationResult {
  address: string;
  latitude: number;
  longitude: number;
  details: Record<string, string>;
}

const FALLBACK_COORDS = (lat: number, lng: number) => `Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)}`;

export function formatAddress(details: Record<string, string>): string {
  const house = [details.house_number, details.road].filter(Boolean).join(', ');
  const neighbourhood = details.neighbourhood || '';
  const suburb = details.suburb || '';
  const locality = neighbourhood && suburb && neighbourhood !== suburb
    ? `${neighbourhood}, ${suburb}`
    : neighbourhood || suburb || '';
  const city = details.city || details.town || details.village || details.city_district || '';
  const state = (details.state || '').replace(/ U\.T\.$/i, '');
  const postcode = details.postcode || '';
  return [house, locality, city, state, postcode].filter(Boolean).join(', ');
}

export async function fetchCurrentLocation(): Promise<LocationResult> {
  if (!('geolocation' in navigator)) {
    throw new Error('Location is not supported on this device.');
  }
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
  const { latitude, longitude } = pos.coords;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=en`
    );
    const data = await res.json();
    const details = data?.address || {};
    const formatted = formatAddress(details);
    return {
      address: formatted || data?.display_name || FALLBACK_COORDS(latitude, longitude),
      latitude,
      longitude,
      details,
    };
  } catch {
    return { address: FALLBACK_COORDS(latitude, longitude), latitude, longitude, details: {} };
  }
}

export function areaFrom(details: Record<string, string>): string {
  const parts = [details.suburb, details.neighbourhood, details.city_district, details.city, details.state]
    .filter((x) => !!x)
    .slice(0, 2);
  return parts.join(', ');
}