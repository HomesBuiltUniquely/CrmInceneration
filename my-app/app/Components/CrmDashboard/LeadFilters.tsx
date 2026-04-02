"use client";

import { useState } from "react";

type DashboardRole = "sales_admin" | "sales_manager" | "super_admin";

type FilterDef = {
  label: string;
  options: string[];
};

const ADMIN_FILTERS: FilterDef[] = [
  { label: "Sales Admin", options: ["All", "Admin North", "Admin West", "Admin Enterprise"] },
  { label: "Sales Exec", options: ["All", "Aarav", "Neha", "Rohan"] },
  { label: "Sales Mgr", options: ["All", "North Team", "West Team", "Enterprise"] },
  { label: "Presales Mgr", options: ["All", "SMB", "Mid-Market", "Strategic"] },
  { label: "Presales Exec", options: ["All", "Ankit", "Meera", "Sana"] },
];

const MANAGER_FILTERS: FilterDef[] = [
  { label: "Sales Exec", options: ["All", "Aarav", "Neha", "Rohan"] },
  { label: "Stage", options: ["All", "Discovery", "Connection", "Experience & Design", "Decision", "Closed"] },
  { label: "Stage Category", options: ["All", "Won", "Lost"] },
  { label: "Substage", options: ["All", "Fresh Lead", "Attempting First Connect", "Call Scheduled", "Qualified"] },
];

function FilterIcon() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#1D7AFC] to-[#1565c0] shadow-sm ring-1 ring-white/20">
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M4 6h16M7 12h10M10 18h4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function SelectChevron() {
  return (
    <svg viewBox="0 0 20 20" className="pointer-events-none h-4 w-4 text-slate-400" fill="currentColor" aria-hidden="true">
      <path d="M5.5 7.5a1 1 0 0 1 1.4 0L10 10.6l3.1-3.1a1 1 0 1 1 1.4 1.4l-3.8 3.8a1 1 0 0 1-1.4 0L5.5 8.9a1 1 0 0 1 0-1.4Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3.75" y="5.75" width="16.5" height="14.5" rx="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 3.75v4M16.5 3.75v4M3.75 9.5h16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const selectClass =
  "h-10 w-full cursor-pointer appearance-none rounded-lg border border-slate-200/90 bg-white px-3 pr-9 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all duration-200 hover:border-slate-300 hover:border-[#1D7AFC]/25 hover:bg-slate-50/80 hover:shadow-md focus:border-[#1D7AFC] focus:bg-white focus:ring-4 focus:ring-[#1D7AFC]/12";

const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";

type Props = {
  role?: DashboardRole;
};

const QUICK_RANGES = [
  { id: "7d" as const, label: "Last 7 days" },
  { id: "30d" as const, label: "Last 30 days" },
  { id: "q" as const, label: "This Quarter" },
];

export default function LeadFilters({ role = "sales_admin" }: Props) {
  const isManager = role === "sales_manager";
  const filters = isManager ? MANAGER_FILTERS : ADMIN_FILTERS;
  const [quickRange, setQuickRange] = useState<(typeof QUICK_RANGES)[number]["id"]>("7d");

  return (
    <main>
      <div className="xl:w-263.75 xl:mt-7 xl:ml-6 xl:overflow-hidden xl:rounded-2xl xl:border xl:border-slate-200/90 xl:bg-white xl:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-8px_rgba(29,122,252,0.12)]">
        <div className="border-b border-slate-100/80 bg-gradient-to-b from-slate-50/50 to-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FilterIcon />
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight text-slate-800">Pipeline filters</h2>
                <p className="mt-0.5 text-[12px] text-slate-500">Refine your view — updates apply as you change</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 active:scale-[0.98]"
            >
              Reset all
            </button>
          </div>
        </div>

        <div className="px-6 pb-5 pt-5">
          <div className={`grid gap-x-4 gap-y-4 ${isManager ? "grid-cols-5" : "grid-cols-5"}`}>
            {filters.map((filter) => (
              <label key={filter.label} className="col-span-1 min-w-0">
                <span className={labelClass}>{filter.label}</span>
                <div className="relative">
                  <select className={selectClass}>
                    {filter.options.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <SelectChevron />
                  </div>
                </div>
              </label>
            ))}

            {isManager ? (
              <label className="col-span-1 min-w-0">
                <span className={labelClass}>Date range</span>
                <div className="relative">
                  <input
                    type="date"
                    defaultValue="2026-03-30"
                    className={`${selectClass} pr-10`}
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <CalendarIcon />
                  </div>
                </div>
              </label>
            ) : null}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Quick range</span>
                <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50/80 p-1 shadow-inner">
                  {QUICK_RANGES.map((q) => {
                    const active = quickRange === q.id;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setQuickRange(q.id)}
                        className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all duration-200 ${
                          active
                            ? "bg-white text-[#1D7AFC] shadow-sm ring-1 ring-slate-200/80"
                            : "text-slate-600 hover:bg-white/60 hover:text-slate-800"
                        }`}
                      >
                        {q.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-[11px] font-medium italic text-slate-400">Selections apply automatically</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
