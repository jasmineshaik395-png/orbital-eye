// region-baselines.ts
// Orbital Eye — Regional Environmental Baselines

export interface RegionBaseline {
  id: string;
  name: string;
  country: string;

  // Geographic center
  latitude: number;
  longitude: number;

  // Normal environmental conditions
  normalWaterCoverage: number;
  normalVegetationIndex: number;
  normalTemperature: number;

  // Expected seasonal variation
  seasonalVariation: number;

  // Anomaly sensitivity
  anomalySensitivity: number;

  // Main environmental risks
  risks: string[];
}

export const REGION_BASELINES: Record<
  string,
  RegionBaseline
> = {
  guntur: {
    id: "guntur",
    name: "Guntur",
    country: "India",

    latitude: 16.3067,
    longitude: 80.4365,

    normalWaterCoverage: 8,
    normalVegetationIndex: 0.58,
    normalTemperature: 31,

    seasonalVariation: 15,
    anomalySensitivity: 1.2,

    risks: [
      "Flooding",
      "Extreme rainfall",
      "Heat",
      "Agricultural stress",
    ],
  },

  andhra_pradesh: {
    id: "andhra_pradesh",
    name: "Andhra Pradesh",
    country: "India",

    latitude: 15.9129,
    longitude: 79.7400,

    normalWaterCoverage: 10,
    normalVegetationIndex: 0.55,
    normalTemperature: 30,

    seasonalVariation: 18,
    anomalySensitivity: 1.15,

    risks: [
      "Flooding",
      "Cyclones",
      "Heat",
      "Drought",
      "Agricultural stress",
    ],
  },

  india: {
    id: "india",
    name: "India",
    country: "India",

    latitude: 20.5937,
    longitude: 78.9629,

    normalWaterCoverage: 12,
    normalVegetationIndex: 0.52,
    normalTemperature: 28,

    seasonalVariation: 20,
    anomalySensitivity: 1.1,

    risks: [
      "Flooding",
      "Heatwaves",
      "Drought",
      "Cyclones",
      "Wildfires",
      "Agricultural stress",
    ],
  },

  amazon: {
    id: "amazon",
    name: "Amazon Basin",
    country: "Brazil",

    latitude: -3.4653,
    longitude: -62.2159,

    normalWaterCoverage: 18,
    normalVegetationIndex: 0.82,
    normalTemperature: 27,

    seasonalVariation: 12,
    anomalySensitivity: 1.3,

    risks: [
      "Deforestation",
      "Wildfires",
      "Flooding",
      "Vegetation loss",
    ],
  },

  california: {
    id: "california",
    name: "California",
    country: "United States",

    latitude: 36.7783,
    longitude: -119.4179,

    normalWaterCoverage: 6,
    normalVegetationIndex: 0.48,
    normalTemperature: 22,

    seasonalVariation: 25,
    anomalySensitivity: 1.25,

    risks: [
      "Wildfires",
      "Drought",
      "Heatwaves",
      "Water stress",
    ],
  },

  australia: {
    id: "australia",
    name: "Australia",
    country: "Australia",

    latitude: -25.2744,
    longitude: 133.7751,

    normalWaterCoverage: 7,
    normalVegetationIndex: 0.42,
    normalTemperature: 24,

    seasonalVariation: 22,
    anomalySensitivity: 1.2,

    risks: [
      "Wildfires",
      "Drought",
      "Heatwaves",
      "Flooding",
    ],
  },

  europe: {
    id: "europe",
    name: "Europe",
    country: "Europe",

    latitude: 54.5260,
    longitude: 15.2551,

    normalWaterCoverage: 9,
    normalVegetationIndex: 0.55,
    normalTemperature: 15,

    seasonalVariation: 18,
    anomalySensitivity: 1.05,

    risks: [
      "Flooding",
      "Heatwaves",
      "Drought",
      "Extreme weather",
    ],
  },

  africa: {
    id: "africa",
    name: "Africa",
    country: "Africa",

    latitude: 1.6508,
    longitude: 17.6791,

    normalWaterCoverage: 6,
    normalVegetationIndex: 0.38,
    normalTemperature: 27,

    seasonalVariation: 25,
    anomalySensitivity: 1.3,

    risks: [
      "Drought",
      "Heatwaves",
      "Flooding",
      "Desertification",
      "Wildfires",
    ],
  },

  southeast_asia: {
    id: "southeast_asia",
    name: "Southeast Asia",
    country: "Southeast Asia",

    latitude: 5.0,
    longitude: 110.0,

    normalWaterCoverage: 15,
    normalVegetationIndex: 0.68,
    normalTemperature: 28,

    seasonalVariation: 20,
    anomalySensitivity: 1.25,

    risks: [
      "Flooding",
      "Tropical storms",
      "Deforestation",
      "Extreme rainfall",
    ],
  },
};

/**
 * Get a regional baseline.
 */
export function getRegionBaseline(
  regionId: string
): RegionBaseline | undefined {
  return REGION_BASELINES[regionId];
}

/**
 * Get all available regions.
 */
export function getAllRegions(): RegionBaseline[] {
  return Object.values(REGION_BASELINES);
}

/**
 * Calculate how different a value is from the regional baseline.
 *
 * Returns percentage difference.
 */
export function calculateDeviation(
  actual: number,
  baseline: number
): number {
  if (baseline === 0) {
    return 0;
  }

  return Number(
    (((actual - baseline) / baseline) * 100).toFixed(2)
  );
}

/**
 * Calculate anomaly score using the regional sensitivity.
 */
export function calculateRegionalAnomalyScore(
  regionId: string,
  deviation: number
): number {
  const region = getRegionBaseline(regionId);

  if (!region) {
    return Math.min(Math.abs(deviation), 100);
  }

  const score =
    Math.abs(deviation) * region.anomalySensitivity;

  return Math.min(
    Math.round(score),
    100
  );
}

/**
 * Compare current environmental data
 * against the regional baseline.
 */
export function compareWithBaseline(
  regionId: string,
  data: {
    waterCoverage?: number;
    vegetationIndex?: number;
    temperature?: number;
  }
) {
  const baseline = getRegionBaseline(regionId);

  if (!baseline) {
    return null;
  }

  const result = {
    region: baseline.name,
    waterDeviation: 0,
    vegetationDeviation: 0,
    temperatureDeviation: 0,
    anomalyScore: 0,
  };

  const deviations: number[] = [];

  if (data.waterCoverage !== undefined) {
    result.waterDeviation = calculateDeviation(
      data.waterCoverage,
      baseline.normalWaterCoverage
    );

    deviations.push(
      Math.abs(result.waterDeviation)
    );
  }

  if (data.vegetationIndex !== undefined) {
    result.vegetationDeviation = calculateDeviation(
      data.vegetationIndex,
      baseline.normalVegetationIndex
    );

    deviations.push(
      Math.abs(result.vegetationDeviation)
    );
  }

  if (data.temperature !== undefined) {
    result.temperatureDeviation = calculateDeviation(
      data.temperature,
      baseline.normalTemperature
    );

    deviations.push(
      Math.abs(result.temperatureDeviation)
    );
  }

  if (deviations.length > 0) {
    const averageDeviation =
      deviations.reduce(
        (sum, value) => sum + value,
        0
      ) / deviations.length;

    result.anomalyScore =
      calculateRegionalAnomalyScore(
        regionId,
        averageDeviation
      );
  }

  return result;
}
