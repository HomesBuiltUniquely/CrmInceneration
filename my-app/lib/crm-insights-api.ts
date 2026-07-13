"use client";

import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import {
  bookingDateFilterApiParams,
  resolveBookingDateRange,
  type BookingDateFilterState,
} from "@/lib/booking-token-date-filter";

/* ── Types (Hub Phase 1 contract) ─────────────────────────────────────── */

export type InsightsKpiMetric = {
  value: number;
  changePercent?: number | null;
  changeAbsolute?: number | null;
  progressRatio?: number | null;
};

export type InsightsFunnelStage = {
  stageKey: string;
  stageLabel: string;
  count: number;
  countLabel?: string;
  value: number;
  conversionPercent: number;
};

export type InsightsRevenuePhase = {
  phaseKey: string;
  phaseLabel: string;
  value: number;
  percent: number;
};

export type InsightsDropReason = {
  reason: string;
  count: number;
  percent: number;
};

export type InsightsStageVelocity = {
  fromStage: string;
  toStage: string;
  avgDays: number;
  trendDays: number;
};

export type InsightsTeamMember = {
  userId: number | string;
  name: string;
  role: string;
  leads: number;
  meetings: number;
  proposals: number;
  closed: number;
  closedValue: number;
  conversionPercent: number;
};

export type InsightsChartPoint = {
  label: string;
  count?: number;
  conversionPercent?: number;
};

export type InsightsDashboard = {
  filtersApplied?: {
    dateRange?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    branchId?: string | null;
    salesManagerId?: number | null;
    salesExecutiveId?: number | null;
    teamPeriod?: string | null;
  };
  kpis: {
    totalLeads: InsightsKpiMetric;
    pipelineValue: InsightsKpiMetric;
    closedWon: InsightsKpiMetric;
    conversionPercent: InsightsKpiMetric;
  };
  salesFunnel: InsightsFunnelStage[];
  revenueDistribution: {
    phases: InsightsRevenuePhase[];
    observation?: string | null;
  };
  dropReasons: {
    total: number;
    items: InsightsDropReason[];
  };
  stageVelocity: InsightsStageVelocity[];
  teamPerformance: InsightsTeamMember[];
  leadsOverTime: {
    changePercent?: number | null;
    points: InsightsChartPoint[];
  };
  conversionTrend: {
    changePercent?: number | null;
    points: InsightsChartPoint[];
  };
  revenueForecast: {
    target: number;
    actual: number;
    projected: number;
  };
};

export type InsightsBranchOption = {
  id: string;
  name: string;
};

export type InsightsExecutiveOption = {
  id: number;
  name: string;
  role?: string;
  managerId?: number | null;
  branchId?: string | null;
};

export type InsightsManagerOption = {
  id: number;
  name: string;
  branchId?: string | null;
  executives?: InsightsExecutiveOption[];
};

export type InsightsFilterOptions = {
  datePresets?: Array<{ id: string; label: string }>;
  branches: InsightsBranchOption[];
  salesManagers: InsightsManagerOption[];
  salesExecutives: InsightsExecutiveOption[];
};

export type InsightsDashboardQuery = {
  dateFilter: BookingDateFilterState;
  branchId: string;
  salesManagerId: number | null;
  salesExecutiveId: number | null;
  teamPeriod: "daily" | "monthly";
};

/* ── Formatters ───────────────────────────────────────────────────────── */

export function formatInsightsInrCompact(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n) || n === 0) return "₹0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10_000_000) {
    const cr = abs / 10_000_000;
    return `${sign}₹${cr >= 10 ? cr.toFixed(1) : cr.toFixed(2).replace(/\.?0+$/, "")}Cr`;
  }
  if (abs >= 100_000) {
    const lakh = abs / 100_000;
    /** UI mock used ₹84.2M style for large pipeline; keep M for ≥1e6 */
    if (abs >= 1_000_000) {
      const m = abs / 1_000_000;
      return `${sign}₹${m.toFixed(1).replace(/\.0$/, "")}M`;
    }
    return `${sign}₹${lakh.toFixed(1).replace(/\.0$/, "")}L`;
  }
  if (abs >= 1_000) {
    return `${sign}₹${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

export function formatInsightsCount(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  return Math.round(v).toLocaleString("en-IN");
}

export function formatInsightsPercent(
  n: number | null | undefined,
  digits = 1,
): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0%";
  return `${v.toFixed(digits).replace(/\.0$/, "")}%`;
}

export function formatInsightsChangePercent(
  n: number | null | undefined,
  digits = 1,
): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v === 0) return "0%";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits).replace(/\.0$/, "")}%`;
}

export function formatInsightsChangeAbsolute(
  n: number | null | undefined,
): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v === 0) return "₹0";
  const compact = formatInsightsInrCompact(Math.abs(v));
  if (v > 0) return `+${compact}`;
  if (v < 0) return `-${compact.replace(/^-/, "")}`;
  return compact;
}

