import { NextResponse } from 'next/server';
import { fetchLiveAircraft, type StandardAircraft } from '@/lib/aircraftProviders';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * OSIRIS — Live aircraft feed.
 *
 * Fans out to the provider abstraction in src/lib/aircraftProviders (OpenSky
 * primary, adsb.fi fallback), then reshapes the standardized aircraft list
 * into the four category buckets + GPS-jamming overlay the map already
 * consumes. The response shape here is intentionally unchanged from before —
 * OsirisMap.tsx and page.tsx read commercial_flights / private_flights /
 * private_jets / military_flights / gps_jamming directly — so only the data
 * layer underneath it changed.
 */

// A poll response is cached briefly so simultaneous client requests (or a
// client polling faster than the provider layer refreshes) don't each
// trigger their own provider fan-out.
const CACHE_TTL_MS = 20_000;
let cachedResponse: unknown = null;
let cachedAt = 0;
let inFlight: Promise<unknown> | null = null;

const JAMMING_NACP_THRESHOLD = 4;

/** Shape the map's toFeatures()/popups actually read — see OsirisMap.tsx. */
function toMapFlight(ac: StandardAircraft) {
  return {
    // Fields the existing map/popups read today.
    callsign: ac.callsign || '',
    lat: ac.latitude,
    lng: ac.longitude,
    alt: ac.altitude ?? 0,
    heading: ac.heading ?? 0,
    speed_knots: ac.speed ?? 0,
    model: ac.aircraftType || 'Unknown',
    icao24: ac.icao24,
    registration: ac.registration || 'N/A',
    squawk: ac.squawk || '',
    category: ac.category,
    aircraft_category: ac.aircraftCategory,
    grounded: ac.grounded,
    source: ac.source,
    type: 'flight' as const,

    // Standardized fields requested for the live-data upgrade. `id` doubles
    // as the ICAO24 hex address — the one thing every provider here agrees
    // on as a stable identifier.
    id: ac.id,
    latitude: ac.latitude,
    longitude: ac.longitude,
    altitude: ac.altitude,
    speed: ac.speed,
    verticalRate: ac.verticalRate,
    country: ac.country,
    aircraftType: ac.aircraftType,
    lastUpdated: ac.lastUpdated,
  };
}

function aggregateJamming(points: Array<{ lat: number; lng: number; nac_p: number; callsign: string }>) {
  if (points.length === 0) return [];
  const GRID_SIZE = 2;
  const grid = new Map<string, { lat: number; lng: number; count: number; total_nac_p: number }>();

  for (const p of points) {
    const gLat = Math.floor(p.lat / GRID_SIZE) * GRID_SIZE;
    const gLng = Math.floor(p.lng / GRID_SIZE) * GRID_SIZE;
    const key = `${gLat},${gLng}`;
    if (!grid.has(key)) grid.set(key, { lat: gLat + GRID_SIZE / 2, lng: gLng + GRID_SIZE / 2, count: 0, total_nac_p: 0 });
    const cell = grid.get(key)!;
    cell.count++;
    cell.total_nac_p += p.nac_p;
  }

  return Array.from(grid.values())
    .filter((z) => z.count >= 3)
    .map((z) => ({
      lat: z.lat,
      lng: z.lng,
      severity: Math.round((1 - (z.total_nac_p / z.count) / JAMMING_NACP_THRESHOLD) * 100),
      count: z.count,
    }));
}

async function buildResponse() {
  const result = await fetchLiveAircraft();

  const commercial: ReturnType<typeof toMapFlight>[] = [];
  const privateFl: ReturnType<typeof toMapFlight>[] = [];
  const jets: ReturnType<typeof toMapFlight>[] = [];
  const military: ReturnType<typeof toMapFlight>[] = [];
  const jammingPoints: Array<{ lat: number; lng: number; nac_p: number; callsign: string }> = [];

  for (const ac of result.aircraft) {
    const flight = toMapFlight(ac);

    if (typeof ac.nacP === 'number' && ac.nacP <= JAMMING_NACP_THRESHOLD && !ac.grounded) {
      jammingPoints.push({ lat: ac.latitude, lng: ac.longitude, nac_p: ac.nacP, callsign: flight.callsign });
    }

    switch (ac.category) {
      case 'military': military.push(flight); break;
      case 'jet': jets.push(flight); break;
      case 'private': privateFl.push(flight); break;
      default: commercial.push(flight);
    }
  }

  return {
    commercial_flights: commercial,
    private_flights: privateFl,
    private_jets: jets,
    military_flights: military,
    gps_jamming: aggregateJamming(jammingPoints),
    total: result.aircraft.length,
    // "live" once any provider is genuinely current this cycle, "degraded"
    // when only a stale snapshot could be served, "down" when nothing is
    // available at all — the UI's live-status indicator reads this.
    status: result.status,
    source: result.source,
    providers: result.providers,
    timestamp: result.timestamp,
  };
}

export async function GET() {
  const now = Date.now();

  if (cachedResponse && now - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cachedResponse, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
    });
  }

  if (!inFlight) {
    inFlight = buildResponse()
      .then((data) => {
        cachedResponse = data;
        cachedAt = Date.now();
        return data;
      })
      .catch((error) => {
        console.error('[OSIRIS] Flight fetch error:', error);
        // Never crash the route — hand back the last good response if there
        // is one, clearly marked, rather than a 500 that blanks the map.
        if (cachedResponse) {
          return { ...(cachedResponse as Record<string, unknown>), status: 'degraded', source: 'stale-cache' };
        }
        return {
          commercial_flights: [], private_flights: [], private_jets: [], military_flights: [],
          gps_jamming: [], total: 0, status: 'down', source: 'error',
          providers: null, timestamp: new Date().toISOString(),
        };
      })
      .finally(() => { inFlight = null; });
  }

  const data = await inFlight;
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
