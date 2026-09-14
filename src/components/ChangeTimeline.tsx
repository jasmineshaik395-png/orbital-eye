'use client';

import { useState } from 'react';

type TimelinePoint = {
  label: string;
  date: string;
  waterChange: number;
  vegetationChange: number;
  heatChange: number;
  status: 'NORMAL' | 'WATCH' | 'ANOMALY' | 'CRITICAL';
};

type ChangeTimelineProps = {
  locationLabel?: string;
};

const demoTimeline: TimelinePoint[] = [
  {
    label: 'BASELINE',
    date: '30 DAYS AGO',
    waterChange: 4,
    vegetationChange: -2,
    heatChange: 0.6,
    status: 'NORMAL',
  },
  {
    label: 'OBSERVATION 01',
    date: '20 DAYS AGO',
    waterChange: 9,
    vegetationChange: -5,
    heatChange: 1.1,
    status: 'NORMAL',
  },
  {
    label: 'OBSERVATION 02',
    date: '10 DAYS AGO',
    waterChange: 16,
    vegetationChange: -8,
    heatChange: 1.8,
    status: 'WATCH',
  },
  {
    label: 'CURRENT',
    date: 'NOW',
    waterChange: 27,
    vegetationChange: -13,
    heatChange: 2.7,
    status: 'ANOMALY',
  },
];

const statusStyles = {
  NORMAL: 'text-emerald-400 border-emerald-400/20',
  WATCH: 'text-yellow-400 border-yellow-400/20',
  ANOMALY: 'text-orange-400 border-orange-400/20',
  CRITICAL: 'text-red-400 border-red-400/20',
};