export function formatInsightsTrendDays(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v === 0) return "0.0d";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}d`;
}

export function progressWidthPercent(ratio: number | null | undefined): string {
  const r = Number(ratio ?? 0);
  if (!Number.isFinite(r) || r <= 0) return "0%";
  return `${Math.min(100, Math.round(r * 100))}%`;
}

/* ── Query builder ────────────────────────────────────────────────────── */

export function buildInsightsDashboardSearchParams(
  query: InsightsDashboardQuery,
): URLSearchParams {
  const params = new URLSearchParams();
  const dateParams = bookingDateFilterApiParams(query.dateFilter);

  if (dateParams.dateRange) {
    params.set("dateRange", dateParams.dateRange);
  } else if (query.dateFilter.preset === "all") {
    params.set("dateRange", "all");
  } else if (query.dateFilter.preset === "custom") {
    params.set("dateRange", "custom");
  }

  /** Hub accepts dateFrom/dateTo (overrides preset when set). */
  if (dateParams.submittedFrom) {
    params.set("dateFrom", dateParams.submittedFrom);
  }
  if (dateParams.submittedTo) {
    params.set("dateTo", dateParams.submittedTo);
  }

  /** Custom without Hub dateRange preset — still send resolved ISO bounds. */
  if (query.dateFilter.preset === "custom") {
    const range = resolveBookingDateRange(query.dateFilter);
    if (range.submittedFrom && !params.has("dateFrom")) {
      params.set("dateFrom", range.submittedFrom);
    }
    if (range.submittedTo && !params.has("dateTo")) {
      params.set("dateTo", range.submittedTo);
    }
    if (!params.has("dateRange")) params.set("dateRange", "custom");
  }

  const branch = query.branchId.trim();
  if (branch && branch !== "all") {
    params.set("branchId", branch);
  }

  if (query.salesExecutiveId != null) {
    params.set("salesExecutiveId", String(query.salesExecutiveId));
  } else if (query.salesManagerId != null) {
    params.set("salesManagerId", String(query.salesManagerId));
  }

  params.set("teamPeriod", query.teamPeriod);
  return params;
}

/* ── Fetch ────────────────────────────────────────────────────────────── */

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text.trim() ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const err =
      (json &&
        typeof json === "object" &&
        (String((json as Record<string, unknown>).userMessage ?? "") ||
          String((json as Record<string, unknown>).error ?? "") ||
          String((json as Record<string, unknown>).message ?? ""))) ||
      fallback;
    throw new Error(err || fallback);
  }
  return json as T;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asStr(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function normalizeKpi(raw: unknown): InsightsKpiMetric {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    value: asNum(o.value),
    changePercent: o.changePercent == null ? null : asNum(o.changePercent),
    changeAbsolute: o.changeAbsolute == null ? null : asNum(o.changeAbsolute),
    progressRatio: o.progressRatio == null ? null : asNum(o.progressRatio),
  };
}

/** Normalize Hub payload so UI can rely on a stable shape. */
export function normalizeInsightsDashboard(raw: unknown): InsightsDashboard {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kpis = (r.kpis && typeof r.kpis === "object" ? r.kpis : {}) as Record<
    string,
    unknown
  >;
  const revenue = (
    r.revenueDistribution && typeof r.revenueDistribution === "object"
      ? r.revenueDistribution
      : {}
  ) as Record<string, unknown>;
  const drop = (
    r.dropReasons && typeof r.dropReasons === "object" ? r.dropReasons : {}
  ) as Record<string, unknown>;
  const leadsOt = (
    r.leadsOverTime && typeof r.leadsOverTime === "object" ? r.leadsOverTime : {}
  ) as Record<string, unknown>;
  const convTrend = (
    r.conversionTrend && typeof r.conversionTrend === "object"
      ? r.conversionTrend
      : {}
  ) as Record<string, unknown>;
  const forecast = (
    r.revenueForecast && typeof r.revenueForecast === "object"
      ? r.revenueForecast
      : {}
  ) as Record<string, unknown>;

  return {
    filtersApplied:
      r.filtersApplied && typeof r.filtersApplied === "object"
        ? (r.filtersApplied as InsightsDashboard["filtersApplied"])
        : undefined,
    kpis: {
      totalLeads: normalizeKpi(kpis.totalLeads),
      pipelineValue: normalizeKpi(kpis.pipelineValue),
      closedWon: normalizeKpi(kpis.closedWon),
      conversionPercent: normalizeKpi(kpis.conversionPercent),
    },
    salesFunnel: asArray<Record<string, unknown>>(r.salesFunnel).map((s) => ({
      stageKey: asStr(s.stageKey),
      stageLabel: asStr(s.stageLabel, asStr(s.stageKey)),
      count: asNum(s.count),
      countLabel: asStr(s.countLabel, "Leads"),
      value: asNum(s.value),
      conversionPercent: asNum(s.conversionPercent),
    })),
    revenueDistribution: {
      phases: asArray<Record<string, unknown>>(revenue.phases).map((p) => ({
        phaseKey: asStr(p.phaseKey),
        phaseLabel: asStr(p.phaseLabel, asStr(p.phaseKey)),
        value: asNum(p.value),
        percent: asNum(p.percent),
      })),
      observation:
        revenue.observation == null ? null : asStr(revenue.observation),
    },
    dropReasons: {
      total: asNum(drop.total),
      items: asArray<Record<string, unknown>>(drop.items).map((i) => ({
        reason: asStr(i.reason),
        count: asNum(i.count),
        percent: asNum(i.percent),
      })),
    },
    stageVelocity: asArray<Record<string, unknown>>(r.stageVelocity).map((v) => ({
      fromStage: asStr(v.fromStage),
      toStage: asStr(v.toStage),
      avgDays: asNum(v.avgDays),
      trendDays: asNum(v.trendDays),
    })),
    teamPerformance: asArray<Record<string, unknown>>(r.teamPerformance).map(
      (m) => ({
        userId: (m.userId as number | string) ?? "",
        name: asStr(m.name),
        role: asStr(m.role),
        leads: asNum(m.leads),
        meetings: asNum(m.meetings),
        proposals: asNum(m.proposals),
        closed: asNum(m.closed),
        closedValue: asNum(m.closedValue),
        conversionPercent: asNum(m.conversionPercent),
      }),
    ),
    leadsOverTime: {
      changePercent:
        leadsOt.changePercent == null ? null : asNum(leadsOt.changePercent),
      points: asArray<Record<string, unknown>>(leadsOt.points).map((p) => ({
        label: asStr(p.label),
        count: asNum(p.count),
      })),
    },
    conversionTrend: {
      changePercent:
        convTrend.changePercent == null ? null : asNum(convTrend.changePercent),
      points: asArray<Record<string, unknown>>(convTrend.points).map((p) => ({
        label: asStr(p.label),
        conversionPercent: asNum(p.conversionPercent),
      })),
    },
    revenueForecast: {
      target: asNum(forecast.target),
      actual: asNum(forecast.actual),
      projected: asNum(forecast.projected),
    },
  };
}

export function normalizeInsightsFilterOptions(
  raw: unknown,
): InsightsFilterOptions {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const branches = asArray<Record<string, unknown>>(r.branches).map((b) => ({
    id: asStr(b.id),
    name: asStr(b.name, asStr(b.id)),
  }));
  const salesExecutives = asArray<Record<string, unknown>>(
    r.salesExecutives,
  ).map((e) => ({
    id: asNum(e.id),
    name: asStr(e.name),
    role: asStr(e.role),
    managerId: e.managerId == null ? null : asNum(e.managerId),
    branchId: e.branchId == null ? null : asStr(e.branchId),
  }));
  const salesManagers = asArray<Record<string, unknown>>(r.salesManagers).map(
    (m) => ({
      id: asNum(m.id),
      name: asStr(m.name),
      branchId: m.branchId == null ? null : asStr(m.branchId),
      executives: asArray<Record<string, unknown>>(m.executives).map((e) => ({
        id: asNum(e.id),
        name: asStr(e.name),
        role: asStr(e.role),
        managerId: asNum(m.id),
        branchId: e.branchId == null ? null : asStr(e.branchId),
      })),
    }),
  );

  return {
    datePresets: asArray<Record<string, unknown>>(r.datePresets).map((p) => ({
      id: asStr(p.id),
      label: asStr(p.label, asStr(p.id)),
    })),
    branches,
    salesManagers,
    salesExecutives,
  };
}

export async function fetchInsightsDashboard(
  query: InsightsDashboardQuery,
): Promise<InsightsDashboard> {
  const qs = buildInsightsDashboardSearchParams(query).toString();
  const res = await fetch(`/api/crm/insights/dashboard${qs ? `?${qs}` : ""}`, {
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  const json = await readJson<unknown>(res, "Unable to load CRM insights.");
  return normalizeInsightsDashboard(json);
}

export async function fetchInsightsFilterOptions(
  branchId?: string,
): Promise<InsightsFilterOptions> {
  const params = new URLSearchParams();
  const branch = (branchId ?? "").trim();
  if (branch && branch !== "all") params.set("branchId", branch);
  const qs = params.toString();
  const res = await fetch(
    `/api/crm/insights/filter-options${qs ? `?${qs}` : ""}`,
    {
      headers: getCrmAuthHeaders(),
      cache: "no-store",
    },
  );
  const json = await readJson<unknown>(
    res,
    "Unable to load insights filter options.",
  );
  return normalizeInsightsFilterOptions(json);
}

export const EMPTY_INSIGHTS_DASHBOARD: InsightsDashboard = {
  kpis: {
    totalLeads: { value: 0, changePercent: 0, progressRatio: 0 },
    pipelineValue: { value: 0, changeAbsolute: 0, progressRatio: 0 },
    closedWon: { value: 0, changePercent: 0, progressRatio: 0 },
    conversionPercent: { value: 0, changePercent: 0, progressRatio: 0 },
  },
  salesFunnel: [],
  revenueDistribution: { phases: [], observation: null },
  dropReasons: { total: 0, items: [] },
  stageVelocity: [],
  teamPerformance: [],
  leadsOverTime: { changePercent: 0, points: [] },
  conversionTrend: { changePercent: 0, points: [] },
  revenueForecast: { target: 0, actual: 0, projected: 0 },
};
