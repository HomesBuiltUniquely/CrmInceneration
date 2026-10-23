"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { isQuoteDelayed, meetingBoardStats, sortMeetingsForList, type MeetingRecord } from "@/lib/meeting-management-data";
import type { MeetingProgress } from "@/lib/meeting-management-api";
import { CRM_ROLE_STORAGE_KEY, getAuthApiBaseUrl, normalizeRole } from "@/lib/auth/api";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { hierarchyUserDisplayName, type HierarchyUserLike } from "@/lib/hierarchy-user-display";
import { isDatePresetId, resolveDatePreset, toDateKey } from "@/lib/meeting-date-range";
import type { FilterDraft } from "./FilterModal";
import { KpiCard } from "./KpiCard";
import { MeetingHeaderMenus } from "./MeetingHeaderMenus";
import { focusRing, hoverLift } from "./motion";
import { MeetingsTable } from "./MeetingsTable";
import { MeetingsToolbar } from "./MeetingsToolbar";
import { useMeetingFilters, type MeetingTab } from "./useMeetingFilters";

const numberFormat = new Intl.NumberFormat("en-IN");

const BRANCH_OPTIONS = [
  { id: "HBR", label: "HBR" },
  { id: "JP_NAGAR", label: "JP Nagar" },
  { id: "SARJAPUR", label: "Sarjapur" },
];

