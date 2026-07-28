"use client";

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
} from "@/lib/crm-insights-api";
import { fetchAdminLeadsHeatmapData } from "@/lib/admin-leads-api";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { fetchDashboardDealRows } from "@/lib/booking-token-deals-fetch";
import {
  buildInsightsQuoteSentCountOpts,
  computeQuoteSentWonCount,
  filterInsightsQuoteSentScopeLeads,
  listQuoteSentWonLeads,
  resolveInsightsAssigneeAliases,
} from "@/lib/insights-quote-sent-metrics";
import { buildLeadBudgetInvestmentMapSync, enrichInvestmentMapWithQuotes, stableLeadKey } from "@/lib/insights-lead-investment";
import { computeFunnelStageInvestmentTotals, computeFreshLeadInvestmentTotal } from "@/lib/insights-sales-funnel-investment";
import { fetchInsightsRevenueForecastTarget } from "@/lib/insights-revenue-forecast-target";
import { salesTargetsApi } from "@/lib/sales-targets-api";
import { currentSalesTargetMonth } from "@/lib/sales-targets";
import { type InsightsTeamMember } from "@/lib/crm-insights-api";
import InsightSect2, { type TokenMetricsData } from "./InsightSect2";
import InsightSect3 from "./InsightsSect3";
import InsightsSect4 from "./InsightsSect4";
import InsightsSect5 from "./InsightsSect5";
import InsightsSect6 from "./InsightsSect6";
import InsightsDateFilterPopover from "./InsightsDateFilterPopover";
import InsightsDropdownFilter, { type DropdownOption } from "./InsightsDropdownFilter";

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
  const [teamPeriod, setTeamPeriod] = useState<"daily" | "monthly">("monthly");

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

  // Per-user monthly incentive targets (from sales-targets API)
  const [incentiveTargets, setIncentiveTargets] = useState<Record<number, number>>({});

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

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadTokenMetrics();
  }, [loadTokenMetrics]);

  // Load per-user monthly targets from sales-targets API whenever team data changes
  useEffect(() => {
    let cancelled = false;
    const month = currentSalesTargetMonth();
    void (async () => {
      try {
        const rows = await salesTargetsApi.listUsers(month);
        if (cancelled) return;
        const map: Record<number, number> = {};
        for (const row of rows) {
          map[row.userId] = row.monthlyTargetInr;
        }
        setIncentiveTargets(map);
      } catch {
        // silently ignore — columns will show — when target unavailable
      }
    })();
    return () => { cancelled = true; };
  }, [dashboard.teamPerformance]);

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

  const salesFunnelStageCount = dashboard.salesFunnel.length;

  const applyInvestmentMetrics = useCallback(
    (
      scopedLeads: Parameters<typeof filterInsightsQuoteSentScopeLeads>[0],
      investments: Map<string, number>,
      salesFunnel: InsightsDashboard["salesFunnel"],
      opts: ReturnType<typeof buildInsightsQuoteSentCountOpts>,
    ) => {
      const count = computeQuoteSentWonCount(scopedLeads, opts);
      const funnelTotals = computeFunnelStageInvestmentTotals(
        scopedLeads,
        investments,
        salesFunnel,
      );
      funnelTotals.fresh_lead = computeFreshLeadInvestmentTotal(scopedLeads, investments);
      setFunnelStageValues(funnelTotals);

      let totalValue = 0;
      for (const lead of listQuoteSentWonLeads(scopedLeads, opts)) {
        totalValue += investments.get(stableLeadKey(lead)) ?? 0;
      }
      setQuoteSentWonMetrics({ count, totalValue, loading: false });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (salesFunnelStageCount === 0) return;

      try {
        const range = resolveBookingDateRange(dateFilter);
        const assigneeAliasSet = resolveInsightsAssigneeAliases(salesPeople, filterOptions);
        const data = await fetchAdminLeadsHeatmapData(
          {
            workspace: "sales",
            dateFrom: range.submittedFrom,
            dateTo: range.submittedTo,
            assigneeAliasSet: assigneeAliasSet.length > 0 ? assigneeAliasSet : undefined,
          },
          getCrmAuthHeaders(),
        );
        if (cancelled) return;

        const scopedLeads = filterInsightsQuoteSentScopeLeads(data.primaryRows, {
          branchId,
          filterOptions,
        });
        const opts = buildInsightsQuoteSentCountOpts(range.submittedFrom, range.submittedTo);
        const salesFunnel = dashboard.salesFunnel;

        const budgetMap = buildLeadBudgetInvestmentMapSync(scopedLeads);
        if (cancelled) return;
        applyInvestmentMetrics(scopedLeads, budgetMap, salesFunnel, opts);
        setFunnelMetricsLoading(false);

        const enriched = await enrichInvestmentMapWithQuotes(scopedLeads, budgetMap, {
          deadlineMs: 2000,
          concurrency: 16,
          maxQuoteIds: 120,
        });
        if (cancelled) return;
        applyInvestmentMetrics(scopedLeads, enriched, salesFunnel, opts);
      } catch {
        if (!cancelled) {
          setQuoteSentWonMetrics({ count: 0, totalValue: 0, loading: false });
          setFunnelStageValues(null);
          setFunnelMetricsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    applyInvestmentMetrics,
    branchId,
    dateFilter,
    dashboard.salesFunnel,
    filterOptions,
    salesPeople,
    salesFunnelStageCount,
  ]);

  const [forecastTargetInr, setForecastTargetInr] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const target = await fetchInsightsRevenueForecastTarget({
          dateFilter,
          branchId,
          salesPeople,
          filterOptions,
        });
        if (!cancelled) setForecastTargetInr(target > 0 ? target : null);
      } catch {
        if (!cancelled) setForecastTargetInr(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId, dateFilter, filterOptions, salesPeople]);

  const revenueForecastForUi = useMemo(
    () => ({
      ...dashboard.revenueForecast,
      target:
        forecastTargetInr != null && forecastTargetInr > 0
          ? forecastTargetInr
          : dashboard.revenueForecast.target,
    }),
    [dashboard.revenueForecast, forecastTargetInr],
  );

  return (
    <>
      <main className="w-full bg-[#f4f7fb] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="shrink-0">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#1f2937] sm:text-4xl">
              CRM Insights
            </h1>
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

      <InsightSect2 kpis={dashboard.kpis} tokenMetrics={tokenMetrics} />
      <InsightSect3
        salesFunnel={dashboard.salesFunnel}
        lostFunnel={dashboard.lostFunnel}
        revenueDistribution={dashboard.revenueDistribution}
        totalLeadsCount={dashboard.kpis.totalLeads.value}
        tokenMetrics={tokenMetrics}
        quotationCount={quoteSentWonMetrics.count}
        quotationValue={quoteSentWonMetrics.totalValue}
        quotationMetricsLoading={quoteSentWonMetrics.loading}
        funnelStageValues={funnelStageValues}
        funnelMetricsLoading={funnelMetricsLoading}
      />
      <InsightsSect4
        dropReasons={dashboard.dropReasons}
        stageVelocity={dashboard.stageVelocity}
      />
      <InsightsSect5
        team={dashboard.teamPerformance.map((m): InsightsTeamMember => ({
          ...m,
          targetIncentive:
            typeof m.userId === "number" && incentiveTargets[m.userId] != null
              ? incentiveTargets[m.userId]
              : undefined,
          achievedIncentive: m.closedValue,
        }))}
        teamPeriod={teamPeriod}
        onTeamPeriodChange={setTeamPeriod}
      />
      <InsightsSect6
        leadsOverTime={dashboard.leadsOverTime}
        conversionTrend={dashboard.conversionTrend}
        revenueForecast={revenueForecastForUi}
      />
    </>
  );
}
