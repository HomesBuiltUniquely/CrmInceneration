"use client";

import { PIPELINE_BARS } from "../data/mock-data";

export default function PipelineVelocity() {
  const max = Math.max(...PIPELINE_BARS.map((b) => b.value), 1);

  return (
    <section className="rounded-xl border border-[var(--bt-border)] bg-[var(--bt-surface)] p-5 shadow-sm">
      <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--bt-muted)]">
        Pipeline Velocity
      </h2>
      <div className="mt-6 flex h-40 items-end justify-between gap-1.5 px-1">
        {PIPELINE_BARS.map((bar) => {
          const barPx = Math.max(8, Math.round((bar.value / max) * 140));
          return (
            <div key={bar.month} className="flex flex-1 flex-col items-center justify-end gap-2">
              <div
                className="w-full max-w-[28px] rounded-t-sm bg-[var(--bt-green)]"
                style={{ height: barPx, opacity: 0.45 + (bar.value / max) * 0.55 }}
                title={String(bar.value)}
              />
              <span className="text-[9px] font-bold text-[var(--bt-muted)]">{bar.month}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
