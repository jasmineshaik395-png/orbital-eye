import { NextResponse } from 'next/server';
import { stealthFetch } from '@/lib/stealthFetch';

export const maxDuration = 60;

/* ============================================================
   AVIATION REGIONS
   ============================================================ */

const REGIONS = [
  // North America
  { lat: 39.8, lon: -98.5 },
  { lat: 41.0, lon: -74.0 },
  { lat: 33.0, lon: -84.0 },
  { lat: 42.0, lon: -88.0 },
  { lat: 30.0, lon: -97.0 },
  { lat: 47.0, lon: -122.0 },
  { lat: 34.0, lon: -118.0 },
  { lat: 45.0, lon: -73.0 },
  { lat: 49.0, lon: -97.0 },

  // Europe
  { lat: 50.0, lon: 15.0 },
  { lat: 51.5, lon: -1.0 },
  { lat: 47.0, lon: 2.0 },
  { lat: 40.0, lon: -4.0 },
  { lat: 42.0, lon: 13.0 },
  { lat: 60.0, lon: 15.0 },
  { lat: 52.0, lon: 22.0 },
  { lat: 39.0, lon: 35.0 },

  // Middle East & South Asia
  { lat: 25.0, lon: 45.0 },
  { lat: 22.0, lon: 78.0 },

  // East Asia
  { lat: 35.0, lon: 105.0 },
  { lat: 35.0, lon: 136.0 },
  { lat: 37.0, lon: 127.0 },
  { lat: 13.0, lon: 100.0 },
  { lat: 1.0, lon: 104.0 },

  // Australia
  { lat: -25.0, lon: 133.0 },
  { lat: -33.0, lon: 151.0 },

  // Africa
  { lat: 0.0, lon: 20.0 },
  { lat: -26.0, lon: 28.0 },

  // South America
  { lat: -15.0, lon: -60.0 },
  { lat: -23.0, lon: -46.0 },
];

const HELI_TYPES = new Set([
  'R22', 'R44', 'R66',
  'B06', 'B06T', 'B204', 'B205', 'B206', 'B212', 'B222',
  'B230', 'B407', 'B412', 'B427', 'B429', 'B430', 'B505',
  'B525',
  'AS32', 'AS35', 'AS50', 'AS55', 'AS65',
  'EC20', 'EC25', 'EC30', 'EC35', 'EC45', 'EC55', 'EC75',
  'H125', 'H130', 'H135', 'H145', 'H155', 'H160',
  'H175', 'H215', 'H225',
  'S55', 'S58', 'S61', 'S64', 'S70', 'S76', 'S92',
  'A109', 'A119', 'A139', 'A169', 'A189', 'AW09',
  'MD52', 'MD60', 'MDHI', 'MD90', 'NOTR',
  'B47G', 'HUEY', 'GAMA', 'CABR', 'EXE',
]);

const PRIVATE_JET_TYPES = new Set([
  'G150', 'G200', 'G280', 'GLEX', 'G500', 'G550', 'G600',
  'G650', 'G700',
  'GLF2', 'GLF3', 'GLF4', 'GLF5', 'GLF6',
  'GL5T', 'GL7T', 'GV', 'GIV',
  'CL30', 'CL35', 'CL60', 'BD70', 'BD10',
  'C25A', 'C25B', 'C25C', 'C500', 'C510', 'C525',
  'C550', 'C560', 'C56X', 'C680', 'C700', 'C750',
  'E35L', 'E50P', 'E55P', 'E545', 'E550',
  'FA50', 'FA7X', 'FA8X', 'F900', 'F2TH',
  'LJ35', 'LJ40', 'LJ45', 'LJ60', 'LJ70', 'LJ75',
  'PC12', 'PC24', 'TBM7', 'TBM8', 'TBM9',
  'PRM1', 'SF50', 'EA50', 'VLJ',
]);

const MILITARY_INDICATORS = new Set([
  'C17', 'C5M', 'C130', 'C30J',
  'KC10', 'KC46', 'KC35',
  'E3CF', 'E3TF', 'E8A',
  'B1B', 'B2', 'B52',
  'F16', 'F15', 'F18', 'F22', 'F35', 'A10', 'F117',
  'RC135', 'E6B', 'P8A', 'P3',
  'MQ9', 'RQ4', 'U2', 'EP3', 'RC12',
  'V22', 'CH47', 'UH60', 'AH64', 'AH1Z', 'MV22',
  'EUFI', 'RFAL', 'TORD', 'TYP', 'GR4',
]);

