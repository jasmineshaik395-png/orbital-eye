'use client';

import { useEffect, useState } from 'react';

interface FlightLiveStatusProps {
  /** "live" | "degraded" | "down" — see src/lib/aircraftProviders. */
  status?: string;
  /** ISO timestamp of the last successful fetch. */
  timestamp?: string;
  /** Total aircraft currently tracked, across all categories. */
  total?: number;
}

/**
 * 🟢 LIVE AIRCRAFT DATA / Last updated Xs ago / Aircraft tracked: N
 * 🟠 LIVE DATA TEMPORARILY UNAVAILABLE, when every provider is down and
 * there is no snapshot — even a stale one — left to show.
 *
 * Never claims "live" when it isn't: a degraded (stale-cache) response still
 * shows the amber state, with the age of the data it's actually displaying.
 */
export default function FlightLiveStatus({ status, timestamp, total }: FlightLiveStatusProps) {
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  if (!status) return null;

  const ageSeconds = timestamp ? Math.max(0, Math.round((nowTick - new Date(timestamp).getTime()) / 1000)) : null;
  const isDown = status === 'down';
  const isDegraded = status === 'degraded';

  const formatAge = (s: number) => {
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  };

  if (isDown) {
    return (
      <div className="flex items-center gap-1.5 text-[9px] font-mono tracking-wide text-[var(--alert-orange)] px-1 py-1">
        <span>🟠</span>
        <span>LIVE DATA TEMPORARILY UNAVAILABLE</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 text-[9px] font-mono tracking-wide px-1 py-1">
      <div className={`flex items-center gap-1.5 ${isDegraded ? 'text-[var(--alert-orange)]' : 'text-[var(--alert-green)]'}`}>
        <span>{isDegraded ? '🟠' : '🟢'}</span>
        <span>{isDegraded ? 'LIVE DATA DELAYED — SHOWING LAST KNOWN POSITIONS' : 'LIVE AIRCRAFT DATA'}</span>
      </div>
      <div className="text-white/35 pl-4">
        {ageSeconds !== null && <>Last updated: {formatAge(ageSeconds)} · </>}
        Aircraft tracked: {(total ?? 0).toLocaleString()}
      </div>
    </div>
  );
}
