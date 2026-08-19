"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BOOKING_DATE_PRESETS,
  DEFAULT_INSIGHTS_DATE_FILTER,
  resolveBookingDateRange,
  type BookingDateFilterState,
  type BookingDatePresetId,
} from "@/lib/booking-token-date-filter";
import {
  EMPTY_INSIGHTS_DASHBOARD,
  EMPTY_PERFORMANCE_CARDS,
  fetchInsightsDashboard,
  fetchInsightsFilterOptions,
  fetchInsightsPerformanceCards,
  type InsightsDashboard,
  type InsightsFilterOptions,
  type InsightsLostFunnelStage,
  type InsightsTeamMember,
  type PerformanceCards,
} from "@/lib/crm-insights-api";
import {
  fetchAdminLeadsHeatmapData,
  milestoneCountsFromLeads,
  normalizeMilestoneCountsToCanonical,
} from "@/lib/admin-leads-api";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import {
  buildInsightsQuoteSentCountOpts,
  computeQuoteSentWonCount,
  filterInsightsQuoteSentScopeLeads,
  filterInsightsScopeLeadsKeepRows,
  listQuoteSentWonLeads,
  resolveInsightsAssigneeAliases,
} from "@/lib/insights-quote-sent-metrics";
import {
  buildLeadBudgetInvestmentMapSync,
  enrichInvestmentMapWithQuotes,
  stableLeadKey,
} from "@/lib/insights-lead-investment";
import {
  computeFunnelCurrentStageInvestmentTotals,
  computeFreshLeadStageInvestmentTotal,
} from "@/lib/insights-sales-funnel-investment";
import {
  buildAlignedSalesFunnelStages,
  buildInsightsFunnelStagePathData,
  ensureFreshLeadInSalesFunnel,
  fetchInsightsFunnelStagePathData,
  type FunnelStagePathDataMap,
} from "@/lib/insights-funnel-stage-paths";
import { filterLeadsByAssigneeScope } from "@/lib/admin-assignee-match";
import {
  fetchInsightsSalesManagerMyTeamLeads,
} from "@/lib/insights-sales-role-pool";
import {
  insightsSalesManagerMilestoneAndTotal,
  filterApiLeadsByInsightsDateRange,
} from "@/lib/insights-sm-journey-align";
import { buildInsightsWeekChartsFromLeads, type InsightsWeekCharts } from "@/lib/insights-week-charts";
import type { ApiLead } from "@/lib/leads-filter";
import {
  computeLostSegmentCounts,
  computeLostSegmentDropReasons,
} from "@/lib/lead-lost-segment";
import {
  salesAdminPoolInsightOpts,
  salesInsightCountLeads,
} from "@/lib/sales-admin-insight-tiles";
import { filterLeadsForSalesClientInbox } from "@/lib/crm-workspace";
import {
  computeTeamMatrixIncentiveMetrics,
  formatTeamMatrixIncentiveScope,
  loadTeamMatrixIncentiveBase,
  type TeamMemberIncentiveMetrics,
} from "@/lib/insights-team-incentive-matrix";
import type { IncentiveBookingLead } from "@/lib/incentives-booking-data";
import {
  CRM_LOGIN_USERNAME_KEY,
  CRM_ROLE_STORAGE_KEY,
  CRM_TOKEN_STORAGE_KEY,
  CRM_USER_ID_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
  fetchSalesExecutivesForManager,
  normalizeRole,
} from "@/lib/auth/api";
import {
  canAccessCrmInsights,
  canUseInsightsOrgFilters,
} from "@/lib/roleUtils";
import { collectHierarchyUserAssigneeAliases, hierarchyUserDisplayName } from "@/lib/hierarchy-user-display";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import AppTopBar from "../Shared/AppTopBar";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import InsightSect2, { type TokenMetricsData } from "./InsightSect2";
import InsightsPerformanceCards from "./InsightsPerformanceCards";
import InsightSect3 from "./InsightsSect3";
import InsightsSect4 from "./InsightsSect4";
import InsightsSect5 from "./InsightsSect5";
import InsightsSect6 from "./InsightsSect6";
import InsightsDateFilterPopover from "./InsightsDateFilterPopover";
import InsightsDropdownFilter, { type DropdownOption } from "./InsightsDropdownFilter";

function isSalesManagerRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "SALES_MANAGER" || r === "MANAGER";
}

type SalesPeopleSelection =
  | { kind: "all" }
  | { kind: "manager"; id: number }
  | { kind: "executive"; id: number; managerId?: number | null };

const DATE_OPTIONS: Array<{ id: BookingDatePresetId; label: string }> = [
  { id: "all", label: "All" },
  ...BOOKING_DATE_PRESETS.map((p) => ({ id: p.id, label: p.label })),
];

function parseSalesPeopleValue(raw: string): SalesPeopleSelection {
  if (!raw || raw === "all") return { kind: "all" };
  if (raw.startsWith("manager:")) {
    const id = Number(raw.slice("manager:".length));
    return Number.isFinite(id) ? { kind: "manager", id } : { kind: "all" };
  }
  if (raw.startsWith("exec:")) {
    const id = Number(raw.slice("exec:".length));
    return Number.isFinite(id) ? { kind: "executive", id } : { kind: "all" };
  }
  return { kind: "all" };
}

function salesPeopleSelectValue(sel: SalesPeopleSelection): string {
  if (sel.kind === "manager") return `manager:${sel.id}`;
  if (sel.kind === "executive") return `exec:${sel.id}`;
  return "all";
}

