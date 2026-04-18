"use client";

import type { MilestoneStage } from "@/lib/crm-pipeline";

function formatCompact(n: number) {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${n}`;
}

const CHEVRON =
  "[clip-path:polygon(0_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,0_100%,12px_50%)]";

type Props = {
  stages: MilestoneStage[];
  selectedStage: string;
  onSelectStage: (stage: string) => void;
};

function normStage(value: string): string {
  return value.trim().toLowerCase();
}

export default function Milestones({
  stages,
  selectedStage,
  onSelectStage,
}: Props) {
  return (
    <main>
      <div className="xl:mx-6 xl:mt-7 xl:w-[calc(100%-3rem)] xl:min-w-0 xl:overflow-hidden xl:rounded-2xl xl:border xl:border-[var(--crm-border)] xl:bg-[var(--crm-surface)] xl:shadow-[var(--crm-shadow-sm)]">
        <div className="border-b border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--crm-text-muted)]">
              Journey stages
            </p>
            <p className="text-[11px] font-medium italic text-[var(--crm-text-muted)]">
              Select a stage to view paths
            </p>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-nowrap items-stretch gap-1 px-4 py-4">
          {stages.map((s) => {
            const active = normStage(s.stage) === normStage(selectedStage);

            const shell = active
              ? "bg-[var(--crm-accent)] text-white shadow-[var(--crm-shadow-md)] ring-2 ring-[var(--crm-accent-ring)] hover:brightness-110"
              : "bg-[var(--crm-surface-subtle)] text-[var(--crm-text-muted)] shadow-sm ring-1 ring-inset ring-[var(--crm-border)] hover:bg-[var(--crm-surface)] hover:text-[var(--crm-text-secondary)] hover:ring-2 hover:ring-[var(--crm-accent-ring)]";

            const badge = active
              ? "bg-white/22 text-white ring-1 ring-white/35 backdrop-blur-[2px] group-hover:bg-white/30 group-hover:ring-white/45"
              : "light:bg-[var(--crm-accent)] light:text-white dark:bg-[var(--crm-accent-soft)] dark:text-[var(--crm-accent-strong)] ring-1 group-hover:ring-[var(--crm-accent-strong)]";

            return (
              <button
                key={s.stage}
                type="button"
                aria-pressed={active}
                title={s.label}
                onClick={() => onSelectStage(s.stage)}
                className={`group relative flex h-12 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 px-3 font-bold transition-all duration-200 ease-out xl:text-[13px]
                  ${shell}
                  ${CHEVRON}
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-accent)]`}
              >
                <span className="min-w-0 flex-1 truncate pl-3 text-left tracking-wide">
                  {s.label}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums transition-all duration-200 ${badge}`}
                >
                  {formatCompact(s.count)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
