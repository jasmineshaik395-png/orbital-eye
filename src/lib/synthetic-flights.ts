// Synthetic demo aircraft only. Military data is never created or changed here.
export type SyntheticFlight = {
  icao24: string;
  callsign: string;
  lat: number;
  lng: number;
  alt: number;
  heading: number;
  speed_knots: number;
  model: string;
  registration: string;
  squawk: string;
  category: 'commercial' | 'private' | 'jet';
  aircraft_category: string;
  grounded: false;
  source: 'SYNTHETIC DEMO';
  type: 'flight';
  id: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  verticalRate: number;
  country: string;
  aircraftType: string;
  lastUpdated: string;
};

const AIRPORTS = [
  [51.47, -0.45], [40.64, -73.78], [25.25, 55.36], [1.35, 103.99],
  [35.55, 139.78], [28.56, 77.10], [19.09, 72.87], [13.69, 100.75],
  [49.01, 2.55], [41.80, 12.25], [52.31, 4.76], [37.62, -122.38],
  [33.94, -118.40], [22.31, 113.91], [31.14, 121.80], [43.68, -79.63],
  [-23.43, -46.47], [-33.95, 151.18], [ -26.13, 28.24], [30.12, 31.40],
  [59.65, 17.92], [55.97, 37.41], [45.63, 8.72], [50.11, 8.68],
  [38.77, -9.13], [19.44, -99.07], [14.67, -17.07], [6.58, 3.32],
  [34.43, -118.41], [35.68, 139.65], [24.96, 121.23], [37.46, 126.44],
];

const MODELS = ['A320', 'B737', 'B787', 'A350', 'B777', 'E190', 'CRJ900'];
const JET_MODELS = ['G650', 'G550', 'Global 7500', 'Citation X', 'Falcon 8X'];

function makeFlight(i: number, category: SyntheticFlight['category'], now: number): SyntheticFlight {
  const a = AIRPORTS[i % AIRPORTS.length];
  const b = AIRPORTS[(i * 7 + 11) % AIRPORTS.length];
  const phase = ((now / 120000) + i * 0.37) % 1;
  const curve = Math.sin(i * 12.9898) * 0.5 + 0.5;
  const lat = Math.max(-78, Math.min(78, a[0] * (1 - phase) + b[0] * phase + Math.sin(i * 2.3) * 5));
  const lng = ((((a[1] * (1 - phase) + b[1] * phase + Math.cos(i * 1.7) * 8) + 540) % 360) - 180);
  const model = category === 'jet' ? JET_MODELS[i % JET_MODELS.length] : MODELS[i % MODELS.length];
  const prefix = category === 'commercial' ? 'SYN-A' : category === 'private' ? 'SYN-P' : 'SYN-J';
  const id = `${prefix}${String(i).padStart(4, '0')}`;
  const speed = category === 'jet' ? 420 + (i % 90) : category === 'private' ? 260 + (i % 80) : 390 + (i % 120);
  const altitude = category === 'jet' ? 28000 + (i % 11000) : 24000 + (i % 15000);
  return {
    icao24: id.toLowerCase(), callsign: `${prefix}${String(i + 1).padStart(3, '0')}`,
    lat, lng, latitude: lat, longitude: lng,
    alt: altitude, altitude, heading: Math.round((phase * 360 + i * 17) % 360),
    speed_knots: speed, speed, model, aircraftType: model,
    registration: `DEMO-${String(i + 1).padStart(4, '0')}`, squawk: '0000',
    category, aircraft_category: category, grounded: false,
    source: 'SYNTHETIC DEMO', type: 'flight', id,
    verticalRate: Math.round((curve - 0.5) * 400), country: 'DEMO',
    lastUpdated: new Date(now).toISOString(),
  };
}

export function addSyntheticFlights(existing: any): any {
  const now = Date.now();
  return {
    ...existing,
    // Only civilian/demo buckets are extended. military_flights is preserved exactly.
    commercial_flights: [
      ...(existing?.commercial_flights || []),
      ...Array.from({ length: 180 }, (_, i) => makeFlight(i, 'commercial', now)),
    ],
    private_flights: [
      ...(existing?.private_flights || []),
      ...Array.from({ length: 70 }, (_, i) => makeFlight(i, 'private', now)),
    ],
    private_jets: [
      ...(existing?.private_jets || []),
      ...Array.from({ length: 50 }, (_, i) => makeFlight(i, 'jet', now)),
    ],
  };
}