const AIRLINER_TYPES = new Set([
  'A319', 'A320', 'A321',
  'A332', 'A333', 'A339', 'A343', 'A359', 'A388',
  'B737', 'B738', 'B739', 'B38M', 'B39M',
  'B752', 'B753', 'B763', 'B764',
  'B772', 'B77L', 'B77W',
  'B788', 'B789', 'B78X',
  'E170', 'E175', 'E190', 'E195',
  'CRJ7', 'CRJ9',
  'AT43', 'AT72', 'DH8D',
]);

const BIZJET_OPERATORS = new Set([
  'EJA', 'EJM', 'NJE', 'LXJ', 'FJO', 'VJT',
  'XOJ', 'JTL', 'WUP', 'GAJ', 'DPJ', 'CLY', 'TWY',
]);

const AIRLINE_CODE_RE = /^([A-Z]{3})\d/;
const CALLSIGN_RE = /^[A-Z0-9]{3,8}$/;

const JET_CRUISE_ALT_M = 8500;
const JET_CRUISE_KTS = 300;

const ADSB_MAX_DIST = 250;
const ADSBFI_BASE = 'https://opendata.adsb.fi/api/v2';
const ADSBFI_GAP_MS = 1100;

/* ============================================================
   ADSB.FI REGIONAL FALLBACK
   ============================================================ */

async function fetchAdsbFiRegion(
  lat: number,
  lon: number
): Promise<any[]> {
  try {
    const res = await stealthFetch(
      `${ADSBFI_BASE}/lat/${lat}/lon/${lon}/dist/${ADSB_MAX_DIST}`,
      {
        signal: AbortSignal.timeout(12000),
      }
    );

    if (res.ok) {
      const data = await res.json();
      return data.ac || [];
    }

    await res.body?.cancel();
  } catch {}

  return [];
}

/* ============================================================
   FLIGHT CLASSIFIER
   ============================================================ */

function classifyFlight(f: any) {
  const modelUpper = (f.t || '').toUpperCase();
  const flightStr = (f.flight || '').trim().toUpperCase();
  const dbFlags = f.dbFlags || 0;

  if (modelUpper === 'TWR') return null;

  const lat = f.lat;
  const lon = f.lon;

  if (lat == null || lon == null) return null;

  const callsign = flightStr || f.hex || 'UNKNOWN';

  const altRaw = f.alt_baro;

  const altMeters =
    typeof altRaw === 'number'
      ? altRaw * 0.3048
      : 0;

  const speedKnots =
    typeof f.gs === 'number'
      ? Math.round(f.gs * 10) / 10
      : null;

  const heading =
    typeof f.track === 'number'
      ? f.track
      : 0;

  const isHeli =
    HELI_TYPES.has(modelUpper) ||
    f.category_os === 8;

  const isGrounded =
    typeof altRaw === 'number' &&
    altRaw < 100;

  const isOsMilitary =
    f.category_os === 14;

  const isOsHighPerf =
    f.category_os === 7;

  const isOsLight =
    f.category_os === 2;

  const isOsHeavy =
    f.category_os === 4 ||
    f.category_os === 5 ||
    f.category_os === 6;

  const airlineMatch =
    AIRLINE_CODE_RE.exec(callsign);

  const airlineCode =
    airlineMatch
      ? airlineMatch[1]
      : '';

  const isGaCallsign =
    !airlineCode &&
    CALLSIGN_RE.test(flightStr);

  const cruisesLikeAJet =
    altMeters > JET_CRUISE_ALT_M &&
    (speedKnots ?? 0) > JET_CRUISE_KTS;

  let category:
    | 'commercial'
    | 'private'
    | 'jet'
    | 'military' = 'commercial';

  if (
    isOsMilitary ||
    dbFlags & 1 ||
    MILITARY_INDICATORS.has(modelUpper) ||
    /^(RCH|KING|DUKE|EVAC|JAKE|REACH|CONVOY)\d/i.test(
      f.flight || ''
    )
  ) {
    category = 'military';
  }

  else if (
    AIRLINER_TYPES.has(modelUpper) ||
    isOsHeavy
  ) {
    category = 'commercial';
  }

  else if (
    BIZJET_OPERATORS.has(airlineCode) ||
    PRIVATE_JET_TYPES.has(modelUpper) ||
    isOsHighPerf ||
    (isGaCallsign && cruisesLikeAJet)
  ) {
    category = 'jet';
  }

  else if (
    isGaCallsign ||
    isOsLight
  ) {
    category = 'private';
  }

  return {
    callsign,

    lat:
      Math.round(lat * 100000) / 100000,

    lng:
      Math.round(lon * 100000) / 100000,

    alt:
      Math.round(altMeters),

    heading:
      Math.round(heading),

    speed_knots:
      speedKnots,

    model:
      f.t || 'Unknown',

    icao24:
      f.hex || '',

    registration:
      f.r || 'N/A',

    squawk:
      f.squawk || '',

    airline_code:
      airlineCode,

    aircraft_category:
      isHeli ? 'heli' : 'plane',

    category,

    grounded:
      isGrounded,

    nac_p:
      f.nac_p,

    type:
      'flight',
  };
}

