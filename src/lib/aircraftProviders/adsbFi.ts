import { classifyFlight, type RawState } from './classify';
import type { AircraftDataProvider, ProviderFetchResult, StandardAircraft } from './types';

/**
 * adsb.fi — https://github.com/adsbfi/opendata
 *
 * Free, keyless, community ADS-B feed in the tar1090/ADSBExchange-v2 shape.
 * Used only as a fallback when OpenSky has no usable snapshot this cycle —
 * its global military feed is polled every cycle (cheap, always current);
 * its regional /lat/{lat}/lon/{lon}/dist/{nm} endpoint is metered far more
 * tightly, so the worldwide sweep below only runs when nothing else worked.
 *
 * Calls are made with plain `fetch` and paced sequentially, honoring the
 * ~1 req/s the provider documents rather than spoofing headers or IPs to
 * push past it.
 */

const BASE = 'https://opendata.adsb.fi/api/v2';
const MAX_DIST_NM = 250; // hard cap the provider enforces
const REGION_GAP_MS = 1100; // ~1 req/s

// 30 regions covering the major aviation corridors at 250 nm radius each —
// enough overlap to give worldwide coverage without exceeding the provider's
// budget in a single sweep.
const REGIONS: Array<{ lat: number; lon: number }> = [
  { lat: 39.8, lon: -98.5 }, { lat: 41.0, lon: -74.0 }, { lat: 33.0, lon: -84.0 },
  { lat: 42.0, lon: -88.0 }, { lat: 30.0, lon: -97.0 }, { lat: 47.0, lon: -122.0 },
  { lat: 34.0, lon: -118.0 }, { lat: 45.0, lon: -73.0 }, { lat: 49.0, lon: -97.0 },
  { lat: 50.0, lon: 15.0 }, { lat: 51.5, lon: -1.0 }, { lat: 47.0, lon: 2.0 },
  { lat: 40.0, lon: -4.0 }, { lat: 42.0, lon: 13.0 }, { lat: 60.0, lon: 15.0 },
  { lat: 52.0, lon: 22.0 }, { lat: 39.0, lon: 35.0 },
  { lat: 25.0, lon: 45.0 }, { lat: 22.0, lon: 78.0 },
  { lat: 35.0, lon: 105.0 }, { lat: 35.0, lon: 136.0 }, { lat: 37.0, lon: 127.0 },
  { lat: 13.0, lon: 100.0 }, { lat: 1.0, lon: 104.0 },
  { lat: -25.0, lon: 133.0 }, { lat: -33.0, lon: 151.0 },
  { lat: 0.0, lon: 20.0 }, { lat: -26.0, lon: 28.0 },
  { lat: -15.0, lon: -60.0 }, { lat: -23.0, lon: -46.0 },
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

async function fetchAc(url: string): Promise<Tar1090Aircraft[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) { await res.body?.cancel(); return []; }
    const data = await res.json();
    return Array.isArray(data?.ac) ? data.ac : [];
  } catch {
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

  /** Military feed only — cheap, runs every cycle. The full worldwide sweep
   *  is exposed separately via fetchRegionalSweep() so the caller can choose
   *  to skip it when OpenSky already supplied a usable snapshot. */
  async fetchLiveAircraft(): Promise<ProviderFetchResult> {
    const nowSec = Math.floor(Date.now() / 1000);
    const seen = new Set<string>();
    const out: StandardAircraft[] = [];
    ingest(await fetchAc(`${BASE}/mil`), out, seen, nowSec);
    return { aircraft: out, provider: 'adsb.fi', ok: out.length > 0, ageSeconds: 0 };
  },
};

/**
 * Worldwide regional sweep — last resort only, used when OpenSky has no
 * usable snapshot this cycle. Paced at ~1 req/s per the provider's documented
 * limit; 30 regions takes ~33s.
 */
export async function fetchAdsbFiRegionalSweep(): Promise<StandardAircraft[]> {
  const nowSec = Math.floor(Date.now() / 1000);
  const seen = new Set<string>();
  const out: StandardAircraft[] = [];
  for (const r of REGIONS) {
    ingest(
      await fetchAc(`${BASE}/lat/${r.lat}/lon/${r.lon}/dist/${MAX_DIST_NM}`),
      out, seen, nowSec,
    );
    await new Promise((resolve) => setTimeout(resolve, REGION_GAP_MS));
  }
  return out;
}
