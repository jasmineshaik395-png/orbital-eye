'use client';

import { useEffect, useState } from 'react';

type RegionAnalysisProps = {
  lat?: number;
  lng?: number;
  locationLabel?: string;
};

type EnvironmentalData = {
  source?: string;
  isDemo?: boolean;
  coordinates?: {
    lat?: number;
    lng?: number;
  };
  anomaly?: {
    score?: number;
    status?: string;
  };
  indicators?: {
    vegetationChangePercent?: number;
    waterChangePercent?: number;
    surfaceTemperatureChangeCelsius?: number;
    airQualityChangePercent?: number;
  };
  possibleEvent?: string;
  confidence?: number;
  explanation?: string;
  generatedAt?: string;
};

type FloodData = {
  source?: string;
  isDemo?: boolean;
  flood?: {
    score?: number;
    risk?: string;
  };
  indicators?: {
    waterExpansionPercent?: number;
    rainfallIntensityPercent?: number;
    drainageStressPercent?: number;
  };
  possibleEvent?: string;
  confidence?: number;
  explanation?: string;
};

function safeNumber(value: unknown, fallback = 0): number {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function formatCoordinate(value: unknown): string {
  const number = Number(value);

  return Number.isFinite(number) ? number.toFixed(4) : '—';
}

function formatPercent(value: unknown): string {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '—';
  }

  return `${number > 0 ? '+' : ''}${number.toFixed(1)}`;
}

function formatNumber(value: unknown): string {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '—';
  }

  return `${number > 0 ? '+' : ''}${number.toFixed(1)}`;
}

