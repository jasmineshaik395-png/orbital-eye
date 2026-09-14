/**
 * OSIRIS — Aircraft data provider abstraction.
 *
 * Any live-position source (OpenSky, adsb.fi, a future paid feed, …) is
 * wrapped behind this interface: fetchLiveAircraft() returns whatever shape
 * that provider speaks, normalizeAircraft() turns it into the StandardAircraft
 * below. Nothing downstream of index.ts ever touches a provider's raw
 * response, so swapping or adding a source never touches the map/UI code.
 */

/** Provider-agnostic, normalized aircraft state. Use `null` — never invent a
 *  value — when a provider does not supply a field. */
export interface StandardAircraft {
  /** Stable identifier for this aircraft — its ICAO24 hex address. */
  id: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  /** Barometric altitude, metres. */
  altitude: number | null;
  /** Ground speed, knots. */
  speed: number | null;
  /** True track / heading, degrees. */
  heading: number | null;
  /** Rate of climb/descent, metres per second (signed). */
  verticalRate: number | null;
  /** Country of registration, as reported by the source. */
  country: string | null;
  /** Human-readable aircraft type/model when known. */
  aircraftType: string | null;
  /** ISO-8601 timestamp of the last position the source reported for this
   *  aircraft — not the poll time. */
  lastUpdated: string;

  // Extra fields the OSIRIS map/UI already renders. Not part of the minimal
  // spec above, but dropping them would regress existing features.
  icao24: string;
  registration: string | null;
  squawk: string | null;
  grounded: boolean;
  source: string;
  /** Traffic class, used for layer bucketing and marker styling. */
  category: 'commercial' | 'private' | 'jet' | 'military';
  aircraftCategory: 'heli' | 'plane';
  /** ADS-B Navigation Accuracy Category for Position (NACp), 0-11, when the
   *  source reports it. A low value on a still-airborne aircraft is one
   *  signal used for the GPS-jamming overlay. Null when not reported. */
  nacP: number | null;
}

/** What a provider hands back for one polling cycle. */
export interface ProviderFetchResult {
  aircraft: StandardAircraft[];
  /** Short machine-readable name, e.g. "opensky", "adsb.fi". */
  provider: string;
  /** True once this provider returned live data this cycle (a reused/stale
   *  snapshot from a prior cycle still counts — false only means "nothing
   *  usable came back, do not trust this batch"). */
  ok: boolean;
  /** Seconds since this provider's snapshot was actually refreshed from the
   *  network — 0 for a fresh fetch, growing while a cached snapshot is reused. */
  ageSeconds: number;
}

/** Every concrete provider implements this shape. */
export interface AircraftDataProvider {
  name: string;
  /** Fetch (or reuse a cached) snapshot and return StandardAircraft objects
   *  directly — normalization happens inside the provider, next to the raw
   *  shape it understands, so nothing outside this folder parses raw fields. */
  fetchLiveAircraft(): Promise<ProviderFetchResult>;
}
