import { authedJson } from './auth';

// Google Places address lookup through our backend (HHNodeServer
// routes/places.js). The key stays server-side.

export interface PlaceSuggestion {
  place_id: string;
  text: string;
  main: string;
  secondary: string;
}

export interface PlaceAddress {
  line1: string | null;
  line2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  plus_code: string | null;
  /** false = the address doesn't pin a door (a rural road, a named property). */
  has_street_number: boolean;
  formatted: string | null;
}

let enabled: Promise<boolean> | null = null;

/** Whether lookup is set up on the server; asked once per page load. */
export function placesEnabled(): Promise<boolean> {
  if (!enabled) {
    enabled = authedJson<{ enabled: boolean }>('/places/config')
      .then((d) => Boolean(d?.enabled))
      .catch(() => false);
  }
  return enabled;
}

/** One token per address being typed: Google bills the keystrokes and the pick as one session. */
export function newPlacesSession(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function autocompletePlaces(q: string, session: string) {
  return authedJson<PlaceSuggestion[]>(
    `/places/autocomplete?q=${encodeURIComponent(q)}&session=${encodeURIComponent(session)}`,
  );
}

export function placeDetails(placeId: string, session: string) {
  return authedJson<PlaceAddress>(
    `/places/details/${encodeURIComponent(placeId)}?session=${encodeURIComponent(session)}`,
  );
}
