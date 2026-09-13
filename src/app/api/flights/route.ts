import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Flight = {
  icao24: string;
  callsign: string;
  lat: number;
  lng: number;
  alt: number;
  speed_knots: number;
  heading: number;
  registration?: string;
  model?: string;
  category?: string;
  source?: string;
};

const AVIATIONSTACK_URL = "https://api.aviationstack.com/v1/flights";
const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const OPENSKY_STATES_URL =
  "https://opensky-network.org/api/states/all?extended=1";
const INDIA_BBOX = "&lamin=6&lomin=67&lamax=37&lomax=98";

function numberOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function cleanCallsign(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function knotsFromKmh(value: unknown): number {
  const n = numberOrZero(value);
  return n > 0 ? Math.round(n * 0.539957) : 0;
}

/**
 * Aviationstack's live flight records contain the aircraft position in
 * flight.live.  Keep the shape identical to the old OpenSky response so the
 * existing OSIRIS frontend does not need a second data model.
 */
function aviationstackToFlight(row: any): Flight | null {
  const live = row?.live;
  const lat = numberOrZero(live?.latitude);
  const lng = numberOrZero(live?.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return null;
  }

  const flightNumber =
    row?.flight?.icao || row?.flight?.iata || row?.flight?.number || "";
  const airline = row?.airline?.icao || row?.airline?.iata || row?.airline?.name || "";
  const callsign = cleanCallsign(flightNumber || airline);

  return {
    icao24: String(row?.aircraft?.icao24 ?? row?.aircraft?.registration ?? flightNumber),
    callsign,
    lat,
    lng,
    alt: Math.round(numberOrZero(live?.altitude)),
    speed_knots: knotsFromKmh(live?.speed_horizontal),
    heading: numberOrZero(live?.direction),
    registration: row?.aircraft?.registration ? String(row.aircraft.registration) : undefined,
    model: row?.aircraft?.iata || row?.aircraft?.icao || row?.aircraft?.type || undefined,
    category: "commercial",
    source: "aviationstack",
  };
}

async function fetchAviationstack(): Promise<Flight[]> {
  const key = process.env.AVIATIONSTACK_ACCESS_KEY;
  if (!key) throw new Error("AVIATIONSTACK_ACCESS_KEY is not configured");

  const url = `${AVIATIONSTACK_URL}?access_key=${encodeURIComponent(key)}&flight_status=active`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Aviationstack returned ${response.status}`);
  }

  const data = await response.json();
  if (data?.error) {
    throw new Error(`Aviationstack API error: ${data.error.message ?? "unknown error"}`);
  }

  const rows = Array.isArray(data?.data) ? data.data : [];
  return rows.map(aviationstackToFlight).filter(Boolean) as Flight[];
}

async function getOpenSkyToken(): Promise<string | null> {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const response = await fetch(OPENSKY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

function stateToFlight(state: any[]): Flight | null {
  const icao24 = String(state?.[0] ?? "").trim();
  const lat = Number(state?.[6]);
  const lng = Number(state?.[5]);
  if (!icao24 || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const altitudeMeters = Number(state?.[7]);
  const speedMs = Number(state?.[9]);

  return {
    icao24,
    callsign: cleanCallsign(state?.[1]),
    lat,
    lng,
    alt: Number.isFinite(altitudeMeters) ? Math.round(altitudeMeters * 3.28084) : 0,
    speed_knots: Number.isFinite(speedMs) ? Math.round(speedMs * 1.94384) : 0,
    heading: Number.isFinite(Number(state?.[10])) ? Number(state[10]) : 0,
    category: String(state?.[17] ?? ""),
    source: "opensky",
  };
}

async function fetchOpenSky(): Promise<Flight[]> {
  const token = await getOpenSkyToken();
  const headers: HeadersInit = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(OPENSKY_STATES_URL + INDIA_BBOX, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`OpenSky returned ${response.status}`);

  const data = await response.json();
  const states = Array.isArray(data?.states) ? data.states : [];
  const flights: Flight[] = [];

  for (const state of states) {
    if (state?.[8] === true) continue;
    const flight = stateToFlight(state);
    if (flight) flights.push(flight);
  }
  return flights;
}

function responseFor(flights: Flight[], source: string, error?: string) {
  // Aviationstack's live endpoint does not provide a trustworthy military/private
  // classifier. Do not invent one: keep live aircraft in Commercial.
  const commercial_flights = flights;
  return {
    commercial_flights,
    private_flights: [] as Flight[],
    private_jets: [] as Flight[],
    military_flights: [] as Flight[],
    gps_jamming: [],
    total: commercial_flights.length,
    source,
    providers: {
      aviationstack: source === "aviationstack-live" ? flights.length : 0,
      opensky: source === "opensky-live" ? flights.length : 0,
      authenticated: Boolean(process.env.AVIATIONSTACK_ACCESS_KEY || (process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET)),
    },
    timestamp: new Date().toISOString(),
    ...(error ? { error } : {}),
  };
}

export async function GET() {
  try {
    // Use Aviationstack when its key is configured. This gives OSIRIS global
    // real-time flight positions instead of the previous India-only OpenSky box.
    if (process.env.AVIATIONSTACK_ACCESS_KEY) {
      try {
        const flights = await fetchAviationstack();
        return NextResponse.json(responseFor(flights, "aviationstack-live"), {
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
        });
      } catch (aviationError) {
        console.error("Aviationstack failed; trying OpenSky fallback:", aviationError);
      }
    }

    const flights = await fetchOpenSky();
    return NextResponse.json(responseFor(flights, "opensky-live"), {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("LIVE FLIGHT API ERROR:", error);
    return NextResponse.json(
      responseFor([], "flight-provider-error", "Live flight provider unavailable"),
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
