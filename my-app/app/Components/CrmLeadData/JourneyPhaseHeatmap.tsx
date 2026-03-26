type Phase = {
  phaseLabel: string;
  name: string;
  count: number;
  stalePct: number;
  tone: "healthy" | "warning" | "critical";
  note: { icon: "clock" | "alert" | "money" | "check"; text: string };
};

function Icon({ kind }: { kind: Phase["note"]["icon"] }) {
  if (kind === "clock")
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-500" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (kind === "alert")
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-rose-600" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 9v4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path d="M12 17h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path
          d="M10.3 3.6c.8-1.4 2.6-1.4 3.4 0l8 13.8c.8 1.4-.2 3.1-1.7 3.1H4c-1.6 0-2.5-1.7-1.7-3.1l8-13.8Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    );
  if (kind === "money")
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-500" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 7h16v10H4V7Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 10h.01M17 14h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M12 10.2c1.3 0 2.3.8 2.3 1.8S13.3 13.8 12 13.8s-2.3-.8-2.3-1.8 1-1.8 2.3-1.8Z" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-600" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusLegend() {
  return (
    <div className="flex items-center gap-5 text-[10px] font-semibold tracking-wide text-slate-400">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        HEALTHY (&lt; 5% STALE)
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
        WARNING (5–15%)
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
        CRITICAL (&gt; 15%)
      </div>
    </div>
  );
}

function PhaseCard({ p }: { p: Phase }) {
  const bar =
    p.tone === "healthy" ? "bg-emerald-500" : p.tone === "warning" ? "bg-amber-400" : "bg-rose-500";
  const bg =
    p.tone === "healthy" ? "bg-emerald-50" : p.tone === "warning" ? "bg-amber-50" : "bg-rose-50";
  const staleText =
    p.tone === "healthy" ? "text-emerald-600" : p.tone === "warning" ? "text-amber-600" : "text-rose-600";

  return (
    <div className={`relative rounded-2xl border border-slate-200 ${bg} px-5 py-4`}>
      <div className="text-[10px] font-semibold tracking-wide text-slate-400">{p.phaseLabel}</div>
      <div className="mt-2 flex items-start justify-between">
        <div className="text-[13px] font-semibold text-slate-800">{p.name}</div>
        <div className="text-right">
          <div className="text-[20px] font-semibold text-slate-700">{p.count}</div>
          <div className={`text-[10px] font-semibold ${staleText}`}>{p.stalePct}% Stale</div>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full rounded-full bg-white/60">
        <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${Math.min(100, 18 + p.stalePct * 2)}%` }} />
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-slate-500">
        <Icon kind={p.note.icon} />
        <span>{p.note.text}</span>
      </div>
      <div className={`absolute bottom-0 left-0 h-1.5 w-full rounded-b-2xl ${bar}`} />
    </div>
  );
}

export default function JourneyPhaseHeatmap() {
  const phases: Phase[] = [
    { phaseLabel: "PHASE 01", name: "Discovery", count: 412, stalePct: 3, tone: "healthy", note: { icon: "clock", text: "Avg. 3.2 Days in Stage" } },
    { phaseLabel: "PHASE 02", name: "Qualification", count: 284, stalePct: 12, tone: "warning", note: { icon: "clock", text: "34 Leads past SLA" } },
    { phaseLabel: "PHASE 03", name: "Decision", count: 195, stalePct: 18, tone: "critical", note: { icon: "alert", text: "Critical Path (48h)" } },
    { phaseLabel: "PHASE 04", name: "Booking", count: 122, stalePct: 7, tone: "warning", note: { icon: "money", text: "$2.4M Pipeline Value" } },
    { phaseLabel: "PHASE 05", name: "Closure", count: 71, stalePct: 1, tone: "healthy", note: { icon: "check", text: "86% Conversion" } },
  ];

  return (
    <section className="mx-auto mt-6 max-w-[1200px] px-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-semibold text-slate-800">Journey Phase Heatmap</span>
          </div>
          <div className="mt-1 text-[10px] font-semibold tracking-wide text-slate-400">SLA HEALTH STATUS PER PHASE</div>
        </div>
        <StatusLegend />
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
          {phases.map((p) => (
            <PhaseCard key={p.phaseLabel} p={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

