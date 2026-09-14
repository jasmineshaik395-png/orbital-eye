'use client';

import { useMemo, useState } from 'react';

type AlertSeverity = 'INFO' | 'WATCH' | 'ANOMALY' | 'CRITICAL';

type AlertItem = {
  id: string;
  severity: AlertSeverity;
  title: string;
  location: string;
  description: string;
  timestamp: string;
  confidence: number;
  source: string;
};

type AlertPanelProps = {
  locationLabel?: string;
};

const demoAlerts: AlertItem[] = [
  {
    id: 'ALR-001',
    severity: 'CRITICAL',
    title: 'POSSIBLE FLOOD / WATER EXPANSION',
    location: 'Selected Region',
    description:
      'A strong change in the simulated surface-water signal has been detected. Further verification is recommended.',
    timestamp: 'NOW',
    confidence: 89,
    source: 'Orbital Eye Environmental Intelligence',
  },
  {
    id: 'ALR-002',
    severity: 'ANOMALY',
    title: 'UNUSUAL ENVIRONMENTAL CHANGE',
    location: 'Selected Region',
    description:
      'Water, vegetation and surface-heat indicators show an unusual combined pattern.',
    timestamp: '8 MIN AGO',
    confidence: 82,
    source: 'Orbital Eye Anomaly Engine',
  },
  {
    id: 'ALR-003',
    severity: 'WATCH',
    title: 'ELEVATED SURFACE HEAT',
    location: 'Selected Region',
    description:
      'The surface-temperature indicator is above the simulated regional baseline.',
    timestamp: '21 MIN AGO',
    confidence: 74,
    source: 'Orbital Eye Environmental Intelligence',
  },
  {
    id: 'ALR-004',
    severity: 'INFO',
    title: 'REGION UNDER OBSERVATION',
    location: 'Selected Region',
    description:
      'The selected region has been added to the active intelligence monitoring queue.',
    timestamp: '35 MIN AGO',
    confidence: 68,
    source: 'Orbital Eye Monitoring System',
  },
];

const severityConfig: Record<
  AlertSeverity,
  {
    label: string;
    symbol: string;
    text: string;
    border: string;
    bg: string;
  }
> = {
  INFO: {
    label: 'INFO',
    symbol: '●',
    text: 'text-blue-400',
    border: 'border-blue-400/20',
    bg: 'bg-blue-400/5',
  },
  WATCH: {
    label: 'WATCH',
    symbol: '◐',
    text: 'text-yellow-400',
    border: 'border-yellow-400/20',
    bg: 'bg-yellow-400/5',
  },
  ANOMALY: {
    label: 'ANOMALY',
    symbol: '▲',
    text: 'text-orange-400',
    border: 'border-orange-400/20',
    bg: 'bg-orange-400/5',
  },
  CRITICAL: {
    label: 'CRITICAL',
    symbol: '◆',
    text: 'text-red-400',
    border: 'border-red-400/20',
    bg: 'bg-red-400/5',
  },
};

