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

const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

const OPENSKY_STATES_URL =
  "https://opensky-network.org/api/states/all?extended=1";

// India + nearby airspace.
// Remove this bbox if you want global coverage.
const INDIA_BBOX =
  "&lamin=6&lomin=67&lamax=37&lomax=98";

async function getOpenSkyToken(): Promise<string | null> {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  try {
    const response = await fetch(OPENSKY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("OpenSky token error:", response.status);
      return null;
    }

    const data = await response.json();
    return data.access_token ?? null;
  } catch (error) {
    console.error("OpenSky token request failed:", error);
    return null;
  }
}

function knotsFromMs(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.round(value * 1.94384);
}

function feetFromMeters(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.round(value * 3.28084);
}

function cleanCallsign(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

/*
 * OpenSky state vector:
 *
 * 0  = icao24
 * 1  = callsign
 * 2  = origin country
 * 3  = time position
 * 4  = last contact
 * 5  = longitude
 * 6  = latitude
 * 7  = barometric altitude
 * 8  = on ground
 * 9  = velocity m/s
 * 10 = true track
 * 11 = vertical rate
 * 12 = sensors
 * 13 = geometric altitude
 * 14 = squawk
 * 15 = spi
 * 16 = position source
 * 17 = aircraft category
 */

function stateToFlight(state: any[]): Flight | null {
  const icao24 = String(state?.[0] ?? "").trim();

  const lat = Number(state?.[6]);
  const lng = Number(state?.[5]);

  if (!icao24 || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    icao24,
    callsign: cleanCallsign(state?.[1]),
    lat,
    lng,
    alt: feetFromMeters(state?.[7]),
    speed_knots: knotsFromMs(state?.[9]),
    heading:
      typeof state?.[10] === "number" && Number.isFinite(state[10])
        ? state[10]
        : 0,
    category: String(state?.[17] ?? ""),
    source: "opensky",
  };
}

/*
 * OpenSky's aircraft category is NOT a reliable military/non-military
 * identifier by itself.
 *
 * These categories are useful for separating obvious aircraft types,
 * but military identification should come from a dedicated provider
 * or known aircraft database.
 */
function classifyFlight(flight: Flight) {
  const category = flight.category ?? "";

  // OpenSky categories:
  // 14 = UAV
  // 15 = space/trans-atmospheric
  //
  // Keep these separate rather than incorrectly calling every
  // high-performance aircraft "military".
  if (category === "14" || category === "15") {
    return "military";
  }

  // High-performance category.
  // Do NOT automatically classify it as military.
  if (category === "7") {
    return "private";
  }

  return "commercial";
}

async function fetchOpenSky(): Promise<{
  flights: Flight[];
  authenticated: boolean;
}> {
  const token = await getOpenSkyToken();

  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = OPENSKY_STATES_URL + INDIA_BBOX;

  const response = await fetch(url, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OpenSky returned ${response.status}`);
  }

  const data = await response.json();

  const states = Array.isArray(data?.states) ? data.states : [];

  const flights: Flight[] = [];

  for (const state of states) {
    const flight = stateToFlight(state);

    if (!flight) continue;

    // Ignore aircraft currently reported on the ground.
    if (state?.[8] === true) continue;

    flights.push(flight);
  }

  return {
    flights,
    authenticated: Boolean(token),
  };
}

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    const result = await fetchOpenSky();

    const commercial_flights: Flight[] = [];
    const private_flights: Flight[] = [];
    const private_jets: Flight[] = [];
    const military_flights: Flight[] = [];

    for (const flight of result.flights) {
      const type = classifyFlight(flight);

      if (type === "military") {
        military_flights.push(flight);
      } else if (type === "private") {
        private_flights.push(flight);
      } else {
        commercial_flights.push(flight);
      }
    }

    return NextResponse.json(
      {
        commercial_flights,
        private_flights,
        private_jets,

        // This is intentionally only aircraft that can be
        // defensibly classified from the live state data.
        military_flights,

        gps_jamming: [],

        total:
          commercial_flights.length +
          private_flights.length +
          private_jets.length +
          military_flights.length,

        source: "opensky-live",
        providers: {
          opensky: result.flights.length,
          authenticated: result.authenticated,
        },

        timestamp,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("LIVE FLIGHT API ERROR:", error);

    return NextResponse.json(
      {
        commercial_flights: [],
        private_flights: [],
        private_jets: [],
        military_flights: [],
        gps_jamming: [],
        total: 0,
        source: "opensky-error",
        providers: {
          opensky: 0,
          authenticated: Boolean(
            process.env.OPENSKY_CLIENT_ID &&
              process.env.OPENSKY_CLIENT_SECRET
          ),
        },
        timestamp,
        error: "Live flight provider unavailable",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