/* ============================================================
   CACHE
   ============================================================ */

let cachedData: any = null;
let lastFetchTime = 0;

const CACHE_TTL = 90000;

/*
 * Authenticated OpenSky:
 * approximately one request every 90 seconds.
 *
 * Anonymous OpenSky:
 * use a much longer interval because of the smaller
 * anonymous allowance.
 */
const hasOpenSkyCreds = () =>
  Boolean(
    process.env.OPENSKY_CLIENT_ID &&
    process.env.OPENSKY_CLIENT_SECRET
  );

const openSkyInterval = () =>
  hasOpenSkyCreds()
    ? 90000
    : 900000;

let osSnapshot: any[] = [];
let osSnapshotTime = 0;

let fetchPromise:
  Promise<any> | null = null;

let openSkyCooldownUntil = 0;

const OPENSKY_COOLDOWN =
  15 * 60 * 1000;

/* ============================================================
   OPENSKY TOKEN
   ============================================================ */

let osToken: string | null = null;
let osTokenExpiry = 0;

async function getOpenSkyToken(): Promise<string | null> {
  const id =
    process.env.OPENSKY_CLIENT_ID;

  const secret =
    process.env.OPENSKY_CLIENT_SECRET;

  if (!id || !secret) {
    return null;
  }

  if (
    osToken &&
    Date.now() < osTokenExpiry
  ) {
    return osToken;
  }

  try {
    const res = await fetch(
      'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
        },

        body: new URLSearchParams({
          grant_type:
            'client_credentials',

          client_id: id,

          client_secret: secret,
        }),

        signal:
          AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      console.warn(
        '[OSIRIS] OpenSky token failed:',
        res.status
      );

      return null;
    }

    const data =
      await res.json();

    if (!data.access_token) {
      console.warn(
        '[OSIRIS] OpenSky token response missing access_token'
      );

      return null;
    }

    osToken =
      data.access_token;

    osTokenExpiry =
      Date.now() +
      ((data.expires_in || 1800) - 60) *
        1000;

    return osToken;
  }

  catch (e) {
    console.warn(
      '[OSIRIS] OpenSky token error:',
      e
    );

    return null;
  }
}

/* ============================================================
   DEDUPLICATION
   ============================================================ */

function ingestAc(
  raw: any[],
  into: any[],
  seen: Set<string>
) {
  for (const ac of raw) {
    const hex =
      (ac.hex || '')
        .toLowerCase()
        .trim();

    if (
      hex &&
      !seen.has(hex)
    ) {
      seen.add(hex);
      into.push(ac);
    }
  }
}

/* ============================================================
   OPENSKY STATE VECTOR CONVERTER
   ============================================================ */

