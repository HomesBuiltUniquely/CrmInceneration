"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import AppTopBar from "../Shared/AppTopBar";
import SlimScrollArea from "@/app/Components/Shared/SlimScrollArea";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import {
  CRM_LOGIN_USERNAME_KEY,
  CRM_ROLE_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
  normalizeRole,
} from "@/lib/auth/api";
import { canAccessRecordingCallLogs } from "@/lib/roleUtils";
import { cn } from "@/lib/cn";
import {
  fetchAllCallEvents,
  fetchAllCallRecordings,
  fetchCallSyncHealth,
  loadRecordingCallLogsFilterOptions,
} from "@/lib/recording-call-logs/api";
import {
  canSeePerExecutiveSummary,
  canViewCallSyncHealth,
  DURATION_OPTIONS,
  hubActiveFilterCount,
  leadTypeOptionsForRole,
  PERIOD_OPTIONS,
  REINQUIRY_OPTIONS,
  resolvePeriodRange,
  sortOptionsForRole,
} from "@/lib/recording-call-logs/filters";
import {
  aggregateExecutiveTotals,
  buildExecutiveRoster,
  filtersForExecutive,
  type SummaryExecutivePerson,
} from "@/lib/recording-call-logs/executive";
import { directionBadgeClass, TONE_STYLES } from "@/lib/recording-call-logs/format";
import {
  buildCallMetrics,
  buildRecordingMetrics,
  callEventsToRows,
  filterCallEvents,
  filterRecordings,
  filterRowsByMetric,
  filterRowsBySearch,
  recordingsToRows,
} from "@/lib/recording-call-logs/stats";
import type {
  ActivityListRow,
  CallSyncHealth,
  ContentTab,
  HubCallEvent,
  HubCallRecording,
  RecordingCallLogsFilterOptions,
  SummaryDuration,
  SummaryFiltersState,
  SummaryMetric,
  SummaryPeriod,
} from "@/lib/recording-call-logs/types";
import { DEFAULT_SUMMARY_FILTERS } from "@/lib/recording-call-logs/types";
import RecordingPlayerModal, {
  type RecordingPlayerTarget,
} from "@/app/Components/Shared/RecordingPlayerModal";
import ExecutivesPanel from "./ExecutivesPanel";
import MoreFiltersPanel from "./MoreFiltersPanel";

type PageView = "main" | "executiveDetail";

function roleLabel(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function MetricIcon({ id }: { id: string }) {
  const common = "h-[18px] w-[18px]";
  switch (id) {
    case "incoming":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none">
          <path d="M7 7V17H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17 7L7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "outgoing":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none">
          <path d="M17 17V7H7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 17L17 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "missed":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none">
          <path d="M16 8L8 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 8L16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none">
          <path
            d="M8.2 5.8C8.6 5.2 9.4 4.9 10.1 5.1L11.4 5.5C12 5.7 12.3 6.4 12.1 7L11.6 8.6C11.5 9.1 11.7 9.6 12.1 9.9L13.6 11.1C14 11.4 14.5 11.5 15 11.3L16.5 10.7C17.1 10.5 17.8 10.7 18.1 11.3L18.8 12.5C19.2 13.2 19 14.1 18.4 14.6C16.6 16.1 14.1 16.6 11.9 15.7C9.9 14.9 8.2 13.4 7.1 11.5C6 9.5 5.8 7.1 6.6 4.9C6.9 4.2 7.7 3.9 8.4 4.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

function MetricCard({
  metric,
  noun,
  selected,
  onSelect,
}: {
  metric: SummaryMetric;
  noun: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = TONE_STYLES[metric.tone];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group rounded-2xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition",
        "hover:border-[#C9D3E0] hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]",
        selected ? "border-transparent ring-2 ring-[#1D4ED8]/30" : "border-[#E6EAF0]",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            tone.iconBg,
            tone.iconText,
          )}
        >
          <MetricIcon id={metric.id} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-[#14171F]">{metric.label}</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={cn("text-[26px] font-bold leading-none tracking-tight", tone.count)}>
              {metric.count}
            </span>
            <span className="text-[11px] font-medium text-[#8A94A6]">{noun}</span>
          </div>
          <p className="mt-2 text-[12px] font-medium text-[#5B6778]">
            <span className="tabular-nums text-[#14171F]">{metric.talkTimeLabel}</span>
            <span className="text-[#8A94A6]"> · talk time</span>
          </p>
        </div>
      </div>
    </button>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  active = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  active?: boolean;
}) {
  return (
    <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
      <span
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
          active ? "text-[#1D4ED8]" : "text-[#8A94A6]",
        )}
      >
        {label}
        {active ? (
          <span className="inline-flex items-center rounded-full bg-[#DBEAFE] px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-[#1D4ED8]">
            Applied
          </span>
        ) : null}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className={cn(
            "h-10 w-full appearance-none rounded-xl border px-3 pr-9 text-[13px] font-semibold outline-none transition focus:ring-2",
            active
              ? "border-[#93B4F5] bg-[#EFF6FF] text-[#1E3A8A] focus:border-[#2563EB] focus:ring-[#2563EB]/20"
              : "border-[#E6EAF0] bg-white text-[#14171F] focus:border-[#93B4F5] focus:ring-[#2563EB]/15",
          )}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span
          className={cn(
            "pointer-events-none absolute inset-y-0 right-3 flex items-center",
            active ? "text-[#1D4ED8]" : "text-[#8A94A6]",
          )}
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </label>
  );
}

