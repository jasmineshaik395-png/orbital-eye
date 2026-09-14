'use client';

import { useEffect, useState } from 'react';

type AnomalyData = {
  source: string;
  isDemo: boolean;
  coordinates: {
    lat: number;
    lng: number;
  };
  anomaly: {
    score: number;
    status: 'NORMAL' | 'WATCH' | 'ANOMALY' | 'CRITICAL';
  };
  metrics: {
    waterChangePercent: number;
    vegetationChangePercent: number;
    heatChangeCelsius: number;
  };
  possibleEvent: string;
  confidence: number;
  explanation: string;
  generatedAt: string;
};

type EarthAnomalyPanelProps = {
  lat: number;
  lng: number;
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
};

export default function EarthAnomalyPanel({
  lat,
  lng,
  locationLabel,
}: EarthAnomalyPanelProps) {
  const [data, setData] = useState<AnomalyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAnomaly() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/anomaly?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
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
  }, [lat, lng]);

  const status = data?.anomaly.status ?? 'NORMAL';
  const config = statusConfig[status];

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
      {/* Header */}
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
                loading ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400'
              }`}
            />

            <span className="text-[8px] font-mono uppercase tracking-widest text-white/40">
              {loading ? 'ANALYZING' : 'ONLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="border-b border-white/10 px-4 py-3">
        <div className="text-[8px] font-mono uppercase tracking-[0.18em] text-white/35">
          SELECTED REGION
        </div>

        <div className="mt-1 text-xs font-medium text-white/90">
          {locationLabel || 'Selected Location'}
        </div>

        <div className="mt-1 font-mono text-[9px] text-white/35">
          {lat.toFixed(4)}° , {lng.toFixed(4)}°
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="px-4 py-8 text-center">
          <div className="mx-auto h-7 w-7 animate-spin rounded-full border border-white/10 border-t-white/70" />

          <div className="mt-3 text-[9px] font-mono uppercase tracking-widest text-white/40">
            Running anomaly analysis...
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="m-4 rounded border border-red-400/20 bg-red-400/5 p-3">
          <div className="text-[9px] font-mono uppercase tracking-widest text-red-400">
            Analysis Error
          </div>

          <div className="mt-1 text-[10px] text-white/50">
            {error}
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && data && (
        <>
          {/* Status */}
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
                    {data.anomaly.score}
                    <span className="text-xs text-white/25">/100</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="px-4 pt-4">
            <div className="mb-2 text-[8px] font-mono uppercase tracking-[0.2em] text-white/35">
              ENVIRONMENTAL SIGNALS
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Metric
                label="WATER"
                value={`${data.metrics.waterChangePercent > 0 ? '+' : ''}${data.metrics.waterChangePercent}%`}
              />

              <Metric
                label="VEGETATION"
                value={`${data.metrics.vegetationChangePercent > 0 ? '+' : ''}${data.metrics.vegetationChangePercent}%`}
              />

              <Metric
                label="HEAT"
                value={`${data.metrics.heatChangeCelsius > 0 ? '+' : ''}${data.metrics.heatChangeCelsius}°C`}
              />
            </div>
          </div>

          {/* Possible event */}
          <div className="px-4 pt-4">
            <div className="rounded border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[8px] font-mono uppercase tracking-[0.18em] text-white/35">
                POSSIBLE EVENT
              </div>

              <div className="mt-1 text-[10px] font-medium leading-relaxed text-white/80">
                {data.possibleEvent}
              </div>
            </div>
          </div>

          {/* Confidence */}
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono uppercase tracking-widest text-white/35">
                CONFIDENCE
              </span>

              <span className="font-mono text-[9px] text-white/70">
                {data.confidence}%
              </span>
            </div>

            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/60 transition-all duration-500"
                style={{
                  width: `${data.confidence}%`,
                }}
              />
            </div>
          </div>

          {/* Explanation */}
          <div className="px-4 pt-4">
            <div className="text-[8px] font-mono uppercase tracking-[0.18em] text-white/35">
              WHY THIS ALERT?
            </div>

            <p className="mt-1 text-[10px] leading-relaxed text-white/55">
              {data.explanation}
            </p>
          </div>

          {/* Demo warning */}
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

          {/* Source */}
          <div className="mt-4 border-t border-white/10 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
                  SOURCE
                </div>

                <div className="mt-0.5 text-[8px] text-white/40">
                  {data.source}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
                  UPDATED
                </div>

                <div className="mt-0.5 font-mono text-[8px] text-white/40">
                  {new Date(data.generatedAt).toLocaleTimeString()}
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
