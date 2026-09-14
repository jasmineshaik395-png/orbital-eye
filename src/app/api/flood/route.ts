import { NextRequest, NextResponse } from 'next/server';

/**
 * Orbital Eye – Flood Intelligence API
 *
 * Prototype flood/water-change analysis.
 *
 * IMPORTANT:
 * These values are DEMO/PROTOTYPE signals.
 * They are not actual satellite measurements.
 * Replace the calculations with real satellite or
 * environmental observations before presenting them
 * as real-world flood detection.
 */

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const lat = Number(searchParams.get('lat') ?? 16.3067);
  const lng = Number(searchParams.get('lng') ?? 80.4365);

  // Validate coordinates
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return NextResponse.json(
      {
        error: 'Invalid latitude or longitude',
      },
      { status: 400 }
    );
  }

  /*
   * Generate a stable signal for the selected region.
   *
   * The same coordinates produce the same demo result.
   * This prevents the values from changing randomly
   * every time the API is refreshed.
   */
  const seed = Math.abs(
    Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453
  );

  const signal = seed - Math.floor(seed);

  /*
   * Prototype water indicators
   */
  const waterExpansion = Math.round(5 + signal * 35);

  const rainfallIntensity = Math.round(10 + signal * 80);

  const drainageStress = Math.round(
    15 + signal * 70
  );

  /*
   * Flood risk score
   *
   * Water expansion has the highest weight because
   * it is the main indicator in this prototype.
   */
  const floodScore = Math.round(
    clamp(
      waterExpansion * 1.4 +
        rainfallIntensity * 0.35 +
        drainageStress * 0.25
    )
  );

  /*
   * Flood risk classification
   */
  const risk =
    floodScore >= 75
      ? 'HIGH'
      : floodScore >= 50
        ? 'MODERATE'
        : floodScore >= 25
          ? 'LOW'
          : 'NORMAL';

  /*
   * Determine the possible flood condition.
   */
  let possibleEvent = 'NO SIGNIFICANT WATER ANOMALY';

  if (waterExpansion >= 30) {
    possibleEvent = 'POSSIBLE FLOOD / RAPID WATER EXPANSION';
  } else if (waterExpansion >= 20) {
    possibleEvent = 'POSSIBLE WATER EXPANSION';
  } else if (rainfallIntensity >= 65) {
    possibleEvent = 'HIGH RAINFALL CONDITIONS';
  }

  /*
   * Prototype confidence.
   */
  const confidence = Math.round(
    clamp(65 + signal * 25)
  );

  /*
   * Human-readable explanation.
   */
  let explanation =
    'The prototype compares water expansion, rainfall intensity and drainage stress to estimate a possible flood-related anomaly.';

  if (waterExpansion >= 30) {
    explanation =
      'The prototype detects a strong increase in the simulated surface-water signal, which may indicate possible flooding or rapid water expansion.';
  } else if (waterExpansion >= 20) {
    explanation =
      'The prototype detects an increase in the simulated surface-water signal that requires further observation.';
  } else if (rainfallIntensity >= 65) {
    explanation =
      'The prototype detects elevated rainfall conditions that may contribute to increased flood risk.';
  }

  return NextResponse.json({
    source: 'Orbital Eye Flood Intelligence',

    // Clearly identifies this as prototype/demo analysis.
    isDemo: true,

    coordinates: {
      lat,
      lng,
    },

    flood: {
      score: floodScore,
      risk,
    },

    indicators: {
      waterExpansionPercent: waterExpansion,
      rainfallIntensityPercent: rainfallIntensity,
      drainageStressPercent: drainageStress,
    },

    possibleEvent,

    confidence,

    explanation,

    generatedAt: new Date().toISOString(),
  });
}
