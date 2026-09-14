import { openSkyProvider, openSkyHasCredentials } from './openSky';
import { adsbFiProvider, fetchAdsbFiRegionalSweep } from './adsbFi';
import type { StandardAircraft } from './types';

export type { StandardAircraft, AircraftDataProvider, ProviderFetchResult } from './types';

export interface LiveAircraftResult {
  aircraft: StandardAircraft[];
  /** Overall status: "live" once any provider supplied fresh or reused data,
   *  "degraded" when only a stale cache could be returned, "down" when
   *  nothing at all is available this cycle. */
  status: 'live' | 'degraded' | 'down';
  /** Short label for what actually produced this batch, e.g. "opensky",
   *  "opensky+adsb.fi-mil", "adsb.fi-regional", "stale-cache". */
  source: string;
  providers: {
    opensky: number;
    opensky_authenticated: boolean;
    opensky_age_s: number | null;
    adsbfi_military: number;
    adsbfi_regional: number;
  };
  timestamp: string;
}

let lastGoodResult: LiveAircraftResult | null = null;

/**
 * The single entry point the rest of the app calls. Fans out to every
 * provider, merges + dedupes by ICAO24, and only falls back to the slow
 * worldwide adsb.fi sweep when OpenSky produced nothing usable this cycle —
 * that sweep is metered far more tightly than everything else here.
 *
 * Never invents aircraft: if every provider is down, this returns an empty
 * list with status "down" rather than serving anything stale as if it were
 * live positions.
 */
export async function fetchLiveAircraft(): Promise<LiveAircraftResult> {
  const merged = new Map<string, StandardAircraft>();
  const addAll = (list: StandardAircraft[]) => {
    for (const ac of list) if (!merged.has(ac.id)) merged.set(ac.id, ac);
  };

  const [openSkyResult, adsbMilResult] = await Promise.allSettled([
    openSkyProvider.fetchLiveAircraft(),
    adsbFiProvider.fetchLiveAircraft(),
  ]);

  const osOk = openSkyResult.status === 'fulfilled' && openSkyResult.value.ok;
  const osAircraft = openSkyResult.status === 'fulfilled' ? openSkyResult.value.aircraft : [];
  const osAge = openSkyResult.status === 'fulfilled' && Number.isFinite(openSkyResult.value.ageSeconds)
    ? openSkyResult.value.ageSeconds : null;

  const milAircraft = adsbMilResult.status === 'fulfilled' ? adsbMilResult.value.aircraft : [];

  addAll(osAircraft);
  addAll(milAircraft);

  let regionalCount = 0;
  const sourceParts: string[] = [];
  if (osOk) sourceParts.push('opensky');
  if (milAircraft.length > 0) sourceParts.push('adsb.fi-mil');

  // Last resort: OpenSky gave us nothing usable this cycle (rate-limited,
  // down, or no credentials and mid-cooldown). Sweep adsb.fi worldwide
  // instead of leaving the map empty. This is slow (~30s) and only runs
  // when it has to.
  if (!osOk) {
    try {
      const regional = await fetchAdsbFiRegionalSweep();
      regionalCount = regional.length;
      addAll(regional);
      if (regionalCount > 0) sourceParts.push('adsb.fi-regional');
    } catch (e) {
      console.warn('[OSIRIS] adsb.fi regional sweep failed:', e);
    }
  }

  const aircraft = Array.from(merged.values());
  const providers = {
    opensky: osAircraft.length,
    opensky_authenticated: openSkyHasCredentials(),
    opensky_age_s: osAge,
    adsbfi_military: milAircraft.length,
    adsbfi_regional: regionalCount,
  };

  if (aircraft.length > 0) {
    const result: LiveAircraftResult = {
      aircraft,
      status: 'live',
      source: sourceParts.join('+') || 'unknown',
      providers,
      timestamp: new Date().toISOString(),
    };
    lastGoodResult = result;
    return result;
  }

  // Nothing usable this cycle. Serve the last known-good snapshot, clearly
  // marked as degraded, rather than an empty map — but never claim it is
  // live. If there is no prior snapshot either, report honestly that the
  // feed is down instead of fabricating data.
  if (lastGoodResult) {
    return {
      ...lastGoodResult,
      status: 'degraded',
      source: `${lastGoodResult.source}+stale`,
      providers,
    };
  }

  return {
    aircraft: [],
    status: 'down',
    source: 'none',
    providers,
    timestamp: new Date().toISOString(),
  };
}
