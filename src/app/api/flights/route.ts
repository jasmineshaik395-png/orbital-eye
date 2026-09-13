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

function aviationstackToFlight(row: any): Flight | null {
  const live = row?.live;

  // A flight can be returned by Aviationstack while its live position is
  // unavailable. Such a record cannot be placed on a map, so skip it.
  const lat = Number(live?.latitude);
  const lng = Number(live?.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const flightNumber =
    row?.flight?.icao || row?.flight?.iata || row?.flight?.number || "";
  const callsign = cleanCallsign(flightNumber);

  return {
    icao24: String(
      row?.aircraft?.icao24 ??
      row?.aircraft?.registration ??
      row?.flight?.icao ??
      row?.flight?.iata ??
      flightNumber
    ),
    callsign,
    lat,
    lng,
    alt: Math.round(numberOrZero(live?.altitude)),
    speed_knots: knotsFromKmh(live?.speed_horizontal),
    heading: numberOrZero(live?.direction),
    registration: row?.aircraft?.registration
      ? String(row.aircraft.registration)
      : undefined,
    model:
      row?.aircraft?.iata ||
      row?.aircraft?.icao ||
      row?.aircraft?.type ||
      undefined,
    category: "commercial",
    source: "aviationstack",
  };
}

async function fetchAviationstackPage(
  key: string,
  offset: number
): Promise<{ flights: Flight[]; apiRows: number; total: number }> {
  const params = new URLSearchParams({
    access_key: key,
    flight_status: "active",
    limit: "100",
    offset: String(offset),
  });

  const response = await fetch(`${AVIATIONSTACK_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Aviationstack returned ${response.status}`);
  }

  const json = await response.json();

  if (json?.error) {
    throw new Error(
      `Aviationstack API error: ${json.error.message ?? "unknown error"}`
    );
  }

  const rows = Array.isArray(json?.data) ? json.data : [];
  const flights = rows
    .map(aviationstackToFlight)
    .filter(Boolean) as Flight[];

  return {
    flights,
    apiRows: rows.length,
    total: Number(json?.pagination?.total ?? rows.length),
  };
}

async function fetchAviationstack(): Promise<{
  flights: Flight[];
  apiRows: number;
  pagesChecked: number;
  total: number;
}> {
  const key = process.env.AVIATIONSTACK_ACCESS_KEY;

  if (!key) {
    throw new Error("AVIATIONSTACK_ACCESS_KEY is not configured");
  }

  const allFlights: Flight[] = [];
  let apiRows = 0;
  let total = 0;
  let pagesChecked = 0;

  // Usually the first page is enough. If it contains no live coordinates,
  // check only two more pages. This avoids making dozens/hundreds of API calls.
  for (let page = 0; page < 3; page++) {
    const result = await fetchAviationstackPage(key, page * 100);

    pagesChecked++;
    apiRows += result.apiRows;
    total = result.total;
    allFlights.push(...result.flights);

    // Stop as soon as we have aircraft positions.
    if (allFlights.length >= 20) break;

    // Nothing more to check.
    if (result.apiRows < 100) break;
  }

  // Remove duplicate aircraft records.
  const unique = Array.from(
    new Map(allFlights.map((flight) => [flight.icao24, flight])).values()
  );

  return {
    flights: unique,
    apiRows,
    pagesChecked,
    total,
  };
}

export async function GET() {
  try {
    const result = await fetchAviationstack();

    return NextResponse.json(
      {
        commercial_flights: result.flights,
        private_flights: [],
        private_jets: [],
        military_flights: [],
        gps_jamming: [],
        total: result.flights.length,
        source: "aviationstack-live",
        providers: {
          aviationstack: result.flights.length,
          opensky: 0,
          authenticated: Boolean(process.env.AVIATIONSTACK_ACCESS_KEY),
        },
        diagnostics: {
          api_rows_received: result.apiRows,
          live_position_rows: result.flights.length,
          pages_checked: result.pagesChecked,
          api_total_active: result.total,
        },
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("AVIATIONSTACK FLIGHT API ERROR:", error);

    return NextResponse.json(
      {
        commercial_flights: [],
        private_flights: [],
        private_jets: [],
        military_flights: [],
        gps_jamming: [],
        total: 0,
        source: "aviationstack-error",
        providers: {
          aviationstack: 0,
          opensky: 0,
          authenticated: Boolean(process.env.AVIATIONSTACK_ACCESS_KEY),
        },
        diagnostics: {
          error:
            error instanceof Error ? error.message : "Unknown Aviationstack error",
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }
}
