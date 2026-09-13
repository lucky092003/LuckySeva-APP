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

export function splitAddress(full: string): { houseNo: string; area: string; city: string; state: string; pincode: string } {
  const parts = full.split(',').map((s) => s.trim()).filter(Boolean);
  let pincode = '';
  if (parts.length && /^\d{4,6}$/.test(parts[parts.length - 1])) pincode = parts.pop() || '';
  const state = parts.pop() || '';
  const city = parts.pop() || '';
  const area = parts.pop() || '';
  return { houseNo: parts.join(', '), area, city, state, pincode };
}

export function applyDetails(details: Record<string, string>): { houseNo: string; area: string; city: string; state: string; pincode: string } {
  return {
    houseNo: [details.house_number, details.road].filter(Boolean).join(', '),
    area: details.suburb || details.neighbourhood || '',
    city: details.city || details.town || details.village || details.city_district || '',
    state: details.state || '',
    pincode: details.postcode || '',
  };
}

export function areaFrom(details: Record<string, string>): string {
  const parts = [details.suburb, details.neighbourhood, details.city_district, details.city, details.state]
    .filter((x) => !!x)
    .slice(0, 2);
  return parts.join(', ');
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export async function geocodeAddress(parts: {
  house: string;
  city: string;
  state: string;
  pincode: string;
}): Promise<{ latitude: number; longitude: number } | null> {
  const params = new URLSearchParams({ format: 'json', limit: '1', countrycodes: 'in' });
  const street = parts.house.trim();
  const city = parts.city.trim();
  const state = parts.state.trim();
  const pincode = parts.pincode.trim();
  if (street) params.set('street', street);
  if (city) params.set('city', city);
  if (state) params.set('state', state);
  if (pincode) params.set('postalcode', pincode);
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const latitude = Number.parseFloat(data[0].lat);
      const longitude = Number.parseFloat(data[0].lon);
      if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) return { latitude, longitude };
    }
  } catch {
    /* geocoding is best-effort */
  }
  return null;
}