function convertOpenSkyStates(
  states: any[]
): any[] {
  return states
    .filter(
      (s: any[]) =>
        Array.isArray(s) &&
        s.length >= 11 &&
        s[0] &&
        s[5] != null &&
        s[6] != null
    )
    .map((s: any[]) => ({
      /*
       * OpenSky state-vector fields:
       *
       * 0  ICAO24
       * 1  callsign
       * 5  longitude
       * 6  latitude
       * 7  barometric altitude (meters)
       * 9  velocity (m/s)
       * 10 true track
       * 14 squawk
       * 17 emitter category when extended=1
       */

      hex:
        s[0],

      flight:
        typeof s[1] === 'string'
          ? s[1].trim()
          : '',

      lon:
        typeof s[5] === 'number'
          ? s[5]
          : null,

      lat:
        typeof s[6] === 'number'
          ? s[6]
          : null,

      /*
       * Convert meters → feet because the rest of the
       * application expects alt_baro in feet.
       */
      alt_baro:
        typeof s[7] === 'number'
          ? s[7] * 3.28084
          : null,

      /*
       * Convert m/s → knots.
       */
      gs:
        typeof s[9] === 'number'
          ? s[9] * 1.94384
          : null,

      track:
        typeof s[10] === 'number'
          ? s[10]
          : 0,

      squawk:
        s[14] || '',

      category_os:
        s[17],

      /*
       * OpenSky state vectors normally do not contain
       * registration or aircraft model.
       */
      r:
        'N/A',

      t:
        '',
    }));
}

/* ============================================================
   FETCH OPENSKY
   ============================================================ */

