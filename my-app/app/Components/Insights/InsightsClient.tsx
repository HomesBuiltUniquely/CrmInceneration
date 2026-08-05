"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BOOKING_DATE_PRESETS,
  DEFAULT_BOOKING_DATE_FILTER,
  resolveBookingDateRange,
  type BookingDateFilterState,
  type BookingDatePresetId,
} from "@/lib/booking-token-date-filter";
import {
  EMPTY_INSIGHTS_DASHBOARD,
  fetchInsightsDashboard,
  fetchInsightsFilterOptions,
  type InsightsDashboard,
  type InsightsFilterOptions,
  type InsightsLostFunnelStage,
  type InsightsTeamMember,
} from "@/lib/crm-insights-api";
import {
  fetchAdminLeadsHeatmapData,
  milestoneCountsFromLeads,
  normalizeMilestoneCountsToCanonical,
} from "@/lib/admin-leads-api";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { fetchDashboardDealRows } from "@/lib/booking-token-deals-fetch";
import {
  buildInsightsQuoteSentCountOpts,
  computeQuoteSentWonCount,
  filterInsightsQuoteSentScopeLeads,
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
  fetchInsightsFunnelStagePathData,
  type FunnelStagePathDataMap,
} from "@/lib/insights-funnel-stage-paths";
import {
  computeLostSegmentCounts,
  computeLostSegmentDropReasons,
} from "@/lib/lead-lost-segment";
import {
  salesAdminPoolInsightOpts,
  salesInsightCountLeads,
} from "@/lib/sales-admin-insight-tiles";
import {
  computeTeamMatrixIncentiveMetrics,
  formatTeamMatrixIncentiveScope,
  loadTeamMatrixIncentiveBase,
  type TeamMemberIncentiveMetrics,
} from "@/lib/insights-team-incentive-matrix";
import type { IncentiveBookingLead } from "@/lib/incentives-booking-data";
import {
  CRM_ROLE_STORAGE_KEY,
  CRM_USER_ID_STORAGE_KEY,
  normalizeRole,
} from "@/lib/auth/api";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import InsightSect2, { type TokenMetricsData } from "./InsightSect2";
import InsightSect3 from "./InsightsSect3";
import InsightsSect4 from "./InsightsSect4";
import InsightsSect5 from "./InsightsSect5";
import InsightsSect6 from "./InsightsSect6";
import InsightsDateFilterPopover from "./InsightsDateFilterPopover";
import InsightsDropdownFilter, { type DropdownOption } from "./InsightsDropdownFilter";

