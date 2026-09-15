export interface BenchmarkMetric {
  label: string;
  value: string;
  description: string;
  status?: string;
}

export const benchmarkMetrics: BenchmarkMetric[] = [
  {
    label: "INTELLIGENCE LAYERS",
    value: "26",
    description: "Integrated monitoring layers",
    status: "ACTIVE",
  },
  {
    label: "ENTITIES",
    value: "55,938",
    description: "Tracked data entities",
    status: "LIVE",
  },
  {
    label: "GLOBAL COVERAGE",
    value: "GLOBAL",
    description: "Geographic monitoring",
    status: "ACTIVE",
  },
  {
    label: "DATA STATUS",
    value: "LIVE",
    description: "Continuously updated",
    status: "ONLINE",
  },
];

export const benchmarkComparison = [
  {
    capability: "Data Sources",
    traditional: "Multiple Platforms",
    osiris: "Unified Platform",
  },
  {
    capability: "Global Visualization",
    traditional: "Separate Views",
    osiris: "Single 3D Globe",
  },
  {
    capability: "Event Monitoring",
    traditional: "Manual",
    osiris: "Integrated",
  },
  {
    capability: "Data Layers",
    traditional: "Separate",
    osiris: "26 Integrated Layers",
  },
  {
    capability: "Geographic Analysis",
    traditional: "Multiple Tools",
    osiris: "Built-in",
  },
];

export const benchmarkCapabilities = [
  "Multi-source intelligence integration",
  "Real-time event visualization",
  "3D and 2D geographic visualization",
  "Layer-based monitoring",
  "Global event tracking",
  "Interactive map analysis",
];
