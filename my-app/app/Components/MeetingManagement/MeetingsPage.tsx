"use client";

import { useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { meetingBoardStats, type MeetingRecord } from "@/lib/meeting-management-data";
import { meetingFallsInRange, resolveDatePreset } from "@/lib/meeting-date-range";
import type { FilterDraft } from "./FilterModal";
import { KpiCard } from "./KpiCard";
import { MeetingHeaderMenus } from "./MeetingHeaderMenus";
import { focusRing, hoverLift } from "./motion";
import { MeetingsTable } from "./MeetingsTable";
import { MeetingsToolbar } from "./MeetingsToolbar";
import { useMeetingFilters, type MeetingTab } from "./useMeetingFilters";

const numberFormat = new Intl.NumberFormat("en-IN");

export function MeetingsPage({
  meetings,
  quoteSentMeetings,
  loading,
  loadError,
  onShowCalendar,
  onShowQuoteSent,
  onView,
  onReschedule,
  onCancel,
  onRetry,
}: {
  meetings: MeetingRecord[];
  quoteSentMeetings: MeetingRecord[];
  loading: boolean;
  loadError: string;
  onShowCalendar: () => void;
  onShowQuoteSent: () => void;
  onView: (row: MeetingRecord) => void;
  onReschedule: (row: MeetingRecord) => void;
  onCancel: (row: MeetingRecord) => void;
  onRetry: () => void;
}) {
  const reduce = useReducedMotion();
  const filters = useMeetingFilters();

  const stats = useMemo(() => meetingBoardStats(meetings), [meetings]);
  const designers = useMemo(() => uniqueOptions(meetings.map((row) => row.assignee)), [meetings]);
  const sales = useMemo(() => uniqueOptions(meetings.map((row) => row.salesName ?? "")), [meetings]);

  const filtered = useMemo(() => {
    const source = filters.quoteSent ? quoteSentMeetings : meetings;
    const range = !filters.quoteSent && filters.preset
      ? resolveDatePreset(filters.preset, new Date(), { from: filters.dateFrom, to: filters.dateTo })
      : null;
    const needle = filters.q.trim().toLowerCase();
    return source.filter((row) => {
      if (!filters.quoteSent && !matchesTab(row, filters.tab)) return false;
      if (!filters.quoteSent && filters.overdue && !row.needsOutcome) return false;
      if (!filters.quoteSent && filters.designerIds.length && !filters.designerIds.includes(row.assignee)) return false;
      if (!filters.quoteSent && filters.salesIds.length && !filters.salesIds.includes(row.salesName ?? "")) return false;
      if (!filters.quoteSent && filters.labels.length && !filters.labels.some((label) => label.toLowerCase() === row.meetingType.toLowerCase())) return false;
      if (range && !meetingFallsInRange(row.date, range)) return false;
      if (!needle) return true;
      const hay = `${row.customer} ${row.leadId ?? ""} ${row.assignee} ${row.phone} ${row.salesName ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [filters, meetings, quoteSentMeetings]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / filters.pageSize));
  const page = Math.min(filters.page, pageCount);
  const pageRows = filtered.slice((page - 1) * filters.pageSize, page * filters.pageSize);

  useEffect(() => {
    if (filters.page !== page) filters.write({ page }, { keepPage: true });
  }, [filters, page]);

  const draft: FilterDraft = {
    designerIds: filters.designerIds,
    salesIds: filters.salesIds,
    branchIds: filters.branchIds,
    labels: filters.labels,
    preset: filters.preset,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };

  return (
    <div className="w-full font-[family-name:var(--font-manrope)] text-[#0F172A]">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-[-0.03em]">Meetings</h1>
          <p className="mt-1 text-[15px] font-normal text-[#5B6778]">Track, reschedule and follow up on every customer meeting.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewSwitch onShowCalendar={onShowCalendar} reduce={Boolean(reduce)} />
          <div role="tablist" aria-label="Meeting status" className="relative inline-flex h-8 items-center rounded-lg bg-[#E8ECF0] p-0.5">
            {HEADER_TABS.map((item) => {
              const active = filters.tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() =>
                    filters.write({
                      tab: item.id,
                      overdue: false,
                      quoteSent: item.id === "all" ? filters.quoteSent : false,
                    })
                  }
                  className={`relative inline-flex h-7 items-center rounded-md px-2.5 text-[12px] font-semibold tracking-wide ${focusRing} ${
                    active ? "text-[#0F172A]" : "text-[#334155]"
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="meeting-status-pill"
                      className="absolute inset-0 rounded-md bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
                      transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                    />
                  ) : null}
                  <span className="relative">{item.label}</span>
                </button>
              );
            })}
          </div>
          <MeetingHeaderMenus
            value={draft}
            designers={designers}
            sales={sales}
            peopleCount={filters.peopleCount}
            dateCount={filters.dateCount}
            onApply={(next) => filters.write(next)}
          />
        </div>
      </header>

      <section className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2.5" aria-label="Meeting totals">
        <KpiCard ready={!loading} label="Scheduled" value={stats.scheduled} hint="Upcoming meetings" chip={`${numberFormat.format(stats.today)} today`} chipClass="bg-[#E0ECFF] text-[#1E40AF]" iconClass="bg-[#E0ECFF] text-[#1D4ED8]" icon={<CalIcon />} />
        <KpiCard ready={!loading} label="Meetings done" value={stats.meetingsDone} hint="Experience & design" chip="Successful" chipClass="bg-[#F0FDF4] text-[#14532D]" iconClass="bg-[#F0FDF4] text-[#15803D]" icon={<CheckIcon />} />
        <KpiCard ready={!loading} label="Cancelled" value={stats.cancelled} hint="Cancelled meetings" chip={`${stats.cancelledPct}%`} chipClass="bg-[#FEF3C7] text-[#92400E]" iconClass="bg-[#FEF3F2] text-[#B42318]" icon={<XIcon />} />
        <KpiCard ready={!loading} label="Quotes sent" value={quoteSentMeetings.length} hint="Sales Admin leads" chip="Won + lost" chipClass="bg-[#F0FDF4] text-[#15803D]" iconClass="bg-[#F0FDF4] text-[#15803D]" icon={<DocIcon />} active={filters.quoteSent} onClick={onShowQuoteSent} />
      </section>

      <section className="mt-4 overflow-visible rounded-[18px] border border-[#E3E8EE] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <MeetingsToolbar query={filters.q} fetching={loading} onQuery={(q) => filters.write({ q })} />
        <div aria-live="polite" className="sr-only">
          {loading ? "Loading meetings" : `${filtered.length} meetings`}
        </div>
        {loadError && !loading && meetings.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-[16px] font-semibold">{loadError}</p>
            <motion.button type="button" onClick={onRetry} className={`mt-4 inline-flex h-11 items-center rounded-xl border border-[#E3E8EE] px-4 text-[14px] font-semibold ${focusRing}`} {...hoverLift(reduce)}>
              Retry
            </motion.button>
          </div>
        ) : (
          <MeetingsTable
            rows={pageRows}
            loading={loading}
            page={page}
            pageSize={filters.pageSize}
            total={filtered.length}
            onPage={(next) => filters.write({ page: next }, { keepPage: true })}
            onPageSize={(pageSize) => filters.write({ pageSize })}
            onView={onView}
            onReschedule={onReschedule}
            onCancel={onCancel}
            onClear={() =>
              filters.write({
                q: "",
                designerIds: [],
                salesIds: [],
                branchIds: [],
                labels: [],
                preset: "",
                dateFrom: "",
                dateTo: "",
                overdue: false,
                quoteSent: false,
                tab: "all",
              })
            }
          />
        )}
      </section>

    </div>
  );
}

