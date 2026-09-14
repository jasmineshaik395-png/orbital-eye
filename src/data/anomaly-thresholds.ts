export type AnomalyType =
  | "flood"
  | "vegetation"
  | "land"
  | "water"
  | "temperature"
  | "fire"
  | "urban"
  | "environment";

export type AnomalySeverity =
  | "normal"
  | "warning"
  | "critical";

export interface AnomalyThreshold {
  type: AnomalyType;
  label: string;
  unit: string;
  normal: number;
  warning: number;
  critical: number;
  description: string;
}

export const ANOMALY_THRESHOLDS: Record<
  AnomalyType,
  AnomalyThreshold
> = {
  flood: {
    type: "flood",
    label: "Flood / Water Expansion",
    unit: "%",
    normal: 5,
    warning: 15,
    critical: 30,
    description:
      "Detects abnormal expansion of surface water and possible flood-affected regions.",
  },

  vegetation: {
    type: "vegetation",
    label: "Vegetation Stress",
    unit: "%",
    normal: 10,
    warning: 25,
    critical: 45,
    description:
      "Measures abnormal vegetation loss or vegetation health deterioration.",
  },

  land: {
    type: "land",
    label: "Land Surface Change",
    unit: "%",
    normal: 10,
    warning: 25,
    critical: 50,
    description:
      "Detects significant changes in land-cover and surface conditions.",
  },

  water: {
    type: "water",
    label: "Water Body Change",
    unit: "%",
    normal: 10,
    warning: 25,
    critical: 50,
    description:
      "Detects unusual changes in lakes, rivers, reservoirs and other water bodies.",
  },

  temperature: {
    type: "temperature",
    label: "Temperature Anomaly",
    unit: "°C",
    normal: 1,
    warning: 2,
    critical: 4,
    description:
      "Identifies areas experiencing unusual surface-temperature changes.",
  },

  fire: {
    type: "fire",
    label: "Fire / Thermal Anomaly",
    unit: "score",
    normal: 20,
    warning: 50,
    critical: 80,
    description:
      "Identifies significant thermal activity and possible wildfire hotspots.",
  },

  urban: {
    type: "urban",
    label: "Urban Expansion",
    unit: "%",
    normal: 5,
    warning: 15,
    critical: 30,
    description:
      "Detects abnormal changes in built-up and urbanized areas.",
  },

  environment: {
    type: "environment",
    label: "Environmental Anomaly",
    unit: "score",
    normal: 20,
    warning: 50,
    critical: 80,
    description:
      "Combines environmental indicators to identify unusual regional conditions.",
  },
};

export function getAnomalySeverity(
  type: AnomalyType,
  value: number
): AnomalySeverity {
  const threshold = ANOMALY_THRESHOLDS[type];

  if (!threshold) {
    return "normal";
  }

  if (value >= threshold.critical) {
    return "critical";
  }

  if (value >= threshold.warning) {
    return "warning";
  }

  return "normal";
}

export function getSeverityLabel(
  type: AnomalyType,
  value: number
): string {
  return getAnomalySeverity(type, value).toUpperCase();
}

export function getSeverityScore(
  type: AnomalyType,
  value: number
): number {
  const threshold = ANOMALY_THRESHOLDS[type];

  if (!threshold || value <= 0) {
    return 0;
  }

  if (value >= threshold.critical) {
    return 100;
  }

  return Math.round(
    (value / threshold.critical) * 100
  );
}

export function getThreshold(
  type: AnomalyType
): AnomalyThreshold {
  return ANOMALY_THRESHOLDS[type];
}

export function shouldTriggerAlert(
  type: AnomalyType,
  value: number
): boolean {
  const severity = getAnomalySeverity(type, value);

  return (
    severity === "warning" ||
    severity === "critical"
  );
}

export function getAnomalyTypes(): AnomalyType[] {
  return Object.keys(
    ANOMALY_THRESHOLDS
  ) as AnomalyType[];
}
