"use client";

import {
  benchmarkMetrics,
  benchmarkComparison,
  benchmarkCapabilities,
} from "@/data/benchmarkData";

interface BenchmarkPanelProps {
  onClose: () => void;
}

export default function BenchmarkPanel({
  onClose,
}: BenchmarkPanelProps) {
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
      <div className="w-[92vw] max-w-[900px] max-h-[88vh] overflow-y-auto rounded-lg border border-cyan-400/30 bg-[#080b10]/95 shadow-2xl">

        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">

          <div>
            <div className="font-mono text-[9px] tracking-[0.35em] text-cyan-400">
              OSIRIS / ANALYTICS
            </div>

            <h2 className="mt-1 font-mono text-lg font-semibold tracking-[0.15em] text-white">
              SYSTEM RESULTS & BENCHMARK
            </h2>
          </div>

          <button
            onClick={onClose}
            className="border border-white/20 px-3 py-1.5 font-mono text-[10px] tracking-widest text-white/60 transition hover:border-cyan-400 hover:text-cyan-400"
          >
            CLOSE ×
          </button>
        </div>

        {/* METRICS */}
        <div className="grid grid-cols-2 gap-3 p-6 md:grid-cols-4">

          {benchmarkMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="font-mono text-[9px] tracking-[0.18em] text-white/40">
                {metric.label}
              </div>

              <div className="mt-3 font-mono text-2xl font-bold text-cyan-400">
                {metric.value}
              </div>

              <div className="mt-1 font-mono text-[9px] text-white/40">
                {metric.description}
              </div>

              {metric.status && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />

                  <span className="font-mono text-[8px] tracking-widest text-green-400">
                    {metric.status}
                  </span>
                </div>
              )}
            </div>
          ))}

        </div>

        {/* COMPARISON */}
        <div className="px-6">

          <div className="mb-3 font-mono text-[10px] tracking-[0.25em] text-cyan-400">
            PLATFORM COMPARISON
          </div>

          <div className="overflow-hidden rounded border border-white/10">

            {/* TABLE HEADER */}
            <div className="grid grid-cols-3 bg-white/[0.04] px-4 py-3 font-mono text-[9px] tracking-widest text-white/40">
              <span>CAPABILITY</span>
              <span>TRADITIONAL</span>
              <span>OSIRIS</span>
            </div>

            {/* TABLE ROWS */}
            {benchmarkComparison.map((item) => (
              <div
                key={item.capability}
                className="grid grid-cols-3 border-t border-white/5 px-4 py-3 font-mono text-[10px]"
              >
                <span className="text-white/70">
                  {item.capability}
                </span>

                <span className="text-white/35">
                  {item.traditional}
                </span>

                <span className="font-semibold text-cyan-400">
                  {item.osiris}
                </span>
              </div>
            ))}

          </div>
        </div>

        {/* CAPABILITIES */}
        <div className="px-6 pb-6 pt-6">

          <div className="mb-3 font-mono text-[10px] tracking-[0.25em] text-cyan-400">
            PROTOTYPE CAPABILITIES
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">

            {benchmarkCapabilities.map((capability) => (
              <div
                key={capability}
                className="flex items-center gap-3 rounded border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <span className="font-mono text-cyan-400">
                  ✓
                </span>

                <span className="font-mono text-[10px] text-white/60">
                  {capability}
                </span>
              </div>
            ))}

          </div>
        </div>

        {/* FOOTER */}
        <div className="border-t border-white/10 px-6 py-3">

          <div className="font-mono text-[8px] tracking-[0.15em] text-white/25">
            OSIRIS GLOBAL MONITORING SYSTEM · RESULTS MODULE
          </div>

        </div>

      </div>
    </div>
  );
}
