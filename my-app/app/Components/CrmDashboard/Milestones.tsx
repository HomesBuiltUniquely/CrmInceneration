"use client";

import type { MilestoneStage } from "@/lib/crm-pipeline";

function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
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

export default function Milestones({ stages, selectedStage, onSelectStage }: Props) {
  return (
    <main>
      <div className="xl:w-263.75 xl:mt-7 xl:ml-6 xl:overflow-hidden xl:rounded-2xl xl:border xl:border-slate-200/90 xl:bg-white xl:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-8px_rgba(29,122,252,0.12)]">
        <div className="border-b border-slate-100/80 bg-gradient-to-b from-slate-50/60 to-white px-5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Journey stages</p>
            <p className="text-[11px] font-medium italic text-slate-400">Select a stage to view paths</p>
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-nowrap items-stretch gap-1 px-4 py-4">
          {stages.map((s) => {
            const active = s.stage === selectedStage;

            const shell = active
              ? "bg-gradient-to-b from-[#3d94ff] to-[#1D7AFC] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] hover:from-[#4a9eff] hover:to-[#1868d4] hover:shadow-[0_4px_14px_rgba(29,122,252,0.45),inset_0_1px_0_rgba(255,255,255,0.25)] hover:ring-2 hover:ring-white/35 active:from-[#1a6fe0] active:to-[#1558b8] active:shadow-inner"
              : "bg-gradient-to-b from-white to-slate-100/95 text-slate-500 shadow-sm ring-1 ring-inset ring-slate-200/80 hover:from-slate-50 hover:to-white hover:text-slate-700 hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)] hover:ring-2 hover:ring-[#1D7AFC]/20 active:from-slate-100 active:to-slate-200";

            const badge = active
              ? "bg-white/22 text-white ring-1 ring-white/35 backdrop-blur-[2px] group-hover:bg-white/30 group-hover:ring-white/45"
              : "bg-white/90 text-slate-600 ring-1 ring-slate-200/90 group-hover:bg-white group-hover:text-slate-800 group-hover:ring-slate-300/80";

            return (
              <button
                key={s.stage}
                type="button"
                title={s.label}
                onClick={() => onSelectStage(s.stage)}
                className={`group relative flex h-12 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 px-3 font-bold transition-all duration-200 ease-out xl:text-[13px]
                  ${shell}
                  ${CHEVRON}
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D7AFC]`}
              >
                <span className="min-w-0 flex-1 truncate pl-3 text-left tracking-wide">{s.label}</span>
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
