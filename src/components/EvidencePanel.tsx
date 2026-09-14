'use client';

import { useMemo, useState } from 'react';

type EvidenceType =
  | 'AIRCRAFT'
  | 'SATELLITE'
  | 'MARITIME'
  | 'ENVIRONMENT'
  | 'WEATHER'
  | 'EVENT';

type EvidenceItem = {
  id: string;
  type: EvidenceType;
  title: string;
  location: string;
  source: string;
  timestamp: string;
  status: 'VERIFIED' | 'OPEN SOURCE' | 'PROTOTYPE';
  confidence: number;
  description: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
};

type EvidencePanelProps = {
  locationLabel?: string;
  lat?: number;
  lng?: number;
};

const demoEvidence: EvidenceItem[] = [
  {
    id: 'EV-001',
    type: 'AIRCRAFT',
    title: 'AIRCRAFT ACTIVITY OBSERVATION',
    location: 'Selected Region',
    source: 'Open Aircraft Data',
    timestamp: 'NOW',
    status: 'OPEN SOURCE',
    confidence: 91,
    description:
      'Aircraft position and movement information available from an open-source tracking feed.',
    coordinates: {
      lat: 16.3067,
      lng: 80.4365,
    },
  },
  {
    id: 'EV-002',
    type: 'ENVIRONMENT',
    title: 'SURFACE CHANGE INDICATOR',
    location: 'Selected Region',
    source: 'Orbital Eye Environmental Analysis',
    timestamp: '8 MIN AGO',
    status: 'PROTOTYPE',
    confidence: 84,
    description:
      'Environmental indicators show a change in simulated water, vegetation and surface-heat signals.',
    coordinates: {
      lat: 16.3067,
      lng: 80.4365,
    },
  },
  {
    id: 'EV-003',
    type: 'SATELLITE',
    title: 'EARTH OBSERVATION RECORD',
    location: 'Selected Region',
    source: 'Public Earth Observation Data',
    timestamp: '18 MIN AGO',
    status: 'OPEN SOURCE',
    confidence: 87,
    description:
      'Public Earth-observation information can be used to compare regional conditions across observation periods.',
    coordinates: {
      lat: 16.3067,
      lng: 80.4365,
    },
  },
  {
    id: 'EV-004',
    type: 'WEATHER',
    title: 'WEATHER CONDITION',
    location: 'Selected Region',
    source: 'Weather Data Feed',
    timestamp: '25 MIN AGO',
    status: 'OPEN SOURCE',
    confidence: 79,
    description:
      'Weather observations provide supporting context for environmental and disaster-related analysis.',
    coordinates: {
      lat: 16.3067,
      lng: 80.4365,
    },
  },
  {
    id: 'EV-005',
    type: 'EVENT',
    title: 'REGIONAL EVENT INDICATOR',
    location: 'Selected Region',
    source: 'Open-Source Event Information',
    timestamp: '42 MIN AGO',
    status: 'PROTOTYPE',
    confidence: 72,
    description:
      'Open-source event information can provide additional context when analyzing unusual regional patterns.',
    coordinates: {
      lat: 16.3067,
      lng: 80.4365,
    },
  },
];

const typeConfig: Record<
  EvidenceType,
  {
    label: string;
    symbol: string;
  }
> = {
  AIRCRAFT: {
    label: 'AIRCRAFT',
    symbol: '✈',
  },
  SATELLITE: {
    label: 'SATELLITE',
    symbol: '◉',
  },
  MARITIME: {
    label: 'MARITIME',
    symbol: '≈',
  },
  ENVIRONMENT: {
    label: 'ENVIRONMENT',
    symbol: '◌',
  },
  WEATHER: {
    label: 'WEATHER',
    symbol: '☁',
  },
  EVENT: {
    label: 'EVENT',
    symbol: '!',
  },
};

const statusStyles = {
  VERIFIED: 'border-emerald-400/20 text-emerald-400',
  'OPEN SOURCE': 'border-blue-400/20 text-blue-400',
  PROTOTYPE: 'border-yellow-400/20 text-yellow-400',
};

