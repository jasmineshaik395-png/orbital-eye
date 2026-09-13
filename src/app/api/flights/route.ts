import { NextResponse } from "next/server";

export const maxDuration = 60;

type Flight = {
  hex: string;
  flight: string;
  registration?: string;
  type?: string;
  origin_country?: string;

  lat: number;
  lon: number;

  alt_baro: number;
  alt_geom?: number;

  gs: number;
  track: number;

  squawk?: string;
  category_os?: number;

  on_ground?: boolean;

  source?: string;
  demo?: boolean;
};

type OpenSkyState = any[];

const CACHE_TTL = 20_000;

let cachedFlights: {
  data: Flight[];
  timestamp: number;
} | null = null;

let lastOpenSkyRequest = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ---------------------------------------------------------
   OPEN SKY
--------------------------------------------------------- */

async function fetchOpenSky(): Promise<Flight[]> {
  const now = Date.now();

  // Anonymous OpenSky should not be polled continuously.
  if (now - lastOpenSkyRequest < 10_000) {
    return cachedFlights?.data ?? [];
  }

  lastOpenSkyRequest = now;

  // India + surrounding South Asia.
  // Smaller bounding boxes cost fewer OpenSky credits.
  const url =
    "https://opensky-network.org/api/states/all" +
    "?lamin=5" +
    "&lomin=65" +
    "&lamax=37" +
    "&lomax=100" +
    "&extended=1";

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Orbital-Eye/1.0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.log(
        `OpenSky returned ${response.status}: ${response.statusText}`
      );
      return [];
    }

    const data = await response.json();

    const states: OpenSkyState[] = Array.isArray(data?.states)
      ? data.states
      : [];

    if (states.length === 0) {
      console.log("OpenSky returned 0 aircraft");
      return [];
    }

    const flights: Flight[] = states
      .filter((s) => {
        const lat = Number(s?.[6]);
        const lon = Number(s?.[5]);

        return (
          Number.isFinite(lat) &&
          Number.isFinite(lon) &&
          lat >= -90 &&
          lat <= 90 &&
          lon >= -180 &&
          lon <= 180
        );
      })
      .map((s) => {
        const altitudeMeters = Number(s?.[7] ?? 0);
        const speedMs = Number(s?.[9] ?? 0);

        return {
          hex: String(s?.[0] ?? "").toUpperCase(),

          flight: String(s?.[1] ?? "UNKNOWN").trim(),

          origin_country: String(s?.[2] ?? "Unknown"),

          lon: Number(s?.[5]),
          lat: Number(s?.[6]),

          // meters -> feet
          alt_baro: altitudeMeters * 3.28084,

          // m/s -> knots
          gs: speedMs * 1.94384,

          track: Number(s?.[10] ?? 0),

          squawk: s?.[14] ? String(s[14]) : undefined,

          category_os:
            s?.[17] !== null && s?.[17] !== undefined
              ? Number(s[17])
              : undefined,

          on_ground: Boolean(s?.[8]),

          source: "opensky",
          demo: false,
        };
      })
      .filter((f) => !f.on_ground);

    console.log(`OpenSky aircraft received: ${flights.length}`);

    return flights;
  } catch (error) {
    console.error("OpenSky error:", error);
    return [];
  }
}

/* ---------------------------------------------------------
   ADSB.FI FALLBACK
--------------------------------------------------------- */

async function fetchAdsbFi(): Promise<Flight[]> {
  try {
    const url =
      "https://opendata.adsb.fi/api/v2/lat/20/lon/78/dist/250";

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Orbital-Eye/1.0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.log(`adsb.fi returned ${response.status}`);
      return [];
    }

    const data = await response.json();

    const aircraft = Array.isArray(data?.aircraft)
      ? data.aircraft
      : [];

    return aircraft
      .filter((a: any) => {
        const lat = Number(a?.lat);
        const lon = Number(a?.lon);

        return (
          Number.isFinite(lat) &&
          Number.isFinite(lon)
        );
      })
      .map((a: any): Flight => ({
        hex: String(a?.hex ?? "").toUpperCase(),

        flight: String(
          a?.flight ??
          a?.callsign ??
          "UNKNOWN"
        ).trim(),

        registration: a?.r
          ? String(a.r)
          : undefined,

        type: a?.t
          ? String(a.t)
          : undefined,

        origin_country: "Unknown",

        lat: Number(a.lat),
        lon: Number(a.lon),

        alt_baro:
          Number(a?.alt_baro ?? a?.altitude ?? 0),

        gs:
          Number(a?.gs ?? a?.speed ?? 0),

        track:
          Number(a?.track ?? a?.heading ?? 0),

        squawk: a?.squawk
          ? String(a.squawk)
          : undefined,

        on_ground: Boolean(a?.ground),

        source: "adsb.fi",
        demo: false,
      }))
      .filter((f) => !f.on_ground);
  } catch (error) {
    console.error("adsb.fi error:", error);
    return [];
  }
}