export default function ChangeTimeline({
  locationLabel,
}: ChangeTimelineProps) {
  const [selectedIndex, setSelectedIndex] = useState(
    demoTimeline.length - 1
  );

  const selected = demoTimeline[selectedIndex];

  return (
    <section
      className="
        w-[370px] max-w-[calc(100vw-24px)]
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
        <div className="text-[8px] font-mono uppercase tracking-[0.2em] text-white/30">
          ORBITAL EYE / TEMPORAL INTELLIGENCE
        </div>

        <h2 className="mt-1 text-sm font-semibold tracking-wide">
          CHANGE TIMELINE
        </h2>

        <div className="mt-1 text-[8px] font-mono text-white/30">
          {locationLabel || 'Selected Region'}
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 pt-5">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-2 top-2 h-[2px] w-[calc(100%-16px)] bg-white/10" />

          <div className="relative flex justify-between">
            {demoTimeline.map((point, index) => {
              const active = index === selectedIndex;

              return (
                <button
                  key={point.label}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  className="group flex w-[70px] flex-col items-center"
                  aria-label={`View ${point.label}`}
                >
                  <span
                    className={`
                      relative z-10 h-4 w-4 rounded-full border
                      transition-all duration-200
                      ${
                        active
                          ? 'scale-125 border-white bg-white'
                          : 'border-white/30 bg-black group-hover:border-white/70'
                      }
                    `}
                  />

                  <span
                    className={`
                      mt-2 text-center text-[7px] font-mono uppercase
                      tracking-wider
                      ${
                        active
                          ? 'text-white'
                          : 'text-white/30'
                      }
                    `}
                  >
                    {point.label}
                  </span>

                  <span className="mt-0.5 text-center text-[6px] font-mono text-white/20">
                    {point.date}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Observation */}
      <div className="px-4 pt-5">
        <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[7px] font-mono uppercase tracking-widest text-white/30">
                SELECTED OBSERVATION
              </div>

              <div className="mt-1 text-xs font-semibold">
                {selected.label}
              </div>
            </div>

            <div
              className={`
                rounded border px-2 py-1
                text-[7px] font-mono tracking-widest
                ${statusStyles[selected.status]}
              `}
            >
              {selected.status}
            </div>
          </div>
        </div>
      </div>

      {/* Change Indicators */}
      <div className="px-4 pt-4">
        <div className="mb-2 text-[8px] font-mono uppercase tracking-widest text-white/30">
          OBSERVED CHANGE
        </div>

        <div className="grid grid-cols-3 gap-2">
          <ChangeMetric
            label="WATER"
            value={selected.waterChange}
            suffix="%"
          />

          <ChangeMetric
            label="VEGETATION"
            value={selected.vegetationChange}
            suffix="%"
          />

          <ChangeMetric
            label="SURFACE HEAT"
            value={selected.heatChange}
            suffix="°C"
          />
        </div>
      </div>

      {/* Change Bars */}
      <div className="px-4 pt-4">
        <div className="rounded border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-3 text-[8px] font-mono uppercase tracking-widest text-white/30">
            CHANGE MAGNITUDE
          </div>

          <ChangeBar
            label="WATER EXPANSION"
            value={selected.waterChange}
            max={40}
          />

          <ChangeBar
            label="VEGETATION CHANGE"
            value={Math.abs(selected.vegetationChange)}
            max={30}
          />

          <ChangeBar
            label="SURFACE HEAT"
            value={selected.heatChange}
            max={5}
          />
        </div>
      </div>

      {/* Before vs Now */}
      <div className="px-4 pt-4">
        <div className="text-[8px] font-mono uppercase tracking-widest text-white/30">
          BEFORE VS NOW
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded border border-white/10 bg-white/[0.02] p-3">
            <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
              BASELINE
            </div>

            <div className="mt-2 text-[10px] text-white/60">
              Water: +{demoTimeline[0].waterChange}%
            </div>

            <div className="mt-1 text-[10px] text-white/60">
              Vegetation: {demoTimeline[0].vegetationChange}%
            </div>

            <div className="mt-1 text-[10px] text-white/60">
              Heat: +{demoTimeline[0].heatChange}°C
            </div>
          </div>

          <div className="rounded border border-white/10 bg-white/[0.02] p-3">
            <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
              CURRENT
            </div>

            <div className="mt-2 text-[10px] text-white/70">
              Water: +{demoTimeline[demoTimeline.length - 1].waterChange}%
            </div>

            <div className="mt-1 text-[10px] text-white/70">
              Vegetation:{' '}
              {demoTimeline[demoTimeline.length - 1].vegetationChange}%
            </div>

            <div className="mt-1 text-[10px] text-white/70">
              Heat: +{demoTimeline[demoTimeline.length - 1].heatChange}°C
            </div>
          </div>
        </div>
      </div>

      {/* Interpretation */}
      <div className="px-4 pt-4">
        <div className="rounded border border-yellow-400/20 bg-yellow-400/5 p-3">
          <div className="text-[7px] font-mono uppercase tracking-widest text-yellow-400/70">
            TEMPORAL INTERPRETATION
          </div>

          <p className="mt-1 text-[8px] leading-relaxed text-white/45">
            The timeline shows how environmental indicators can change
            between observation periods. Increasing water coverage,
            vegetation decline and surface heat may indicate an unusual
            regional pattern that requires further verification.
          </p>
        </div>
      </div>

      {/* Demo Notice */}
      <div className="mx-4 mt-4 border-t border-white/10 pt-3">
        <div className="text-[7px] font-mono uppercase tracking-widest text-yellow-400/60">
          PROTOTYPE / DEMO TIMELINE
        </div>

        <p className="mt-1 text-[7px] leading-relaxed text-white/25">
          Timeline values are simulated demonstration data. They are
          not actual historical satellite measurements.
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[7px] font-mono uppercase tracking-widest text-white/20">
          TEMPORAL ANALYSIS
        </span>

        <span className="text-[7px] font-mono uppercase tracking-widest text-white/20">
          ORBITAL EYE
        </span>
      </div>
    </section>
  );
}

/* ----------------------------- */
/* Small Components              */
/* ----------------------------- */

function ChangeMetric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix: string;
}) {
  const positive = value >= 0;

  return (
    <div className="rounded border border-white/10 bg-white/[0.025] p-2.5">
      <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
        {label}
      </div>

      <div
        className={`mt-1 text-[11px] font-semibold ${
          positive ? 'text-white/75' : 'text-white/60'
        }`}
      >
        {positive ? '+' : ''}
        {value}
        {suffix}
      </div>
    </div>
  );
}

function ChangeBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const width = Math.min(
    Math.max((Math.abs(value) / max) * 100, 0),
    100
  );

  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[7px] font-mono uppercase tracking-widest text-white/25">
          {label}
        </span>

        <span className="text-[7px] font-mono text-white/35">
          {value}
        </span>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white/50 transition-all duration-500"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