export default function InsightsClient1() {
  const [dateFilter, setDateFilter] = useState<BookingDateFilterState>(
    DEFAULT_INSIGHTS_DATE_FILTER,
  );
  const [branchId, setBranchId] = useState("all");
  const [salesPeople, setSalesPeople] = useState<SalesPeopleSelection>({
    kind: "all",
  });
  /** Hub team matrix always monthly (Insights date window). */
  const teamPeriod = "monthly" as const;
  const [role, setRole] = useState("");
  const [viewerUserId, setViewerUserId] = useState<number | null>(null);
  /** SM My Leads parity: self + team hierarchy aliases (username + display). */
  const [smTeamAliasesWhenAll, setSmTeamAliasesWhenAll] = useState<string[]>([]);
  /** Journey heatmap-style team names (display + username). */
  const [smTeamDisplayNames, setSmTeamDisplayNames] = useState<string[]>([]);
  const [smSelfAliases, setSmSelfAliases] = useState<string[]>([]);
  const [aliasesByUserId, setAliasesByUserId] = useState<Map<number, string[]>>(
    () => new Map(),
  );
  const [smScopeReady, setSmScopeReady] = useState(false);

  const [filterOptions, setFilterOptions] = useState<InsightsFilterOptions>({
    branches: [],
    salesManagers: [],
    salesExecutives: [],
  });
  const [dashboard, setDashboard] = useState<InsightsDashboard>(
    EMPTY_INSIGHTS_DASHBOARD,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [performanceCards, setPerformanceCards] = useState<PerformanceCards | null>(
    null,
  );
  const [performanceCardsLoading, setPerformanceCardsLoading] = useState(true);

  /** Achieved/Payoff vs Insights date filter (Incentives engine). */
  const [teamIncentiveLeads, setTeamIncentiveLeads] = useState<
    Map<number, IncentiveBookingLead[]>
  >(() => new Map());
  const [teamIncentiveTargets, setTeamIncentiveTargets] = useState<
    Map<string, Map<number, number>>
  >(() => new Map());
  const [teamIncentiveByUser, setTeamIncentiveByUser] = useState<
    Map<number, TeamMemberIncentiveMetrics>
  >(() => new Map());
  const [incentiveScopeLabel, setIncentiveScopeLabel] = useState("");
  const [teamIncentivesLoading, setTeamIncentivesLoading] = useState(false);

  useEffect(() => {
    setRole(normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? ""));
    const rawId = window.localStorage.getItem(CRM_USER_ID_STORAGE_KEY);
    const id = rawId ? Number(rawId) : NaN;
    setViewerUserId(Number.isFinite(id) && id > 0 ? id : null);
  }, []);

  /**
   * Load Sales Manager team the same way as My Leads / notifications:
   * GET users-by-role SALES_EXECUTIVE (JWT-scoped) + own display/login aliases.
   */
  useEffect(() => {
    if (!role) return;
    if (!isSalesManagerRole(role)) {
      setSmTeamAliasesWhenAll([]);
      setSmTeamDisplayNames([]);
      setSmSelfAliases([]);
      setAliasesByUserId(new Map());
      setSmScopeReady(true);
      return;
    }
    let cancelled = false;
    setSmScopeReady(false);
    void (async () => {
      try {
        const token = window.localStorage.getItem(CRM_TOKEN_STORAGE_KEY)?.trim() ?? "";
        const displayName =
          window.localStorage.getItem(CRM_USER_NAME_STORAGE_KEY)?.trim() ?? "";
        const loginUser =
          window.localStorage.getItem(CRM_LOGIN_USERNAME_KEY)?.trim() ?? "";
        const meAliases = collectHierarchyUserAssigneeAliases({
          fullName: displayName,
          name: displayName,
          username: loginUser || displayName,
        });
        const byId = new Map<number, string[]>();
        if (viewerUserId && viewerUserId > 0) {
          byId.set(viewerUserId, meAliases);
        }
        const all = new Set(meAliases);
        const teamDisplay: string[] = [];
        if (token) {
          const [rawExecs, legacyRes] = await Promise.all([
            fetchSalesExecutivesForManager(token),
            fetch(`/api/sales-executive/all`, {
              cache: "no-store",
              credentials: "include",
              headers: getCrmAuthHeaders({ Accept: "application/json" }),
            }),
          ]);
          const addExec = (row: Record<string, unknown>) => {
            const uid = Number(row.id ?? 0);
            if (uid) {
              const aliases = collectHierarchyUserAssigneeAliases({
                id: uid,
                fullName: String(row.fullName ?? row.name ?? "").trim() || undefined,
                name: String(row.name ?? "").trim() || undefined,
                username: String(row.username ?? "").trim() || undefined,
                email: String(row.email ?? "").trim() || undefined,
              });
              byId.set(uid, aliases);
              for (const a of aliases) all.add(a);
            }
            // Same as Header managerTeamNames — display name only.
            const display = hierarchyUserDisplayName({
              fullName: String(row.fullName ?? "").trim() || undefined,
              name: String(row.name ?? "").trim() || undefined,
              username: String(row.username ?? "").trim() || undefined,
            });
            if (display && !teamDisplay.some((t) => t.toLowerCase() === display.toLowerCase())) {
              teamDisplay.push(display);
            }
          };
          for (const row of rawExecs) {
            const mid =
              row.managerId != null && row.managerId !== ""
                ? Number(row.managerId)
                : null;
            if (
              viewerUserId &&
              mid != null &&
              Number.isFinite(mid) &&
              mid > 0 &&
              mid !== viewerUserId
            ) {
              continue;
            }
            addExec(row);
          }
          if (legacyRes.ok) {
            const j = (await legacyRes.json().catch(() => [])) as unknown;
            const raw = Array.isArray(j)
              ? j
              : j && typeof j === "object" && Array.isArray((j as { data?: unknown }).data)
                ? ((j as { data: unknown[] }).data ?? [])
                : [];
            for (const row of raw) {
              if (!row || typeof row !== "object") continue;
              const rec = row as Record<string, unknown>;
              if (Number(rec.managerId ?? 0) !== Number(viewerUserId ?? 0)) continue;
              addExec(rec);
            }
          }
        }
        if (!cancelled) {
          setAliasesByUserId(byId);
          setSmTeamAliasesWhenAll([...all]);
          setSmSelfAliases(meAliases);
          setSmTeamDisplayNames(teamDisplay);
          setSmScopeReady(true);
        }
      } catch {
        if (!cancelled) {
          setSmTeamAliasesWhenAll([]);
          setSmTeamDisplayNames([]);
          setSmSelfAliases([]);
          setAliasesByUserId(new Map());
          setSmScopeReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, viewerUserId]);

  const canPickTeamIncentives = useMemo(() => {
    const r = role.toUpperCase();
    return (
      r === "SUPER_ADMIN" ||
      r === "SALES_ADMIN" ||
      r === "ADMIN" ||
      r === "SALES_MANAGER" ||
      r === "MANAGER"
    );
  }, [role]);

  const roleLabel = useMemo(
    () =>
      role
        .toLowerCase()
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ") || "User",
    [role],
  );

  const isSalesManager = useMemo(() => isSalesManagerRole(role), [role]);
  /** SUPER_ADMIN / ADMIN / SALES_ADMIN — branch + org-wide people. */
  const isOrgAdmin = useMemo(() => canUseInsightsOrgFilters(role), [role]);
  const insightsAllowed = useMemo(
    () => (role ? canAccessCrmInsights(role) : false),
    [role],
  );
  /** Branch + full people hierarchy only for org admins. */
  const showBranchFilter = isOrgAdmin;
  const showManagerPeopleOptions = isOrgAdmin;

  /**
   * Dashboard people scope:
   * - Admin/SA: as selected
   * - Sales Manager: always team (manager = self when "All"); exec pick when selected
   */
  const dashboardPeopleParams = useMemo(() => {
    if (isSalesManager) {
      if (salesPeople.kind === "executive") {
        return {
          salesManagerId: viewerUserId,
          salesExecutiveId: salesPeople.id,
        };
      }
      return {
        salesManagerId: viewerUserId,
        salesExecutiveId: null as number | null,
      };
    }
    return {
      salesManagerId: salesPeople.kind === "manager" ? salesPeople.id : null,
      salesExecutiveId: salesPeople.kind === "executive" ? salesPeople.id : null,
    };
  }, [isSalesManager, salesPeople, viewerUserId]);

  const effectiveBranchId = showBranchFilter ? branchId : "all";

  const assigneeAliasSet = useMemo(
    () =>
      resolveInsightsAssigneeAliases(salesPeople, filterOptions, {
        forceTeamWhenAll: isSalesManager && salesPeople.kind === "all",
        teamAliasesWhenAll:
          isSalesManager && salesPeople.kind === "all"
            ? smTeamAliasesWhenAll
            : undefined,
        aliasesByUserId,
      }),
    [
      salesPeople,
      filterOptions,
      isSalesManager,
      smTeamAliasesWhenAll,
      aliasesByUserId,
    ],
  );

  const loadFilters = useCallback(async (selectedBranch: string) => {
    try {
      const options = await fetchInsightsFilterOptions(
        selectedBranch === "all" ? undefined : selectedBranch,
      );
      setFilterOptions(options);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load filter options.",
      );
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    // Wait for role so unauthorized users never fetch, and SM gets manager id.
    if (!role) return;
    if (!canAccessCrmInsights(role)) {
      setLoading(false);
      return;
    }
    if (isSalesManager && (viewerUserId == null || viewerUserId <= 0)) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await fetchInsightsDashboard({
        dateFilter,
        branchId: effectiveBranchId,
        salesManagerId: dashboardPeopleParams.salesManagerId,
        salesExecutiveId: dashboardPeopleParams.salesExecutiveId,
        teamPeriod,
      });
      setDashboard(data);
    } catch (err) {
      setDashboard(EMPTY_INSIGHTS_DASHBOARD);
      setError(
        err instanceof Error ? err.message : "Failed to load insights dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    effectiveBranchId,
    dateFilter,
    dashboardPeopleParams,
    teamPeriod,
    isSalesManager,
    viewerUserId,
    role,
  ]);

  const performanceQuery = useMemo(
    () => ({
      dateFilter,
      branchId: effectiveBranchId,
      salesManagerId: dashboardPeopleParams.salesManagerId,
      salesExecutiveId: dashboardPeopleParams.salesExecutiveId,
      teamPeriod,
    }),
    [
      dateFilter,
      effectiveBranchId,
      dashboardPeopleParams,
      teamPeriod,
    ],
  );

  const loadPerformanceCards = useCallback(async () => {
    if (!role) return;
    if (!canAccessCrmInsights(role)) {
      setPerformanceCardsLoading(false);
      return;
    }
    if (isSalesManager && (viewerUserId == null || viewerUserId <= 0)) {
      return;
    }
    setPerformanceCardsLoading(true);
    try {
      const data = await fetchInsightsPerformanceCards(performanceQuery);
      setPerformanceCards(data);
    } catch {
      setPerformanceCards((prev) => prev ?? EMPTY_PERFORMANCE_CARDS);
    } finally {
      setPerformanceCardsLoading(false);
    }
  }, [role, isSalesManager, viewerUserId, performanceQuery]);

  /**
   * Token / Booking / Gross — Hub KPIs only (same Scope as totalLeads).
   * Do not recompute via fetchDashboardDealRows (misses branch when people=all).
   */
  const tokenMetrics = useMemo((): TokenMetricsData => {
    const tv = dashboard.kpis.tokenValue?.value ?? 0;
    const bv = dashboard.kpis.bookingValue?.value ?? 0;
    return {
      tokenValue: tv,
      bookingValue: bv,
      futureConversionValue: 0,
      tokenCount: 0,
      bookingCount: 0,
      loading: loading,
    };
  }, [dashboard.kpis.tokenValue, dashboard.kpis.bookingValue, loading]);

  useEffect(() => {
    if (!role || !canAccessCrmInsights(role)) return;
    // SM never scopes filter-options by branch
    void loadFilters(showBranchFilter ? branchId : "all");
  }, [branchId, loadFilters, showBranchFilter, role]);

  /** Drop people selection if it no longer exists under current branch filter-options. */
  useEffect(() => {
    if (salesPeople.kind === "all") return;
    if (salesPeople.kind === "manager") {
      if (isSalesManager) {
        setSalesPeople({ kind: "all" });
        return;
      }
      const ok = filterOptions.salesManagers.some((m) => m.id === salesPeople.id);
      if (!ok) setSalesPeople({ kind: "all" });
      return;
    }
    const execOk =
      filterOptions.salesExecutives.some((e) => e.id === salesPeople.id) ||
      filterOptions.salesManagers.some((m) =>
        (m.executives ?? []).some((e) => e.id === salesPeople.id),
      );
    if (!execOk) setSalesPeople({ kind: "all" });
  }, [filterOptions, salesPeople, isSalesManager]);

  // SM: clear branch (not used)
  useEffect(() => {
    if (isSalesManager && branchId !== "all") setBranchId("all");
  }, [isSalesManager, branchId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadPerformanceCards();
  }, [loadPerformanceCards]);

  // Achieved + Payoff = same executive-leads API as Incentives page
  useEffect(() => {
    let cancelled = false;
    const team = dashboard.teamPerformance;
    // Wait for role from localStorage so admin doesn't take the self-only path first.
    if (!role) {
      setTeamIncentivesLoading(team.length > 0);
      return;
    }
    if (!canAccessCrmInsights(role)) {
      setTeamIncentivesLoading(false);
      return;
    }
    if (team.length === 0) {
      setTeamIncentiveLeads(new Map());
      setTeamIncentiveTargets(new Map());
      setTeamIncentiveByUser(new Map());
      setIncentiveScopeLabel("");
      setTeamIncentivesLoading(false);
      return;
    }
    setTeamIncentivesLoading(true);
    setTeamIncentiveLeads(new Map());
    setTeamIncentiveByUser(new Map());
    setIncentiveScopeLabel(formatTeamMatrixIncentiveScope(dateFilter));

    const applyProgress = (state: {
      leadsByUserId: Map<number, IncentiveBookingLead[]>;
      targetsByMonth: Map<string, Map<number, number>>;
      done: boolean;
    }) => {
      if (cancelled) return;
      setTeamIncentiveLeads(state.leadsByUserId);
      setTeamIncentiveTargets(state.targetsByMonth);
      setTeamIncentiveByUser(
        computeTeamMatrixIncentiveMetrics({
          team,
          leadsByUserId: state.leadsByUserId,
          dateFilter,
          targetsByMonth: state.targetsByMonth,
        }),
      );
      if (state.done) setTeamIncentivesLoading(false);
    };

    void (async () => {
      try {
        await loadTeamMatrixIncentiveBase({
          team,
          dateFilter,
          canPickTeam: canPickTeamIncentives,
          viewerUserId,
          onProgress: applyProgress,
        });
      } catch {
        if (!cancelled) {
          setTeamIncentiveLeads(new Map());
          setTeamIncentiveTargets(new Map());
          setTeamIncentiveByUser(new Map());
          setTeamIncentivesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    dashboard.teamPerformance,
    dateFilter,
    canPickTeamIncentives,
    viewerUserId,
    role,
  ]);

  // Recompute metrics when date/leads/targets change without a full reload mid-stream
  useEffect(() => {
    if (dashboard.teamPerformance.length === 0) return;
    if (teamIncentiveLeads.size === 0) return;
    setTeamIncentiveByUser(
      computeTeamMatrixIncentiveMetrics({
        team: dashboard.teamPerformance,
        leadsByUserId: teamIncentiveLeads,
        dateFilter,
        targetsByMonth: teamIncentiveTargets,
      }),
    );
    setIncentiveScopeLabel(formatTeamMatrixIncentiveScope(dateFilter));
  }, [
    dashboard.teamPerformance,
    teamIncentiveLeads,
    teamIncentiveTargets,
    dateFilter,
  ]);

  const teamForMatrix = useMemo((): InsightsTeamMember[] => {
    const rows = dashboard.teamPerformance
      .filter((m) => !isSalesManagerRole(m.role || ""))
      .map((m) => {
        const uid = Number(m.userId);
        const leads = Number(m.leads) || 0;
        const closed = Number(m.closed) || 0;
        const hubConv = Number(m.conversionPercent);
        const conversionPercent = Number.isFinite(hubConv)
          ? Math.round(hubConv * 10) / 10
          : leads > 0
            ? Math.round((closed / leads) * 1000) / 10
            : 0;
        const inc =
          Number.isFinite(uid) && uid > 0
            ? teamIncentiveByUser.get(uid)
            : undefined;
        // Only FE Incentives engine — never fall back to missing Hub fields as 0
        const achievedIncentive = inc != null ? inc.achievedIncentive : undefined;
        const payoff = inc != null ? inc.payoff : undefined;

        return {
          ...m,
          leads,
          closed,
          conversionPercent,
          achievedIncentive,
          payoff,
        };
      });
    return rows.sort((a, b) => (Number(b.leads) || 0) - (Number(a.leads) || 0));
  }, [dashboard.teamPerformance, teamIncentiveByUser]);

  const executiveOptions = useMemo(() => {
    if (filterOptions.salesManagers.some((m) => (m.executives?.length ?? 0) > 0)) {
      return filterOptions.salesManagers.flatMap((m) =>
        (m.executives ?? []).map((e) => ({
          ...e,
          managerId: e.managerId ?? m.id,
          managerName: m.name,
        })),
      );
    }
    return filterOptions.salesExecutives.map((e) => {
      const manager = filterOptions.salesManagers.find(
        (m) => m.id === e.managerId,
      );
      return { ...e, managerName: manager?.name ?? "" };
    });
  }, [filterOptions]);

  const onDatePresetChange = (preset: BookingDatePresetId) => {
    setDateFilter((prev) => ({
      ...prev,
      preset,
      ...(preset === "custom" ? {} : { customFrom: "", customTo: "" }),
    }));
  };

  const salespeopleOptions = useMemo<DropdownOption[]>(() => {
    const opts: DropdownOption[] = [
      {
        value: "all",
        label: isSalesManager ? "All team executives" : "All Salespeople",
      },
    ];
    if (showManagerPeopleOptions) {
      filterOptions.salesManagers.forEach((m) => {
        opts.push({
          value: `manager:${m.id}`,
          label: m.name,
          sublabel: `Manager · ${m.executives?.length || 0} executives`,
          category: "Managers / Team Leads",
        });
      });
    }
    executiveOptions.forEach((e) => {
      opts.push({
        value: `exec:${e.id}`,
        label: e.name,
        sublabel: e.managerName
          ? `Team: ${e.managerName}`
          : isSalesManager
            ? "Your executive"
            : "Sales Executive",
        category: isSalesManager ? "Your team" : "Sales Executives",
      });
    });
    return opts;
  }, [
    filterOptions,
    executiveOptions,
    isSalesManager,
    showManagerPeopleOptions,
  ]);

  const branchOptions = useMemo<DropdownOption[]>(() => {
    const opts: DropdownOption[] = [
      { value: "all", label: "Location: All Branches" },
    ];
    filterOptions.branches.forEach((b) => {
      opts.push({
        value: b.id,
        label: b.name || b.id,
        sublabel: `Branch ID: ${b.id}`,
      });
    });
    return opts;
  }, [filterOptions]);

  const salesSelect = salesPeopleSelectValue(salesPeople);

  const isAnyFilterActive =
    dateFilter.preset !== "currentMonth" ||
    salesPeople.kind !== "all" ||
    (showBranchFilter && branchId !== "all");

  const clearAllFilters = () => {
    setDateFilter(DEFAULT_INSIGHTS_DATE_FILTER);
    setSalesPeople({ kind: "all" });
    if (showBranchFilter) setBranchId("all");
  };

  const [quoteSentWonMetrics, setQuoteSentWonMetrics] = useState<{
    count: number;
    totalValue: number | null;
    loading: boolean;
  }>({ count: 0, totalValue: null, loading: false });

  const [funnelStageValues, setFunnelStageValues] = useState<Record<string, number> | null>(null);
  const [funnelMetricsLoading, setFunnelMetricsLoading] = useState(false);
  const [stagePathData, setStagePathData] = useState<FunnelStagePathDataMap>({});
  const [stagePathLoading, setStagePathLoading] = useState(true);
  /** Authoritative totals from same sales admin pool as Leads page (phone-unique, verified). */
  const [alignedSalesPoolTotal, setAlignedSalesPoolTotal] = useState<number | null>(null);
  const [alignedLostFunnel, setAlignedLostFunnel] = useState<InsightsDashboard["lostFunnel"] | null>(
    null,
  );
  /** Drop reasons from same lost-segment leads as Lost Funnel Total. */
  const [alignedDropReasons, setAlignedDropReasons] = useState<
    InsightsDashboard["dropReasons"] | null
  >(null);
  /** Current-in-stage funnel (Fresh Lead = milestone inventory, not pool total). */
  const [alignedSalesFunnel, setAlignedSalesFunnel] = useState<
    InsightsDashboard["salesFunnel"] | null
  >(null);
  /**
   * Volume charts from the same date-scoped inventory.
   * Short range → weeks → days; All time / multi-month → months → weeks → days.
   */
  const [alignedWeekCharts, setAlignedWeekCharts] = useState<InsightsWeekCharts | null>(
    null,
  );

  // Quick sketch path (may differ slightly) — overwritten by authoritative pool below.
  useEffect(() => {
    let cancelled = false;
    setStagePathLoading(true);
    void (async () => {
      try {
        const range = resolveBookingDateRange(dateFilter);
        const assignees = assigneeAliasSet;
        const data = await fetchInsightsFunnelStagePathData({
          dateFrom: range.submittedFrom,
          dateTo: range.submittedTo,
          assignees: assignees.length > 0 ? assignees : undefined,
        });
        if (!cancelled) {
          setStagePathData((prev) => (Object.keys(prev).length > 0 ? prev : data));
          setStagePathLoading(false);
        }
      } catch {
        if (!cancelled) setStagePathLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateFilter, assigneeAliasSet]);

  const applyInvestmentMetrics = useCallback(
    (
      scopedLeads: Parameters<typeof filterInsightsQuoteSentScopeLeads>[0],
      investments: Map<string, number>,
      salesFunnel: InsightsDashboard["salesFunnel"],
      opts: ReturnType<typeof buildInsightsQuoteSentCountOpts>,
    ) => {
      const count = computeQuoteSentWonCount(scopedLeads, opts);
      const funnelTotals = computeFunnelCurrentStageInvestmentTotals(
        scopedLeads,
        investments,
        salesFunnel,
      );
      funnelTotals.fresh_lead = computeFreshLeadStageInvestmentTotal(scopedLeads, investments);
      setFunnelStageValues(funnelTotals);

      let totalValue = 0;
      for (const lead of listQuoteSentWonLeads(scopedLeads, opts)) {
        totalValue += investments.get(stableLeadKey(lead)) ?? 0;
      }
      setQuoteSentWonMetrics({ count, totalValue, loading: false });
    },
    [],
  );

  // Authoritative pool — SM uses same mergeAll as My Leads; admins use heatmap + scope.
  useEffect(() => {
    if (!role || !canAccessCrmInsights(role)) return;
    // SM: wait for hierarchy aliases so we never count without a team scope.
    if (isSalesManager && !smScopeReady) return;
    // Allow SM when scope ready even if only self aliases (no execs yet).
    if (isSalesManager && smSelfAliases.length === 0 && smTeamDisplayNames.length === 0) {
      setAlignedSalesPoolTotal(0);
      setAlignedLostFunnel(null);
      setAlignedDropReasons(null);
      setAlignedSalesFunnel(null);
      setAlignedWeekCharts(null);
      setFunnelMetricsLoading(false);
      return;
    }

    let cancelled = false;
    setFunnelMetricsLoading(true);
    (async () => {
      try {
        const range = resolveBookingDateRange(dateFilter);
        const assigneeAliasSetLocal = assigneeAliasSet;
        const subStatusQs = new URLSearchParams({
          resource: "sub-status",
          role: "SALES_EXECUTIVE",
        });

        // SM/MANAGER: same my∪team + id-merge journey as My Leads Total / heatmap phases.
        // Org admins: sales filter-merge heatmap (not phone-primary).
        let poolRows: ApiLead[] = [];
        let smCanViewPool: ApiLead[] | null = null;

        if (isSalesManager) {
          /**
           * Full my∪team inventory (no Hub date pin) so All time matches My Leads 1:1.
           * This month / other presets applied client-side on lead *created* date after id-merge.
           */
          const hubMyTeam = await fetchInsightsSalesManagerMyTeamLeads({
            // Pin Hub only when filtering a single exec; All = full my∪team JWT pool.
            assigneeAliasSet:
              salesPeople.kind === "executive" && assigneeAliasSetLocal.length > 0
                ? assigneeAliasSetLocal
                : undefined,
          });
          let inventory = filterLeadsForSalesClientInbox(hubMyTeam, "verified");
          if (salesPeople.kind === "executive" && assigneeAliasSetLocal.length > 0) {
            inventory = filterLeadsByAssigneeScope(inventory, assigneeAliasSetLocal);
          }
          inventory = filterApiLeadsByInsightsDateRange(inventory, range);
          smCanViewPool = inventory;
          const aligned = insightsSalesManagerMilestoneAndTotal(inventory);
          poolRows = aligned.pool;
        } else {
          // Full sales journey (no date in Hub) then client month/range cut — same as SM accuracy.
          const data = await fetchAdminLeadsHeatmapData(
            {
              workspace: "sales",
              verificationStatus: "verified",
              assigneeAliasSet:
                assigneeAliasSetLocal.length > 0 ? assigneeAliasSetLocal : undefined,
            },
            getCrmAuthHeaders(),
          );
          // Journey id-merge rows (not phone primaryRows) — same as Journey Phase Heatmap.
          let journeyRows =
            data.leads.length > 0 ? data.leads : data.primaryRows;
          if (assigneeAliasSetLocal.length > 0) {
            journeyRows = filterLeadsByAssigneeScope(journeyRows, assigneeAliasSetLocal);
          }
          journeyRows = filterLeadsForSalesClientInbox(journeyRows, "verified");
          journeyRows = filterApiLeadsByInsightsDateRange(journeyRows, range);
          const aligned = insightsSalesManagerMilestoneAndTotal(journeyRows);
          poolRows = aligned.pool;
        }

        const subMapRes = await fetch(`/api/milestone-count?${subStatusQs.toString()}`, {
          cache: "no-store",
          headers: getCrmAuthHeaders(),
        }).catch(() => null);

        if (cancelled) return;

        const scopedRows = filterInsightsScopeLeadsKeepRows(poolRows, {
          branchId: effectiveBranchId,
          filterOptions,
        });
        // Lost Segment total uses full canView pool (not stage id-merge only).
        const lostScopeRows =
          isSalesManager && smCanViewPool
            ? filterInsightsScopeLeadsKeepRows(smCanViewPool, {
                branchId: effectiveBranchId,
                filterOptions,
              })
            : scopedRows;

        // Funnel = id-merged stage inventory (My Leads phases). Lost Segment still phone-primary.
        const funnelPool = scopedRows;
        const lostCountPool = salesInsightCountLeads(lostScopeRows);

        // leadView "default" does not re-scope (pool already Hub-scoped / assignee filtered).
        const insightOpts = salesAdminPoolInsightOpts(
          "",
          [],
          range.submittedFrom,
          range.submittedTo,
        );
        const lostCounts = computeLostSegmentCounts(lostCountPool, insightOpts);
        const dropReasonsAligned = computeLostSegmentDropReasons(lostCountPool, insightOpts);
        const lostStages: InsightsLostFunnelStage[] = [
          {
            stageKey: "fresh_lead_lost",
            stageLabel: "Fresh Lead Lost",
            count: 0,
            dropPercent: 0,
          },
          {
            stageKey: "discovery_lost",
            stageLabel: "Discovery Lost",
            count: lostCounts.lostDiscovery,
            dropPercent: 0,
          },
          {
            stageKey: "connection_lost",
            stageLabel: "Connection Lost",
            count: lostCounts.lostConnection,
            dropPercent: 0,
          },
          {
            stageKey: "exp_design_lost",
            stageLabel: "Exp & Design Lost",
            count: lostCounts.lostExperienceDesign,
            dropPercent: 0,
          },
          {
            stageKey: "decision_lost",
            stageLabel: "Decision Lost",
            count: lostCounts.lostDecision,
            dropPercent: 0,
          },
          {
            stageKey: "closed_lost",
            stageLabel: "Closed Lost",
            count: lostCounts.lostClosed,
            dropPercent: 0,
          },
        ];
        // Lost Total = sum of segment tiles only (exclude zero Fresh Lost shell row).
        const lostTotal = lostStages
          .filter((st) => st.stageKey !== "fresh_lead_lost")
          .reduce((s, x) => s + x.count, 0);
        for (const st of lostStages) {
          if (st.stageKey === "fresh_lead_lost") {
            st.dropPercent = 0;
            continue;
          }
          st.dropPercent = lostTotal > 0 ? Math.round((st.count / lostTotal) * 100) : 0;
        }

        let subMappings: Array<{ stage: string; stageCategory: string; subStageName: string }> =
          [];
        if (subMapRes?.ok) {
          try {
            const mapJson = (await subMapRes.json()) as {
              mappings?: Array<{ stage: string; stageCategory: string; subStageName: string }>;
            };
            subMappings = mapJson.mappings ?? [];
          } catch {
            subMappings = [];
          }
        }

        // Always derive phases from funnelPool so Total === phase sum after any scope.
        const milestoneCountsScoped = normalizeMilestoneCountsToCanonical(
          milestoneCountsFromLeads(funnelPool, "sales"),
          "sales",
        );
        const salesFunnelShell = buildAlignedSalesFunnelStages(milestoneCountsScoped);

        // Total bar: always id-merge stage sum (= My Leads Total Leads when unfiltered).
        const stageInventoryTotal = Object.values(milestoneCountsScoped).reduce(
          (s, n) => s + (Number(n) || 0),
          0,
        );
        const finalTotal =
          stageInventoryTotal > 0 ? stageInventoryTotal : funnelPool.length;

        if (!cancelled) {
          setAlignedSalesPoolTotal(finalTotal);
          setAlignedLostFunnel({ total: lostTotal, stages: lostStages });
          setAlignedDropReasons(dropReasonsAligned);
          setStagePathData(buildInsightsFunnelStagePathData(funnelPool, subMappings));
          setStagePathLoading(false);
          setAlignedSalesFunnel(salesFunnelShell);
          // This month / custom: only weeks inside the Insights date window (not Hub multi-month weeks).
          setAlignedWeekCharts(buildInsightsWeekChartsFromLeads(funnelPool, range));
        }

        const opts = buildInsightsQuoteSentCountOpts(range.submittedFrom, range.submittedTo);
        const budgetMap = buildLeadBudgetInvestmentMapSync(funnelPool);
        if (cancelled) return;
        applyInvestmentMetrics(funnelPool, budgetMap, salesFunnelShell, opts);
        setFunnelMetricsLoading(false);

        const enriched = await enrichInvestmentMapWithQuotes(funnelPool, budgetMap, {
          deadlineMs: 2000,
          concurrency: 16,
          maxQuoteIds: 120,
        });
        if (cancelled) return;
        applyInvestmentMetrics(funnelPool, enriched, salesFunnelShell, opts);
      } catch {
        if (!cancelled) {
          setQuoteSentWonMetrics({ count: 0, totalValue: 0, loading: false });
          setFunnelStageValues(null);
          setFunnelMetricsLoading(false);
          setAlignedSalesPoolTotal(null);
          setAlignedLostFunnel(null);
          setAlignedDropReasons(null);
          setAlignedSalesFunnel(null);
          setAlignedWeekCharts(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    applyInvestmentMetrics,
    effectiveBranchId,
    dateFilter,
    filterOptions,
    assigneeAliasSet,
    role,
    isSalesManager,
    smScopeReady,
    salesPeople.kind,
    smSelfAliases,
    smTeamDisplayNames,
    smTeamAliasesWhenAll,
    viewerUserId,
  ]);

  // Role not yet read from storage
  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--crm-app-bg)] text-sm text-gray-500">
        Loading Insights…
      </div>
    );
  }

  if (!insightsAllowed) {
    return (
      <div className="min-h-screen bg-[var(--crm-app-bg)] xl:h-screen xl:overflow-hidden">
        <div className="grid min-h-screen xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
          <QuickAccessSidebar
            appBadge="HO WS"
            appName="Hows"
            appTagline="by HUB"
            sections={dashboardSidebarSections}
            profileName={roleLabel}
            profileRole={role}
            profileInitials={roleLabel.slice(0, 2).toUpperCase() || "U"}
          />
          <div className="flex min-w-0 flex-col items-center justify-center gap-3 bg-[#f4f7fb] px-6 text-center">
            <h1 className="text-xl font-bold text-gray-900">Access restricted</h1>
            <p className="max-w-md text-sm text-gray-600">
              CRM Insights is available for Super Admin, Admin, Sales Admin, and Sales
              Manager roles only.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--crm-app-bg)] xl:h-screen xl:overflow-hidden">
      <div className="grid min-h-screen xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
        <QuickAccessSidebar
          appBadge="HO WS"
          appName="Hows"
          appTagline="by HUB"
          sections={dashboardSidebarSections}
          profileName={roleLabel}
          profileRole={role}
          profileInitials={roleLabel.slice(0, 2).toUpperCase() || "SA"}
        />

        <div className="min-w-0 bg-[#f4f7fb] xl:h-screen xl:overflow-y-auto">
          <AppTopBar />

          <main className="w-full px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="shrink-0">
                <h2 className="text-3xl font-extrabold tracking-tight text-[#1f2937] sm:text-4xl">
                  CRM Insights
                </h2>
                <p className="mt-1.5 max-w-md text-xs font-medium text-gray-500 sm:text-sm">
                  Precision analytics for elite interior design operations.
                </p>
              </div>

              <div className="w-full space-y-3 lg:w-auto">
                {/* Custom Filter Controls Bar */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <InsightsDateFilterPopover
                    value={dateFilter}
                    onChange={setDateFilter}
                    defaultFilter={DEFAULT_INSIGHTS_DATE_FILTER}
                    subtitle="Default: this month · All Time = My Leads full inventory"
                  />

                  <InsightsDropdownFilter
                    options={salespeopleOptions}
                    value={salesSelect}
                    onChange={(val) => setSalesPeople(parseSalesPeopleValue(val))}
                    placeholder={
                      isSalesManager ? "All team executives" : "All Salespeople"
                    }
                    icon="users"
                    ariaLabel="Filter by Salespeople"
                  />

                  {showBranchFilter ? (
                    <InsightsDropdownFilter
                      options={branchOptions}
                      value={branchId}
                      onChange={setBranchId}
                      placeholder="Location: All"
                      icon="location"
                      ariaLabel="Filter by Branch location"
                    />
                  ) : null}

                  {isAnyFilterActive ? (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50/80 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs"
                      title="Clear all active filters"
                    >
                      <svg
                        className="mr-1 h-3.5 w-3.5 text-rose-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Reset Filters
                    </button>
                  ) : null}

                  <button
                    type="button"
                    disabled
                    title="Export PDF feature coming soon"
                    className="inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-100 px-4 text-xs font-semibold text-gray-400 opacity-80"
                  >
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Export PDF
                  </button>
                </div>

                {/* Error and Loading indicators */}
                {error ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-700 shadow-2xs">
                    {error}
                  </div>
                ) : null}
                {loading ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
                    <svg
                      className="h-4 w-4 animate-spin text-indigo-600"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Updating insights data...</span>
                  </div>
                ) : null}
              </div>
            </div>
          </main>

          <InsightSect2
            kpis={{
              ...dashboard.kpis,
              // Same id-merge journey inventory as Sales Funnel Total / My Leads Total.
              totalLeads: {
                ...dashboard.kpis.totalLeads,
                value:
                  alignedSalesPoolTotal != null
                    ? alignedSalesPoolTotal
                    : dashboard.kpis.totalLeads.value,
              },
            }}
            tokenMetrics={tokenMetrics}
            dashboardLoading={
              loading || funnelMetricsLoading || (isSalesManager && !smScopeReady)
            }
          />
          <InsightsPerformanceCards
            data={performanceCards ?? dashboard.performanceCards ?? null}
            loading={
              performanceCardsLoading || (isSalesManager && !smScopeReady)
            }
          />
      <InsightSect3
        salesFunnel={ensureFreshLeadInSalesFunnel(
          alignedSalesFunnel ?? dashboard.salesFunnel,
        )}
        lostFunnel={alignedLostFunnel ?? dashboard.lostFunnel}
        holdFunnel={dashboard.holdFunnel}
        holdPathByStage={dashboard.holdPathByStage}
        revenueDistribution={dashboard.revenueDistribution}
        totalLeadsCount={
          alignedSalesPoolTotal ?? dashboard.kpis.totalLeads.value
        }
        tokenMetrics={tokenMetrics}
        quotationCount={quoteSentWonMetrics.count}
        quotationValue={quoteSentWonMetrics.totalValue}
        quotationMetricsLoading={quoteSentWonMetrics.loading}
        funnelStageValues={funnelStageValues}
        funnelMetricsLoading={funnelMetricsLoading}
        stagePathData={stagePathData}
        stagePathLoading={stagePathLoading}
        useCurrentStageInventory={Boolean(alignedSalesFunnel)}
      />
          <InsightsSect4
            dropReasons={alignedDropReasons ?? dashboard.dropReasons}
            lostTotalOverride={alignedLostFunnel?.total ?? dashboard.lostFunnel?.total ?? null}
            stageVelocity={dashboard.stageVelocity}
          />
          <InsightsSect5
            team={teamForMatrix}
            incentiveScopeLabel={incentiveScopeLabel}
            incentivesLoading={teamIncentivesLoading}
          />
          <InsightsSect6
            leadsOverTime={
              alignedWeekCharts?.leadsOverTime ?? dashboard.leadsOverTime
            }
            conversionTrend={
              alignedWeekCharts?.conversionTrend ?? dashboard.conversionTrend
            }
            revenueForecast={dashboard.revenueForecast}
            dateFilter={dateFilter}
            volumeCharts={alignedWeekCharts}
            weekBars={alignedWeekCharts?.weekBars ?? null}
          />
        </div>
      </div>
    </div>
  );
}
