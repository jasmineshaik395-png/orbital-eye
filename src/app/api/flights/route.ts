diff --git a/src/app/api/flights/route.ts b/src/app/api/flights/route.ts
index f5eefc5..e35eb4d 100644
--- a/src/app/api/flights/route.ts
+++ b/src/app/api/flights/route.ts
@@ -1,223 +1,165 @@
-import { NextResponse } from "next/server";
+import { NextResponse } from 'next/server';
+import { fetchLiveAircraft, type StandardAircraft } from '@/lib/aircraftProviders';
 
-export const dynamic = "force-dynamic";
+export const maxDuration = 60;
+export const dynamic = 'force-dynamic';
 export const revalidate = 0;
 
-type Flight = {
-  icao24: string;
-  callsign: string;
-  lat: number;
-  lng: number;
-  alt: number;
-  speed_knots: number;
-  heading: number;
-  registration?: string;
-  model?: string;
-  category?: string;
-  source?: string;
-};
-
-const AVIATIONSTACK_URL = "https://api.aviationstack.com/v1/flights";
-
-function numberOrZero(value: unknown): number {
-  const n = Number(value);
-  return Number.isFinite(n) ? n : 0;
-}
-
-function cleanCallsign(value: unknown): string {
-  return typeof value === "string" ? value.trim() : "";
-}
-
-function knotsFromKmh(value: unknown): number {
-  const n = numberOrZero(value);
-  return n > 0 ? Math.round(n * 0.539957) : 0;
-}
-
-function aviationstackToFlight(row: any): Flight | null {
-  const live = row?.live;
-
-  // A flight can be returned by Aviationstack while its live position is
-  // unavailable. Such a record cannot be placed on a map, so skip it.
-  const lat = Number(live?.latitude);
-  const lng = Number(live?.longitude);
-
-  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
-  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
-
-  const flightNumber =
-    row?.flight?.icao || row?.flight?.iata || row?.flight?.number || "";
-  const callsign = cleanCallsign(flightNumber);
-
+/**
+ * OSIRIS — Live aircraft feed.
+ *
+ * Fans out to the provider abstraction in src/lib/aircraftProviders (OpenSky
+ * primary, adsb.fi fallback), then reshapes the standardized aircraft list
+ * into the four category buckets + GPS-jamming overlay the map already
+ * consumes. The response shape here is intentionally unchanged from before —
+ * OsirisMap.tsx and page.tsx read commercial_flights / private_flights /
+ * private_jets / military_flights / gps_jamming directly — so only the data
+ * layer underneath it changed.
+ */
+
+// A poll response is cached briefly so simultaneous client requests (or a
+// client polling faster than the provider layer refreshes) don't each
+// trigger their own provider fan-out.
+const CACHE_TTL_MS = 20_000;
+let cachedResponse: unknown = null;
+let cachedAt = 0;
+let inFlight: Promise<unknown> | null = null;
+
+const JAMMING_NACP_THRESHOLD = 4;
+
+/** Shape the map's toFeatures()/popups actually read — see OsirisMap.tsx. */
+function toMapFlight(ac: StandardAircraft) {
   return {
-    icao24: String(
-      row?.aircraft?.icao24 ??
-      row?.aircraft?.registration ??
-      row?.flight?.icao ??
-      row?.flight?.iata ??
-      flightNumber
-    ),
-    callsign,
-    lat,
-    lng,
-    alt: Math.round(numberOrZero(live?.altitude)),
-    speed_knots: knotsFromKmh(live?.speed_horizontal),
-    heading: numberOrZero(live?.direction),
-    registration: row?.aircraft?.registration
-      ? String(row.aircraft.registration)
-      : undefined,
-    model:
-      row?.aircraft?.iata ||
-      row?.aircraft?.icao ||
-      row?.aircraft?.type ||
-      undefined,
-    category: "commercial",
-    source: "aviationstack",
+    // Fields the existing map/popups read today.
+    callsign: ac.callsign || '',
+    lat: ac.latitude,
+    lng: ac.longitude,
+    alt: ac.altitude ?? 0,
+    heading: ac.heading ?? 0,
+    speed_knots: ac.speed ?? 0,
+    model: ac.aircraftType || 'Unknown',
+    icao24: ac.icao24,
+    registration: ac.registration || 'N/A',
+    squawk: ac.squawk || '',
+    category: ac.category,
+    aircraft_category: ac.aircraftCategory,
+    grounded: ac.grounded,
+    source: ac.source,
+    type: 'flight' as const,
+
+    // Standardized fields requested for the live-data upgrade. `id` doubles
+    // as the ICAO24 hex address — the one thing every provider here agrees
+    // on as a stable identifier.
+    id: ac.id,
+    latitude: ac.latitude,
+    longitude: ac.longitude,
+    altitude: ac.altitude,
+    speed: ac.speed,
+    verticalRate: ac.verticalRate,
+    country: ac.country,
+    aircraftType: ac.aircraftType,
+    lastUpdated: ac.lastUpdated,
   };
 }
 
-async function fetchAviationstackPage(
-  key: string,
-  offset: number
-): Promise<{ flights: Flight[]; apiRows: number; total: number }> {
-  const params = new URLSearchParams({
-    access_key: key,
-    flight_status: "active",
-    limit: "100",
-    offset: String(offset),
-  });
-
-  const response = await fetch(`${AVIATIONSTACK_URL}?${params.toString()}`, {
-    headers: { Accept: "application/json" },
-    cache: "no-store",
-  });
-
-  if (!response.ok) {
-    throw new Error(`Aviationstack returned ${response.status}`);
-  }
-
-  const json = await response.json();
-
-  if (json?.error) {
-    throw new Error(
-      `Aviationstack API error: ${json.error.message ?? "unknown error"}`
-    );
+function aggregateJamming(points: Array<{ lat: number; lng: number; nac_p: number; callsign: string }>) {
+  if (points.length === 0) return [];
+  const GRID_SIZE = 2;
+  const grid = new Map<string, { lat: number; lng: number; count: number; total_nac_p: number }>();
+
+  for (const p of points) {
+    const gLat = Math.floor(p.lat / GRID_SIZE) * GRID_SIZE;
+    const gLng = Math.floor(p.lng / GRID_SIZE) * GRID_SIZE;
+    const key = `${gLat},${gLng}`;
+    if (!grid.has(key)) grid.set(key, { lat: gLat + GRID_SIZE / 2, lng: gLng + GRID_SIZE / 2, count: 0, total_nac_p: 0 });
+    const cell = grid.get(key)!;
+    cell.count++;
+    cell.total_nac_p += p.nac_p;
   }
 
-  const rows = Array.isArray(json?.data) ? json.data : [];
-  const flights = rows
-    .map(aviationstackToFlight)
-    .filter(Boolean) as Flight[];
-
-  return {
-    flights,
-    apiRows: rows.length,
-    total: Number(json?.pagination?.total ?? rows.length),
-  };
+  return Array.from(grid.values())
+    .filter((z) => z.count >= 3)
+    .map((z) => ({
+      lat: z.lat,
+      lng: z.lng,
+      severity: Math.round((1 - (z.total_nac_p / z.count) / JAMMING_NACP_THRESHOLD) * 100),
+      count: z.count,
+    }));
 }
 
-async function fetchAviationstack(): Promise<{
-  flights: Flight[];
-  apiRows: number;
-  pagesChecked: number;
-  total: number;
-}> {
-  const key = process.env.AVIATIONSTACK_ACCESS_KEY;
-
-  if (!key) {
-    throw new Error("AVIATIONSTACK_ACCESS_KEY is not configured");
-  }
-
-  const allFlights: Flight[] = [];
-  let apiRows = 0;
-  let total = 0;
-  let pagesChecked = 0;
+async function buildResponse() {
+  const result = await fetchLiveAircraft();
 
-  // Usually the first page is enough. If it contains no live coordinates,
-  // check only two more pages. This avoids making dozens/hundreds of API calls.
-  for (let page = 0; page < 3; page++) {
-    const result = await fetchAviationstackPage(key, page * 100);
+  const commercial: ReturnType<typeof toMapFlight>[] = [];
+  const privateFl: ReturnType<typeof toMapFlight>[] = [];
+  const jets: ReturnType<typeof toMapFlight>[] = [];
+  const military: ReturnType<typeof toMapFlight>[] = [];
+  const jammingPoints: Array<{ lat: number; lng: number; nac_p: number; callsign: string }> = [];
 
-    pagesChecked++;
-    apiRows += result.apiRows;
-    total = result.total;
-    allFlights.push(...result.flights);
+  for (const ac of result.aircraft) {
+    const flight = toMapFlight(ac);
 
-    // Stop as soon as we have aircraft positions.
-    if (allFlights.length >= 20) break;
+    if (typeof ac.nacP === 'number' && ac.nacP <= JAMMING_NACP_THRESHOLD && !ac.grounded) {
+      jammingPoints.push({ lat: ac.latitude, lng: ac.longitude, nac_p: ac.nacP, callsign: flight.callsign });
+    }
 
-    // Nothing more to check.
-    if (result.apiRows < 100) break;
+    switch (ac.category) {
+      case 'military': military.push(flight); break;
+      case 'jet': jets.push(flight); break;
+      case 'private': privateFl.push(flight); break;
+      default: commercial.push(flight);
+    }
   }
 
-  // Remove duplicate aircraft records.
-  const unique = Array.from(
-    new Map(allFlights.map((flight) => [flight.icao24, flight])).values()
-  );
-
   return {
-    flights: unique,
-    apiRows,
-    pagesChecked,
-    total,
+    commercial_flights: commercial,
+    private_flights: privateFl,
+    private_jets: jets,
+    military_flights: military,
+    gps_jamming: aggregateJamming(jammingPoints),
+    total: result.aircraft.length,
+    // "live" once any provider is genuinely current this cycle, "degraded"
+    // when only a stale snapshot could be served, "down" when nothing is
+    // available at all — the UI's live-status indicator reads this.
+    status: result.status,
+    source: result.source,
+    providers: result.providers,
+    timestamp: result.timestamp,
   };
 }
 
 export async function GET() {
-  try {
-    const result = await fetchAviationstack();
-
-    return NextResponse.json(
-      {
-        commercial_flights: result.flights,
-        private_flights: [],
-        private_jets: [],
-        military_flights: [],
-        gps_jamming: [],
-        total: result.flights.length,
-        source: "aviationstack-live",
-        providers: {
-          aviationstack: result.flights.length,
-          opensky: 0,
-          authenticated: Boolean(process.env.AVIATIONSTACK_ACCESS_KEY),
-        },
-        diagnostics: {
-          api_rows_received: result.apiRows,
-          live_position_rows: result.flights.length,
-          pages_checked: result.pagesChecked,
-          api_total_active: result.total,
-        },
-        timestamp: new Date().toISOString(),
-      },
-      {
-        headers: {
-          "Cache-Control": "no-store, no-cache, must-revalidate",
-        },
-      }
-    );
-  } catch (error) {
-    console.error("AVIATIONSTACK FLIGHT API ERROR:", error);
-
-    return NextResponse.json(
-      {
-        commercial_flights: [],
-        private_flights: [],
-        private_jets: [],
-        military_flights: [],
-        gps_jamming: [],
-        total: 0,
-        source: "aviationstack-error",
-        providers: {
-          aviationstack: 0,
-          opensky: 0,
-          authenticated: Boolean(process.env.AVIATIONSTACK_ACCESS_KEY),
-        },
-        diagnostics: {
-          error:
-            error instanceof Error ? error.message : "Unknown Aviationstack error",
-        },
-        timestamp: new Date().toISOString(),
-      },
-      { status: 200, headers: { "Cache-Control": "no-store" } }
-    );
+  const now = Date.now();
+
+  if (cachedResponse && now - cachedAt < CACHE_TTL_MS) {
+    return NextResponse.json(cachedResponse, {
+      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' },
+    });
   }
+
+  if (!inFlight) {
+    inFlight = buildResponse()
+      .then((data) => {
+        cachedResponse = data;
+        cachedAt = Date.now();
+        return data;
+      })
+      .catch((error) => {
+        console.error('[OSIRIS] Flight fetch error:', error);
+        // Never crash the route — hand back the last good response if there
+        // is one, clearly marked, rather than a 500 that blanks the map.
+        if (cachedResponse) {
+          return { ...(cachedResponse as Record<string, unknown>), status: 'degraded', source: 'stale-cache' };
+        }
+        return {
+          commercial_flights: [], private_flights: [], private_jets: [], military_flights: [],
+          gps_jamming: [], total: 0, status: 'down', source: 'error',
+          providers: null, timestamp: new Date().toISOString(),
+        };
+      })
+      .finally(() => { inFlight = null; });
+  }
+
+  const data = await inFlight;
+  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
 }
diff --git a/src/components/FlightLiveStatus.tsx b/src/components/FlightLiveStatus.tsx
new file mode 100644
index 0000000..c8a0054
--- /dev/null
+++ b/src/components/FlightLiveStatus.tsx
@@ -0,0 +1,63 @@
+'use client';
+
+import { useEffect, useState } from 'react';
+
+interface FlightLiveStatusProps {
+  /** "live" | "degraded" | "down" — see src/lib/aircraftProviders. */
+  status?: string;
+  /** ISO timestamp of the last successful fetch. */
+  timestamp?: string;
+  /** Total aircraft currently tracked, across all categories. */
+  total?: number;
+}
+
+/**
+ * 🟢 LIVE AIRCRAFT DATA / Last updated Xs ago / Aircraft tracked: N
+ * 🟠 LIVE DATA TEMPORARILY UNAVAILABLE, when every provider is down and
+ * there is no snapshot — even a stale one — left to show.
+ *
+ * Never claims "live" when it isn't: a degraded (stale-cache) response still
+ * shows the amber state, with the age of the data it's actually displaying.
+ */
+export default function FlightLiveStatus({ status, timestamp, total }: FlightLiveStatusProps) {
+  const [nowTick, setNowTick] = useState(() => Date.now());
+
+  useEffect(() => {
+    const iv = setInterval(() => setNowTick(Date.now()), 1000);
+    return () => clearInterval(iv);
+  }, []);
+
+  if (!status) return null;
+
+  const ageSeconds = timestamp ? Math.max(0, Math.round((nowTick - new Date(timestamp).getTime()) / 1000)) : null;
+  const isDown = status === 'down';
+  const isDegraded = status === 'degraded';
+
+  const formatAge = (s: number) => {
+    if (s < 60) return `${s}s ago`;
+    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
+    return `${Math.floor(s / 3600)}h ago`;
+  };
+
+  if (isDown) {
+    return (
+      <div className="flex items-center gap-1.5 text-[9px] font-mono tracking-wide text-[var(--alert-orange)] px-1 py-1">
+        <span>🟠</span>
+        <span>LIVE DATA TEMPORARILY UNAVAILABLE</span>
+      </div>
+    );
+  }
+
+  return (
+    <div className="flex flex-col gap-0.5 text-[9px] font-mono tracking-wide px-1 py-1">
+      <div className={`flex items-center gap-1.5 ${isDegraded ? 'text-[var(--alert-orange)]' : 'text-[var(--alert-green)]'}`}>
+        <span>{isDegraded ? '🟠' : '🟢'}</span>
+        <span>{isDegraded ? 'LIVE DATA DELAYED — SHOWING LAST KNOWN POSITIONS' : 'LIVE AIRCRAFT DATA'}</span>
+      </div>
+      <div className="text-white/35 pl-4">
+        {ageSeconds !== null && <>Last updated: {formatAge(ageSeconds)} · </>}
+        Aircraft tracked: {(total ?? 0).toLocaleString()}
+      </div>
+    </div>
+  );
+}
diff --git a/src/components/LayerPanel.tsx b/src/components/LayerPanel.tsx
index a4927ab..e8563d1 100644
--- a/src/components/LayerPanel.tsx
+++ b/src/components/LayerPanel.tsx
@@ -8,6 +8,7 @@ import {
   Flame, Tv, Radio, Mountain, Anchor, Megaphone, SlidersHorizontal
 } from 'lucide-react';
 import StyleStudio from './StyleStudio';
+import FlightLiveStatus from './FlightLiveStatus';
 import { TERRAIN_MIN_ZOOM, type TerrainStatus } from '@/lib/map-terrain';
 
 interface LayerPanelProps {
@@ -271,6 +272,12 @@ function LayerPanel({ data, activeLayers, setActiveLayers, isMobile, theme = 'co
             <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/30 border-b border-white/[0.06] pb-1.5">
               {group.fullLabel}
             </div>
+            {group.label === 'AVIATION' && (
+              <FlightLiveStatus status={data.status} timestamp={data.timestamp} total={
+                (data.commercial_flights?.length || 0) + (data.private_flights?.length || 0)
+                + (data.private_jets?.length || 0) + (data.military_flights?.length || 0)
+              } />
+            )}
             <div className="flex flex-col gap-1">
               {group.layers.map((layer) => {
                 const isLayerActive = activeLayers[layer.key];
@@ -459,6 +466,12 @@ function LayerPanel({ data, activeLayers, setActiveLayers, isMobile, theme = 'co
                         </button>
                       )}
                     </div>
+                    {group.label === 'AVIATION' && (
+                      <FlightLiveStatus status={data.status} timestamp={data.timestamp} total={
+                        (data.commercial_flights?.length || 0) + (data.private_flights?.length || 0)
+                        + (data.private_jets?.length || 0) + (data.military_flights?.length || 0)
+                      } />
+                    )}
                     <div className="flex flex-col gap-0.5">
                       {group.layers.map((layer) => {
                         const isLayerActive = activeLayers[layer.key];
diff --git a/src/lib/aircraftProviders/adsbFi.ts b/src/lib/aircraftProviders/adsbFi.ts
new file mode 100644
index 0000000..8cd6b33
--- /dev/null
+++ b/src/lib/aircraftProviders/adsbFi.ts
@@ -0,0 +1,150 @@
+import { classifyFlight, type RawState } from './classify';
+import type { AircraftDataProvider, ProviderFetchResult, StandardAircraft } from './types';
+
+/**
+ * adsb.fi — https://github.com/adsbfi/opendata
+ *
+ * Free, keyless, community ADS-B feed in the tar1090/ADSBExchange-v2 shape.
+ * Used only as a fallback when OpenSky has no usable snapshot this cycle —
+ * its global military feed is polled every cycle (cheap, always current);
+ * its regional /lat/{lat}/lon/{lon}/dist/{nm} endpoint is metered far more
+ * tightly, so the worldwide sweep below only runs when nothing else worked.
+ *
+ * Calls are made with plain `fetch` and paced sequentially, honoring the
+ * ~1 req/s the provider documents rather than spoofing headers or IPs to
+ * push past it.
+ */
+
+const BASE = 'https://opendata.adsb.fi/api/v2';
+const MAX_DIST_NM = 250; // hard cap the provider enforces
+const REGION_GAP_MS = 1100; // ~1 req/s
+
+// 30 regions covering the major aviation corridors at 250 nm radius each —
+// enough overlap to give worldwide coverage without exceeding the provider's
+// budget in a single sweep.
+const REGIONS: Array<{ lat: number; lon: number }> = [
+  { lat: 39.8, lon: -98.5 }, { lat: 41.0, lon: -74.0 }, { lat: 33.0, lon: -84.0 },
+  { lat: 42.0, lon: -88.0 }, { lat: 30.0, lon: -97.0 }, { lat: 47.0, lon: -122.0 },
+  { lat: 34.0, lon: -118.0 }, { lat: 45.0, lon: -73.0 }, { lat: 49.0, lon: -97.0 },
+  { lat: 50.0, lon: 15.0 }, { lat: 51.5, lon: -1.0 }, { lat: 47.0, lon: 2.0 },
+  { lat: 40.0, lon: -4.0 }, { lat: 42.0, lon: 13.0 }, { lat: 60.0, lon: 15.0 },
+  { lat: 52.0, lon: 22.0 }, { lat: 39.0, lon: 35.0 },
+  { lat: 25.0, lon: 45.0 }, { lat: 22.0, lon: 78.0 },
+  { lat: 35.0, lon: 105.0 }, { lat: 35.0, lon: 136.0 }, { lat: 37.0, lon: 127.0 },
+  { lat: 13.0, lon: 100.0 }, { lat: 1.0, lon: 104.0 },
+  { lat: -25.0, lon: 133.0 }, { lat: -33.0, lon: 151.0 },
+  { lat: 0.0, lon: 20.0 }, { lat: -26.0, lon: 28.0 },
+  { lat: -15.0, lon: -60.0 }, { lat: -23.0, lon: -46.0 },
+];
+
+interface Tar1090Aircraft {
+  hex?: string;
+  flight?: string;
+  lat?: number;
+  lon?: number;
+  alt_baro?: number | 'ground';
+  gs?: number;
+  track?: number;
+  baro_rate?: number;
+  geom_rate?: number;
+  squawk?: string;
+  r?: string;
+  t?: string;
+  dbFlags?: number;
+  /** Seconds since the last message from this aircraft. */
+  seen?: number;
+  /** Seconds since the last position report. */
+  seen_pos?: number;
+  nac_p?: number;
+}
+
+function toRawState(ac: Tar1090Aircraft, nowSec: number): RawState | null {
+  if (typeof ac.lat !== 'number' || typeof ac.lon !== 'number') return null;
+  const onGround = ac.alt_baro === 'ground';
+  const altBaroFt = typeof ac.alt_baro === 'number' ? ac.alt_baro : (onGround ? 0 : null);
+  const ageSec = typeof ac.seen_pos === 'number' ? ac.seen_pos : (ac.seen ?? 0);
+
+  return {
+    hex: (ac.hex || '').toLowerCase().trim(),
+    flight: ac.flight?.trim() || null,
+    lat: ac.lat,
+    lon: ac.lon,
+    altBaroFt,
+    gs: typeof ac.gs === 'number' ? ac.gs : null,
+    track: typeof ac.track === 'number' ? ac.track : null,
+    vertRateFpm: typeof ac.baro_rate === 'number' ? ac.baro_rate
+      : (typeof ac.geom_rate === 'number' ? ac.geom_rate : null),
+    squawk: ac.squawk || null,
+    country: null, // tar1090 feeds don't carry registration country
+    typeCode: ac.t?.trim(),
+    registration: ac.r?.trim(),
+    dbFlags: ac.dbFlags,
+    onGround,
+    lastContactSec: nowSec - Math.max(0, ageSec),
+    nacP: typeof ac.nac_p === 'number' ? ac.nac_p : null,
+  };
+}
+
+async function fetchAc(url: string): Promise<Tar1090Aircraft[]> {
+  try {
+    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
+    if (!res.ok) { await res.body?.cancel(); return []; }
+    const data = await res.json();
+    return Array.isArray(data?.ac) ? data.ac : [];
+  } catch {
+    return [];
+  }
+}
+
+function ingest(
+  raw: Tar1090Aircraft[],
+  into: StandardAircraft[],
+  seen: Set<string>,
+  nowSec: number,
+) {
+  for (const ac of raw) {
+    const hex = (ac.hex || '').toLowerCase().trim();
+    if (!hex || seen.has(hex)) continue;
+    const rawState = toRawState(ac, nowSec);
+    if (!rawState) continue;
+    const classified = classifyFlight(rawState);
+    if (!classified) continue;
+    classified.source = 'adsb.fi';
+    seen.add(hex);
+    into.push(classified);
+  }
+}
+
+export const adsbFiProvider: AircraftDataProvider = {
+  name: 'adsb.fi',
+
+  /** Military feed only — cheap, runs every cycle. The full worldwide sweep
+   *  is exposed separately via fetchRegionalSweep() so the caller can choose
+   *  to skip it when OpenSky already supplied a usable snapshot. */
+  async fetchLiveAircraft(): Promise<ProviderFetchResult> {
+    const nowSec = Math.floor(Date.now() / 1000);
+    const seen = new Set<string>();
+    const out: StandardAircraft[] = [];
+    ingest(await fetchAc(`${BASE}/mil`), out, seen, nowSec);
+    return { aircraft: out, provider: 'adsb.fi', ok: out.length > 0, ageSeconds: 0 };
+  },
+};
+
+/**
+ * Worldwide regional sweep — last resort only, used when OpenSky has no
+ * usable snapshot this cycle. Paced at ~1 req/s per the provider's documented
+ * limit; 30 regions takes ~33s.
+ */
+export async function fetchAdsbFiRegionalSweep(): Promise<StandardAircraft[]> {
+  const nowSec = Math.floor(Date.now() / 1000);
+  const seen = new Set<string>();
+  const out: StandardAircraft[] = [];
+  for (const r of REGIONS) {
+    ingest(
+      await fetchAc(`${BASE}/lat/${r.lat}/lon/${r.lon}/dist/${MAX_DIST_NM}`),
+      out, seen, nowSec,
+    );
+    await new Promise((resolve) => setTimeout(resolve, REGION_GAP_MS));
+  }
+  return out;
+}
diff --git a/src/lib/aircraftProviders/classify.ts b/src/lib/aircraftProviders/classify.ts
new file mode 100644
index 0000000..5fbedd6
--- /dev/null
+++ b/src/lib/aircraftProviders/classify.ts
@@ -0,0 +1,187 @@
+import type { StandardAircraft } from './types';
+
+/**
+ * Common shape both providers reduce their raw response into before
+ * classification. Not exported outside this folder — it is an internal
+ * seam, not the public contract (that is StandardAircraft).
+ */
+export interface RawState {
+  hex: string;
+  /** Callsign as broadcast, untrimmed. */
+  flight: string | null;
+  lat: number;
+  lon: number;
+  /** Feet. */
+  altBaroFt: number | null;
+  /** Knots. */
+  gs: number | null;
+  /** Degrees true. */
+  track: number | null;
+  /** Feet per minute, signed. */
+  vertRateFpm: number | null;
+  squawk: string | null;
+  /** Country of registration, when the source reports one. */
+  country: string | null;
+  /** ADS-B emitter category, OpenSky's numbering (states/all field 17). */
+  categoryOs?: number;
+  /** ICAO aircraft type code, e.g. "B738". Only adsb.fi-shaped feeds carry this. */
+  typeCode?: string;
+  /** Registration, e.g. "N12345". Only adsb.fi-shaped feeds carry this. */
+  registration?: string;
+  /** tar1090 dbFlags bitfield (bit 0 = military). */
+  dbFlags?: number;
+  onGround?: boolean;
+  /** Unix seconds of the last position update for this aircraft. */
+  lastContactSec: number;
+  /** ADS-B Navigation Accuracy Category for Position, when reported. */
+  nacP?: number | null;
+}
+
+const HELI_TYPES = new Set([
+  'R22', 'R44', 'R66', 'B06', 'B06T', 'B204', 'B205', 'B206', 'B212', 'B222', 'B230',
+  'B407', 'B412', 'B427', 'B429', 'B430', 'B505', 'B525',
+  'AS32', 'AS35', 'AS50', 'AS55', 'AS65',
+  'EC20', 'EC25', 'EC30', 'EC35', 'EC45', 'EC55', 'EC75',
+  'H125', 'H130', 'H135', 'H145', 'H155', 'H160', 'H175', 'H215', 'H225',
+  'S55', 'S58', 'S61', 'S64', 'S70', 'S76', 'S92',
+  'A109', 'A119', 'A139', 'A169', 'A189', 'AW09',
+  'MD52', 'MD60', 'MDHI', 'MD90', 'NOTR',
+  'B47G', 'HUEY', 'GAMA', 'CABR', 'EXE',
+]);
+
+const PRIVATE_JET_TYPES = new Set([
+  'G150', 'G200', 'G280', 'GLEX', 'G500', 'G550', 'G600', 'G650', 'G700',
+  'GLF2', 'GLF3', 'GLF4', 'GLF5', 'GLF6', 'GL5T', 'GL7T', 'GV', 'GIV',
+  'CL30', 'CL35', 'CL60', 'BD70', 'BD10',
+  'C25A', 'C25B', 'C25C', 'C500', 'C510', 'C525', 'C550', 'C560', 'C56X', 'C680', 'C700', 'C750',
+  'E35L', 'E50P', 'E55P', 'E545', 'E550',
+  'FA50', 'FA7X', 'FA8X', 'F900', 'F2TH',
+  'LJ35', 'LJ40', 'LJ45', 'LJ60', 'LJ70', 'LJ75',
+  'PC12', 'PC24', 'TBM7', 'TBM8', 'TBM9',
+  'PRM1', 'SF50', 'EA50', 'VLJ',
+]);
+
+const MILITARY_INDICATORS = new Set([
+  'C17', 'C5M', 'C130', 'C30J', 'KC10', 'KC46', 'KC35', 'E3CF', 'E3TF', 'E8A',
+  'B1B', 'B2', 'B52', 'F16', 'F15', 'F18', 'F22', 'F35', 'A10', 'F117',
+  'RC135', 'E6B', 'P8A', 'P3', 'MQ9', 'RQ4', 'U2', 'EP3', 'RC12',
+  'V22', 'CH47', 'UH60', 'AH64', 'AH1Z', 'MV22',
+  'EUFI', 'RFAL', 'TORD', 'TYP', 'GR4',
+]);
+
+// Airliner and regional types stay commercial whatever their callsign says.
+const AIRLINER_TYPES = new Set([
+  'A319', 'A320', 'A321', 'A332', 'A333', 'A339', 'A343', 'A359', 'A388',
+  'B737', 'B738', 'B739', 'B38M', 'B39M', 'B752', 'B753', 'B763', 'B764',
+  'B772', 'B77L', 'B77W', 'B788', 'B789', 'B78X',
+  'E170', 'E175', 'E190', 'E195', 'CRJ7', 'CRJ9', 'AT43', 'AT72', 'DH8D',
+]);
+
+// Fractional-ownership and charter operators file under a 3-letter ICAO
+// designator exactly like an airline, so AIRLINE_CODE_RE matches them and
+// they would otherwise be counted as commercial traffic.
+const BIZJET_OPERATORS = new Set([
+  'EJA', 'EJM', 'NJE', 'LXJ', 'FJO', 'VJT', 'XOJ', 'JTL', 'WUP', 'GAJ', 'DPJ', 'CLY', 'TWY',
+]);
+
+const AIRLINE_CODE_RE = /^([A-Z]{3})\d/;
+
+// A callsign that is not an airline designator + flight number is a
+// registration: what general-aviation aircraft broadcast once the hyphen is
+// stripped — DMMKG (D-MMKG), HBYKO (HB-YKO), OEDLH (OE-DLH), N425RS, CGABC.
+const CALLSIGN_RE = /^[A-Z0-9]{3,8}$/;
+
+// Business jets cruise in the mid-thirties at transonic speed; nothing flying
+// under a civil registration reaches FL280 at 300 kt without turbofans. This
+// is the only bizjet/piston discriminator available on feeds with no type
+// code (OpenSky).
+const JET_CRUISE_ALT_M = 8500;
+const JET_CRUISE_KTS = 300;
+
+const FT_TO_M = 0.3048;
+const FPM_TO_MS = 0.00508;
+
+/** Normalize + classify one aircraft. Returns null for rows that cannot be
+ *  placed on a map (missing position) or that are not aircraft at all
+ *  (ground vehicle / tower transponders some feeds include). */
+export function classifyFlight(raw: RawState): StandardAircraft | null {
+  if (typeof raw.lat !== 'number' || typeof raw.lon !== 'number') return null;
+  if (!Number.isFinite(raw.lat) || !Number.isFinite(raw.lon)) return null;
+  if (raw.lat < -90 || raw.lat > 90 || raw.lon < -180 || raw.lon > 180) return null;
+
+  const modelUpper = (raw.typeCode || '').toUpperCase();
+  if (modelUpper === 'TWR') return null;
+
+  const flightStr = (raw.flight || '').trim().toUpperCase();
+  const callsign = flightStr || raw.hex || 'UNKNOWN';
+  const altMeters = typeof raw.altBaroFt === 'number' ? raw.altBaroFt * FT_TO_M : null;
+  const speedKnots = typeof raw.gs === 'number' ? Math.round(raw.gs * 10) / 10 : null;
+  const heading = raw.track ?? null;
+  const isHeli = HELI_TYPES.has(modelUpper) || raw.categoryOs === 8;
+  const isGrounded = raw.onGround === true
+    || (typeof raw.altBaroFt === 'number' && raw.altBaroFt < 100);
+
+  const isOsMilitary = raw.categoryOs === 14;
+  const isOsHighPerf = raw.categoryOs === 7;
+  const isOsLight = raw.categoryOs === 2;
+  // Large / high-vortex large / heavy — airline or cargo metal by weight alone.
+  const isOsHeavy = raw.categoryOs === 4 || raw.categoryOs === 5 || raw.categoryOs === 6;
+
+  const airlineMatch = AIRLINE_CODE_RE.exec(flightStr);
+  const airlineCode = airlineMatch ? airlineMatch[1] : '';
+
+  // OpenSky supplies no aircraft type, and its ADS-B emitter category is "no
+  // information" for the large majority of aircraft even with extended=1.
+  // Every type-based test below therefore only fires on adsb.fi-shaped feeds.
+  // The callsign is the field OpenSky always fills, so the airline-designator
+  // test is what carries the split for the bulk of the map.
+  const isGaCallsign = !airlineCode && CALLSIGN_RE.test(flightStr);
+  const cruisesLikeAJet = altMeters !== null
+    && altMeters > JET_CRUISE_ALT_M && (speedKnots ?? 0) > JET_CRUISE_KTS;
+
+  let category: StandardAircraft['category'] = 'commercial';
+  if (
+    isOsMilitary || (raw.dbFlags ?? 0) & 1 || MILITARY_INDICATORS.has(modelUpper)
+    || /^(RCH|KING|DUKE|EVAC|JAKE|REACH|CONVOY)\d/i.test(raw.flight || '')
+  ) {
+    category = 'military';
+  } else if (AIRLINER_TYPES.has(modelUpper) || isOsHeavy) {
+    category = 'commercial';
+  } else if (
+    BIZJET_OPERATORS.has(airlineCode)
+    || PRIVATE_JET_TYPES.has(modelUpper)
+    || isOsHighPerf
+    || (isGaCallsign && cruisesLikeAJet)
+  ) {
+    category = 'jet';
+  } else if (isGaCallsign || isOsLight) {
+    category = 'private';
+  }
+
+  const lastUpdated = new Date(raw.lastContactSec * 1000).toISOString();
+  const aircraftType = raw.typeCode?.trim() || null;
+
+  return {
+    id: raw.hex,
+    icao24: raw.hex,
+    callsign: callsign || null,
+    latitude: Math.round(raw.lat * 100000) / 100000,
+    longitude: Math.round(raw.lon * 100000) / 100000,
+    altitude: altMeters !== null ? Math.round(altMeters) : null,
+    speed: speedKnots,
+    heading: heading !== null ? Math.round(heading) : null,
+    verticalRate: typeof raw.vertRateFpm === 'number'
+      ? Math.round(raw.vertRateFpm * FPM_TO_MS * 100) / 100
+      : null,
+    country: raw.country || null,
+    aircraftType,
+    lastUpdated,
+    registration: raw.registration?.trim() || null,
+    squawk: raw.squawk || null,
+    grounded: isGrounded,
+    source: '',
+    category,
+    aircraftCategory: isHeli ? 'heli' : 'plane',
+    nacP: typeof raw.nacP === 'number' ? raw.nacP : null,
+  } satisfies StandardAircraft;
+}
diff --git a/src/lib/aircraftProviders/index.ts b/src/lib/aircraftProviders/index.ts
new file mode 100644
index 0000000..1fcfe98
--- /dev/null
+++ b/src/lib/aircraftProviders/index.ts
@@ -0,0 +1,120 @@
+import { openSkyProvider, openSkyHasCredentials } from './openSky';
+import { adsbFiProvider, fetchAdsbFiRegionalSweep } from './adsbFi';
+import type { StandardAircraft } from './types';
+
+export type { StandardAircraft, AircraftDataProvider, ProviderFetchResult } from './types';
+
+export interface LiveAircraftResult {
+  aircraft: StandardAircraft[];
+  /** Overall status: "live" once any provider supplied fresh or reused data,
+   *  "degraded" when only a stale cache could be returned, "down" when
+   *  nothing at all is available this cycle. */
+  status: 'live' | 'degraded' | 'down';
+  /** Short label for what actually produced this batch, e.g. "opensky",
+   *  "opensky+adsb.fi-mil", "adsb.fi-regional", "stale-cache". */
+  source: string;
+  providers: {
+    opensky: number;
+    opensky_authenticated: boolean;
+    opensky_age_s: number | null;
+    adsbfi_military: number;
+    adsbfi_regional: number;
+  };
+  timestamp: string;
+}
+
+let lastGoodResult: LiveAircraftResult | null = null;
+
+/**
+ * The single entry point the rest of the app calls. Fans out to every
+ * provider, merges + dedupes by ICAO24, and only falls back to the slow
+ * worldwide adsb.fi sweep when OpenSky produced nothing usable this cycle —
+ * that sweep is metered far more tightly than everything else here.
+ *
+ * Never invents aircraft: if every provider is down, this returns an empty
+ * list with status "down" rather than serving anything stale as if it were
+ * live positions.
+ */
+export async function fetchLiveAircraft(): Promise<LiveAircraftResult> {
+  const merged = new Map<string, StandardAircraft>();
+  const addAll = (list: StandardAircraft[]) => {
+    for (const ac of list) if (!merged.has(ac.id)) merged.set(ac.id, ac);
+  };
+
+  const [openSkyResult, adsbMilResult] = await Promise.allSettled([
+    openSkyProvider.fetchLiveAircraft(),
+    adsbFiProvider.fetchLiveAircraft(),
+  ]);
+
+  const osOk = openSkyResult.status === 'fulfilled' && openSkyResult.value.ok;
+  const osAircraft = openSkyResult.status === 'fulfilled' ? openSkyResult.value.aircraft : [];
+  const osAge = openSkyResult.status === 'fulfilled' && Number.isFinite(openSkyResult.value.ageSeconds)
+    ? openSkyResult.value.ageSeconds : null;
+
+  const milAircraft = adsbMilResult.status === 'fulfilled' ? adsbMilResult.value.aircraft : [];
+
+  addAll(osAircraft);
+  addAll(milAircraft);
+
+  let regionalCount = 0;
+  const sourceParts: string[] = [];
+  if (osOk) sourceParts.push('opensky');
+  if (milAircraft.length > 0) sourceParts.push('adsb.fi-mil');
+
+  // Last resort: OpenSky gave us nothing usable this cycle (rate-limited,
+  // down, or no credentials and mid-cooldown). Sweep adsb.fi worldwide
+  // instead of leaving the map empty. This is slow (~30s) and only runs
+  // when it has to.
+  if (!osOk) {
+    try {
+      const regional = await fetchAdsbFiRegionalSweep();
+      regionalCount = regional.length;
+      addAll(regional);
+      if (regionalCount > 0) sourceParts.push('adsb.fi-regional');
+    } catch (e) {
+      console.warn('[OSIRIS] adsb.fi regional sweep failed:', e);
+    }
+  }
+
+  const aircraft = Array.from(merged.values());
+  const providers = {
+    opensky: osAircraft.length,
+    opensky_authenticated: openSkyHasCredentials(),
+    opensky_age_s: osAge,
+    adsbfi_military: milAircraft.length,
+    adsbfi_regional: regionalCount,
+  };
+
+  if (aircraft.length > 0) {
+    const result: LiveAircraftResult = {
+      aircraft,
+      status: 'live',
+      source: sourceParts.join('+') || 'unknown',
+      providers,
+      timestamp: new Date().toISOString(),
+    };
+    lastGoodResult = result;
+    return result;
+  }
+
+  // Nothing usable this cycle. Serve the last known-good snapshot, clearly
+  // marked as degraded, rather than an empty map — but never claim it is
+  // live. If there is no prior snapshot either, report honestly that the
+  // feed is down instead of fabricating data.
+  if (lastGoodResult) {
+    return {
+      ...lastGoodResult,
+      status: 'degraded',
+      source: `${lastGoodResult.source}+stale`,
+      providers,
+    };
+  }
+
+  return {
+    aircraft: [],
+    status: 'down',
+    source: 'none',
+    providers,
+    timestamp: new Date().toISOString(),
+  };
+}
diff --git a/src/lib/aircraftProviders/openSky.ts b/src/lib/aircraftProviders/openSky.ts
new file mode 100644
index 0000000..b87a509
--- /dev/null
+++ b/src/lib/aircraftProviders/openSky.ts
@@ -0,0 +1,181 @@
+import { classifyFlight, type RawState } from './classify';
+import type { AircraftDataProvider, ProviderFetchResult, StandardAircraft } from './types';
+
+/**
+ * OpenSky Network — https://openskynetwork.github.io/opensky-api/rest.html
+ *
+ * Free, global ADS-B/Mode-S aggregation with no API key required. Anonymous
+ * callers share a 400-credits/day pool per IP; a free account (client-credentials
+ * OAuth2, since March 2025) gets its own 4000-credits/day pool, at 4 credits per
+ * unbounded /states/all call — about one call every 90s all day. Set
+ * OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET to use the authenticated pool.
+ *
+ * Coverage depends on volunteer ADS-B receivers, so it is denser over
+ * North America/Europe than mid-ocean or parts of Africa/Central Asia —
+ * a real limitation of crowd-sourced receiver placement, not a bug here.
+ */
+
+const STATES_URL = 'https://opensky-network.org/api/states/all?extended=1';
+const TOKEN_URL =
+  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
+
+const M_TO_FT = 3.28084;
+const MS_TO_KTS = 1.94384;
+const MS_TO_FPM = 196.850;
+
+const hasCreds = () =>
+  Boolean(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET);
+
+// Authenticated: 90s keeps ~1000 calls/day, well inside the 4000-credit budget.
+// Anonymous: 900s keeps ~96 calls/day, inside the 400-credit budget.
+const pollIntervalMs = () => (hasCreds() ? 90_000 : 900_000);
+
+let token: string | null = null;
+let tokenExpiry = 0;
+
+async function getToken(): Promise<string | null> {
+  const id = process.env.OPENSKY_CLIENT_ID;
+  const secret = process.env.OPENSKY_CLIENT_SECRET;
+  if (!id || !secret) return null;
+  if (token && Date.now() < tokenExpiry) return token;
+  try {
+    const res = await fetch(TOKEN_URL, {
+      method: 'POST',
+      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
+      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
+      signal: AbortSignal.timeout(10000),
+    });
+    if (!res.ok) { console.warn('[OSIRIS] OpenSky token request failed:', res.status); return null; }
+    const data = await res.json();
+    if (!data.access_token) return null;
+    token = data.access_token;
+    tokenExpiry = Date.now() + ((data.expires_in || 1800) - 60) * 1000;
+    return token;
+  } catch (e) {
+    console.warn('[OSIRIS] OpenSky token error:', e);
+    return null;
+  }
+}
+
+// Snapshot survives across requests within the same warm server instance —
+// state vectors are only worth re-fetching on pollIntervalMs(), not on every
+// client poll of /api/flights.
+let snapshot: StandardAircraft[] = [];
+let snapshotAt = 0;
+let cooldownUntil = 0;
+const COOLDOWN_MS = 15 * 60 * 1000;
+
+function toRawState(s: unknown[], nowSec: number): RawState | null {
+  const lon = s[5] as number | null;
+  const lat = s[6] as number | null;
+  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
+
+  const baroM = s[7] as number | null;
+  const velocityMs = s[9] as number | null;
+  const vertRateMs = s[11] as number | null;
+  const lastContact = (s[4] as number | null) ?? (s[3] as number | null) ?? nowSec;
+
+  return {
+    hex: String(s[0] || '').toLowerCase(),
+    flight: (s[1] as string | null)?.trim() || null,
+    lat,
+    lon,
+    altBaroFt: typeof baroM === 'number' ? baroM * M_TO_FT : null,
+    gs: typeof velocityMs === 'number' ? velocityMs * MS_TO_KTS : null,
+    track: (s[10] as number | null) ?? null,
+    vertRateFpm: typeof vertRateMs === 'number' ? vertRateMs * MS_TO_FPM : null,
+    squawk: (s[14] as string | null) || null,
+    country: (s[2] as string | null) || null,
+    categoryOs: s[17] as number | undefined,
+    onGround: Boolean(s[8]),
+    lastContactSec: lastContact,
+  };
+}
+
+export const openSkyProvider: AircraftDataProvider = {
+  name: 'opensky',
+
+  async fetchLiveAircraft(): Promise<ProviderFetchResult> {
+    const dueForRefresh = Date.now() - snapshotAt >= pollIntervalMs();
+    const inCooldown = Date.now() < cooldownUntil;
+
+    if (!dueForRefresh || inCooldown) {
+      return {
+        aircraft: snapshot,
+        provider: 'opensky',
+        ok: snapshot.length > 0,
+        ageSeconds: snapshotAt ? Math.round((Date.now() - snapshotAt) / 1000) : Infinity,
+      };
+    }
+
+    try {
+      const authToken = await getToken();
+      const res = await fetch(STATES_URL, {
+        signal: AbortSignal.timeout(30000),
+        headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
+      });
+
+      if (res.status === 429) {
+        cooldownUntil = Date.now() + COOLDOWN_MS;
+        console.warn('[OSIRIS] OpenSky 429 — cooling down 15 min');
+        await res.body?.cancel();
+        return {
+          aircraft: snapshot,
+          provider: 'opensky',
+          ok: snapshot.length > 0,
+          ageSeconds: snapshotAt ? Math.round((Date.now() - snapshotAt) / 1000) : Infinity,
+        };
+      }
+
+      if (!res.ok) {
+        console.warn('[OSIRIS] OpenSky returned', res.status);
+        await res.body?.cancel();
+        return {
+          aircraft: snapshot,
+          provider: 'opensky',
+          ok: false,
+          ageSeconds: snapshotAt ? Math.round((Date.now() - snapshotAt) / 1000) : Infinity,
+        };
+      }
+
+      const data = await res.json();
+      const states: unknown[][] = Array.isArray(data?.states) ? data.states : [];
+      const nowSec = Math.floor(Date.now() / 1000);
+
+      const parsed: StandardAircraft[] = [];
+      for (const s of states) {
+        const raw = toRawState(s, nowSec);
+        if (!raw) continue;
+        const classified = classifyFlight(raw);
+        if (!classified) continue;
+        classified.source = 'opensky';
+        parsed.push(classified);
+      }
+
+      // A near-empty response with a 200 is treated as unusable rather than
+      // "quiet airspace" — global state vectors never legitimately collapse
+      // to a handful of aircraft, so this is a malformed/partial response.
+      if (parsed.length > 100) {
+        snapshot = parsed;
+        snapshotAt = Date.now();
+      }
+
+      return {
+        aircraft: snapshot,
+        provider: 'opensky',
+        ok: snapshot.length > 0,
+        ageSeconds: snapshotAt ? Math.round((Date.now() - snapshotAt) / 1000) : Infinity,
+      };
+    } catch (e) {
+      console.warn('[OSIRIS] OpenSky fetch error:', e);
+      return {
+        aircraft: snapshot,
+        provider: 'opensky',
+        ok: false,
+        ageSeconds: snapshotAt ? Math.round((Date.now() - snapshotAt) / 1000) : Infinity,
+      };
+    }
+  },
+};
+
+export const openSkyHasCredentials = hasCreds;
diff --git a/src/lib/aircraftProviders/types.ts b/src/lib/aircraftProviders/types.ts
new file mode 100644
index 0000000..3e0bbc6
--- /dev/null
+++ b/src/lib/aircraftProviders/types.ts
@@ -0,0 +1,72 @@
+/**
+ * OSIRIS — Aircraft data provider abstraction.
+ *
+ * Any live-position source (OpenSky, adsb.fi, a future paid feed, …) is
+ * wrapped behind this interface: fetchLiveAircraft() returns whatever shape
+ * that provider speaks, normalizeAircraft() turns it into the StandardAircraft
+ * below. Nothing downstream of index.ts ever touches a provider's raw
+ * response, so swapping or adding a source never touches the map/UI code.
+ */
+
+/** Provider-agnostic, normalized aircraft state. Use `null` — never invent a
+ *  value — when a provider does not supply a field. */
+export interface StandardAircraft {
+  /** Stable identifier for this aircraft — its ICAO24 hex address. */
+  id: string;
+  callsign: string | null;
+  latitude: number;
+  longitude: number;
+  /** Barometric altitude, metres. */
+  altitude: number | null;
+  /** Ground speed, knots. */
+  speed: number | null;
+  /** True track / heading, degrees. */
+  heading: number | null;
+  /** Rate of climb/descent, metres per second (signed). */
+  verticalRate: number | null;
+  /** Country of registration, as reported by the source. */
+  country: string | null;
+  /** Human-readable aircraft type/model when known. */
+  aircraftType: string | null;
+  /** ISO-8601 timestamp of the last position the source reported for this
+   *  aircraft — not the poll time. */
+  lastUpdated: string;
+
+  // Extra fields the OSIRIS map/UI already renders. Not part of the minimal
+  // spec above, but dropping them would regress existing features.
+  icao24: string;
+  registration: string | null;
+  squawk: string | null;
+  grounded: boolean;
+  source: string;
+  /** Traffic class, used for layer bucketing and marker styling. */
+  category: 'commercial' | 'private' | 'jet' | 'military';
+  aircraftCategory: 'heli' | 'plane';
+  /** ADS-B Navigation Accuracy Category for Position (NACp), 0-11, when the
+   *  source reports it. A low value on a still-airborne aircraft is one
+   *  signal used for the GPS-jamming overlay. Null when not reported. */
+  nacP: number | null;
+}
+
+/** What a provider hands back for one polling cycle. */
+export interface ProviderFetchResult {
+  aircraft: StandardAircraft[];
+  /** Short machine-readable name, e.g. "opensky", "adsb.fi". */
+  provider: string;
+  /** True once this provider returned live data this cycle (a reused/stale
+   *  snapshot from a prior cycle still counts — false only means "nothing
+   *  usable came back, do not trust this batch"). */
+  ok: boolean;
+  /** Seconds since this provider's snapshot was actually refreshed from the
+   *  network — 0 for a fresh fetch, growing while a cached snapshot is reused. */
+  ageSeconds: number;
+}
+
+/** Every concrete provider implements this shape. */
+export interface AircraftDataProvider {
+  name: string;
+  /** Fetch (or reuse a cached) snapshot and return StandardAircraft objects
+   *  directly — normalization happens inside the provider, next to the raw
+   *  shape it understands, so nothing outside this folder parses raw fields. */
+  fetchLiveAircraft(): Promise<ProviderFetchResult>;
+}
