import type { StandardAircraft } from './types';

/**
 * Common shape both providers reduce their raw response into before
 * classification. Not exported outside this folder — it is an internal
 * seam, not the public contract (that is StandardAircraft).
 */
export interface RawState {
  hex: string;
  /** Callsign as broadcast, untrimmed. */
  flight: string | null;
  lat: number;
  lon: number;
  /** Feet. */
  altBaroFt: number | null;
  /** Knots. */
  gs: number | null;
  /** Degrees true. */
  track: number | null;
  /** Feet per minute, signed. */
  vertRateFpm: number | null;
  squawk: string | null;
  /** Country of registration, when the source reports one. */
  country: string | null;
  /** ADS-B emitter category, OpenSky's numbering (states/all field 17). */
  categoryOs?: number;
  /** ICAO aircraft type code, e.g. "B738". Only adsb.fi-shaped feeds carry this. */
  typeCode?: string;
  /** Registration, e.g. "N12345". Only adsb.fi-shaped feeds carry this. */
  registration?: string;
  /** tar1090 dbFlags bitfield (bit 0 = military). */
  dbFlags?: number;
  onGround?: boolean;
  /** Unix seconds of the last position update for this aircraft. */
  lastContactSec: number;
  /** ADS-B Navigation Accuracy Category for Position, when reported. */
  nacP?: number | null;
}

const HELI_TYPES = new Set([
  'R22', 'R44', 'R66', 'B06', 'B06T', 'B204', 'B205', 'B206', 'B212', 'B222', 'B230',
  'B407', 'B412', 'B427', 'B429', 'B430', 'B505', 'B525',
  'AS32', 'AS35', 'AS50', 'AS55', 'AS65',
  'EC20', 'EC25', 'EC30', 'EC35', 'EC45', 'EC55', 'EC75',
  'H125', 'H130', 'H135', 'H145', 'H155', 'H160', 'H175', 'H215', 'H225',
  'S55', 'S58', 'S61', 'S64', 'S70', 'S76', 'S92',
  'A109', 'A119', 'A139', 'A169', 'A189', 'AW09',
  'MD52', 'MD60', 'MDHI', 'MD90', 'NOTR',
  'B47G', 'HUEY', 'GAMA', 'CABR', 'EXE',
]);

const PRIVATE_JET_TYPES = new Set([
  'G150', 'G200', 'G280', 'GLEX', 'G500', 'G550', 'G600', 'G650', 'G700',
  'GLF2', 'GLF3', 'GLF4', 'GLF5', 'GLF6', 'GL5T', 'GL7T', 'GV', 'GIV',
  'CL30', 'CL35', 'CL60', 'BD70', 'BD10',
  'C25A', 'C25B', 'C25C', 'C500', 'C510', 'C525', 'C550', 'C560', 'C56X', 'C680', 'C700', 'C750',
  'E35L', 'E50P', 'E55P', 'E545', 'E550',
  'FA50', 'FA7X', 'FA8X', 'F900', 'F2TH',
  'LJ35', 'LJ40', 'LJ45', 'LJ60', 'LJ70', 'LJ75',
  'PC12', 'PC24', 'TBM7', 'TBM8', 'TBM9',
  'PRM1', 'SF50', 'EA50', 'VLJ',
]);

const MILITARY_INDICATORS = new Set([
  'C17', 'C5M', 'C130', 'C30J', 'KC10', 'KC46', 'KC35', 'E3CF', 'E3TF', 'E8A',
  'B1B', 'B2', 'B52', 'F16', 'F15', 'F18', 'F22', 'F35', 'A10', 'F117',
  'RC135', 'E6B', 'P8A', 'P3', 'MQ9', 'RQ4', 'U2', 'EP3', 'RC12',
  'V22', 'CH47', 'UH60', 'AH64', 'AH1Z', 'MV22',
  'EUFI', 'RFAL', 'TORD', 'TYP', 'GR4',
]);

// Airliner and regional types stay commercial whatever their callsign says.
const AIRLINER_TYPES = new Set([
  'A319', 'A320', 'A321', 'A332', 'A333', 'A339', 'A343', 'A359', 'A388',
  'B737', 'B738', 'B739', 'B38M', 'B39M', 'B752', 'B753', 'B763', 'B764',
  'B772', 'B77L', 'B77W', 'B788', 'B789', 'B78X',
  'E170', 'E175', 'E190', 'E195', 'CRJ7', 'CRJ9', 'AT43', 'AT72', 'DH8D',
]);

// Fractional-ownership and charter operators file under a 3-letter ICAO
// designator exactly like an airline, so AIRLINE_CODE_RE matches them and
// they would otherwise be counted as commercial traffic.
const BIZJET_OPERATORS = new Set([
  'EJA', 'EJM', 'NJE', 'LXJ', 'FJO', 'VJT', 'XOJ', 'JTL', 'WUP', 'GAJ', 'DPJ', 'CLY', 'TWY',
]);

const AIRLINE_CODE_RE = /^([A-Z]{3})\d/;

