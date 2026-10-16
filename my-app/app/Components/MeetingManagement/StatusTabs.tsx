"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE, focusRing } from "./motion";
import type { MeetingTab } from "./useMeetingFilters";

const numberFormat = new Intl.NumberFormat("en-IN");

export function StatusTabs({
  tab,
  counts,
  overdue,
  overdueOn,
  onTab,
  onOverdue,
}: {
  tab: MeetingTab;
  counts: Record<MeetingTab, number>;
  overdue: number;
  overdueOn: boolean;
  onTab: (tab: MeetingTab) => void;
  onOverdue: () => void;
}) {
  const reduce = useReducedMotion();
  const tabs: Array<{ id: MeetingTab; label: string }> = [
    { id: "all", label: "All" },
    { id: "today", label: "Today" },
    { id: "upcoming", label: "Upcoming" },
    { id: "completed", label: "Completed" },
    { id: "rescheduled", label: "Rescheduled" },
    { id: "cancelled", label: "Cancelled" },
  ];
  return (
    <div className="flex flex-col gap-3 border-b border-[#E3E8EE] px-4 md:flex-row md:items-end md:justify-between md:px-5">
      <div role="tablist" aria-label="Meeting status" className="flex gap-1 overflow-x-auto">
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTab(item.id)}
              className={`relative min-h-11 shrink-0 rounded-t-xl px-3 pb-3 pt-3 text-[14px] font-semibold transition-colors duration-200 hover:bg-[#F1F4F7] hover:text-[#0F172A] ${focusRing} ${
                active ? "text-[#15803D]" : "text-[#5B6778]"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {item.label}
                <motion.span
                  key={counts[item.id]}
                  animate={reduce ? undefined : { scale: [1, 1.08, 1] }}
                  transition={{ duration: 0.22, ease: EASE }}
                  className={`inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-[12px] font-semibold ${
                    active ? "bg-[#F0FDF4] text-[#14532D]" : "bg-[#F4F6F8] text-[#5B6778]"
                  }`}
                >
                  {numberFormat.format(counts[item.id])}
                </motion.span>
              </span>
              {active ? (
                <motion.span
                  layoutId="meeting-tab-underline"
                  className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-[#22C55E]"
                  transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
      {overdue > 0 ? (
          <button
            type="button"
            onClick={onOverdue}
            aria-pressed={overdueOn}
            className={`mb-2 inline-flex h-11 shrink-0 items-center gap-2 self-start whitespace-nowrap rounded-full bg-[#FEF3C7] px-3 text-[13px] font-semibold text-[#92400E] ${focusRing} ${
              overdueOn ? "ring-2 ring-[#D97706]" : ""
            }`}
          >
          <span className="h-2 w-2 rounded-full bg-[#D97706]" />
          {numberFormat.format(overdue)} overdue meetings
        </button>
      ) : (
        <span className="mb-2 inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap self-start rounded-full bg-[#F0FDF4] px-3 text-[13px] font-semibold text-[#14532D] md:self-auto">
          <CheckIcon />
          0 overdue meetings
        </span>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 10.2L8.8 12.5L13.5 7.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