/* ---------------------------------------------------------
   DEMO FALLBACK
   ---------------------------------------------------------

   IMPORTANT:
   These are demonstration positions, NOT live aircraft.
   They are used only when live providers return zero data,
   so the Expo interface does not remain empty.
--------------------------------------------------------- */

function getDemoFlights(): Flight[] {
  return [
    {
      hex: "DEMO001",
      flight: "IGO-DEMO1",
      registration: "VT-DEMO",
      type: "A320",
      origin_country: "India",
      lat: 13.0827,
      lon: 80.2707,
      alt_baro: 31000,
      gs: 445,
      track: 325,
      squawk: "1001",
      category_os: 4,
      on_ground: false,
      source: "demo",
      demo: true,
    },

    {
      hex: "DEMO002",
      flight: "AIC-DEMO2",
      registration: "VT-DEMO2",
      type: "A321",
      origin_country: "India",
      lat: 12.9716,
      lon: 77.5946,
      alt_baro: 28000,
      gs: 430,
      track: 55,
      squawk: "1002",
      category_os: 4,
      on_ground: false,
      source: "demo",
      demo: true,
    },

    {
      hex: "DEMO003",
      flight: "AXB-DEMO3",
      registration: "VT-DEMO3",
      type: "A320",
      origin_country: "India",
      lat: 17.385,
      lon: 78.4867,
      alt_baro: 33000,
      gs: 455,
      track: 250,
      squawk: "1003",
      category_os: 4,
      on_ground: false,
      source: "demo",
      demo: true,
    },

    {
      hex: "DEMO004",
      flight: "IGO-DEMO4",
      registration: "VT-DEMO4",
      type: "A320",
      origin_country: "India",
      lat: 16.5062,
      lon: 80.648,
      alt_baro: 24000,
      gs: 410,
      track: 315,
      squawk: "1004",
      category_os: 4,
      on_ground: false,
      source: "demo",
      demo: true,
    },

    {
      hex: "DEMO005",
      flight: "AI-DEMO5",
      registration: "VT-DEMO5",
      type: "B737",
      origin_country: "India",
      lat: 19.076,
      lon: 72.8777,
      alt_baro: 36000,
      gs: 470,
      track: 95,
      squawk: "1005",
      category_os: 4,
      on_ground: false,
      source: "demo",
      demo: true,
    },

    {
      hex: "DEMO006",
      flight: "UK-DEMO6",
      registration: "VT-DEMO6",
      type: "A321",
      origin_country: "India",
      lat: 22.5726,
      lon: 88.3639,
      alt_baro: 30000,
      gs: 440,
      track: 180,
      squawk: "1006",
      category_os: 4,
      on_ground: false,
      source: "demo",
      demo: true,
    },

    {
      hex: "DEMO007",
      flight: "IGO-DEMO7",
      registration: "VT-DEMO7",
      type: "A320",
      origin_country: "India",
      lat: 15.9129,
      lon: 79.74,
      alt_baro: 27000,
      gs: 420,
      track: 35,
      squawk: "1007",
      category_os: 4,
      on_ground: false,
      source: "demo",
      demo: true,
    },

    {
      hex: "DEMO008",
      flight: "AIC-DEMO8",
      registration: "VT-DEMO8",
      type: "B787",
      origin_country: "India",
      lat: 28.6139,
      lon: 77.209,
      alt_baro: 39000,
      gs: 490,
      track: 140,
      squawk: "1008",
      category_os: 6,
      on_ground: false,
      source: "demo",
      demo: true,
    },
  ];
}

/* ---------------------------------------------------------
   CLASSIFICATION
--------------------------------------------------------- */

function classifyFlights(flights: Flight[]) {
  const commercial: Flight[] = [];
  const privateFlights: Flight[] = [];
  const privateJets: Flight[] = [];
  const military: Flight[] = [];
  const gpsJamming: Flight[] = [];

  for (const flight of flights) {
    const callsign = (
      flight.flight ||
      ""
    ).toUpperCase();

    const country = (
      flight.origin_country ||
      ""
    ).toUpperCase();

    const type = (
      flight.type ||
      ""
    ).toUpperCase();

    // Military indicators
    const militaryMatch =
      callsign.includes("MIL") ||
      callsign.includes("AF") ||
      callsign.includes("RCH") ||
      callsign.includes("FORTE") ||
      callsign.includes("NAVY") ||
      callsign.includes("ARMY") ||
      country.includes("MILITARY");

    if (militaryMatch) {
      military.push(flight);
      continue;
    }

    // Private jet indicators
    const privateJetMatch =
      type.includes("GULFSTREAM") ||
      type.includes("FALCON") ||
      type.includes("CITATION") ||
      type.includes("LEARJET") ||
      type.includes("CHALLENGER");

    if (privateJetMatch) {
      privateJets.push(flight);
      continue;
    }

    // Commercial airline indicators
    const commercialMatch =
      callsign.startsWith("IGO") ||
      callsign.startsWith("AIC") ||
      callsign.startsWith("AXB") ||
      callsign.startsWith("VTI") ||
      callsign.startsWith("SEJ") ||
      callsign.startsWith("AKJ") ||
      callsign.startsWith("UAE") ||
      callsign.startsWith("QTR") ||
      callsign.startsWith("SIA") ||
      callsign.startsWith("BAW") ||
      callsign.startsWith("THA") ||
      callsign.startsWith("AI") ||
      callsign.startsWith("UK");

    if (commercialMatch) {
      commercial.push(flight);
      continue;
    }

    // General aircraft → commercial for map visibility
    commercial.push(flight);
  }

  return {
    commercial,
    privateFlights,
    privateJets,
    military,
    gpsJamming,
  };
}