function matchesTab(row: MeetingRecord, tab: MeetingTab): boolean {
  if (tab === "all") return true;
  if (tab === "scheduled") return row.status === "SCHEDULED" || row.status === "IN PROGRESS";
  if (tab === "today") return row.dayOffset === 0 && row.status !== "CANCELLED";
  if (tab === "upcoming") return row.dayOffset > 0 && row.status !== "COMPLETED" && row.status !== "CANCELLED";
  if (tab === "completed") return row.status === "COMPLETED";
  if (tab === "rescheduled") return row.status === "RESCHEDULED";
  return row.status === "CANCELLED";
}

const HEADER_TABS: Array<{ id: MeetingTab; label: string }> = [
  { id: "all", label: "ALL" },
  { id: "scheduled", label: "SCHEDULED" },
  { id: "completed", label: "COMPLETED" },
  { id: "rescheduled", label: "RESCHEDULED" },
  { id: "cancelled", label: "CANCELLED" },
];

function ViewSwitch({ onShowCalendar, reduce }: { onShowCalendar: () => void; reduce: boolean }) {
  return (
    <div className="relative inline-flex h-8 items-center rounded-lg bg-[#E8ECF0] p-0.5" role="group" aria-label="Meetings view">
      <button type="button" className={`relative inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[12px] font-semibold text-[#0F172A] ${focusRing}`}>
        <motion.span
          layoutId="meeting-view-pill"
          className="absolute inset-0 rounded-md bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
          transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        />
        <ListIcon />
        <span className="relative">List</span>
      </button>
      <button
        type="button"
        onClick={onShowCalendar}
        className={`relative inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[12px] font-semibold text-[#334155] ${focusRing}`}
      >
        <CalendarSwitchIcon />
        <span>Calendar</span>
      </button>
    </div>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 20 20" className="relative h-4 w-4" fill="none" aria-hidden>
      <path d="M4 5.5h12M4 10h12M4 14.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CalendarSwitchIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
      <rect x="3" y="4.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 8h14M7 3.5v2.5M13 3.5v2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function uniqueOptions(values: string[]) {
  const seen = new Set<string>();
  const options: Array<{ id: string; label: string }> = [];
  for (const value of values) {
    const label = value.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    options.push({ id: label, label });
  }
  options.sort((a, b) => a.label.localeCompare(b.label));
  return options;
}

function CalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M6 12.5L10 16.5L18 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14 3.5V9h5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
