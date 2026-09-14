import { NextRequest, NextResponse } from 'next/server';

/**
 * Orbital Eye – Environmental Intelligence API
 *
 * Prototype environmental-change analysis.
 *
 * IMPORTANT:
 * These values are DEMO/PROTOTYPE signals.
 * They are not actual satellite measurements.
 * Replace these calculations with real satellite/environmental
 * observations before presenting them as real-world measurements.
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
   * Generate a stable regional signal.
   *
   * The same coordinates produce the same demo values.
   */
  const seed = Math.abs(
    Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453
  );

  const signal = seed - Math.floor(seed);

  /*
   * Prototype environmental indicators
   */

  // Simulated vegetation change
  const vegetationChange = -Math.round(
    3 + signal * 22
  );

  // Simulated water coverage change
  const waterChange = Math.round(
    4 + signal * 30
  );

  // Simulated surface temperature change
  const temperatureChange = Number(
    (0.5 + signal * 4.5).toFixed(1)
  );

  // Simulated air-quality change
  const airQualityChange = Math.round(
    5 + signal * 35
  );

  /*
   * Calculate environmental anomaly score.
   */
  const anomalyScore = Math.round(
    clamp(
      Math.abs(vegetationChange) * 1.2 +
        waterChange * 1.3 +
        temperatureChange * 8 +
        airQualityChange * 0.3
    )
  );

  /*
   * Environmental status
   */
  const status =
    anomalyScore >= 75
      ? 'CRITICAL'
      : anomalyScore >= 50
        ? 'ANOMALY'
        : anomalyScore >= 25
          ? 'WATCH'
          : 'NORMAL';

  /*
   * Identify the strongest environmental signal.
   */
  let possibleEvent = 'NORMAL ENVIRONMENTAL CONDITIONS';

  if (waterChange >= 25) {
    possibleEvent = 'POSSIBLE WATER EXPANSION';
  } else if (Math.abs(vegetationChange) >= 18) {
    possibleEvent = 'POSSIBLE VEGETATION DECLINE';
  } else if (temperatureChange >= 3.5) {
    possibleEvent = 'UNUSUAL SURFACE HEAT';
  } else if (airQualityChange >= 30) {
    possibleEvent = 'ELEVATED AIR-QUALITY CHANGE';
  } else if (anomalyScore >= 25) {
    possibleEvent = 'ENVIRONMENTAL CHANGE DETECTED';
  }

  /*
   * Prototype confidence score.
   */
  const confidence = Math.round(
    clamp(65 + signal * 25)
  );

  /*
   * Human-readable explanation.
   */
  let explanation =
    'The prototype combines vegetation, water, surface-temperature and air-quality signals to identify unusual environmental patterns.';

  if (waterChange >= 25) {
    explanation =
      'The prototype detects a strong increase in the simulated water-coverage signal and flags a possible environmental change.';
  } else if (Math.abs(vegetationChange) >= 18) {
    explanation =
      'The prototype detects a notable simulated vegetation decline that may require further environmental observation.';
  } else if (temperatureChange >= 3.5) {
    explanation =
      'The prototype detects an elevated simulated surface-temperature signal compared with the regional baseline.';
  } else if (airQualityChange >= 30) {
    explanation =
      'The prototype detects a significant simulated change in the air-quality indicator.';
  }

  return NextResponse.json({
    source: 'Orbital Eye Environmental Intelligence',

    // Clearly identifies this as prototype/demo analysis.
    isDemo: true,

    coordinates: {
      lat,
      lng,
    },

    anomaly: {
      score: anomalyScore,
      status,
    },

    indicators: {
      vegetationChangePercent: vegetationChange,
      waterChangePercent: waterChange,
      surfaceTemperatureChangeCelsius: temperatureChange,
      airQualityChangePercent: airQualityChange,
    },

    possibleEvent,

    confidence,

    explanation,

    generatedAt: new Date().toISOString(),
  });
}
