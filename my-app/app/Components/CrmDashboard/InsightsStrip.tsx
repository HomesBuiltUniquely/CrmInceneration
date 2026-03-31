type DwellRow = {
  label: string;
  valuePct: number; // 0-100
  colorClass: string;
};

function SparklesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-10 text-white rounded-full "
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2l.9 3.1a3 3 0 0 0 2 2L18 8l-3.1.9a3 3 0 0 0-2 2L12 14l-.9-3.1a3 3 0 0 0-2-2L6 8l3.1-.9a3 3 0 0 0 2-2L12 2Z"
        fill="currentColor"
      />
      <path
        d="M19 13l.6 2a2 2 0 0 0 1.4 1.4l2 .6-2 .6a2 2 0 0 0-1.4 1.4l-.6 2-.6-2a2 2 0 0 0-1.4-1.4l-2-.6 2-.6a2 2 0 0 0 1.4-1.4l.6-2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LegendDot({ className }: { className: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${className}`} />;
}

function AvatarStack({ countLabel = "+12" }: { countLabel?: string }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="flex -space-x-2">
        <div className="h-6 w-6 rounded-full border-2 border-white bg-slate-200" />
        <div className="h-6 w-6 rounded-full border-2 border-white bg-slate-300" />
        <div className="h-6 w-6 rounded-full border-2 border-white bg-slate-400" />
      </div>
      <div className="text-[11px] font-semibold text-slate-500">
        {countLabel}
      </div>
    </div>
  );
}

export default function InsightsStrip() {
  const dwell: DwellRow[] = [
    { label: "0-24h", valuePct: 78, colorClass: "bg-emerald-500" },
    { label: "24-72h", valuePct: 34, colorClass: "bg-amber-500" },
    { label: "72h+", valuePct: 12, colorClass: "bg-rose-500" },
  ];

  return (
    <section className="xl:ml-6 xl:mt-5 xl:w-263.75">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:h-50">
        {/* Stage dwell distribution */}
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="text-[11px] font-semibold tracking-wide text-slate-400">
            STAGE DWELL DISTRIBUTION
          </div>
          <div className="mt-4 space-y-3">
            {dwell.map((row) => (
              <div key={row.label} className="flex items-center gap-4">
                <div className="h-2.5 flex-1 rounded-full bg-slate-100">
                  <div
                    className={`h-2.5 rounded-full ${row.colorClass}`}
                    style={{ width: `${row.valuePct}%` }}
                  />
                </div>
                <div className="w-12 text-right text-[11px] font-semibold text-slate-600">
                  {row.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top leakage factors */}
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="text-[11px] font-semibold tracking-wide text-slate-400">
            TOP LEAKAGE FACTORS
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
              Unresponsive (42%)
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
              Budget (22%)
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
              No Authority (15%)
            </span>
          </div>
        </div>

        {/* AI smart action */}
        <div className="rounded-2xl border border-slate-200 bg-blue-50 px-6 py-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1D7AFC] shadow-sm">
              <SparklesIcon />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wide text-[#1D7AFC]">
                AI SMART ACTION
              </div>
              <div className="mt-1 text-[12px] font-medium leading-5 text-slate-600">
                Increase &quot;Attempting&quot; touches by 20% to improve
                conversion by 4.5%.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend + avatars */}
      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <LegendDot className="bg-emerald-500" />
            <span className="text-[11px] font-medium text-slate-500">
              High Conversion Velocity
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LegendDot className="bg-amber-500" />
            <span className="text-[11px] font-medium text-slate-500">
              SLA Pending
            </span>
          </div>
        </div>
        <AvatarStack />
      </div>
    </section>
  );
}
