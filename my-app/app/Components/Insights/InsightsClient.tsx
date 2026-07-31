"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BOOKING_DATE_PRESETS,
  DEFAULT_BOOKING_DATE_FILTER,
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
import InsightSect2 from "./InsightSect2";
import InsightSect3 from "./InsightsSect3";
import InsightsSect4 from "./InsightsSect4";
import InsightsSect5 from "./InsightsSect5";
import InsightsSect6 from "./InsightsSect6";

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

  useEffect(() => {
    void loadFilters(branchId);
  }, [branchId, loadFilters]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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

  const salesSelect = salesPeopleSelectValue(salesPeople);

  return (
    <>
      <main className="w-full bg-[#f4f7fb] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="shrink-0">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#1f2937] sm:text-4xl">
              CRM Insights
            </h1>
            <p className="mt-2 max-w-md text-sm text-gray-500 sm:text-base">
              Precision analytics for elite interior design operations.
            </p>
          </div>

          <div className="w-full space-y-3 lg:w-auto">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
              <select
                className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm lg:w-44"
                value={dateFilter.preset}
                onChange={(e) =>
                  onDatePresetChange(e.target.value as BookingDatePresetId)
                }
                aria-label="Date range"
              >
                {DATE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm lg:w-52"
                value={salesSelect}
                onChange={(e) => setSalesPeople(parseSalesPeopleValue(e.target.value))}
                aria-label="Salespeople"
              >
                <option value="all">All Salespeople</option>
                {filterOptions.salesManagers.map((m) => (
                  <option key={`m-${m.id}`} value={`manager:${m.id}`}>
                    Team · {m.name}
                  </option>
                ))}
                {executiveOptions.map((e) => (
                  <option key={`e-${e.id}`} value={`exec:${e.id}`}>
                    {e.managerName
                      ? `${e.name} (${e.managerName})`
                      : e.name}
                  </option>
                ))}
              </select>

              <select
                className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm lg:w-44"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                aria-label="Branch location"
              >
                <option value="all">Location: All</option>
                {filterOptions.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.id}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled
                title="Export PDF is not available yet"
                className="h-10 cursor-not-allowed rounded-md bg-gray-300 px-4 text-sm font-semibold text-gray-500 lg:w-40"
              >
                Export PDF
              </button>
            </div>

            {dateFilter.preset === "custom" ? (
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  From
                  <input
                    type="date"
                    className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                    value={dateFilter.customFrom}
                    onChange={(e) =>
                      setDateFilter((prev) => ({
                        ...prev,
                        customFrom: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  To
                  <input
                    type="date"
                    className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                    value={dateFilter.customTo}
                    onChange={(e) =>
                      setDateFilter((prev) => ({
                        ...prev,
                        customTo: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            {loading ? (
              <p className="text-sm text-gray-500">Loading insights…</p>
            ) : null}
          </div>
        </div>
      </main>

      <InsightSect2 kpis={dashboard.kpis} />
      <InsightSect3
        salesFunnel={dashboard.salesFunnel}
        revenueDistribution={dashboard.revenueDistribution}
      />
      <InsightsSect4
        dropReasons={dashboard.dropReasons}
        stageVelocity={dashboard.stageVelocity}
      />
      <InsightsSect5
        team={dashboard.teamPerformance}
        teamPeriod={teamPeriod}
        onTeamPeriodChange={setTeamPeriod}
      />
      <InsightsSect6
        leadsOverTime={dashboard.leadsOverTime}
        conversionTrend={dashboard.conversionTrend}
        revenueForecast={dashboard.revenueForecast}
      />
    </>
  );
}
