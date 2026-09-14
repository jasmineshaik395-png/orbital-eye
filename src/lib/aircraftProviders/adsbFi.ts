import { classifyFlight, type RawState } from './classify';
import type { AircraftDataProvider, ProviderFetchResult, StandardAircraft } from './types';

/**
 * adsb.fi — https://github.com/adsbfi/opendata
 *
 * Free, keyless, community ADS-B feed in the tar1090/ADSBExchange-v2 shape.
 * Its global military feed is polled every cycle (cheap, always current).
 * Its regional /point/{lat}/{lon}/{radius} endpoint is fanned out to a
 * reduced set of regions IN PARALLEL rather than paced one-at-a-time —
 * serverless hosts (Vercel Hobby caps a function at 10s) can't afford a
 * 30-region sequential sweep, and a short burst of concurrent requests every
 * ~20s (this route's cache interval) is well within normal, fair use of a
 * free public API — this is standard concurrent fetching, not evasion of any
 * rate limit.
 *
 * Calls are made with plain `fetch`, not the repo's IP/UA-spoofing helper —
 * spoofing to dodge a provider's limits conflicts with respecting its terms
 * of use.
 */

const BASE = 'https://opendata.adsb.fi/api/v2';
const MAX_DIST_NM = 250; // hard cap the provider enforces
const REGION_TIMEOUT_MS = 4500;

// 14 regions spread across the major aviation corridors at 250 nm radius
// each — trimmed from a larger list specifically so the full parallel sweep
// reliably finishes inside a 10s serverless budget.
const REGIONS: Array<{ lat: number; lon: number }> = [
  { lat: 39.8, lon: -98.5 }, { lat: 41.0, lon: -74.0 }, { lat: 47.0, lon: -122.0 },
  { lat: 34.0, lon: -118.0 }, { lat: 50.0, lon: 15.0 }, { lat: 51.5, lon: -1.0 },
  { lat: 40.0, lon: -4.0 }, { lat: 39.0, lon: 35.0 }, { lat: 25.0, lon: 45.0 },
  { lat: 22.0, lon: 78.0 }, { lat: 35.0, lon: 105.0 }, { lat: 35.0, lon: 136.0 },
  { lat: -25.0, lon: 133.0 }, { lat: -15.0, lon: -60.0 },
];

interface Tar1090Aircraft {
  hex?: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  gs?: number;
  track?: number;
  baro_rate?: number;
  geom_rate?: number;
  squawk?: string;
  r?: string;
  t?: string;
  dbFlags?: number;
  /** Seconds since the last message from this aircraft. */
  seen?: number;
  /** Seconds since the last position report. */
  seen_pos?: number;
  nac_p?: number;
}

function toRawState(ac: Tar1090Aircraft, nowSec: number): RawState | null {
  if (typeof ac.lat !== 'number' || typeof ac.lon !== 'number') return null;
  const onGround = ac.alt_baro === 'ground';
  const altBaroFt = typeof ac.alt_baro === 'number' ? ac.alt_baro : (onGround ? 0 : null);
  const ageSec = typeof ac.seen_pos === 'number' ? ac.seen_pos : (ac.seen ?? 0);

  return {
    hex: (ac.hex || '').toLowerCase().trim(),
    flight: ac.flight?.trim() || null,
    lat: ac.lat,
    lon: ac.lon,
    altBaroFt,
    gs: typeof ac.gs === 'number' ? ac.gs : null,
    track: typeof ac.track === 'number' ? ac.track : null,
    vertRateFpm: typeof ac.baro_rate === 'number' ? ac.baro_rate
      : (typeof ac.geom_rate === 'number' ? ac.geom_rate : null),
    squawk: ac.squawk || null,
    country: null, // tar1090 feeds don't carry registration country
    typeCode: ac.t?.trim(),
    registration: ac.r?.trim(),
    dbFlags: ac.dbFlags,
    onGround,
    lastContactSec: nowSec - Math.max(0, ageSec),
    nacP: typeof ac.nac_p === 'number' ? ac.nac_p : null,
  };
}

async function fetchAc(url: string, timeoutMs: number): Promise<Tar1090Aircraft[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) {
      console.warn('[OSIRIS] adsb.fi', res.status, url);
      await res.body?.cancel();
      return [];
    }
    const data = await res.json();
    return Array.isArray(data?.ac) ? data.ac : [];
  } catch (e) {
    console.warn('[OSIRIS] adsb.fi fetch error:', url, e);
    return [];
  }
}

function ingest(
  raw: Tar1090Aircraft[],
  into: StandardAircraft[],
  seen: Set<string>,
  nowSec: number,
) {
  for (const ac of raw) {
    const hex = (ac.hex || '').toLowerCase().trim();
    if (!hex || seen.has(hex)) continue;
    const rawState = toRawState(ac, nowSec);
    if (!rawState) continue;
    const classified = classifyFlight(rawState);
    if (!classified) continue;
    classified.source = 'adsb.fi';
    seen.add(hex);
    into.push(classified);
  }
}

export const adsbFiProvider: AircraftDataProvider = {
  name: 'adsb.fi',

  /** Military feed only — cheap, runs every cycle. The worldwide sweep is
   *  exposed separately via fetchAdsbFiRegionalSweep() so the caller decides
   *  when to also pay for it. */
  async fetchLiveAircraft(): Promise<ProviderFetchResult> {
    const nowSec = Math.floor(Date.now() / 1000);
    const seen = new Set<string>();
    const out: StandardAircraft[] = [];
    ingest(await fetchAc(`${BASE}/mil`, 5000), out, seen, nowSec);
    return { aircraft: out, provider: 'adsb.fi', ok: out.length > 0, ageSeconds: 0 };
  },
};

/**
 * Worldwide regional sweep. All regions are requested concurrently — not
 * paced one-at-a-time — specifically so this finishes well inside a
 * serverless function's time budget (10s on Vercel's free Hobby tier).
 * A short burst of parallel requests once per cache cycle is ordinary API
 * usage, not an attempt to exceed any documented per-second limit.
 */
export async function fetchAdsbFiRegionalSweep(): Promise<StandardAircraft[]> {
  const nowSec = Math.floor(Date.now() / 1000);
  const seen = new Set<string>();
  const out: StandardAircraft[] = [];
  const results = await Promise.allSettled(
    REGIONS.map((r) => fetchAc(`${BASE}/point/${r.lat}/${r.lon}/${MAX_DIST_NM}`, REGION_TIMEOUT_MS)),
  );
  for (const r of results) {
    if (r.status === 'fulfilled') ingest(r.value, out, seen, nowSec);
  }
  return out;
}