export default function AlertPanel({
  locationLabel,
}: AlertPanelProps) {
  const [selectedSeverity, setSelectedSeverity] =
    useState<'ALL' | AlertSeverity>('ALL');

  const [selectedAlert, setSelectedAlert] =
    useState<AlertItem | null>(null);

  const alerts = useMemo(() => {
    if (selectedSeverity === 'ALL') {
      return demoAlerts.map((alert) => ({
        ...alert,
        location:
          locationLabel || alert.location,
      }));
    }

    return demoAlerts
      .filter((alert) => alert.severity === selectedSeverity)
      .map((alert) => ({
        ...alert,
        location:
          locationLabel || alert.location,
      }));
  }, [selectedSeverity, locationLabel]);

  const criticalCount = demoAlerts.filter(
    (alert) => alert.severity === 'CRITICAL'
  ).length;

  const anomalyCount = demoAlerts.filter(
    (alert) => alert.severity === 'ANOMALY'
  ).length;

  const watchCount = demoAlerts.filter(
    (alert) => alert.severity === 'WATCH'
  ).length;

  return (
    <section
      className="
        w-[390px] max-w-[calc(100vw-24px)]
        overflow-hidden rounded-lg
        border border-white/10
        bg-black/90
        text-white
        shadow-2xl shadow-black/50
        backdrop-blur-xl
      "
    >
      {/* HEADER */}
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[8px] font-mono uppercase tracking-[0.22em] text-white/30">
              ORBITAL EYE / INTELLIGENCE SYSTEM
            </div>

            <h2 className="mt-1 text-sm font-semibold tracking-wide">
              ALERT CENTER
            </h2>

            <div className="mt-1 text-[8px] font-mono text-white/30">
              {locationLabel || 'GLOBAL MONITORING NETWORK'}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />

            <span className="text-[7px] font-mono uppercase tracking-widest text-white/35">
              LIVE
            </span>
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-3 border-b border-white/10">
        <SummaryBox
          label="CRITICAL"
          value={criticalCount}
          text="text-red-400"
        />

        <SummaryBox
          label="ANOMALY"
          value={anomalyCount}
          text="text-orange-400"
        />

        <SummaryBox
          label="WATCH"
          value={watchCount}
          text="text-yellow-400"
        />
      </div>

      {/* FILTERS */}
      <div className="border-b border-white/10 px-4 py-3">
        <div className="mb-2 text-[7px] font-mono uppercase tracking-[0.2em] text-white/25">
          FILTER ALERTS
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              'ALL',
              'CRITICAL',
              'ANOMALY',
              'WATCH',
              'INFO',
            ] as const
          ).map((filter) => {
            const active = selectedSeverity === filter;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedSeverity(filter)}
                className={`
                  rounded border px-2 py-1
                  text-[7px] font-mono
                  uppercase tracking-widest
                  transition-all
                  ${
                    active
                      ? 'border-white/30 bg-white/10 text-white'
                      : 'border-white/10 bg-white/[0.02] text-white/35 hover:border-white/20 hover:text-white/70'
                  }
                `}
              >
                {filter}
              </button>
            );
          })}
        </div>
      </div>

      {/* ALERT LIST */}
      <div className="max-h-[390px] overflow-y-auto">
        {alerts.length === 0 && (
          <div className="px-4 py-8 text-center">
            <div className="text-[9px] font-mono uppercase tracking-widest text-white/30">
              NO ALERTS
            </div>

            <div className="mt-1 text-[8px] text-white/20">
              No alerts match the selected filter.
            </div>
          </div>
        )}

        {alerts.map((alert) => {
          const config = severityConfig[alert.severity];

          return (
            <button
              key={alert.id}
              type="button"
              onClick={() => setSelectedAlert(alert)}
              className="
                w-full border-b border-white/10
                px-4 py-3 text-left
                transition-colors
                hover:bg-white/[0.035]
              "
            >
              <div className="flex items-start gap-3">
                {/* SEVERITY INDICATOR */}
                <div
                  className={`
                    mt-0.5 flex h-7 w-7 shrink-0
                    items-center justify-center
                    rounded border
                    ${config.border}
                    ${config.bg}
                    ${config.text}
                  `}
                >
                  <span className="text-[10px]">
                    {config.symbol}
                  </span>
                </div>

                {/* CONTENT */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`
                        text-[8px] font-mono
                        uppercase tracking-wider
                        ${config.text}
                      `}
                    >
                      {alert.severity}
                    </div>

                    <span className="shrink-0 text-[7px] font-mono text-white/20">
                      {alert.timestamp}
                    </span>
                  </div>

                  <div className="mt-1 text-[10px] font-semibold leading-snug text-white/80">
                    {alert.title}
                  </div>

                  <div className="mt-1 text-[8px] font-mono text-white/30">
                    {alert.location}
                  </div>

                  <p className="mt-1.5 line-clamp-2 text-[8px] leading-relaxed text-white/40">
                    {alert.description}
                  </p>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[7px] font-mono text-white/20">
                      {alert.id}
                    </span>

                    <span className="text-[7px] font-mono text-white/30">
                      CONF. {alert.confidence}%
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* SELECTED ALERT DETAILS */}
      {selectedAlert && (
        <div className="border-t border-white/10 bg-white/[0.025] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
                SELECTED ALERT
              </div>

              <div className="mt-1 text-[10px] font-semibold text-white/80">
                {selectedAlert.title}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedAlert(null)}
              className="
                rounded border border-white/10
                px-2 py-1
                text-[7px] font-mono
                text-white/35
                hover:text-white
              "
            >
              CLOSE
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Detail
              label="SEVERITY"
              value={selectedAlert.severity}
            />

            <Detail
              label="CONFIDENCE"
              value={`${selectedAlert.confidence}%`}
            />

            <Detail
              label="LOCATION"
              value={selectedAlert.location}
            />

            <Detail
              label="TIME"
              value={selectedAlert.timestamp}
            />
          </div>

          <div className="mt-3 rounded border border-white/10 bg-black/20 p-3">
            <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
              INTELLIGENCE SUMMARY
            </div>

            <p className="mt-1.5 text-[8px] leading-relaxed text-white/50">
              {selectedAlert.description}
            </p>
          </div>

          <div className="mt-3">
            <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
              DATA SOURCE
            </div>

            <div className="mt-1 text-[8px] text-white/40">
              {selectedAlert.source}
            </div>
          </div>

          <div className="mt-3 rounded border border-yellow-400/20 bg-yellow-400/5 p-3">
            <div className="text-[7px] font-mono uppercase tracking-widest text-yellow-400/70">
              HUMAN VERIFICATION
            </div>

            <p className="mt-1 text-[8px] leading-relaxed text-white/35">
              This alert represents an identified pattern or
              indicator. It should be verified using reliable
              observations and official sources before making
              decisions.
            </p>
          </div>
        </div>
      )}

      {/* DEMO NOTICE */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="text-[7px] font-mono uppercase tracking-widest text-yellow-400/60">
          PROTOTYPE / DEMO ALERTS
        </div>

        <p className="mt-1 text-[7px] leading-relaxed text-white/25">
          Current alert records are simulated demonstration
          data. Connect verified real-time sources before
          presenting them as live intelligence.
        </p>
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
        <span className="text-[7px] font-mono uppercase tracking-widest text-white/20">
          ALERT MONITOR
        </span>

        <span className="text-[7px] font-mono uppercase tracking-widest text-white/20">
          ORBITAL EYE
        </span>
      </div>
    </section>
  );
}

function SummaryBox({
  label,
  value,
  text,
}: {
  label: string;
  value: number;
  text: string;
}) {
  return (
    <div className="border-r border-white/10 px-3 py-3 last:border-r-0">
      <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
        {label}
      </div>

      <div className={`mt-1 text-lg font-bold ${text}`}>
        {value}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border border-white/10 bg-white/[0.02] p-2">
      <div className="text-[6px] font-mono uppercase tracking-widest text-white/20">
        {label}
      </div>

      <div className="mt-1 text-[8px] font-medium text-white/60">
        {value}
      </div>
    </div>
  );
}
