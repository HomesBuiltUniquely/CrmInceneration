"use client";

export type ChartGranularity = "week" | "month";

type Props = {
  value: ChartGranularity;
  onChange: (value: ChartGranularity) => void;
  className?: string;
};

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

function WeekIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 ${active ? "text-white" : "text-slate-600"}`}
      fill="currentColor"
      aria-hidden
    >
      <rect x="2" y="11" width="2" height="5" rx="0.5" opacity={0.45} />
      <rect x="6" y="8" width="2" height="8" rx="0.5" opacity={0.65} />
      <rect x="10" y="5" width="2" height="11" rx="0.5" />
      <rect x="14" y="9" width="2" height="7" rx="0.5" opacity={0.75} />
    </svg>
  );
}

function MonthIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 ${active ? "text-white" : "text-slate-600"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <rect x="3" y="4" width="14" height="13" rx="1.5" />
      <path d="M3 8h14" />
      <path d="M7 2.5v3M13 2.5v3" strokeLinecap="round" />
      <rect x="6" y="10" width="2" height="2" rx="0.25" fill="currentColor" stroke="none" />
      <rect x="9" y="10" width="2" height="2" rx="0.25" fill="currentColor" stroke="none" />
      <rect x="12" y="10" width="2" height="2" rx="0.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Compact week / month switch — icon buttons, matches chart/table toggle style. */
export default function InsightsChartGranularityToggle({
  value,
  onChange,
  className = "",
}: Props) {
  return (
    <div
      className={`flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 ${className}`}
      role="group"
      aria-label="Chart time grain"
    >
      <button
        type="button"
        aria-label="Week view"
        aria-pressed={value === "week"}
        title="Week view"
        onClick={() => onChange("week")}
        className={`rounded-md p-1.5 transition-all duration-300 hover:scale-[1.04] active:scale-[0.96] ${
          value === "week" ? "bg-slate-900 shadow-sm" : "hover:bg-white"
        }`}
        style={{ transitionTimingFunction: EASE }}
      >
        <WeekIcon active={value === "week"} />
      </button>
      <button
        type="button"
        aria-label="Month view"
        aria-pressed={value === "month"}
        title="Month view"
        onClick={() => onChange("month")}
        className={`rounded-md p-1.5 transition-all duration-300 hover:scale-[1.04] active:scale-[0.96] ${
          value === "month" ? "bg-slate-900 shadow-sm" : "hover:bg-white"
        }`}
        style={{ transitionTimingFunction: EASE }}
      >
        <MonthIcon active={value === "month"} />
      </button>
    </div>
  );
}