export default function EvidencePanel({
  locationLabel,
  lat,
  lng,
}: EvidencePanelProps) {
  const [selectedType, setSelectedType] =
    useState<'ALL' | EvidenceType>('ALL');

  const [selectedEvidence, setSelectedEvidence] =
    useState<EvidenceItem | null>(null);

  const evidence = useMemo(() => {
    const currentLocation = locationLabel || 'Selected Region';

    return demoEvidence
      .filter((item) => {
        if (selectedType === 'ALL') return true;
        return item.type === selectedType;
      })
      .map((item) => ({
        ...item,
        location: currentLocation,
        coordinates:
          lat !== undefined && lng !== undefined
            ? { lat, lng }
            : item.coordinates,
      }));
  }, [selectedType, locationLabel, lat, lng]);

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
        <div className="text-[8px] font-mono uppercase tracking-[0.22em] text-white/30">
          ORBITAL EYE / SOURCE VERIFICATION
        </div>

        <div className="mt-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide">
            EVIDENCE PANEL
          </h2>

          <span className="text-[7px] font-mono uppercase tracking-widest text-white/30">
            {evidence.length} RECORDS
          </span>
        </div>

        <div className="mt-1 text-[8px] font-mono text-white/30">
          {locationLabel || 'GLOBAL INTELLIGENCE NETWORK'}
        </div>
      </div>

      {/* SOURCE FLOW */}
      <div className="border-b border-white/10 px-4 py-3">
        <div className="text-[7px] font-mono uppercase tracking-[0.2em] text-white/25">
          EVIDENCE FLOW
        </div>

        <div className="mt-2 flex items-center justify-between text-[7px] font-mono uppercase tracking-widest">
          <span className="text-white/40">SOURCE</span>

          <span className="text-white/20">→</span>

          <span className="text-white/40">OBSERVATION</span>

          <span className="text-white/20">→</span>

          <span className="text-white/40">ANALYSIS</span>
        </div>
      </div>

      {/* FILTER */}
      <div className="border-b border-white/10 px-4 py-3">
        <div className="mb-2 text-[7px] font-mono uppercase tracking-widest text-white/25">
          EVIDENCE TYPE
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              'ALL',
              'AIRCRAFT',
              'SATELLITE',
              'ENVIRONMENT',
              'WEATHER',
              'EVENT',
            ] as const
          ).map((filter) => {
            const active = selectedType === filter;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedType(filter)}
                className={`
                  rounded border px-2 py-1
                  text-[7px] font-mono
                  uppercase tracking-widest
                  transition-all
                  ${
                    active
                      ? 'border-white/30 bg-white/10 text-white'
                      : 'border-white/10 bg-white/[0.02] text-white/30 hover:border-white/20 hover:text-white/70'
                  }
                `}
              >
                {filter}
              </button>
            );
          })}
        </div>
      </div>

      {/* EVIDENCE LIST */}
      <div className="max-h-[400px] overflow-y-auto">
        {evidence.length === 0 && (
          <div className="px-4 py-8 text-center">
            <div className="text-[9px] font-mono uppercase tracking-widest text-white/30">
              NO EVIDENCE
            </div>

            <p className="mt-1 text-[8px] text-white/20">
              No evidence records match this filter.
            </p>
          </div>
        )}

        {evidence.map((item) => {
          const config = typeConfig[item.type];

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedEvidence(item)}
              className="
                w-full border-b border-white/10
                px-4 py-3 text-left
                transition-colors
                hover:bg-white/[0.035]
              "
            >
              <div className="flex items-start gap-3">
                {/* ICON */}
                <div
                  className="
                    flex h-8 w-8 shrink-0
                    items-center justify-center
                    rounded border border-white/10
                    bg-white/[0.025]
                    text-[13px] text-white/50
                  "
                >
                  {config.symbol}
                </div>

                {/* DETAILS */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[7px] font-mono uppercase tracking-widest text-white/30">
                      {config.label}
                    </span>

                    <span className="shrink-0 text-[7px] font-mono text-white/20">
                      {item.timestamp}
                    </span>
                  </div>

                  <div className="mt-1 text-[10px] font-semibold leading-snug text-white/80">
                    {item.title}
                  </div>

                  <div className="mt-1 text-[8px] font-mono text-white/30">
                    {item.location}
                  </div>

                  <p className="mt-1.5 line-clamp-2 text-[8px] leading-relaxed text-white/40">
                    {item.description}
                  </p>

                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className={`
                        rounded border px-1.5 py-0.5
                        text-[6px] font-mono uppercase tracking-widest
                        ${statusStyles[item.status]}
                      `}
                    >
                      {item.status}
                    </span>

                    <span className="text-[7px] font-mono text-white/25">
                      CONF. {item.confidence}%
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* SELECTED EVIDENCE */}
      {selectedEvidence && (
        <div className="border-t border-white/10 bg-white/[0.025] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
                SELECTED EVIDENCE
              </div>

              <div className="mt-1 text-[10px] font-semibold text-white/80">
                {selectedEvidence.title}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedEvidence(null)}
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

          {/* METADATA */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <EvidenceDetail
              label="TYPE"
              value={selectedEvidence.type}
            />

            <EvidenceDetail
              label="STATUS"
              value={selectedEvidence.status}
            />

            <EvidenceDetail
              label="TIMESTAMP"
              value={selectedEvidence.timestamp}
            />

            <EvidenceDetail
              label="CONFIDENCE"
              value={`${selectedEvidence.confidence}%`}
            />
          </div>

          {/* LOCATION */}
          <div className="mt-3 rounded border border-white/10 bg-black/20 p-3">
            <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
              LOCATION
            </div>

            <div className="mt-1 text-[9px] text-white/65">
              {selectedEvidence.location}
            </div>

            {selectedEvidence.coordinates && (
              <div className="mt-1 font-mono text-[7px] text-white/25">
                LAT{' '}
                {selectedEvidence.coordinates.lat.toFixed(4)}
                {'  '}
                LNG{' '}
                {selectedEvidence.coordinates.lng.toFixed(4)}
              </div>
            )}
          </div>

          {/* DESCRIPTION */}
          <div className="mt-3">
            <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
              OBSERVATION
            </div>

            <p className="mt-1.5 text-[8px] leading-relaxed text-white/50">
              {selectedEvidence.description}
            </p>
          </div>

          {/* SOURCE */}
          <div className="mt-3 rounded border border-white/10 bg-white/[0.02] p-3">
            <div className="text-[7px] font-mono uppercase tracking-widest text-white/25">
              DATA SOURCE
            </div>

            <div className="mt-1 text-[8px] font-medium text-white/60">
              {selectedEvidence.source}
            </div>
          </div>

          {/* VERIFICATION */}
          <div className="mt-3 rounded border border-yellow-400/20 bg-yellow-400/5 p-3">
            <div className="text-[7px] font-mono uppercase tracking-widest text-yellow-400/70">
              VERIFICATION STATUS
            </div>

            <p className="mt-1 text-[8px] leading-relaxed text-white/35">
              Evidence records provide supporting information for
              intelligence analysis. Open-source observations should
              be cross-checked with reliable sources before being
              treated as confirmed information.
            </p>
          </div>
        </div>
      )}

      {/* PROTOTYPE NOTICE */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="text-[7px] font-mono uppercase tracking-widest text-yellow-400/60">
          EVIDENCE / SOURCE NOTICE
        </div>

        <p className="mt-1 text-[7px] leading-relaxed text-white/25">
          Some records shown in this prototype are simulated
          demonstration records. They are not presented as
          verified real-world evidence.
        </p>
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
        <span className="text-[7px] font-mono uppercase tracking-widest text-white/20">
          SOURCE ANALYSIS
        </span>

        <span className="text-[7px] font-mono uppercase tracking-widest text-white/20">
          ORBITAL EYE
        </span>
      </div>
    </section>
  );
}

function EvidenceDetail({
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