// A callsign that is not an airline designator + flight number is a
// registration: what general-aviation aircraft broadcast once the hyphen is
// stripped — DMMKG (D-MMKG), HBYKO (HB-YKO), OEDLH (OE-DLH), N425RS, CGABC.
const CALLSIGN_RE = /^[A-Z0-9]{3,8}$/;

// Business jets cruise in the mid-thirties at transonic speed; nothing flying
// under a civil registration reaches FL280 at 300 kt without turbofans. This
// is the only bizjet/piston discriminator available on feeds with no type
// code (OpenSky).
const JET_CRUISE_ALT_M = 8500;
const JET_CRUISE_KTS = 300;

const FT_TO_M = 0.3048;
const FPM_TO_MS = 0.00508;

/** Normalize + classify one aircraft. Returns null for rows that cannot be
 *  placed on a map (missing position) or that are not aircraft at all
 *  (ground vehicle / tower transponders some feeds include). */
export function classifyFlight(raw: RawState): StandardAircraft | null {
  if (typeof raw.lat !== 'number' || typeof raw.lon !== 'number') return null;
  if (!Number.isFinite(raw.lat) || !Number.isFinite(raw.lon)) return null;
  if (raw.lat < -90 || raw.lat > 90 || raw.lon < -180 || raw.lon > 180) return null;

  const modelUpper = (raw.typeCode || '').toUpperCase();
  if (modelUpper === 'TWR') return null;

  const flightStr = (raw.flight || '').trim().toUpperCase();
  const callsign = flightStr || raw.hex || 'UNKNOWN';
  const altMeters = typeof raw.altBaroFt === 'number' ? raw.altBaroFt * FT_TO_M : null;
  const speedKnots = typeof raw.gs === 'number' ? Math.round(raw.gs * 10) / 10 : null;
  const heading = raw.track ?? null;
  const isHeli = HELI_TYPES.has(modelUpper) || raw.categoryOs === 8;
  const isGrounded = raw.onGround === true
    || (typeof raw.altBaroFt === 'number' && raw.altBaroFt < 100);

  const isOsMilitary = raw.categoryOs === 14;
  const isOsHighPerf = raw.categoryOs === 7;
  const isOsLight = raw.categoryOs === 2;
  // Large / high-vortex large / heavy — airline or cargo metal by weight alone.
  const isOsHeavy = raw.categoryOs === 4 || raw.categoryOs === 5 || raw.categoryOs === 6;

  const airlineMatch = AIRLINE_CODE_RE.exec(flightStr);
  const airlineCode = airlineMatch ? airlineMatch[1] : '';

  // OpenSky supplies no aircraft type, and its ADS-B emitter category is "no
  // information" for the large majority of aircraft even with extended=1.
  // Every type-based test below therefore only fires on adsb.fi-shaped feeds.
  // The callsign is the field OpenSky always fills, so the airline-designator
  // test is what carries the split for the bulk of the map.
  const isGaCallsign = !airlineCode && CALLSIGN_RE.test(flightStr);
  const cruisesLikeAJet = altMeters !== null
    && altMeters > JET_CRUISE_ALT_M && (speedKnots ?? 0) > JET_CRUISE_KTS;

  let category: StandardAircraft['category'] = 'commercial';
  if (
    isOsMilitary || (raw.dbFlags ?? 0) & 1 || MILITARY_INDICATORS.has(modelUpper)
    || /^(RCH|KING|DUKE|EVAC|JAKE|REACH|CONVOY)\d/i.test(raw.flight || '')
  ) {
    category = 'military';
  } else if (AIRLINER_TYPES.has(modelUpper) || isOsHeavy) {
    category = 'commercial';
  } else if (
    BIZJET_OPERATORS.has(airlineCode)
    || PRIVATE_JET_TYPES.has(modelUpper)
    || isOsHighPerf
    || (isGaCallsign && cruisesLikeAJet)
  ) {
    category = 'jet';
  } else if (isGaCallsign || isOsLight) {
    category = 'private';
  }

  const lastUpdated = new Date(raw.lastContactSec * 1000).toISOString();
  const aircraftType = raw.typeCode?.trim() || null;

  return {
    id: raw.hex,
    icao24: raw.hex,
    callsign: callsign || null,
    latitude: Math.round(raw.lat * 100000) / 100000,
    longitude: Math.round(raw.lon * 100000) / 100000,
    altitude: altMeters !== null ? Math.round(altMeters) : null,
    speed: speedKnots,
    heading: heading !== null ? Math.round(heading) : null,
    verticalRate: typeof raw.vertRateFpm === 'number'
      ? Math.round(raw.vertRateFpm * FPM_TO_MS * 100) / 100
      : null,
    country: raw.country || null,
    aircraftType,
    lastUpdated,
    registration: raw.registration?.trim() || null,
    squawk: raw.squawk || null,
    grounded: isGrounded,
    source: '',
    category,
    aircraftCategory: isHeli ? 'heli' : 'plane',
    nacP: typeof raw.nacP === 'number' ? raw.nacP : null,
  } satisfies StandardAircraft;
}
