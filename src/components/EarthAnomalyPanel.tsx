'use client';

import { useEffect, useState } from 'react';

type AnomalyData = {
  source?: string;
  isDemo?: boolean;
  coordinates?: {
    lat?: number;
    lng?: number;
  };
  anomaly?: {
    score?: number;
    status?: 'NORMAL' | 'WATCH' | 'ANOMALY' | 'CRITICAL';
  };
  metrics?: {
    waterChangePercent?: number;
    vegetationChangePercent?: number;
    heatChangeCelsius?: number;
  };
  possibleEvent?: string;
  confidence?: number;
  explanation?: string;
  generatedAt?: string;
};

type EarthAnomalyPanelProps = {
  lat?: number;
  lng?: number;
  locationLabel?: string;
};

const statusConfig = {
  NORMAL: {
    label: 'NORMAL',
    symbol: '●',
    border: 'border-emerald-400/30',
    text: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
  },
  WATCH: {
    label: 'WATCH',
    symbol: '◐',
    border: 'border-yellow-400/30',
    text: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
  },
  ANOMALY: {
    label: 'ANOMALY',
    symbol: '▲',
    border: 'border-orange-400/30',
    text: 'text-orange-400',
    bg: 'bg-orange-400/10',
  },
  CRITICAL: {
    label: 'CRITICAL',
    symbol: '◆',
    border: 'border-red-400/30',
    text: 'text-red-400',
    bg: 'bg-red-400/10',
  },
} as const;

function safeNumber(value: unknown, fallback = 0): number {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function formatCoordinate(value: unknown): string {
  const number = Number(value);

  return Number.isFinite(number) ? number.toFixed(4) : '—';
}

function formatValue(value: unknown, decimals = 1): string {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '—';
  }

  return number.toFixed(decimals);
}

function formatSigned(value: unknown, decimals = 1): string {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '—';
  }

  return `${number > 0 ? '+' : ''}${number.toFixed(decimals)}`;
}