export default function RegionAnalysis({
  lat,
  lng,
  locationLabel,
}: RegionAnalysisProps) {
  const [environment, setEnvironment] =
    useState<EnvironmentalData | null>(null);

  const [flood, setFlood] = useState<FloodData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasCoordinates =
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

  useEffect(() => {
    let cancelled = false;

    async function loadAnalysis() {
      try {
        setLoading(true);
        setError(null);

        if (!hasCoordinates) {
          throw new Error(
            'Select a valid region on the globe to run regional analysis.'
          );
        }

        const safeLat = safeNumber(lat);
        const safeLng = safeNumber(lng);

        const query = `lat=${encodeURIComponent(
          safeLat
        )}&lng=${encodeURIComponent(safeLng)}`;

        const [environmentResponse, floodResponse] =
          await Promise.all([
            fetch(`/api/environment?${query}`, {
              cache: 'no-store',
            }),

            fetch(`/api/flood?${query}`, {
              cache: 'no-store',
            }),
          ]);

        if (!environmentResponse.ok || !floodResponse.ok) {
          throw new Error('Unable to load regional intelligence');
        }

        const environmentData: EnvironmentalData =
          await environmentResponse.json();

        const floodData: FloodData =
          await floodResponse.json();

        if (!cancelled) {
          setEnvironment(environmentData);
          setFlood(floodData);
        }
      } catch (err) {
        if (!cancelled) {
          setEnvironment(null);
          setFlood(null);

          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load regional intelligence'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAnalysis();

    return () => {
      cancelled = true;
    };
  }, [lat, lng, hasCoordinates]);

  const environmentScore = safeNumber(
    environment?.anomaly?.score
  );

  const floodScore = safeNumber(flood?.flood?.score);

  const confidence = safeNumber(environment?.confidence);

  return (
    <section
      className="
        w-[360px] max-w-[calc(100vw-24px)]
        overflow-hidden rounded-lg
        border border-white/10
        bg-black/85
        text-white
        shadow-2xl shadow-black/50
        backdrop-blur-xl
      "
    >
      {/* HEADER */}
      <div className="border-b border-white/10 px-4 py-3">
        <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-white/35">
          ORBITAL EYE / REGIONAL INTELLIGENCE
        </div>

        <h2 className="mt-1 text-sm font-semibold tracking-wide">
          REGION ANALYSIS
        </h2>

        <div className="mt-1 font-mono text-[8px] text-white/30">
          {locationLabel || 'Selected Region'}
        </div>

        <div className="mt-0.5 font-mono text-[8px] text-white/25">
          {formatCoordinate(lat)}° , {formatCoordinate(lng)}°
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="px-4 py-8 text-center">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border border-white/10 border-t-white/70" />

          <div className="mt-3 text-[9px] font-mono uppercase tracking-widest text-white/40">
            Analyzing region...
          </div>
        </div>
      )}

      {/* ERROR */}
      {!loading && error && (
        <div className="m-4 rounded border border-red-400/20 bg-red-400/5 p-3">
          <div className="text-[9px] font-mono uppercase tracking-widest text-red-400">
            ANALYSIS ERROR
          </div>

          <div className="mt-1 text-[9px] leading-relaxed text-white/50">
            {error}
          </div>
        </div>
      )}

      {/* RESULTS */}
      {!loading && !error && environment && flood && (
        <div className="space-y-4 p-4">
          {/* OVERALL INTELLIGENCE */}
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[8px] font-mono uppercase tracking-widest text-white/30">
                  ENVIRONMENT STATUS
                </div>

                <div className="mt-1 text-sm font-bold">
                  {environment.anomaly?.status || 'UNKNOWN'}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[8px] font-mono uppercase tracking-widest text-white/30">
                  SCORE
                </div>

                <div className="text-2xl font-bold">
                  {environmentScore.toFixed(0)}
                  <span className="text-xs text-white/25">
                    /100
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ENVIRONMENTAL INDICATORS */}
          <div>
            <div className="mb-2 text-[8px] font-mono uppercase tracking-widest text-white/30">
              ENVIRONMENTAL INDICATORS
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Indicator
                label="WATER CHANGE"
                value={`${formatPercent(
                  environment.indicators?.waterChangePercent
                )}%`}
              />

              <Indicator
                label="VEGETATION"
                value={`${formatPercent(
                  environment.indicators?.vegetationChangePercent
                )}%`}
              />

              <Indicator
                label="SURFACE HEAT"
                value={`${formatNumber(
                  environment.indicators
                    ?.surfaceTemperatureChangeCelsius
                )}°C`}
              />

              <Indicator
                label="AIR QUALITY"
                value={`${formatPercent(
                  environment.indicators?.airQualityChangePercent
                )}%`}
              />
            </div>
          </div>

          {/* FLOOD INTELLIGENCE */}
          <div>
            <div className="mb-2 text-[8px] font-mono uppercase tracking-widest text-white/30">
              FLOOD INTELLIGENCE
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-white/50">
                  FLOOD RISK
                </span>

                <span className="text-[10px] font-bold">
                  {flood.flood?.risk || 'UNKNOWN'}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-[9px] font-mono text-white/50">
                  FLOOD SCORE
                </span>

                <span className="font-mono text-[10px] text-white/75">
                  {floodScore.toFixed(0)}/100
                </span>
              </div>

              <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white/60 transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      Math.max(floodScore, 0),
                      100
                    )}%`,
                  }}
                />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <SmallMetric
                  label="WATER"
                  value={`${formatPercent(
                    flood.indicators?.waterExpansionPercent
                  )}%`}
                />

                <SmallMetric
                  label="RAIN"
                  value={`${formatPercent(
                    flood.indicators?.rainfallIntensityPercent
                  )}%`}
                />

                <SmallMetric
                  label="DRAINAGE"
                  value={`${formatPercent(
                    flood.indicators?.drainageStressPercent
                  )}%`}
                />
              </div>
            </div>
          </div>

          {/* POSSIBLE EVENTS */}
          <div>
            <div className="mb-2 text-[8px] font-mono uppercase tracking-widest text-white/30">
              POSSIBLE EVENTS
            </div>

            <div className="space-y-2">
              <EventRow
                label="ENVIRONMENT"
                value={
                  environment.possibleEvent ||
                  'No significant event detected'
                }
              />

              <EventRow
                label="FLOOD"
                value={
                  flood.possibleEvent ||
                  'No significant flood event detected'
                }
              />
            </div>
          </div>

          {/* CONFIDENCE */}
          <div className="rounded border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono uppercase tracking-widest text-white/30">
                ANALYSIS CONFIDENCE
              </span>

              <span className="font-mono text-[9px] text-white/70">
                {confidence.toFixed(0)}%
              </span>
            </div>

            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/60 transition-all duration-500"
                style={{
                  width: `${Math.min(
                    Math.max(confidence, 0),
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* EXPLANATION */}
          <div>
            <div className="text-[8px] font-mono uppercase tracking-widest text-white/30">
              INTELLIGENCE SUMMARY
            </div>

            <p className="mt-1 text-[9px] leading-relaxed text-white/50">
              {environment.explanation ||
                'No environmental explanation available.'}
            </p>

            <p className="mt-2 text-[9px] leading-relaxed text-white/40">
              {flood.explanation ||
                'No flood explanation available.'}
            </p>
          </div>

          {/* HUMAN VERIFICATION */}
          <div className="rounded border border-yellow-400/20 bg-yellow-400/5 p-3">
            <div className="text-[8px] font-mono uppercase tracking-widest text-yellow-400/80">
              HUMAN VERIFICATION
            </div>

            <p className="mt-1 text-[8px] leading-relaxed text-white/40">
              Detected patterns are indicators for further
              investigation and should be verified using reliable
              external observations or official sources.
            </p>
          </div>

          {/* DEMO NOTICE */}
          {(environment.isDemo || flood.isDemo) && (
            <div className="border-t border-white/10 pt-3">
              <div className="text-[7px] font-mono uppercase tracking-widest text-yellow-400/70">
                PROTOTYPE / DEMO DATA
              </div>

              <p className="mt-1 text-[8px] leading-relaxed text-white/30">
                Current regional indicators are simulated prototype
                signals and should not be presented as actual
                satellite measurements.
              </p>
            </div>
          )}

          {/* FOOTER */}
          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-[7px] font-mono uppercase tracking-widest text-white/20">
              ORBITAL EYE
            </span>

            <span className="text-[7px] font-mono uppercase tracking-widest text-white/20">
              REGIONAL ANALYSIS
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function Indicator({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border border-white/10 bg-white/[0.025] p-2.5">
      <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
        {label}
      </div>

      <div className="mt-1 text-[11px] font-semibold text-white/75">
        {value}
      </div>
    </div>
  );
}

function SmallMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border border-white/10 bg-black/20 p-2">
      <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
        {label}
      </div>

      <div className="mt-1 text-[9px] font-semibold text-white/65">
        {value}
      </div>
    </div>
  );
}

function EventRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded border border-white/10 bg-white/[0.02] px-3 py-2">
      <span className="shrink-0 text-[7px] font-mono uppercase tracking-widest text-white/25">
        {label}
      </span>

      <span className="text-right text-[8px] font-medium text-white/65">
        {value}
      </span>
    </div>
  );
}