function ActivityList({
  rows,
  emptyLabel,
  loading,
  showPlay = false,
  onPlay,
}: {
  rows: ActivityListRow[];
  emptyLabel: string;
  loading?: boolean;
  showPlay?: boolean;
  onPlay?: (row: ActivityListRow) => void;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[#E6EAF0] bg-white px-4 py-12 text-center text-[13px] font-medium text-[#8A94A6]">
        Loading…
      </div>
    );
  }

  const headerCols = showPlay
    ? "md:grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1fr)_130px_80px_56px]"
    : "md:grid-cols-[minmax(0,1.4fr)_130px_minmax(0,1fr)_140px_90px]";

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E6EAF0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div
        className={cn(
          "hidden gap-3 border-b border-[#E6EAF0] bg-[#F8FAFC] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8A94A6] md:grid",
          headerCols,
        )}
      >
        <span>Lead</span>
        <span>Type</span>
        <span>Executive</span>
        <span>When</span>
        <span className="text-right">Duration</span>
        {showPlay ? <span className="text-right">Play</span> : null}
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-[13px] font-medium text-[#8A94A6]">
          {emptyLabel}
        </div>
      ) : (
        <ul className="divide-y divide-[#EEF1F5]">
          {rows.map((row) => {
            const canPlay = Boolean(row.recordingId && (showPlay || row.hasRecording));
            return (
              <li
                key={row.id}
                className={cn(
                  "grid gap-2 px-4 py-3.5 transition hover:bg-[#F8FAFC] md:items-center md:gap-3",
                  headerCols,
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-[#14171F]">{row.leadName}</p>
                  <p className="mt-0.5 truncate text-[12px] text-[#8A94A6]">
                    {row.leadId} · {row.phoneMasked}
                  </p>
                </div>
                <div>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      directionBadgeClass(row.direction),
                    )}
                  >
                    {row.direction}
                  </span>
                </div>
                <p className="truncate text-[13px] font-medium text-[#334155]">{row.executive}</p>
                <p className="text-[12px] font-medium text-[#5B6778]">{row.startedAtLabel}</p>
                <p className="text-[13px] font-semibold tabular-nums text-[#14171F] md:text-right">
                  {row.durationLabel}
                </p>
                {showPlay ? (
                  <div className="flex justify-start md:justify-end">
                    <button
                      type="button"
                      disabled={!canPlay}
                      onClick={() => onPlay?.(row)}
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-full transition",
                        canPlay
                          ? "bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE]"
                          : "cursor-not-allowed bg-[#F1F5F9] text-[#A0A8B5]",
                      )}
                      title={canPlay ? "Play recording" : "Recording unavailable"}
                      aria-label={canPlay ? `Play recording for ${row.leadName}` : "Recording unavailable"}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                        <path d="M8 5.5v13l11-6.5L8 5.5z" />
                      </svg>
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const EMPTY_FILTER_OPTIONS: RecordingCallLogsFilterOptions = {
  branches: [],
  salesAdmins: [],
  salesManagers: [],
  salesExecutives: [],
  presalesManagers: [],
  presalesExecutives: [],
  assignees: [],
};

export default function RecordingCallLogsClient() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [profileName, setProfileName] = useState("User");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<ContentTab>("calls");
  const [view, setView] = useState<PageView>("main");
  const [focusedExecutive, setFocusedExecutive] =
    useState<SummaryExecutivePerson | null>(null);
  const [filters, setFilters] = useState<SummaryFiltersState>(DEFAULT_SUMMARY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<SummaryFiltersState>(DEFAULT_SUMMARY_FILTERS);
  const [moreOpen, setMoreOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);

  const [events, setEvents] = useState<HubCallEvent[]>([]);
  const [recordings, setRecordings] = useState<HubCallRecording[]>([]);
  const [callSyncLastAt, setCallSyncLastAt] = useState<string | null>(null);
  const [syncHealth, setSyncHealth] = useState<CallSyncHealth | null>(null);
  const [filterOptions, setFilterOptions] = useState<RecordingCallLogsFilterOptions>(EMPTY_FILTER_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState("");
  const [playerTarget, setPlayerTarget] = useState<RecordingPlayerTarget | null>(null);

  useEffect(() => {
    const next = normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "");
    const name =
      window.localStorage.getItem(CRM_USER_NAME_STORAGE_KEY)?.trim() ||
      window.localStorage.getItem(CRM_LOGIN_USERNAME_KEY)?.trim() ||
      "User";
    setRole(next);
    setProfileName(name);
    setReady(true);
    if (!canAccessRecordingCallLogs(next)) router.replace("/");
  }, [router]);

  const loadData = useCallback(async (nextFilters: SummaryFiltersState, nextRole: string) => {
    setLoading(true);
    setError("");
    try {
      const { from, to } = resolvePeriodRange(nextFilters.period);
      const userId = nextFilters.hub.salesExecutiveUserId;

      const [eventsResult, recordingsResult] = await Promise.all([
        fetchAllCallEvents({ from, to, userId }),
        fetchAllCallRecordings({ from, to }),
      ]);

      setEvents(eventsResult.items);
      setCallSyncLastAt(eventsResult.callSyncLastAt);
      setRecordings(recordingsResult);

      if (canViewCallSyncHealth(nextRole)) {
        try {
          setSyncHealth(await fetchCallSyncHealth(3));
        } catch {
          setSyncHealth(null);
        }
      } else {
        setSyncHealth(null);
      }
    } catch (e) {
      setEvents([]);
      setRecordings([]);
      setError(e instanceof Error ? e.message : "Could not load call data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !canAccessRecordingCallLogs(role)) return;
    void loadData(filters, role);
  }, [ready, role, filters, loadData]);

  useEffect(() => {
    if (!ready || !canAccessRecordingCallLogs(role)) return;
    let cancelled = false;
    setLoadingOptions(true);
    void loadRecordingCallLogsFilterOptions(filters.hub.branch || undefined)
      .then((opts) => {
        if (!cancelled) setFilterOptions(opts);
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, role, filters.hub.branch]);

  const activeFilters = useMemo(() => {
    if (view === "executiveDetail" && focusedExecutive) {
      return filtersForExecutive(filters, focusedExecutive);
    }
    return filters;
  }, [view, focusedExecutive, filters]);

  const scopedEvents = useMemo(
    () =>
      filterCallEvents(events, {
        leadTypeKey: activeFilters.leadTypeKey,
        duration: activeFilters.duration,
        hub: activeFilters.hub,
      }),
    [events, activeFilters],
  );

  const scopedRecordings = useMemo(
    () =>
      filterRecordings(recordings, {
        leadTypeKey: activeFilters.leadTypeKey,
        duration: activeFilters.duration,
        hub: activeFilters.hub,
      }),
    [recordings, activeFilters],
  );

  const executiveRows = useMemo(() => {
    if (!canSeePerExecutiveSummary(role)) return [];
    const roster = buildExecutiveRoster({
      role,
      options: filterOptions,
      hub: filters.hub,
    });
    return aggregateExecutiveTotals({
      roster,
      events,
      recordings,
      filters,
    });
  }, [role, filterOptions, filters, events, recordings]);

  const metrics = useMemo(() => {
    if (tab === "recordings") return buildRecordingMetrics(scopedRecordings);
    return buildCallMetrics(scopedEvents);
  }, [tab, scopedEvents, scopedRecordings]);

  const listRows = useMemo(() => {
    const base =
      tab === "recordings"
        ? recordingsToRows(scopedRecordings)
        : callEventsToRows(scopedEvents);
    return filterRowsBySearch(filterRowsByMetric(base, selectedMetricId), search);
  }, [tab, scopedEvents, scopedRecordings, selectedMetricId, search]);

  const noun = tab === "recordings" ? "recordings" : "calls";

  const moreCount =
    hubActiveFilterCount(filters.hub) +
    (filters.leadTypeKey ? 1 : 0) +
    (filters.sortKey !== "updatedAt,desc" ? 1 : 0);

  const periodActive = filters.period !== DEFAULT_SUMMARY_FILTERS.period;
  const durationActive = filters.duration !== DEFAULT_SUMMARY_FILTERS.duration;
  const hasAppliedFilters = periodActive || durationActive || moreCount > 0;
  const appliedFilterTotal =
    (periodActive ? 1 : 0) + (durationActive ? 1 : 0) + moreCount;

  const periodLabel =
    PERIOD_OPTIONS.find((o) => o.value === activeFilters.period)?.label ?? "Today";
  const durationLabel =
    DURATION_OPTIONS.find((o) => o.value === activeFilters.duration)?.label ??
    "Any duration";

  const appliedChips = useMemo(() => {
    const chips: { id: string; label: string }[] = [];
    if (periodActive) chips.push({ id: "period", label: `Period: ${periodLabel}` });
    if (durationActive) {
      chips.push({ id: "duration", label: `Duration: ${durationLabel}` });
    }

    const labelOf = (
      options: { value: string; label: string }[],
      value: string,
      fallback: string,
    ) => options.find((o) => o.value === value)?.label ?? fallback;

    const hub = filters.hub;
    if (hub.branch) {
      chips.push({
        id: "branch",
        label: `Branch: ${labelOf(filterOptions.branches, hub.branch, hub.branch)}`,
      });
    }
    if (hub.salesAdmin) {
      chips.push({
        id: "salesAdmin",
        label: `Sales Admin: ${labelOf(
          filterOptions.salesAdmins.length
            ? filterOptions.salesAdmins
            : filterOptions.salesManagers,
          hub.salesAdmin,
          hub.salesAdmin,
        )}`,
      });
    }
    if (hub.salesManager) {
      chips.push({
        id: "salesManager",
        label: `Sales Mgr: ${labelOf(
          filterOptions.salesManagers,
          hub.salesManager,
          hub.salesManager,
        )}`,
      });
    }
    if (hub.salesExecutive) {
      chips.push({
        id: "salesExecutive",
        label: `Exec: ${labelOf(
          filterOptions.salesExecutives,
          hub.salesExecutive,
          hub.salesExecutive,
        )}`,
      });
    }
    if (hub.presalesManager) {
      chips.push({
        id: "presalesManager",
        label: `Presales Mgr: ${labelOf(
          filterOptions.presalesManagers,
          hub.presalesManager,
          hub.presalesManager,
        )}`,
      });
    }
    if (hub.presalesExecutive) {
      chips.push({
        id: "presalesExecutive",
        label: `Presales Exec: ${labelOf(
          filterOptions.presalesExecutives.length
            ? filterOptions.presalesExecutives
            : filterOptions.salesExecutives,
          hub.presalesExecutive,
          hub.presalesExecutive,
        )}`,
      });
    }
    if (hub.assignee) {
      chips.push({
        id: "assignee",
        label: `Assignee: ${labelOf(
          filterOptions.assignees,
          hub.assignee,
          hub.assignee,
        )}`,
      });
    }
    if (hub.reinquiry) {
      chips.push({
        id: "reinquiry",
        label: `Reinquiry: ${labelOf(REINQUIRY_OPTIONS, hub.reinquiry, hub.reinquiry)}`,
      });
    }
    if (filters.leadTypeKey) {
      chips.push({
        id: "leadType",
        label: `Lead type: ${labelOf(
          leadTypeOptionsForRole(role),
          filters.leadTypeKey,
          filters.leadTypeKey,
        )}`,
      });
    }
    if (filters.sortKey !== "updatedAt,desc") {
      chips.push({
        id: "sort",
        label: `Sort: ${labelOf(
          sortOptionsForRole(role),
          filters.sortKey,
          filters.sortKey,
        )}`,
      });
    }
    return chips;
  }, [
    periodActive,
    durationActive,
    periodLabel,
    durationLabel,
    filters,
    filterOptions,
    role,
  ]);

  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_SUMMARY_FILTERS);
    setDraftFilters(DEFAULT_SUMMARY_FILTERS);
    setSelectedMetricId(null);
  }, []);

  const allowed = ready && canAccessRecordingCallLogs(role);
  const showPerExecutive = canSeePerExecutiveSummary(role);
  const syncLabel = callSyncLastAt
    ? formatSyncAt(callSyncLastAt)
    : syncHealth?.teamCallSyncLastAt
      ? formatSyncAt(syncHealth.teamCallSyncLastAt)
      : "No sync yet";

  return (
    <div className="min-h-screen min-h-dvh overflow-x-clip bg-[#F4F6F8] xl:h-screen xl:overflow-hidden">
      <div className="grid min-h-screen xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <QuickAccessSidebar
            appBadge="HO WS"
            appName="Hows"
            appTagline="by HUB"
            sections={dashboardSidebarSections}
            profileName={roleLabel(role) || profileName}
            profileRole={role || "USER"}
            profileInitials={profileName.slice(0, 2).toUpperCase()}
          />
        </div>

        <SlimScrollArea
          className="bg-[#F4F6F8] xl:h-screen"
          contentClassName="overflow-x-clip"
          contentId="recording-call-logs-scroll"
        >
          <AppTopBar />

          {allowed ? (
            <main className="px-4 py-5 md:px-6 md:py-6">
              <div className="mx-auto max-w-[1180px]">
                {view === "executiveDetail" && focusedExecutive ? (
                  <button
                    type="button"
                    onClick={() => {
                      setView("main");
                      setFocusedExecutive(null);
                      setTab("executives");
                      setSelectedMetricId(null);
                      setSearch("");
                    }}
                    className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2563EB] hover:underline"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                      <path
                        d="M12.5 4.5L7 10L12.5 15.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Back to By executive
                  </button>
                ) : null}

                <header className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A94A6]">
                      {view === "executiveDetail" ? "Executive summary" : "CRM · Activity"}
                    </p>
                    <h1 className="mt-1 text-[24px] font-bold tracking-tight text-[#14171F] md:text-[28px]">
                      {view === "executiveDetail" && focusedExecutive
                        ? focusedExecutive.displayName
                        : "Recording & Call Logs"}
                    </h1>
                    <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[#5B6778]">
                      {view === "executiveDetail" && focusedExecutive
                        ? focusedExecutive.isPresales
                          ? "Presales executive · period filters apply here"
                          : "Sales executive · period filters apply here"
                        : "Company SIM call activity and HUB recordings — mobile Summary parity for web."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadData(filters, role)}
                    className="inline-flex items-center gap-2 self-start rounded-full border border-[#E6EAF0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#5B6778] shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-[#F8FAFC]"
                  >
                    Refresh
                  </button>
                </header>

                {error ? (
                  <div className="mb-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13px] font-medium text-[#B91C1C]">
                    {error}
                  </div>
                ) : null}

                {view === "main" ? (
                <div className="flex items-center gap-1 border-b border-[#E6EAF0]">
                  {(
                    [
                      { id: "calls" as const, label: "Calls" },
                      { id: "recordings" as const, label: "Recordings" },
                      ...(showPerExecutive
                        ? [{ id: "executives" as const, label: "By executive" }]
                        : []),
                    ]
                  ).map((item) => {
                    const active = tab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setTab(item.id);
                          setSelectedMetricId(null);
                          setSearch("");
                        }}
                        className={cn(
                          "relative px-4 py-3 text-[14px] font-semibold transition",
                          active ? "text-[#14171F]" : "text-[#8A94A6] hover:text-[#5B6778]",
                        )}
                      >
                        {item.label}
                        {active ? (
                          <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-[#14171F]" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                ) : (
                <div className="flex items-center gap-1 border-b border-[#E6EAF0]">
                  {(
                    [
                      { id: "calls" as const, label: "Calls" },
                      { id: "recordings" as const, label: "Recordings" },
                    ]
                  ).map((item) => {
                    const active = tab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setTab(item.id);
                          setSelectedMetricId(null);
                          setSearch("");
                        }}
                        className={cn(
                          "relative px-4 py-3 text-[14px] font-semibold transition",
                          active ? "text-[#14171F]" : "text-[#8A94A6] hover:text-[#5B6778]",
                        )}
                      >
                        {item.label}
                        {active ? (
                          <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-[#14171F]" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                )}

                {tab !== "executives" || view === "executiveDetail" ? (
                <section className="mt-5">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <h2 className="text-[16px] font-bold text-[#14171F]">
                        {tab === "calls" ? "Call summary" : "Recording summary"}
                      </h2>
                      <p className="mt-0.5 text-[12px] text-[#8A94A6]">
                        {tab === "calls"
                          ? "Company SIM · CRM leads only"
                          : "HUB logged calls with audio"}
                      </p>
                    </div>
                    {selectedMetricId ? (
                      <button
                        type="button"
                        onClick={() => setSelectedMetricId(null)}
                        className="text-[12px] font-semibold text-[#2563EB] hover:underline"
                      >
                        Clear selection
                      </button>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {metrics.map((metric) => (
                      <MetricCard
                        key={metric.id}
                        metric={metric}
                        noun={noun}
                        selected={selectedMetricId === metric.id}
                        onSelect={() =>
                          setSelectedMetricId((prev) =>
                            prev === metric.id ? null : metric.id,
                          )
                        }
                      />
                    ))}
                  </div>
                </section>
                ) : null}

                {tab === "calls" ? (
                  <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[#E6EAF0] bg-[#F8FAFC] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[13px] font-semibold text-[#14171F]">Call sync status</p>
                      <p className="mt-0.5 text-[12px] text-[#5B6778]">Last sync: {syncLabel}</p>
                    </div>
                    {syncHealth ? (
                      <span className="self-start rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#334155] ring-1 ring-[#E6EAF0] sm:self-auto">
                        {syncHealth.executives.filter((e) => e.health === "stale" || e.health === "never").length}{" "}
                        team alerts
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <section
                  className={cn(
                    "mt-5 rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-5",
                    hasAppliedFilters
                      ? "border-[#93B4F5] ring-1 ring-[#BFDBFE]"
                      : "border-[#E6EAF0]",
                  )}
                >
                  {hasAppliedFilters ? (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#EFF6FF] px-3 py-2">
                      <p className="text-[12px] font-semibold text-[#1D4ED8]">
                        Filters applied
                        <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1D4ED8] px-1.5 text-[10px] font-bold text-white">
                          {appliedFilterTotal}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="text-[12px] font-semibold text-[#1D4ED8] underline-offset-2 hover:underline"
                      >
                        Clear all
                      </button>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <FilterSelect
                      label="Period"
                      value={filters.period}
                      options={PERIOD_OPTIONS}
                      active={periodActive}
                      onChange={(period: SummaryPeriod) =>
                        setFilters((prev) => ({ ...prev, period }))
                      }
                    />
                    <FilterSelect
                      label="Duration"
                      value={filters.duration}
                      options={DURATION_OPTIONS}
                      active={durationActive}
                      onChange={(duration: SummaryDuration) =>
                        setFilters((prev) => ({ ...prev, duration }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setDraftFilters(filters);
                        setMoreOpen(true);
                      }}
                      className={cn(
                        "relative inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-[13px] font-semibold transition",
                        moreCount > 0
                          ? "border-[#93B4F5] bg-[#EFF6FF] text-[#1D4ED8] hover:bg-[#DBEAFE]"
                          : "border-[#E6EAF0] bg-[#F8FAFC] text-[#334155] hover:bg-[#F1F5F9]",
                      )}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                        <path
                          d="M4 7H20M7 12H17M10 17H14"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                      {moreCount > 0 ? "Filters applied" : "More filters"}
                      {moreCount > 0 ? (
                        <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1D4ED8] px-1.5 text-[10px] font-bold text-white">
                          {moreCount}
                        </span>
                      ) : null}
                    </button>
                  </div>

                  {hasAppliedFilters ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {appliedChips.map((chip) => (
                        <span
                          key={chip.id}
                          className="inline-flex max-w-full items-center truncate rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-semibold text-[#1E40AF]"
                        >
                          {chip.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-[12px] font-medium text-[#8A94A6]">
                      Showing <span className="text-[#334155]">{periodLabel}</span>
                      {" · "}
                      <span className="text-[#334155]">{durationLabel}</span>
                    </p>
                  )}
                </section>

                {view === "main" && tab === "executives" ? (
                  <ExecutivesPanel
                    rows={executiveRows}
                    loading={loading || loadingOptions}
                    onExecutiveTap={(row) => {
                      setFocusedExecutive(row.person);
                      setView("executiveDetail");
                      setSelectedMetricId(null);
                      setSearch("");
                      setTab("calls");
                    }}
                  />
                ) : null}

                {tab !== "executives" || view === "executiveDetail" ? (
                <section className="mt-5">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-[16px] font-bold text-[#14171F]">
                        {tab === "calls" ? "Call logs" : "Recordings"}
                      </h2>
                      <p className="mt-0.5 text-[12px] text-[#8A94A6]">
                        {listRows.length} result{listRows.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="relative w-full sm:max-w-[280px]">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#8A94A6]">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                          <path d="M16 16L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </span>
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search lead, executive, phone…"
                        className="h-10 w-full rounded-xl border border-[#E6EAF0] bg-white pl-9 pr-3 text-[13px] font-medium text-[#14171F] outline-none transition placeholder:text-[#A0A8B5] focus:border-[#93B4F5] focus:ring-2 focus:ring-[#2563EB]/15"
                      />
                    </div>
                  </div>

                  <ActivityList
                    rows={listRows}
                    loading={loading}
                    showPlay={tab === "recordings"}
                    onPlay={(row) => {
                      if (!row.recordingId) return;
                      setPlayerTarget({
                        recordingId: row.recordingId,
                        title: row.leadName || "Call recording",
                        subtitle: [
                          row.direction,
                          row.startedAtLabel,
                          row.durationLabel,
                          row.executive && row.executive !== "—" ? row.executive : null,
                        ]
                          .filter(Boolean)
                          .join(" · "),
                        durationSec: row.durationSec,
                      });
                    }}
                    emptyLabel={
                      tab === "calls"
                        ? "No call logs match these filters."
                        : "No recordings match these filters."
                    }
                  />
                </section>
                ) : null}
              </div>
            </main>
          ) : (
            <div className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-[#5B6778]">
              {ready
                ? "Recording & Call Logs is available to sales, presales, and admin roles."
                : "Loading…"}
            </div>
          )}
        </SlimScrollArea>
      </div>

      <MoreFiltersPanel
        open={moreOpen}
        role={role}
        value={draftFilters}
        options={filterOptions}
        loadingOptions={loadingOptions}
        onChange={setDraftFilters}
        onClose={() => setMoreOpen(false)}
        onApply={() => {
          setFilters(draftFilters);
          setMoreOpen(false);
          setSelectedMetricId(null);
        }}
        onReset={() => {
          setDraftFilters(DEFAULT_SUMMARY_FILTERS);
        }}
      />

      <RecordingPlayerModal
        target={playerTarget}
        onClose={() => setPlayerTarget(null)}
      />
    </div>
  );
}

function formatSyncAt(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