export default function EarthAnomalyPanel({
  lat,
  lng,
  locationLabel,
}: EarthAnomalyPanelProps) {
  const [data, setData] = useState<AnomalyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasCoordinates =
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

  useEffect(() => {
    let cancelled = false;

    async function loadAnomaly() {
      try {
        setLoading(true);
        setError(null);

        if (!hasCoordinates) {
          throw new Error(
            'Select a valid region on the globe to run anomaly analysis.'
          );
        }

        const safeLat = safeNumber(lat);
        const safeLng = safeNumber(lng);

        const response = await fetch(
          `/api/anomaly?lat=${encodeURIComponent(
            safeLat
          )}&lng=${encodeURIComponent(safeLng)}`,
          {
            cache: 'no-store',
          }
        );

        if (!response.ok) {
          throw new Error('Unable to load anomaly analysis');
        }

        const result: AnomalyData = await response.json();

        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setData(null);

          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load anomaly analysis'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAnomaly();

    return () => {
      cancelled = true;
    };
  }, [lat, lng, hasCoordinates]);

  const status = data?.anomaly?.status ?? 'NORMAL';
  const config =
    statusConfig[status as keyof typeof statusConfig] ??
    statusConfig.NORMAL;

  const score = safeNumber(data?.anomaly?.score);
  const confidence = safeNumber(data?.confidence);

  return (
    <section
      className="
        w-[330px] max-w-[calc(100vw-24px)]
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
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono tracking-[0.2em] text-white/40">
              ORBITAL EYE
            </div>

            <h2 className="mt-1 text-sm font-semibold tracking-wide">
              EARTH ANOMALY INTELLIGENCE
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                loading
                  ? 'animate-pulse bg-yellow-400'
                  : error
                    ? 'bg-red-400'
                    : 'bg-emerald-400'
              }`}
            />

            <span className="text-[8px] font-mono uppercase tracking-widest text-white/40">
              {loading ? 'ANALYZING' : error ? 'ERROR' : 'ONLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* LOCATION */}
      <div className="border-b border-white/10 px-4 py-3">
        <div className="text-[8px] font-mono uppercase tracking-[0.18em] text-white/35">
          SELECTED REGION
        </div>

        <div className="mt-1 text-xs font-medium text-white/90">
          {locationLabel || 'Selected Location'}
        </div>

        <div className="mt-1 font-mono text-[9px] text-white/35">
          {formatCoordinate(lat)}° , {formatCoordinate(lng)}°
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="px-4 py-8 text-center">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border border-white/10 border-t-white/70" />

          <div className="mt-3 text-[9px] font-mono uppercase tracking-widest text-white/40">
            Running anomaly analysis...
          </div>
        </div>
      )}

      {/* ERROR */}
      {!loading && error && (
        <div className="m-4 rounded border border-red-400/20 bg-red-400/5 p-3">
          <div className="text-[9px] font-mono uppercase tracking-widest text-red-400">
            ANALYSIS ERROR
          </div>

          <div className="mt-1 text-[10px] leading-relaxed text-white/50">
            {error}
          </div>
        </div>
      )}

      {/* RESULTS */}
      {!loading && !error && data && (
        <>
          {/* STATUS */}
          <div className="px-4 pt-4">
            <div
              className={`rounded-lg border ${config.border} ${config.bg} p-3`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-white/40">
                    INTELLIGENCE STATUS
                  </div>

                  <div
                    className={`mt-1 flex items-center gap-2 text-sm font-bold ${config.text}`}
                  >
                    <span>{config.symbol}</span>
                    <span>{config.label}</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[8px] font-mono uppercase tracking-widest text-white/35">
                    SCORE
                  </div>

                  <div className={`text-2xl font-bold ${config.text}`}>
                    {formatValue(score, 0)}
                    <span className="text-xs text-white/25">/100</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* METRICS */}
          <div className="px-4 pt-4">
            <div className="mb-2 text-[8px] font-mono uppercase tracking-[0.2em] text-white/35">
              ENVIRONMENTAL SIGNALS
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Metric
                label="WATER"
                value={formatSigned(
                  data.metrics?.waterChangePercent
                )}
              />

              <Metric
                label="VEGETATION"
                value={formatSigned(
                  data.metrics?.vegetationChangePercent
                )}
              />

              <Metric
                label="HEAT"
                value={`${formatSigned(
                  data.metrics?.heatChangeCelsius
                )}°C`}
              />
            </div>
          </div>

          {/* POSSIBLE EVENT */}
          <div className="px-4 pt-4">
            <div className="rounded border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[8px] font-mono uppercase tracking-[0.18em] text-white/35">
                POSSIBLE EVENT
              </div>

              <div className="mt-1 text-[10px] font-medium leading-relaxed text-white/80">
                {data.possibleEvent || 'No significant event detected'}
              </div>
            </div>
          </div>

          {/* CONFIDENCE */}
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono uppercase tracking-widest text-white/35">
                CONFIDENCE
              </span>

              <span className="font-mono text-[9px] text-white/70">
                {formatValue(confidence, 0)}%
              </span>
            </div>

            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/60 transition-all duration-500"
                style={{
                  width: `${Math.min(Math.max(confidence, 0), 100)}%`,
                }}
              />
            </div>
          </div>

          {/* EXPLANATION */}
          <div className="px-4 pt-4">
            <div className="text-[8px] font-mono uppercase tracking-[0.18em] text-white/35">
              WHY THIS ALERT?
            </div>

            <p className="mt-1 text-[10px] leading-relaxed text-white/55">
              {data.explanation || 'No additional explanation available.'}
            </p>
          </div>

          {/* DEMO WARNING */}
          {data.isDemo && (
            <div className="mx-4 mt-4 rounded border border-yellow-400/20 bg-yellow-400/5 px-3 py-2">
              <div className="text-[8px] font-mono uppercase tracking-widest text-yellow-400/80">
                PROTOTYPE DATA
              </div>

              <div className="mt-1 text-[8px] leading-relaxed text-white/40">
                This analysis currently uses simulated signals for
                demonstration. Connect real satellite/environmental
                observations before treating these values as measured data.
              </div>
            </div>
          )}

          {/* SOURCE */}
          <div className="mt-4 border-t border-white/10 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
                  SOURCE
                </div>

                <div className="mt-0.5 text-[8px] text-white/40">
                  {data.source || 'Orbital Eye Intelligence Engine'}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
                  UPDATED
                </div>

                <div className="mt-0.5 font-mono text-[8px] text-white/40">
                  {data.generatedAt
                    ? new Date(data.generatedAt).toLocaleTimeString()
                    : '—'}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border border-white/10 bg-white/[0.025] p-2">
      <div className="text-[7px] font-mono uppercase tracking-widest text-white/30">
        {label}
      </div>

      <div className="mt-1 text-[11px] font-semibold text-white/80">
        {value}
      </div>
    </div>
  );
}