async function fetchOpenSky(
  token: string | null
): Promise<any[]> {

  const osInit: RequestInit =
    token
      ? {
          signal:
            AbortSignal.timeout(30000),

          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      : {
          signal:
            AbortSignal.timeout(30000),
        };

  /*
   * PRIMARY:
   *
   * India + surrounding South Asia.
   *
   * This is much smaller than requesting the entire
   * global aircraft state database.
   */
  const INDIA_URL =
    'https://opensky-network.org/api/states/all' +
    '?lamin=5' +
    '&lomin=65' +
    '&lamax=37' +
    '&lomax=100' +
    '&extended=1';

  try {
    console.log(
      '[OSIRIS] Requesting OpenSky India/South Asia data...'
    );

    const res =
      await stealthFetch(
        INDIA_URL,
        osInit
      );

    if (res.status === 429) {
      console.warn(
        '[OSIRIS] OpenSky India request returned 429'
      );

      openSkyCooldownUntil =
        Date.now() +
        OPENSKY_COOLDOWN;

      await res.body?.cancel();

      return [];
    }

    if (res.ok) {
      const data =
        await res.json();

      const states =
        Array.isArray(data.states)
          ? data.states
          : [];

      const converted =
        convertOpenSkyStates(states);

      console.log(
        `[OSIRIS] OpenSky India returned ${converted.length} aircraft`
      );

      /*
       * IMPORTANT:
       *
       * Accept even a small valid result.
       *
       * The old code required >100 aircraft and discarded
       * smaller valid responses.
       */
      if (converted.length > 0) {
        return converted;
      }
    }

    else {
      console.warn(
        '[OSIRIS] OpenSky India returned',
        res.status
      );

      await res.body?.cancel();
    }
  }

  catch (e) {
    console.warn(
      '[OSIRIS] OpenSky India request error:',
      e
    );
  }

  /*
   * SECONDARY:
   *
   * If India query fails, try global OpenSky.
   *
   * This is only a fallback, not the normal request.
   */
  try {
    console.log(
      '[OSIRIS] India query empty — trying global OpenSky...'
    );

    const GLOBAL_URL =
      'https://opensky-network.org/api/states/all?extended=1';

    const res =
      await stealthFetch(
        GLOBAL_URL,
        osInit
      );

    if (res.status === 429) {
      console.warn(
        '[OSIRIS] Global OpenSky returned 429'
      );

      openSkyCooldownUntil =
        Date.now() +
        OPENSKY_COOLDOWN;

      await res.body?.cancel();

      return [];
    }

    if (!res.ok) {
      console.warn(
        '[OSIRIS] Global OpenSky returned',
        res.status
      );

      await res.body?.cancel();

      return [];
    }

    const data =
      await res.json();

    const states =
      Array.isArray(data.states)
        ? data.states
        : [];

    const converted =
      convertOpenSkyStates(states);

    console.log(
      `[OSIRIS] Global OpenSky returned ${converted.length} aircraft`
    );

    return converted;
  }

  catch (e) {
    console.warn(
      '[OSIRIS] Global OpenSky error:',
      e
    );

    return [];
  }
}

/* ============================================================
   GET
   ============================================================ */

export async function GET() {
  const now =
    Date.now();

  /*
   * Normal response cache.
   */
  if (
    cachedData &&
    now - lastFetchTime <
      CACHE_TTL
  ) {
    return NextResponse.json(
      cachedData,
      {
        headers: {
          'Cache-Control':
            'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  }

  /*
   * Prevent multiple simultaneous expensive requests.
   */
  if (fetchPromise) {
    try {
      const data =
        await fetchPromise;

      return NextResponse.json(
        data,
        {
          headers: {
            'Cache-Control':
              'public, s-maxage=30, stale-while-revalidate=60',
          },
        }
      );
    }

    catch {
      return NextResponse.json(
        {
          error:
            'Failed to fetch flight data',
        },
        {
          status: 500,
        }
      );
    }
  }

  const JAMMING_NACAP_THRESHOLD = 4;

  fetchPromise =
    (async () => {

      const allRaw: any[] = [];
      const seenHex =
        new Set<string>();

      let source: string;

      /* ======================================================
         OPEN SKY INTERVAL
         ====================================================== */

      const skipOpenSky =
        Date.now() <
          openSkyCooldownUntil ||
        Date.now() -
          osSnapshotTime <
          openSkyInterval();

      let token:
        string | null = null;

      if (!skipOpenSky) {
        token =
          await getOpenSkyToken();
      }

      /*
       * Military feed and OpenSky run in parallel.
       */
      const [milRes, osRes] =
        await Promise.allSettled([

          /*
           * Always get military aircraft.
           */
          stealthFetch(
            `${ADSBFI_BASE}/mil`,
            {
              signal:
                AbortSignal.timeout(15000),
            }
          ),

          /*
           * Skip OpenSky while cooldown/snapshot
           * interval is active.
           */
          skipOpenSky
            ? Promise.reject(
                new Error(
                  'OpenSky in cooldown'
                )
              )
            : fetchOpenSky(token),
        ]);

      /* ======================================================
         MILITARY FEED
         ====================================================== */

      if (
        milRes.status ===
        'fulfilled'
      ) {

        if (
          milRes.value.ok
        ) {

          try {
            const data =
              await milRes.value.json();

            ingestAc(
              data.ac || [],
              allRaw,
              seenHex
            );
          }

          catch (e) {
            console.warn(
              '[OSIRIS] adsb.fi military parse error:',
              e
            );
          }
        }

        else {
          console.warn(
            '[OSIRIS] adsb.fi military feed returned',
            milRes.value.status
          );

          await milRes.value.body?.cancel();
        }
      }

      const milCount =
        allRaw.length;

      /* ======================================================
         OPENSKY SNAPSHOT
         ====================================================== */

      if (
        osRes.status ===
        'fulfilled'
      ) {

        const states =
          osRes.value;

        /*
         * NEW:
         *
         * Any valid OpenSky aircraft can become the snapshot.
         */
        if (
          Array.isArray(states) &&
          states.length > 0
        ) {

          osSnapshot =
            states;

          osSnapshotTime =
            Date.now();

          console.log(
            `[OSIRIS] Saved ${osSnapshot.length} OpenSky aircraft`
          );
        }
      }

      else {

        console.warn(
          '[OSIRIS] OpenSky skipped/unavailable:',
          osRes.reason?.message ||
            'unknown'
        );
      }

      /*
       * Add the most recent OpenSky snapshot.
       */
      ingestAc(
        osSnapshot,
        allRaw,
        seenHex
      );

      const openSkyWorked =
        osSnapshot.length > 0;

      /* ======================================================
         REGIONAL ADSB.FI FALLBACK
         ====================================================== */

      if (!openSkyWorked) {

        source =
          'regional';

        console.warn(
          '[OSIRIS] No OpenSky snapshot — falling back to adsb.fi regional sweep'
        );

        for (
          const r of REGIONS
        ) {

          const regional =
            await fetchAdsbFiRegion(
              r.lat,
              r.lon
            );

          ingestAc(
            regional,
            allRaw,
            seenHex
          );

          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                ADSBFI_GAP_MS
              )
          );
        }

        if (
          allRaw.length === 0
        ) {
          console.error(
            '[OSIRIS] Every flight provider returned zero aircraft.'
          );
        }
      }

      else {

        source =
          hasOpenSkyCreds()
            ? 'opensky-auth'
            : 'opensky-anon';
      }

      /* ======================================================
         CLASSIFICATION
         ====================================================== */

      const commercial: any[] = [];
      const privateFl: any[] = [];
      const jets: any[] = [];
      const military: any[] = [];
      const gpsJamming: any[] = [];

      for (
        const raw of allRaw
      ) {

        const flight =
          classifyFlight(raw);

        if (!flight) {
          continue;
        }

        /*
         * GPS jamming detection.
         */
        if (
          typeof flight.nac_p ===
            'number' &&
          flight.nac_p <=
            JAMMING_NACAP_THRESHOLD &&
          !flight.grounded
        ) {

          gpsJamming.push({
            lat:
              flight.lat,

            lng:
              flight.lng,

            nac_p:
              flight.nac_p,

            callsign:
              flight.callsign,
          });
        }

        switch (
          flight.category
        ) {

          case 'military':
            military.push(
              flight
            );
            break;

          case 'jet':
            jets.push(
              flight
            );
            break;

          case 'private':
            privateFl.push(
              flight
            );
            break;

          default:
            commercial.push(
              flight
            );
        }
      }

      /* ======================================================
         RESPONSE
         ====================================================== */

      return {

        commercial_flights:
          commercial,

        private_flights:
          privateFl,

        private_jets:
          jets,

        military_flights:
          military,

        gps_jamming:
          aggregateJamming(
            gpsJamming,
            JAMMING_NACAP_THRESHOLD
          ),

        total:
          allRaw.length,

        source,

        providers: {

          adsbfi_mil:
            milCount,

          adsbfi_regional:
            openSkyWorked
              ? 0
              : Math.max(
                  0,
                  allRaw.length -
                    milCount
                ),

          opensky:
            osSnapshot.length,

          opensky_auth:
            hasOpenSkyCreds(),

          opensky_age_s:
            osSnapshotTime
              ? Math.round(
                  (
                    Date.now() -
                    osSnapshotTime
                  ) / 1000
                )
              : null,
        },

        timestamp:
          new Date().toISOString(),
      };
    })();

  /* ============================================================
     FINAL RESPONSE
     ============================================================ */

  try {

    const data =
      await fetchPromise;

    cachedData =
      data;

    lastFetchTime =
      Date.now();

    fetchPromise =
      null;

    return NextResponse.json(
      data,
      {
        headers: {
          'Cache-Control':
            data.total < 100
              ? 'no-store, max-age=0'
              : 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  }

  catch (error) {

    console.error(
      '[OSIRIS] Flight fetch error:',
      error
    );

    fetchPromise =
      null;

    /*
     * Never blank the map if we have previous data.
     */
    if (cachedData) {

      console.warn(
        '[OSIRIS] Returning stale flight cache as fallback'
      );

      return NextResponse.json(
        {
          ...cachedData,

          source:
            (
              cachedData.source ||
              'unknown'
            ) + '+stale',
        },
        {
          headers: {
            'Cache-Control':
              'no-store, max-age=0',
          },
        }
      );
    }

    return NextResponse.json(
      {
        error:
          'Failed to fetch flight data',
      },
      {
        status: 500,
      }
    );
  }
}

/* ============================================================
   GPS JAMMING AGGREGATION
   ============================================================ */

function aggregateJamming(
  points: any[],
  threshold: number
) {

  if (
    points.length === 0
  ) {
    return [];
  }

  const grid =
    new Map<
      string,
      {
        lat: number;
        lng: number;
        count: number;
        total_nac_p: number;
      }
    >();

  const GRID_SIZE = 2;

  for (
    const p of points
  ) {

    const gLat =
      Math.floor(
        p.lat /
          GRID_SIZE
      ) *
      GRID_SIZE;

    const gLng =
      Math.floor(
        p.lng /
          GRID_SIZE
      ) *
      GRID_SIZE;

    const key =
      `${gLat},${gLng}`;

    if (
      !grid.has(key)
    ) {

      grid.set(
        key,
        {
          lat:
            gLat +
            GRID_SIZE / 2,

          lng:
            gLng +
            GRID_SIZE / 2,

          count:
            0,

          total_nac_p:
            0,
        }
      );
    }

    const cell =
      grid.get(key)!;

    cell.count++;

    cell.total_nac_p +=
      p.nac_p;
  }

  return Array.from(
    grid.values()
  )
    .filter(
      z =>
        z.count >= 3
    )
    .map(
      z => ({
        lat:
          z.lat,

        lng:
          z.lng,

        severity:
          Math.round(
            (
              1 -
              (
                z.total_nac_p /
                z.count
              ) /
                threshold
            ) *
              100
          ),

        count:
          z.count,
      })
    );
}