/* ---------------------------------------------------------
   API
--------------------------------------------------------- */

export async function GET() {
  try {
    // Use short server-side cache
    if (
      cachedFlights &&
      Date.now() - cachedFlights.timestamp < CACHE_TTL
    ) {
      const classified = classifyFlights(
        cachedFlights.data
      );

      return NextResponse.json(
        {
          commercial_flights:
            classified.commercial,

          private_flights:
            classified.privateFlights,

          private_jets:
            classified.privateJets,

          military_flights:
            classified.military,

          gps_jamming:
            classified.gpsJamming,

          total: cachedFlights.data.length,

          source:
            cachedFlights.data[0]?.source ??
            "cache",

          providers: {
            adsbfi_mil: 0,
            adsbfi_regional: 0,

            opensky:
              cachedFlights.data.filter(
                (f) => f.source === "opensky"
              ).length,

            opensky_auth:
              Boolean(
                process.env.OPENSKY_CLIENT_ID &&
                process.env.OPENSKY_CLIENT_SECRET
              ),

            opensky_age_s: Math.round(
              (Date.now() -
                cachedFlights.timestamp) /
                1000
            ),
          },

          timestamp:
            new Date().toISOString(),
        },
        {
          headers: {
            "Cache-Control":
              "public, max-age=10, stale-while-revalidate=30",
          },
        }
      );
    }

    /* ---------------------------------------------
       1. Try OpenSky
    --------------------------------------------- */

    let flights = await fetchOpenSky();

    let source = "opensky";

    /* ---------------------------------------------
       2. Try ADSB.FI if OpenSky empty
    --------------------------------------------- */

    if (flights.length === 0) {
      await sleep(500);

      const adsbFlights =
        await fetchAdsbFi();

      if (adsbFlights.length > 0) {
        flights = adsbFlights;
        source = "adsb.fi";
      }
    }

    /* ---------------------------------------------
       3. DEMO FALLBACK
    --------------------------------------------- */

    if (flights.length === 0) {
      console.log(
        "No live aircraft available. Using demo flight data."
      );

      flights = getDemoFlights();
      source = "demo-fallback";
    }

    /* ---------------------------------------------
       Cache
    --------------------------------------------- */

    cachedFlights = {
      data: flights,
      timestamp: Date.now(),
    };

    const classified =
      classifyFlights(flights);

    const openskyCount =
      flights.filter(
        (f) => f.source === "opensky"
      ).length;

    const adsbCount =
      flights.filter(
        (f) => f.source === "adsb.fi"
      ).length;

    const demoCount =
      flights.filter(
        (f) => f.demo === true
      ).length;

    return NextResponse.json(
      {
        commercial_flights:
          classified.commercial,

        private_flights:
          classified.privateFlights,

        private_jets:
          classified.privateJets,

        military_flights:
          classified.military,

        gps_jamming:
          classified.gpsJamming,

        total: flights.length,

        source,

        providers: {
          adsbfi_mil: 0,

          adsbfi_regional:
            adsbCount,

          opensky:
            openskyCount,

          opensky_auth:
            Boolean(
              process.env.OPENSKY_CLIENT_ID &&
              process.env.OPENSKY_CLIENT_SECRET
            ),

          opensky_age_s: null,

          demo:
            demoCount,
        },

        timestamp:
          new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=10, stale-while-revalidate=30",
        },
      }
    );
  } catch (error) {
    console.error(
      "Flight API fatal error:",
      error
    );

    // Even if everything fails, return demo data
    // so the Expo interface doesn't become empty.
    const demoFlights =
      getDemoFlights();

    const classified =
      classifyFlights(demoFlights);

    return NextResponse.json(
      {
        commercial_flights:
          classified.commercial,

        private_flights:
          classified.privateFlights,

        private_jets:
          classified.privateJets,

        military_flights:
          classified.military,

        gps_jamming:
          classified.gpsJamming,

        total: demoFlights.length,

        source: "demo-fallback",

        providers: {
          adsbfi_mil: 0,
          adsbfi_regional: 0,
          opensky: 0,
          opensky_auth: false,
          opensky_age_s: null,
          demo: demoFlights.length,
        },

        timestamp:
          new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}