function isSalesManagerRole(role: string): boolean {
  const r = role.trim().toLowerCase().replace(/[_\s]+/g, " ");
  return (
    r === "sales manager" ||
    r === "manager" ||
    r === "sales_manager" ||
    r.includes("sales manager")
  );
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
    DEFAULT_BOOKING_DATE_FILTER,
  );
  const [branchId, setBranchId] = useState("all");
  const [salesPeople, setSalesPeople] = useState<SalesPeopleSelection>({
    kind: "all",
  });
  /** Hub team matrix always monthly (Insights date window). */
  const teamPeriod = "monthly" as const;
  const [role, setRole] = useState("");
  const [viewerUserId, setViewerUserId] = useState<number | null>(null);

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
    setLoading(true);
    setError("");
    try {
      const data = await fetchInsightsDashboard({
        dateFilter,
        branchId,
        salesManagerId:
          salesPeople.kind === "manager" ? salesPeople.id : null,
        salesExecutiveId:
          salesPeople.kind === "executive" ? salesPeople.id : null,
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
  }, [branchId, dateFilter, salesPeople, teamPeriod]);

  const [tokenMetrics, setTokenMetrics] = useState<TokenMetricsData>({
    tokenValue: 0,
    bookingValue: 0,
    futureConversionValue: 0,
    tokenCount: 0,
    bookingCount: 0,
    loading: true,
  });

  const loadTokenMetrics = useCallback(async () => {
    setTokenMetrics((prev) => ({ ...prev, loading: true }));
    try {
      const rows = await fetchDashboardDealRows({ tab: "all", dateFilter });
      const active = rows.filter((r) => r.listingType !== "cancel");

      // Booking deals (full 10% / confirmed booking)
      const bookingDeals = active.filter((r) => r.listingType === "booking");
      const bookingValue = bookingDeals.reduce(
        (sum, r) => sum + (r.tenPercentAmount || r.paidAmount || r.dealValueAmount || 0),
        0,
      );

      // Token deals (in token stage)
      const tokenDeals = active.filter((r) => r.listingType === "token");
      const tokenValue = tokenDeals.reduce((sum, r) => sum + (r.paidAmount || 0), 0);

      // Future conversion value (potential value remaining to complete 10% booking on token deals)
      const futureConversionValue = tokenDeals.reduce(
        (sum, r) => sum + Math.max(0, (r.tenPercentAmount || 0) - (r.paidAmount || 0)),
        0,
      );

      setTokenMetrics({
        tokenValue,
        bookingValue,
        futureConversionValue,
        tokenCount: tokenDeals.length,
        bookingCount: bookingDeals.length,
        loading: false,
      });
    } catch {
      setTokenMetrics({
        tokenValue: 0,
        bookingValue: 0,
        futureConversionValue: 0,
        tokenCount: 0,
        bookingCount: 0,
        loading: false,
      });
    }
  }, [dateFilter]);

  useEffect(() => {
    void loadFilters(branchId);
  }, [branchId, loadFilters]);

  /** Drop people selection if it no longer exists under current branch filter-options. */
  useEffect(() => {
    if (salesPeople.kind === "all") return;
    if (salesPeople.kind === "manager") {
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
  }, [filterOptions, salesPeople]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadTokenMetrics();
  }, [loadTokenMetrics]);

  // Achieved + Payoff = same executive-leads API as Incentives page
  useEffect(() => {
    let cancelled = false;
    const team = dashboard.teamPerformance;
    // Wait for role from localStorage so admin doesn't take the self-only path first.
    if (!role) {
      setTeamIncentivesLoading(team.length > 0);
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
      { value: "all", label: "All Salespeople" },
    ];
    filterOptions.salesManagers.forEach((m) => {
      opts.push({
        value: `manager:${m.id}`,
        label: m.name,
        sublabel: `Manager · ${m.executives?.length || 0} executives`,
        category: "Managers / Team Leads",
      });
    });
    executiveOptions.forEach((e) => {
      opts.push({
        value: `exec:${e.id}`,
        label: e.name,
        sublabel: e.managerName ? `Team: ${e.managerName}` : "Sales Executive",
        category: "Sales Executives",
      });
    });
    return opts;
  }, [filterOptions, executiveOptions]);

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
    dateFilter.preset !== "all" ||
    salesPeople.kind !== "all" ||
    branchId !== "all";

  const clearAllFilters = () => {
    setDateFilter(DEFAULT_BOOKING_DATE_FILTER);
    setSalesPeople({ kind: "all" });
    setBranchId("all");
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

  // Quick sketch path (may differ slightly) — overwritten by authoritative pool below.
  useEffect(() => {
    let cancelled = false;
    setStagePathLoading(true);
    void (async () => {
      try {
        const range = resolveBookingDateRange(dateFilter);
        const assignees = resolveInsightsAssigneeAliases(salesPeople, filterOptions);
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
  }, [dateFilter, filterOptions, salesPeople]);

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

  // Authoritative pool — same as Super Admin Sales Journey Heatmap + Lost Segment
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const range = resolveBookingDateRange(dateFilter);
        const assigneeAliasSet = resolveInsightsAssigneeAliases(salesPeople, filterOptions);
        const subStatusQs = new URLSearchParams({ resource: "sub-status", role: "SALES_EXECUTIVE" });

        const [data, subMapRes] = await Promise.all([
          fetchAdminLeadsHeatmapData(
            {
              workspace: "sales",
              verificationStatus: "verified",
              dateFrom: range.submittedFrom,
              dateTo: range.submittedTo,
              assigneeAliasSet: assigneeAliasSet.length > 0 ? assigneeAliasSet : undefined,
            },
            getCrmAuthHeaders(),
          ),
          fetch(`/api/milestone-count?${subStatusQs.toString()}`, {
            cache: "no-store",
            headers: getCrmAuthHeaders(),
          }).catch(() => null),
        ]);
        if (cancelled) return;

        const scopedLeads = filterInsightsQuoteSentScopeLeads(data.primaryRows, {
          branchId,
          filterOptions,
        });
        // Same phone-unique pool used by Leads insight tiles / Lost Segment / Journey heatmap
        const insightPool = salesInsightCountLeads(scopedLeads);
        const insightOpts = salesAdminPoolInsightOpts(
          "",
          [],
          range.submittedFrom,
          range.submittedTo,
        );
        const lostCounts = computeLostSegmentCounts(insightPool, insightOpts);
        const dropReasonsAligned = computeLostSegmentDropReasons(insightPool, insightOpts);
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
        const lostTotal = lostStages.reduce((s, x) => s + x.count, 0);
        for (const st of lostStages) {
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

        const milestoneCounts = normalizeMilestoneCountsToCanonical(
          milestoneCountsFromLeads(insightPool, "sales"),
          "sales",
        );
        const salesFunnelShell = buildAlignedSalesFunnelStages(milestoneCounts);

        if (!cancelled) {
          setAlignedSalesPoolTotal(insightPool.length);
          setAlignedLostFunnel({ total: lostTotal, stages: lostStages });
          setAlignedDropReasons(dropReasonsAligned);
          setStagePathData(buildInsightsFunnelStagePathData(insightPool, subMappings));
          setStagePathLoading(false);
          setAlignedSalesFunnel(salesFunnelShell);
        }

        const opts = buildInsightsQuoteSentCountOpts(range.submittedFrom, range.submittedTo);
        const budgetMap = buildLeadBudgetInvestmentMapSync(scopedLeads);
        if (cancelled) return;
        applyInvestmentMetrics(scopedLeads, budgetMap, salesFunnelShell, opts);
        setFunnelMetricsLoading(false);

        const enriched = await enrichInvestmentMapWithQuotes(scopedLeads, budgetMap, {
          deadlineMs: 2000,
          concurrency: 16,
          maxQuoteIds: 120,
        });
        if (cancelled) return;
        applyInvestmentMetrics(scopedLeads, enriched, salesFunnelShell, opts);
      } catch {
        if (!cancelled) {
          setQuoteSentWonMetrics({ count: 0, totalValue: 0, loading: false });
          setFunnelStageValues(null);
          setFunnelMetricsLoading(false);
          setAlignedSalesPoolTotal(null);
          setAlignedLostFunnel(null);
          setAlignedDropReasons(null);
          setAlignedSalesFunnel(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyInvestmentMetrics, branchId, dateFilter, filterOptions, salesPeople]);

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
          <div className="border-b border-[var(--crm-border)] bg-[var(--crm-surface-elevated)] shadow-[var(--crm-shadow-sm)]">
            <div className="flex min-h-16 items-center gap-3 px-4 md:px-6">
              <Image src="/HowsCrmLogo.png" alt="Hows CRM" width={44} height={44} />
              <div>
                <h1 className="text-base font-bold text-[var(--crm-text-primary)]">
                  Insights
                </h1>
                <p className="text-xs text-[var(--crm-text-muted)]">
                  Sales performance &amp; pipeline analytics
                </p>
              </div>
            </div>
          </div>

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
                  />

                  <InsightsDropdownFilter
                    options={salespeopleOptions}
                    value={salesSelect}
                    onChange={(val) => setSalesPeople(parseSalesPeopleValue(val))}
                    placeholder="All Salespeople"
                    icon="users"
                    ariaLabel="Filter by Salespeople"
                  />

                  <InsightsDropdownFilter
                    options={branchOptions}
                    value={branchId}
                    onChange={setBranchId}
                    placeholder="Location: All"
                    icon="location"
                    ariaLabel="Filter by Branch location"
                  />

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
              totalLeads: {
                ...dashboard.kpis.totalLeads,
                value: alignedSalesPoolTotal ?? dashboard.kpis.totalLeads.value,
              },
            }}
            tokenMetrics={tokenMetrics}
          />
      <InsightSect3
        salesFunnel={alignedSalesFunnel ?? dashboard.salesFunnel}
        lostFunnel={alignedLostFunnel ?? dashboard.lostFunnel}
        revenueDistribution={dashboard.revenueDistribution}
        totalLeadsCount={alignedSalesPoolTotal ?? dashboard.kpis.totalLeads.value}
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
            leadsOverTime={dashboard.leadsOverTime}
            conversionTrend={dashboard.conversionTrend}
            revenueForecast={dashboard.revenueForecast}
          />
        </div>
      </div>
    </div>
  );
}