export function MeetingsPage({
  meetings,
  quoteSentMeetings,
  loading,
  loadError,
  onShowCalendar,
  onShowQuoteSent,
  onShowQuoteDelayed,
  onShowMeetingSuccessful,
  onView,
  onReschedule,
  onRetry,
}: {
  meetings: MeetingRecord[];
  quoteSentMeetings: MeetingRecord[];
  loading: boolean;
  loadError: string;
  onShowCalendar: () => void;
  onShowQuoteSent: () => void;
  onShowQuoteDelayed: () => void;
  onShowMeetingSuccessful: () => void;
  onView: (row: MeetingRecord) => void;
  onReschedule: (row: MeetingRecord) => void;
  onRetry: () => void;
}) {
  const reduce = useReducedMotion();
  const filters = useMeetingFilters();
  const [designers, setDesigners] = useState<Array<{ id: string; label: string }>>([]);
  const [sales, setSales] = useState<Array<{ id: string; label: string }>>([]);
  const [tabsOpen, setTabsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const role = normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "");
    const teamScoped = role === "SALES_MANAGER" || role === "SALES_EXECUTIVE";
    void Promise.all([
      loadUsersByRole("DESIGNER"),
      teamScoped ? Promise.resolve([]) : loadUsersByRole("SALES_EXECUTIVE"),
    ]).then(([designerUsers, salesUsers]) => {
      if (cancelled) return;
      setDesigners(uniqueOptions(designerUsers.map(hierarchyUserDisplayName)));
      setSales(uniqueOptions(salesUsers.map(hierarchyUserDisplayName)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const salesOptions = useMemo(() => {
    if (sales.length > 0) return sales;
    return uniqueOptions(meetings.map((row) => row.assignedSalesName?.trim() ?? ""));
  }, [meetings, sales]);

  const branches = BRANCH_OPTIONS;

  const boardDates = useMemo(
    () => meetingBoardDates(filters.preset, filters.dateFrom, filters.dateTo),
    [filters.preset, filters.dateFrom, filters.dateTo],
  );
  const progressFilter: MeetingProgress[] = filters.meetingSuccessful ? ["MEETING_SUCCESSFUL"] : filters.progress;
  const monthMeetings = useMemo(
    () => meetings.filter((row) => dateInBoardRange(row.date, boardDates)),
    [meetings, boardDates],
  );
  const monthQuoteSent = useMemo(
    () => quoteSentMeetings.filter((row) => dateInBoardRange(row.date, boardDates)),
    [quoteSentMeetings, boardDates],
  );
  const stats = useMemo(() => meetingBoardStats(monthMeetings), [monthMeetings]);
  const quoteDelayedCount = useMemo(() => monthMeetings.filter((row) => isQuoteDelayed(row)).length, [monthMeetings]);

  const filtered = useMemo(() => {
    const focused = filters.quoteSent || filters.quoteDelayed;
    const source = filters.quoteSent ? quoteSentMeetings : meetings;
    const needle = filters.q.trim().toLowerCase();
    return sortMeetingsForList(source.filter((row) => {
      if (!dateInBoardRange(row.date, boardDates)) return false;
      if (filters.designerIds.length && !filters.designerIds.includes(row.assignee)) return false;
      if (filters.salesIds.length && !filters.salesIds.includes(row.assignedSalesName ?? "")) return false;
      if (filters.branchIds.length && !filters.branchIds.some((branch) => sameBranch(row.branch, branch))) return false;
      if (progressFilter.length && !progressFilter.includes(row.progress ?? "SCHEDULED")) return false;
      if (filters.quoteDelayed && !isQuoteDelayed(row)) return false;
      if (filters.meetingSuccessful && row.meetingSuccessful !== true && row.progress !== "MEETING_SUCCESSFUL") return false;
      if (!focused && !matchesTab(row, filters.tab)) return false;
      if (!focused && filters.overdue && !row.needsOutcome) return false;
      if (!focused && filters.labels.length && !filters.labels.some((label) => label.toLowerCase() === row.meetingType.toLowerCase())) return false;
      if (!needle) return true;
      const hay = `${row.customer} ${row.leadId ?? ""} ${row.assignee} ${row.phone} ${row.salesName ?? ""} ${row.assignedSalesName ?? ""}`.toLowerCase();
      return hay.includes(needle);
    }));
  }, [boardDates, filters, meetings, progressFilter, quoteSentMeetings]);

  const displayTotal = loading && meetings.length === 0 && quoteSentMeetings.length === 0 ? null : filtered.length;
  const listTotal = filtered.length;
  const pageCount = Math.max(1, Math.ceil(listTotal / filters.pageSize));
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
    progress: filters.progress,
    preset: filters.preset,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };

  return (
    <div className="w-full font-[family-name:var(--font-manrope)] text-[#0F172A]">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[26px] font-bold leading-none tracking-[-0.03em]">Meetings</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-normal text-[#5B6778]">Track, reschedule and follow up on every customer meeting.</p>
            <span
              title={!filters.preset || filters.preset === "this-month" ? "These numbers are for the current month" : "These numbers follow the date range you picked"}
              className={`inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-semibold ${
                !filters.preset || filters.preset === "this-month"
                  ? "bg-[#E8F1FF] text-[#1B3FA8]"
                  : "bg-[#F1F5F9] text-[#334155]"
              }`}
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
                <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              {periodNote(filters.preset, boardDates)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="relative z-30 inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-2xl border border-[#E6EAF0] bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <StatusMenu
            tab={filters.tab}
            open={tabsOpen}
            reduce={Boolean(reduce)}
            onOpen={() => setTabsOpen(true)}
            onClose={() => setTabsOpen(false)}
            onPick={(id) => {
              if (id !== filters.tab) {
                filters.write({
                  tab: id,
                  overdue: false,
                  quoteSent: id === "all" ? filters.quoteSent : false,
                  quoteDelayed: false,
                  meetingSuccessful: false,
                });
              }
              setTabsOpen(false);
            }}
          />
          <span className="mx-0.5 hidden h-5 w-px shrink-0 bg-[#E6EAF0] sm:block" aria-hidden />
          <MeetingHeaderMenus
            value={draft}
            designers={designers}
            sales={salesOptions}
            branches={branches}
            onApply={(next) => filters.write(next)}
          />
        </div>
        <div className="inline-flex items-center rounded-2xl border border-[#E6EAF0] bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <ViewSwitch onShowCalendar={onShowCalendar} reduce={Boolean(reduce)} />
        </div>
        </div>
      </header>

      <section className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2" aria-label="Meeting totals">
        <KpiCard ready={!loading} label="Scheduled" value={stats.scheduled} hint="Upcoming meetings" chip={`${numberFormat.format(stats.today)} today`} chipClass="bg-[#E0ECFF] text-[#1E40AF]" iconClass="bg-[#E0ECFF] text-[#1D4ED8]" icon={<CalIcon />} />
        <KpiCard ready={!loading} label="Meeting successful" value={stats.meetingSuccessful} hint="Successful meetings" chip="Yes" chipClass="bg-[#E0ECFF] text-[#1E40AF]" iconClass="bg-[#E0ECFF] text-[#1D4ED8]" icon={<CheckIcon />} active={filters.meetingSuccessful} onClick={onShowMeetingSuccessful} />
        <KpiCard ready={!loading} label="Cancelled" value={stats.cancelled} hint="Cancelled meetings" chip={`${stats.cancelledPct}%`} chipClass="bg-[#FEF3C7] text-[#92400E]" iconClass="bg-[#FEF3F2] text-[#B42318]" icon={<XIcon />} />
        <KpiCard ready={!loading} label="Quotes sent" value={monthQuoteSent.length} hint="Sales Admin leads" chip="Won + lost" chipClass="bg-[#F0FDF4] text-[#15803D]" iconClass="bg-[#F0FDF4] text-[#15803D]" icon={<DocIcon />} active={filters.quoteSent} onClick={onShowQuoteSent} />
        <KpiCard ready={!loading} label="Quote delayed" value={quoteDelayedCount} hint="After meeting successful" chip="Over 4 hours" chipClass="bg-[#FEF3F2] text-[#B42318]" iconClass="bg-[#FEF3F2] text-[#B42318]" icon={<ClockIcon />} active={filters.quoteDelayed} onClick={onShowQuoteDelayed} />
      </section>

      <section className="mt-4 overflow-visible rounded-[18px] border border-[#E3E8EE] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <MeetingsToolbar query={filters.q} fetching={loading} total={displayTotal} onQuery={(q) => filters.write({ q })} />
        <div aria-live="polite" className="sr-only">
          {loading ? "Loading meetings" : `${listTotal} meetings`}
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
            total={listTotal}
            onPage={(next) => filters.write({ page: next }, { keepPage: true })}
            onPageSize={(pageSize) => filters.write({ pageSize })}
            onView={onView}
            onReschedule={onReschedule}
            onClear={() =>
              filters.write({
                q: "",
                designerIds: [],
                salesIds: [],
                branchIds: [],
                labels: [],
                progress: [],
                preset: "",
                dateFrom: "",
                dateTo: "",
                overdue: false,
                quoteSent: false,
                quoteDelayed: false,
                meetingSuccessful: false,
                tab: "all",
              })
            }
          />
        )}
      </section>
    </div>
  );
}

function periodNote(preset: string, dates: { from?: string; to?: string } | null): string {
  if (preset === "all" || !dates?.from || !dates.to) return "All dates";
  if (!preset || preset === "this-month") {
    return new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  }
  const from = new Date(`${dates.from}T00:00:00`);
  const to = new Date(`${dates.to}T00:00:00`);
  const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();
  if (sameMonth) return from.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  const start = from.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const end = to.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${start} – ${end}`;
}

function sameBranch(rowBranch: string | undefined, selected: string): boolean {
  const key = (value: string) => value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const canon = (value: string) => {
    const normalized = key(value);
    if (normalized.startsWith("HBR")) return "HBR";
    if (normalized.includes("JP") && normalized.includes("NAGAR")) return "JP_NAGAR";
    if (normalized.includes("SARJAPUR")) return "SARJAPUR";
    return normalized;
  };
  return Boolean(rowBranch) && canon(rowBranch ?? "") === canon(selected);
}

function dateInBoardRange(date: string, dates: { from?: string; to?: string } | null): boolean {
  if (!dates?.from && !dates?.to) return true;
  if (!date) return false;
  if (dates.from && date < dates.from) return false;
  if (dates.to && date > dates.to) return false;
  return true;
}

function matchesTab(row: MeetingRecord, tab: MeetingTab): boolean {
  if (tab === "all") return true;
  if (tab === "cancelled") return row.meetingStatus === "CANCELLED";
  if (tab === "rescheduled") return row.meetingStatus === "RESCHEDULED";
  if (tab === "in-progress") return row.progress === "IN_PROGRESS" && row.meetingStatus !== "CANCELLED" && row.meetingStatus !== "RESCHEDULED";
  if (tab === "scheduled") {
    return (
      (row.meetingStatus ?? "SCHEDULED") === "SCHEDULED" &&
      row.progress !== "IN_PROGRESS" &&
      row.progress !== "MEETING_ABANDONED" &&
      row.progress !== "MEETING_SUCCESSFUL"
    );
  }
  if (tab === "today") return row.dayOffset === 0 && row.meetingStatus !== "CANCELLED";
  if (tab === "upcoming") return row.dayOffset > 0 && row.status !== "COMPLETED" && row.meetingStatus !== "CANCELLED";
  return row.status === "COMPLETED" && row.meetingStatus !== "CANCELLED";
}

const HEADER_TABS: Array<{ id: MeetingTab; label: string }> = [
  { id: "all", label: "ALL" },
  { id: "scheduled", label: "SCHEDULED" },
  { id: "rescheduled", label: "RESCHEDULED" },
  { id: "in-progress", label: "IN PROGRESS" },
  { id: "cancelled", label: "CANCELLED" },
];

const TAB_DOT: Record<MeetingTab, string> = {
  all: "bg-[#64748B]",
  scheduled: "bg-[#2563EB]",
  rescheduled: "bg-[#D97706]",
  "in-progress": "bg-[#0B6B45]",
  cancelled: "bg-[#DC2626]",
  completed: "bg-[#0B6B45]",
  today: "bg-[#2563EB]",
  upcoming: "bg-[#2563EB]",
};

function StatusMenu({
  tab,
  open,
  reduce,
  onOpen,
  onClose,
  onPick,
}: {
  tab: MeetingTab;
  open: boolean;
  reduce: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPick: (id: MeetingTab) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const current = HEADER_TABS.find((item) => item.id === tab) ?? HEADER_TABS[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => (open ? onClose() : onOpen())}
        className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[12px] font-semibold tracking-wide text-[#14171F] ${focusRing} ${
          open ? "bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "bg-[#F3F5F8]"
        }`}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TAB_DOT[current.id]}`} />
        <span>{current.label}</span>
        <svg viewBox="0 0 16 16" className={`h-3 w-3 text-[#94A3B8] transition-transform ${open ? "rotate-180" : ""}`} fill="none" aria-hidden>
          <path d="M4 6.5 8 10.5 12 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="listbox"
            aria-label="Meeting status"
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            transition={reduce ? { duration: 0 } : { duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute left-0 top-[calc(100%+6px)] z-50 flex w-[168px] flex-col overflow-hidden rounded-xl border border-[#E6EAF0] bg-white py-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
          >
            {HEADER_TABS.map((item) => {
              const active = item.id === tab;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => onPick(item.id)}
                  className={`flex h-8 w-full items-center gap-1.5 px-2.5 text-left text-[12px] font-semibold tracking-wide ${focusRing} ${
                    active ? "bg-[#F3F5F8] text-[#14171F]" : "text-[#334155] hover:bg-[#F8FAFC]"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TAB_DOT[item.id]}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ViewSwitch({ onShowCalendar, reduce }: { onShowCalendar: () => void; reduce: boolean }) {
  return (
    <div className="relative inline-flex h-8 items-center rounded-xl bg-[#F3F5F8] p-0.5" role="group" aria-label="Meetings view">
      <button type="button" className={`relative inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold text-[#0B6B45] ${focusRing}`}>
        <motion.span
          layoutId="meeting-view-pill"
          className="absolute inset-0 rounded-lg bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]"
          transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        />
        <ListIcon />
        <span className="relative">List</span>
      </button>
      <button
        type="button"
        onClick={onShowCalendar}
        className={`relative inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold text-[#5F6675] transition-colors hover:text-[#14171F] ${focusRing}`}
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

function meetingBoardDates(preset: string, dateFrom: string, dateTo: string): { from?: string; to?: string } | null {
  if (preset === "all") return null;
  const effective = preset || "this-month";
  if (effective === "custom") {
    const from = dateFrom.trim();
    const to = dateTo.trim();
    if (!from && !to) return null;
    return { from: from || undefined, to: to || undefined };
  }
  if (!isDatePresetId(effective) || effective === "custom") return null;
  const range = resolveDatePreset(effective, new Date(), { from: dateFrom, to: dateTo });
  if (!range) return null;
  return { from: toDateKey(range.from), to: toDateKey(range.to) };
}

async function loadUsersByRole(role: "DESIGNER" | "SALES_EXECUTIVE"): Promise<HierarchyUserLike[]> {
  const res = await fetch(
    `${getAuthApiBaseUrl()}/api/auth/users-by-role?role=${encodeURIComponent(role)}`,
    { cache: "no-store", headers: getCrmAuthHeaders({ Accept: "application/json" }) },
  );
  if (!res.ok) return [];
  const data = (await res.json().catch(() => [])) as unknown;
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const user = row as HierarchyUserLike & { role?: string };
    const userRole = normalizeRole(user.role);
    if (userRole && userRole !== role) return [];
    return [{ fullName: user.fullName, name: user.name, username: user.username }];
  });
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
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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
