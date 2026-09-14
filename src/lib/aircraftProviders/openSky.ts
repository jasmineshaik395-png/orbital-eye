import { classifyFlight, type RawState } from './classify';
import type { AircraftDataProvider, ProviderFetchResult, StandardAircraft } from './types';

/**
 * OpenSky Network — https://openskynetwork.github.io/opensky-api/rest.html
 *
 * Free, global ADS-B/Mode-S aggregation with no API key required. Anonymous
 * callers share a 400-credits/day pool per IP; a free account (client-credentials
 * OAuth2, since March 2025) gets its own 4000-credits/day pool, at 4 credits per
 * unbounded /states/all call — about one call every 90s all day. Set
 * OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET to use the authenticated pool.
 *
 * Coverage depends on volunteer ADS-B receivers, so it is denser over
 * North America/Europe than mid-ocean or parts of Africa/Central Asia —
 * a real limitation of crowd-sourced receiver placement, not a bug here.
 */

const STATES_URL = 'https://opensky-network.org/api/states/all?extended=1';
const TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

const M_TO_FT = 3.28084;
const MS_TO_KTS = 1.94384;
const MS_TO_FPM = 196.850;

const hasCreds = () =>
  Boolean(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET);

// Authenticated: 90s keeps ~1000 calls/day, well inside the 4000-credit budget.
// Anonymous: 900s keeps ~96 calls/day, inside the 400-credit budget.
const pollIntervalMs = () => (hasCreds() ? 90_000 : 900_000);

let token: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string | null> {
  const id = process.env.OPENSKY_CLIENT_ID;
  const secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (token && Date.now() < tokenExpiry) return token;
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) { console.warn('[OSIRIS] OpenSky token request failed:', res.status); return null; }
    const data = await res.json();
    if (!data.access_token) return null;
    token = data.access_token;
    tokenExpiry = Date.now() + ((data.expires_in || 1800) - 60) * 1000;
    return token;
  } catch (e) {
    console.warn('[OSIRIS] OpenSky token error:', e);
    return null;
  }
}

// Snapshot survives across requests within the same warm server instance —
// state vectors are only worth re-fetching on pollIntervalMs(), not on every
// client poll of /api/flights.
let snapshot: StandardAircraft[] = [];
let snapshotAt = 0;
let cooldownUntil = 0;
const COOLDOWN_MS = 15 * 60 * 1000;

function toRawState(s: unknown[], nowSec: number): RawState | null {
  const lon = s[5] as number | null;
  const lat = s[6] as number | null;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;

  const baroM = s[7] as number | null;
  const velocityMs = s[9] as number | null;
  const vertRateMs = s[11] as number | null;
  const lastContact = (s[4] as number | null) ?? (s[3] as number | null) ?? nowSec;

  return {
    hex: String(s[0] || '').toLowerCase(),
    flight: (s[1] as string | null)?.trim() || null,
    lat,
    lon,
    altBaroFt: typeof baroM === 'number' ? baroM * M_TO_FT : null,
    gs: typeof velocityMs === 'number' ? velocityMs * MS_TO_KTS : null,
    track: (s[10] as number | null) ?? null,
    vertRateFpm: typeof vertRateMs === 'number' ? vertRateMs * MS_TO_FPM : null,
    squawk: (s[14] as string | null) || null,
    country: (s[2] as string | null) || null,
    categoryOs: s[17] as number | undefined,
    onGround: Boolean(s[8]),
    lastContactSec: lastContact,
  };
}

export const openSkyProvider: AircraftDataProvider = {
  name: 'opensky',

  async fetchLiveAircraft(): Promise<ProviderFetchResult> {
    const dueForRefresh = Date.now() - snapshotAt >= pollIntervalMs();
    const inCooldown = Date.now() < cooldownUntil;

    if (!dueForRefresh || inCooldown) {
      return {
        aircraft: snapshot,
        provider: 'opensky',
        ok: snapshot.length > 0,
        ageSeconds: snapshotAt ? Math.round((Date.now() - snapshotAt) / 1000) : Infinity,
      };
    }

    try {
      const authToken = await getToken();
      const res = await fetch(STATES_URL, {
        signal: AbortSignal.timeout(30000),
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      });

      if (res.status === 429) {
        cooldownUntil = Date.now() + COOLDOWN_MS;
        console.warn('[OSIRIS] OpenSky 429 — cooling down 15 min');
        await res.body?.cancel();
        return {
          aircraft: snapshot,
          provider: 'opensky',
          ok: snapshot.length > 0,
          ageSeconds: snapshotAt ? Math.round((Date.now() - snapshotAt) / 1000) : Infinity,
        };
      }

      if (!res.ok) {
        console.warn('[OSIRIS] OpenSky returned', res.status);
        await res.body?.cancel();
        return {
          aircraft: snapshot,
          provider: 'opensky',
          ok: false,
          ageSeconds: snapshotAt ? Math.round((Date.now() - snapshotAt) / 1000) : Infinity,
        };
      }

      const data = await res.json();
      const states: unknown[][] = Array.isArray(data?.states) ? data.states : [];
      const nowSec = Math.floor(Date.now() / 1000);

      const parsed: StandardAircraft[] = [];
      for (const s of states) {
        const raw = toRawState(s, nowSec);
        if (!raw) continue;
        const classified = classifyFlight(raw);
        if (!classified) continue;
        classified.source = 'opensky';
        parsed.push(classified);
      }

      // A near-empty response with a 200 is treated as unusable rather than
      // "quiet airspace" — global state vectors never legitimately collapse
      // to a handful of aircraft, so this is a malformed/partial response.
      if (parsed.length > 100) {
        snapshot = parsed;
        snapshotAt = Date.now();
      }

      return {
        aircraft: snapshot,
        provider: 'opensky',
        ok: snapshot.length > 0,
        ageSeconds: snapshotAt ? Math.round((Date.now() - snapshotAt) / 1000) : Infinity,
      };
    } catch (e) {
      console.warn('[OSIRIS] OpenSky fetch error:', e);
      return {
        aircraft: snapshot,
        provider: 'opensky',
        ok: false,
        ageSeconds: snapshotAt ? Math.round((Date.now() - snapshotAt) / 1000) : Infinity,
      };
    }
  },
};

export const openSkyHasCredentials = hasCreds;
