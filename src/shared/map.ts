/** Field Map: position sources and the OpenStreetMap data it uses. */
export interface MapHome { label: string; latitude: number; longitude: number }
export type HelperLocation = { ok: true; latitude: number; longitude: number; accuracy: number } | { ok: false; error: LocationError };
export type LocationError = 'denied' | 'disabled' | 'timeout' | 'unavailable' | 'unsupported';
export type MapPosition =
  | { source: 'device'; latitude: number; longitude: number; accuracy: number }
  | { source: 'home'; latitude: number; longitude: number; label: string; reason: LocationError }
  | { source: 'none'; reason: LocationError };

/** OpenFreeMap: free OpenStreetMap vector tiles, no key or account. */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
export const MAP_ORIGINS = ['https://tiles.openfreemap.org'] as const;
/** OpenStreetMap's place search, used only when the user looks up a home location. */
export const GEOCODE_URL = 'https://nominatim.openstreetmap.org/search';
const MAX_LABEL = 120;
const ERRORS: readonly LocationError[] = ['denied', 'disabled', 'timeout', 'unavailable', 'unsupported'];

const isLatitude = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 90;
const isLongitude = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 180;

export function parseHelperLocation(output: string): HelperLocation {
  try {
    const data = JSON.parse(output.trim()) as Record<string, unknown>;
    if (typeof data.error === 'string') return { ok: false, error: ERRORS.includes(data.error as LocationError) ? data.error as LocationError : 'unavailable' };
    if (isLatitude(data.latitude) && isLongitude(data.longitude)) {
      const accuracy = typeof data.accuracy === 'number' && Number.isFinite(data.accuracy) && data.accuracy >= 0 ? data.accuracy : 0;
      return { ok: true, latitude: data.latitude, longitude: data.longitude, accuracy };
    }
  } catch { /* Malformed helper output is treated as unavailable. */ }
  return { ok: false, error: 'unavailable' };
}

export function resolveMapPosition(location: HelperLocation, home: MapHome | undefined): MapPosition {
  if (location.ok) return { latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy, source: 'device' };
  return home ? { latitude: home.latitude, longitude: home.longitude, source: 'home', label: home.label, reason: location.error } : { source: 'none', reason: location.error };
}

export function normalizeMapHome(value: unknown): MapHome | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const data = value as Record<string, unknown>;
  const label = typeof data.label === 'string' ? data.label.trim().slice(0, MAX_LABEL) : '';
  return label && isLatitude(data.latitude) && isLongitude(data.longitude) ? { label, latitude: data.latitude, longitude: data.longitude } : undefined;
}

/** First result of a Nominatim `format=json` search. */
export function parseGeocode(response: unknown): MapHome | undefined {
  if (!Array.isArray(response) || !response.length) return undefined;
  const place = response[0] as Record<string, unknown>;
  return normalizeMapHome({ label: place.display_name, latitude: Number(place.lat), longitude: Number(place.lon) });
}
