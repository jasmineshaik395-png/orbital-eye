import { NextRequest, NextResponse } from 'next/server';

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Orbital Eye – Earth Anomaly Intelligence
 *
 * Prototype anomaly engine.
 *
 * IMPORTANT:
 * The current calculations are demo/prototype signals.
 * Replace them with real satellite/environment observations
 * before presenting the values as measured satellite data.
 */

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
      { error: 'Invalid latitude or longitude' },
      { status: 400 }
    );
  }

  /*
   * Generate a stable regional signal.
   *
   * This is intentionally deterministic:
   * the values stay consistent for the same coordinates
   * instead of changing randomly on every refresh.
   */
  const seed = Math.abs(
    Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453
  );

  const signal = seed - Math.floor(seed);

  // Prototype environmental changes
  const waterChange = Math.round(6 + signal * 24);

  const vegetationChange = -Math.round(
    4 + signal * 16
  );

  const heatChange = Number(
    (0.8 + signal * 3.8).toFixed(1)
  );

  /*
   * Calculate anomaly score.
   *
   * 0   = normal
   * 25+ = watch
   * 50+ = anomaly
   * 75+ = critical
   */
  const score = Math.round(
    clamp(
      waterChange * 1.5 +
        Math.abs(vegetationChange) * 1.2 +
        heatChange * 8
    )
  );

  const status =
    score >= 75
      ? 'CRITICAL'
      : score >= 50
        ? 'ANOMALY'
        : score >= 25
          ? 'WATCH'
          : 'NORMAL';

  /*
   * Identify the strongest possible event.
   */
  const possibleEvent =
    waterChange >= 22
      ? 'POSSIBLE FLOOD / WATER EXPANSION'
      : heatChange >= 3
        ? 'UNUSUAL SURFACE HEAT'
        : 'ENVIRONMENTAL CHANGE';

  /*
   * Prototype confidence score.
   */
  const confidence = Math.round(
    clamp(68 + signal * 22)
  );

  /*
   * Human-readable explanation.
   */
  let explanation =
    'The prototype combines water, vegetation and heat-change signals to identify an unusual regional pattern.';

  if (waterChange >= 22) {
    explanation =
      'The prototype flags a large increase in surface-water signal combined with vegetation decline.';
  } else if (heatChange >= 3) {
    explanation =
      'The prototype detects an elevated surface-heat signal compared with the regional baseline.';
  } else if (vegetationChange <= -12) {
    explanation =
      'The prototype detects a notable vegetation decline combined with other environmental changes.';
  }

  return NextResponse.json({
    source: 'Orbital Eye Prototype Analysis',

    // Clearly identifies that these are not yet real satellite measurements.
    isDemo: true,

    coordinates: {
      lat,
      lng,
    },

    anomaly: {
      score,
      status,
    },

    metrics: {
      waterChangePercent: waterChange,
      vegetationChangePercent: vegetationChange,
      heatChangeCelsius: heatChange,
    },

    possibleEvent,

    confidence,

    explanation,

    generatedAt: new Date().toISOString(),
  });
}
