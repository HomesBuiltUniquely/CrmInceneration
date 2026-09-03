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

export type InsightsLostFunnelStage = {
  stageKey: string;
  stageLabel: string;
  count: number;
  dropPercent: number;
};

/** Hub Hold funnel bar (catalog-gated milestones only). */
export type InsightsHoldFunnelStage = {
  stageKey: string;
  stageLabel: string;
  count: number;
  sharePercent: number;
};

export type InsightsHoldSubstage = {
  subStageKey: string;
  title: string;
  count: number;
};

export type InsightsHoldPathStage = {
  holdTotal: number;
  substages: InsightsHoldSubstage[];
};

/** Keys: discovery | connection | exp_design | decision | … */
export type InsightsHoldPathByStage = Record<string, InsightsHoldPathStage>;

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

/** Hub stage-velocity hop (persisted transition history). FE displays only — do not recompute. */
export type InsightsStageVelocity = {
  fromStage: string;
  toStage: string;
  /** Mean days for completions in the current filter window (1 decimal). */
  avgDays: number;
  /** currentAvg − previousPeriodAvg; negative = faster (good). */
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
  /** Hub optional row active flag (P0 matrix). */
  active?: boolean;
  /** FE Incentives only (prefer); Hub usually omits. */
  targetIncentive?: number;
  achievedIncentive?: number;
  payoff?: number;
};

export type InsightsChartPoint = {
  label: string;
  count?: number;
  conversionPercent?: number;
};

/** Hub conversion trend line — prefer over FE lead-pool recompute when points present. */
export type InsightsConversionTrend = {
  changePercent?: number | null;
  points: InsightsChartPoint[];
  bucketField?: string | null;
  numeratorRule?: string | null;
  denominatorRule?: string | null;
};

export function hasHubConversionTrend(
  trend: InsightsConversionTrend | null | undefined,
): boolean {
  return (trend?.points?.length ?? 0) > 0;
}

/** Hub revenue forecast bars — Actual aligns with kpis.grossBooking when actualScope is set. */
export type InsightsRevenueForecast = {
  target: number;
  actual: number;
  projected: number;
  /** e.g. "grossBooking" — same as Token + Booking KPI strip. */
  actualScope?: string | null;
  targetSource?: string | null;
};

function normalizeRevenueForecast(raw: unknown): InsightsRevenueForecast {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    target: asNum(o.target),
    actual: asNum(o.actual),
    projected: asNum(o.projected),
    actualScope: o.actualScope == null ? null : asStr(o.actualScope),
    targetSource: o.targetSource == null ? null : asStr(o.targetSource),
  };
}

export type InsightsDashboard = {
  filtersApplied?: {
    dateRange?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    branchId?: string | null;
    salesManagerId?: number | null;
    salesExecutiveId?: number | null;
    teamPeriod?: string | null;
    /** Hub frozen rule echo (P0) e.g. lead.assignee ⇄ User.fullName|username */
    assigneeRule?: string | null;
    /** Hub frozen field for branch scope e.g. User.branch */
    branchField?: string | null;
  };
  kpis: {
    totalLeads: InsightsKpiMetric;
    pipelineValue: InsightsKpiMetric;
    closedWon: InsightsKpiMetric;
    conversionPercent: InsightsKpiMetric;
    /**
     * Hub money KPIs — same Scope as totalLeads (branch + people + date).
     * Prefer over FE booking-token deal recompute.
     */
    tokenValue?: InsightsKpiMetric | null;
    bookingValue?: InsightsKpiMetric | null;
    grossBooking?: InsightsKpiMetric | null;
  };
  salesFunnel: InsightsFunnelStage[];
  lostFunnel?: {
    total: number;
    stages: InsightsLostFunnelStage[];
  };
  /** Authoritative On Hold funnel from LeadMilestones Hold catalog (Hub). */
  holdFunnel?: {
    total: number;
    stages: InsightsHoldFunnelStage[];
  };
  /** Exact Hold substage path breakdown per milestone (Hub). */
  holdPathByStage?: InsightsHoldPathByStage;
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
  conversionTrend: InsightsConversionTrend;
  revenueForecast: InsightsRevenueForecast;
  /** Four sales-strip KPI tiles. Prefer dedicated `/performance-cards` fetch. */
  performanceCards?: PerformanceCards;
};

export type InsightsTone = "green" | "yellow" | "red" | "neutral";
export type InsightsTrend = "up" | "down" | "flat";
export type InsightsCardStatus = "hit" | "on_track" | "at_risk" | "behind";

type PerformanceMoneyCard = {
  title: string;
  valueInr: number;
  valueLabel: string;
  status: InsightsCardStatus;
  tone: InsightsTone;
};

export type BookingValueCard = PerformanceMoneyCard & {
  cardKey: "bookingValue";
  targetInr: number;
  targetLabel: string;
  completionPercent: number;
  progressRatio: number;
};

export type WeightedPipelineCard = PerformanceMoneyCard & {
  cardKey: "weightedPipeline";
  unweightedValueInr: number;
  remainingTargetInr: number;
  remainingTargetLabel: string;
  coverageX: number;
  coverageLabel: string;
};

export type ConversionCard = {
  cardKey: "leadToMeeting" | "meetingToBooking";
  title: string;
  valuePercent: number;
  targetPercent: number;
  variancePercent: number;
  varianceLabel: string;
  trend: InsightsTrend;
  status: InsightsCardStatus;
  tone: InsightsTone;
};

export type PerformanceCards = {
  targets: {
    bookingValueInr: number;
    leadToMeetingPercent: number;
    meetingToBookingPercent: number;
  };
  counts: { leads: number; meetings: number; bookings: number };
  cards: {
    bookingValue: BookingValueCard;
    weightedPipeline: WeightedPipelineCard;
    leadToMeeting: ConversionCard & { leadCount: number; meetingCount: number };
    meetingToBooking: ConversionCard & { meetingCount: number; bookingCount: number };
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

export type InsightsPerformanceCardsQuery = InsightsDashboardQuery & {
  bookingTargetInr?: number;
  leadToMeetingTargetPercent?: number;
  meetingToBookingTargetPercent?: number;
};

/** Sales Funnel measure mode (Hub /v1/crm/insights/sales-funnel). */
export type InsightsFunnelMode = "current" | "passages" | "cohort";

/** Path tab — same as production All / Won / Lost / Hold. */
export type InsightsFunnelPathFilter = "all" | "won" | "lost" | "hold";

export type InsightsFunnelPathBreakdown = {
  won: number;
  lost: number;
  hold: number;
};

export type InsightsSalesFunnelStage = InsightsFunnelStage & {
  sharePercent?: number;
  pathBreakdown?: InsightsFunnelPathBreakdown | null;
  /** Passages — entries from leads created inside the filter range. */
  newCount?: number;
  oldCount?: number;
  newSharePercent?: number;
  oldSharePercent?: number;
};

/** Discovery→Closed conversion summary (Passages + Cohort). */
export type InsightsSalesFunnelConversion = {
  baseStage: string;
  overallPercent: number;
  /** Passages only — leads created inside range. */
  newPercent?: number | null;
  /** Passages only — leads created before range. */
  oldPercent?: number | null;
};

/** Cohort live snapshot — optional Hub block. */
export type InsightsCohortProgress = {
  inProgressCount?: number;
  finalOutcomeCount?: number;
  inProgressPercent?: number;
  finalOutcomePercent?: number;
  asOfLabel?: string | null;
};

export type InsightsSalesFunnelResponse = {
  funnelMode: InsightsFunnelMode;
  pathFilter: InsightsFunnelPathFilter;
  passagesAvailable: boolean;
  passagesUnavailableReason: string | null;
  definitions: {
    dateField: string;
    reachRule: string;
    timezone: string;
  };
  total: {
    count: number;
    sharePercent: number;
    countLabel?: string;
  };
  /** Discovery→Closed % — base at Discovery, not Fresh Lead. */
  conversion?: InsightsSalesFunnelConversion | null;
  /** Cohort — live in-progress vs final split. */
  cohortProgress?: InsightsCohortProgress | null;
  stages: InsightsSalesFunnelStage[];
  /** Alias some Hub builds still return. */
  salesFunnel: InsightsSalesFunnelStage[];
};

export type InsightsSalesFunnelQuery = InsightsDashboardQuery & {
  funnelMode: InsightsFunnelMode;
  pathFilter?: InsightsFunnelPathFilter;
};

/** Trailing window for Passages old-lead share trend (ignores header date filter in month mode). */
export const PASSAGES_TREND_MONTHS = 12;

export type InsightsTrendGranularity = "month" | "week";

export type InsightsPassagesTrendPoint = {
  /** yyyy-MM (month) or W1…Wn (week). */
  period: string;
  periodLabel?: string;
  weekIndex?: number;
  /** Optional range e.g. "1–7 Sep" for week buckets. */
  rangeLabel?: string;
  /** ISO month e.g. 2026-01 — kept for month buckets. */
  month: string;
  monthLabel?: string;
  newCount: number;
  oldCount: number;
  /** Hub may send; else FE derives old / (new + old). */
  oldSharePercent?: number;
};

/** True when point is a week bucket (W1…Wn), not a calendar month. */
export function isPassagesTrendWeekPoint(p: InsightsPassagesTrendPoint): boolean {
  const period = (p.period || p.month || "").trim();
  // ISO month keys are never weeks (even if Hub echoes a weekIndex by mistake).
  if (/^\d{4}-\d{2}/.test(period)) return false;
  if (/^W\d+$/i.test(period)) return true;
  if (p.weekIndex != null && p.weekIndex > 0) return true;
  return false;
}

export function isPassagesTrendMonthPoint(p: InsightsPassagesTrendPoint): boolean {
  if (isPassagesTrendWeekPoint(p)) return false;
  const period = (p.period || p.month || "").trim();
  if (/^\d{4}-\d{2}/.test(period)) return true;
  const label = `${p.periodLabel ?? ""} ${p.monthLabel ?? ""}`.trim();
  return /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)/i.test(
    label,
  );
}

export function filterPassagesTrendPointsByGranularity(
  points: InsightsPassagesTrendPoint[],
  granularity: InsightsTrendGranularity,
): InsightsPassagesTrendPoint[] {
  if (granularity === "week") {
    const weeks = points.filter(isPassagesTrendWeekPoint);
    if (weeks.length > 0) {
      return [...weeks].sort(
        (a, b) => (a.weekIndex ?? parseWeekIndex(a.period)) - (b.weekIndex ?? parseWeekIndex(b.period)),
      );
    }
    return weeks;
  }
  const months = points.filter(isPassagesTrendMonthPoint);
  // If Hub omitted ISO keys / labels, keep non-week points rather than empty chart.
  if (months.length > 0) return months;
  return points.filter((p) => !isPassagesTrendWeekPoint(p));
}

function parseWeekIndex(period: string): number {
  const m = period.match(/^W(\d+)$/i);
  return m ? Number(m[1]) : 0;
}

export type InsightsPassagesTrendQuery = {
  months?: number;
  weeks?: number;
  granularity?: InsightsTrendGranularity;
  /** Hub preset e.g. current_month — sent with dateFrom/dateTo in week mode. */
  dateRange?: string;
  /** Week mode — YYYY-MM-DD bounds from Insights date filter. */
  dateFrom?: string;
  dateTo?: string;
  branchId: string;
  salesManagerId: number | null;
  salesExecutiveId: number | null;
};

export type InsightsPassagesTrendResponse = {
  hubImplemented: boolean;
  months?: number;
  weeks?: number;
  timezone?: string;
  granularity?: InsightsTrendGranularity;
  dateFrom?: string;
  dateTo?: string;
  points: InsightsPassagesTrendPoint[];
};

/* ── Formatters ───────────────────────────────────────────────────────── */

export function formatInsightsInrCompact(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n) || n === 0) return "₹0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10_000_000) {
    const cr = abs / 10_000_000;
    return `${sign}₹${cr.toFixed(2).replace(/\.?0+$/, "")}Cr`;
  }
  if (abs >= 100_000) {
    const lakh = abs / 100_000;
    return `${sign}₹${lakh.toFixed(2).replace(/\.?0+$/, "")}L`;
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
  if (!Number.isFinite(v) || v === 0) return "0";
  const sign = v > 0 ? "+" : "−";
  return `${sign}${formatInsightsDuration(Math.abs(v))}`;
}

/**
 * Hub stage velocity is stored in days (decimals). Show human units:
 * minutes / hours under 1 day, otherwise days (+ hours when useful).
 */
export function formatInsightsDuration(days: number | null | undefined): string {
  const d = Number(days ?? 0);
  if (!Number.isFinite(d) || d <= 0) return "0h";

  const totalHours = d * 24;
  if (totalHours < 1) {
    const mins = Math.max(1, Math.round(totalHours * 60));
    return `${mins}m`;
  }

  if (d < 1) {
    const h = totalHours >= 10 ? Math.round(totalHours) : Math.round(totalHours * 10) / 10;
    return `${String(h).replace(/\.0$/, "")}h`;
  }

  const wholeDays = Math.floor(d + 1e-9);
  const remHours = Math.round((d - wholeDays) * 24);
  if (remHours <= 0) {
    return wholeDays === 1 ? "1 day" : `${wholeDays} days`;
  }
  if (wholeDays === 0) {
    return `${remHours}h`;
  }
  return `${wholeDays}d ${remHours}h`;
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

export function buildInsightsSalesFunnelSearchParams(
  query: InsightsSalesFunnelQuery,
): URLSearchParams {
  const params = buildInsightsDashboardSearchParams(query);
  params.delete("teamPeriod");

  const mode =
    query.funnelMode === "cohort"
      ? "cohort"
      : query.funnelMode === "passages"
        ? "passages"
        : "current";
  params.set("funnelMode", mode);

  // Passages = stage entries in range; path split (won/lost/hold) does not apply.
  if (mode !== "passages") {
    const path = query.pathFilter ?? "all";
    if (path === "won" || path === "lost" || path === "hold" || path === "all") {
      params.set("pathFilter", path);
    }
  }
  return params;
}

function normalizeFunnelMode(value: unknown): InsightsFunnelMode {
  const s = asStr(value).toLowerCase();
  if (s === "passages") return "passages";
  if (s === "cohort" || s === "created_cohort") return "cohort";
  // inventory / current aliases
  return "current";
}

function normalizePathFilter(value: unknown): InsightsFunnelPathFilter {
  const s = asStr(value).toLowerCase();
  if (s === "won" || s === "lost" || s === "hold") return s;
  return "all";
}

function normalizeSalesFunnelStage(
  raw: Record<string, unknown>,
): InsightsSalesFunnelStage {
  const share = asNum(
    raw.sharePercent ?? raw.conversionPercent ?? raw.percent,
  );
  const breakdownRaw =
    raw.pathBreakdown && typeof raw.pathBreakdown === "object"
      ? (raw.pathBreakdown as Record<string, unknown>)
      : null;
  const stage: InsightsSalesFunnelStage = {
    stageKey: asStr(raw.stageKey),
    stageLabel: asStr(raw.stageLabel, asStr(raw.stageKey)),
    count: asNum(raw.count),
    countLabel: asStr(raw.countLabel, "Leads"),
    value: asNum(raw.value),
    conversionPercent: share,
    sharePercent: share,
    pathBreakdown: breakdownRaw
      ? {
          won: asNum(breakdownRaw.won ?? breakdownRaw.wonTotal),
          lost: asNum(breakdownRaw.lost ?? breakdownRaw.lostTotal),
          hold: asNum(breakdownRaw.hold ?? breakdownRaw.holdTotal),
        }
      : null,
  };

  if (raw.newCount != null || raw.oldCount != null) {
    stage.newCount = asNum(raw.newCount);
    stage.oldCount = asNum(raw.oldCount);
    if (raw.newSharePercent != null) {
      stage.newSharePercent = asNum(raw.newSharePercent);
    }
    if (raw.oldSharePercent != null) {
      stage.oldSharePercent = asNum(raw.oldSharePercent);
    }
  }

  return stage;
}

function normalizeSalesFunnelConversion(
  raw: unknown,
): InsightsSalesFunnelConversion | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    baseStage: asStr(o.baseStage, "discovery") || "discovery",
    overallPercent: asNum(o.overallPercent),
    newPercent: o.newPercent == null ? null : asNum(o.newPercent),
    oldPercent: o.oldPercent == null ? null : asNum(o.oldPercent),
  };
}

function normalizeCohortProgress(
  raw: unknown,
): InsightsCohortProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    inProgressCount:
      o.inProgressCount == null ? undefined : asNum(o.inProgressCount),
    finalOutcomeCount:
      o.finalOutcomeCount == null ? undefined : asNum(o.finalOutcomeCount),
    inProgressPercent:
      o.inProgressPercent == null ? undefined : asNum(o.inProgressPercent),
    finalOutcomePercent:
      o.finalOutcomePercent == null ? undefined : asNum(o.finalOutcomePercent),
    asOfLabel: o.asOfLabel == null ? null : asStr(o.asOfLabel) || null,
  };
}

export function normalizeInsightsSalesFunnel(
  raw: unknown,
): InsightsSalesFunnelResponse {
  const root = unwrapInsightsPayload(raw);
  const stagesRaw = asArray<Record<string, unknown>>(
    root.stages ?? root.salesFunnel,
  );
  const stages = stagesRaw.map(normalizeSalesFunnelStage);
  const totalRaw =
    root.total && typeof root.total === "object"
      ? (root.total as Record<string, unknown>)
      : {};
  const defsRaw =
    root.definitions && typeof root.definitions === "object"
      ? (root.definitions as Record<string, unknown>)
      : {};

  const passagesAvailable =
    root.passagesAvailable === false
      ? false
      : root.passagesAvailable === true
        ? true
        : true;

  return {
    funnelMode: normalizeFunnelMode(root.funnelMode),
    pathFilter: normalizePathFilter(root.pathFilter),
    passagesAvailable,
    passagesUnavailableReason:
      root.passagesUnavailableReason == null && root.message == null
        ? null
        : asStr(root.passagesUnavailableReason ?? root.message) || null,
    definitions: {
      dateField: asStr(defsRaw.dateField),
      reachRule: asStr(defsRaw.reachRule),
      timezone: asStr(defsRaw.timezone, "Asia/Kolkata"),
    },
    total: {
      count: asNum(totalRaw.count),
      sharePercent: asNum(totalRaw.sharePercent, 100),
      countLabel: asStr(totalRaw.countLabel, "Leads") || "Leads",
    },
    conversion: normalizeSalesFunnelConversion(root.conversion),
    cohortProgress: normalizeCohortProgress(root.cohortProgress),
    stages,
    salesFunnel: stages,
  };
}

/**
 * Hub Sales Funnel Efficiency — current | passages | cohort.
 * 501 with passagesAvailable:false is treated as a successful “unavailable” payload.
 */
export async function fetchInsightsSalesFunnel(
  query: InsightsSalesFunnelQuery,
): Promise<InsightsSalesFunnelResponse> {
  const qs = buildInsightsSalesFunnelSearchParams(query).toString();
  const res = await fetch(
    `/api/crm/insights/sales-funnel${qs ? `?${qs}` : ""}`,
    {
      headers: getCrmAuthHeaders(),
      cache: "no-store",
    },
  );

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (res.status === 501) {
    const normalized = normalizeInsightsSalesFunnel(json);
    return {
      ...normalized,
      funnelMode: query.funnelMode === "passages" ? "passages" : normalized.funnelMode,
      pathFilter: query.pathFilter ?? "all",
      passagesAvailable: false,
      passagesUnavailableReason:
        normalized.passagesUnavailableReason ||
        "Stage transition history is not available yet.",
      stages: normalized.stages.length ? normalized.stages : [],
      salesFunnel: normalized.salesFunnel,
    };
  }

  if (!res.ok) {
    const o =
      json && typeof json === "object" ? (json as Record<string, unknown>) : {};
    const msg =
      [o.error, o.message, o.debugMessage]
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .find((v) => v.length > 0) || "Unable to load sales funnel.";
    throw new Error(msg);
  }

  return normalizeInsightsSalesFunnel(json);
}

export function buildInsightsPassagesTrendSearchParams(
  query: InsightsPassagesTrendQuery,
): URLSearchParams {
  const params = new URLSearchParams();
  const granularity = query.granularity ?? "month";
  params.set("granularity", granularity);

  if (granularity === "week") {
    params.set(
      "weeks",
      String(query.weeks != null && query.weeks > 0 ? query.weeks : 6),
    );
    if (query.dateRange?.trim()) params.set("dateRange", query.dateRange.trim());
    if (query.dateFrom?.trim()) params.set("dateFrom", query.dateFrom.trim());
    if (query.dateTo?.trim()) params.set("dateTo", query.dateTo.trim());
  } else {
    params.set(
      "months",
      String(
        query.months != null && query.months > 0
          ? query.months
          : PASSAGES_TREND_MONTHS,
      ),
    );
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
  return params;
}

/** Week-mode passages trend — Hub dateRange + YYYY-MM-DD bounds from header filter. */
export function passagesTrendWeekScopeFromDateFilter(
  dateFilter: BookingDateFilterState,
): Pick<InsightsPassagesTrendQuery, "dateRange" | "dateFrom" | "dateTo"> {
  const range = resolveBookingDateRange(dateFilter);
  const out: Pick<InsightsPassagesTrendQuery, "dateRange" | "dateFrom" | "dateTo"> =
    {};
  if (dateFilter.preset === "currentMonth") {
    out.dateRange = "current_month";
  } else if (dateFilter.preset === "previousMonth") {
    out.dateRange = "previous_month";
  }
  if (range.submittedFrom?.trim()) {
    out.dateFrom = range.submittedFrom.trim().slice(0, 10);
  }
  if (range.submittedTo?.trim()) {
    out.dateTo = range.submittedTo.trim().slice(0, 10);
  }
  return out;
}

export function oldSharePercentFromPassagesCounts(
  newCount: number,
  oldCount: number,
): number {
  const total = newCount + oldCount;
  if (total <= 0) return 0;
  return Math.min(100, (oldCount / total) * 100);
}

/** Parse Hub percent that may be 0–100, 0–1 ratio, or "34.7%". */
export function normalizePassagesOldSharePercent(
  raw: unknown,
  newCount: number,
  oldCount: number,
): number {
  if (newCount + oldCount > 0) {
    return oldSharePercentFromPassagesCounts(newCount, oldCount);
  }
  if (raw == null) return 0;
  const text = String(raw).trim().replace(/%/g, "");
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return 0;
  // Hub sometimes sends a 0–1 fraction when counts are omitted.
  if (n > 0 && n <= 1) return Math.min(100, n * 100);
  return Math.min(100, n);
}

function pickTrendCount(raw: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    if (raw[k] != null && raw[k] !== "") return asNum(raw[k]);
  }
  return 0;
}

export function normalizeInsightsPassagesTrend(
  raw: unknown,
): InsightsPassagesTrendResponse {
  const root = unwrapInsightsPayload(raw);
  const nestedTrend =
    root.trend && typeof root.trend === "object"
      ? (root.trend as Record<string, unknown>)
      : null;
  const pointsRaw = asArray<Record<string, unknown>>(
    root.points ??
      root.monthlyTrend ??
      root.months ??
      nestedTrend?.points ??
      nestedTrend?.monthlyTrend,
  );
  const points: InsightsPassagesTrendPoint[] = pointsRaw.map((p) => {
    const newCount = pickTrendCount(p, [
      "newCount",
      "new",
      "newLeads",
      "newEntries",
      "newLeadCount",
    ]);
    const oldCount = pickTrendCount(p, [
      "oldCount",
      "old",
      "oldLeads",
      "oldEntries",
      "oldLeadCount",
    ]);
    const oldShare = normalizePassagesOldSharePercent(
      p.oldSharePercent ?? p.oldShare ?? p.oldPercent ?? p.sharePercent,
      newCount,
      oldCount,
    );
    const period = asStr(
      p.period ?? p.week ?? p.weekKey ?? p.month ?? p.monthKey ?? p.label ?? p.key,
    );
    const periodLabel =
      asStr(p.periodLabel ?? p.weekLabel ?? p.monthLabel ?? p.label, "") ||
      undefined;
    const rangeLabel =
      asStr(p.rangeLabel ?? p.weekRange ?? p.range, "") || undefined;
    const weekIndex =
      p.weekIndex != null ? asNum(p.weekIndex) : undefined;
    const inferredWeek = /^W\d+$/i.test(period);
    // Normalize "2026-03-01" / "2026/03" → "2026-03" for month paging.
    const monthKeyMatch = period.match(/^(\d{4})[/.-](\d{1,2})/);
    const normalizedPeriod =
      !inferredWeek && monthKeyMatch
        ? `${monthKeyMatch[1]}-${String(monthKeyMatch[2]).padStart(2, "0")}`
        : period;
    return {
      period: normalizedPeriod,
      periodLabel,
      weekIndex:
        weekIndex && weekIndex > 0
          ? weekIndex
          : inferredWeek
            ? parseWeekIndex(period)
            : undefined,
      rangeLabel: rangeLabel || undefined,
      month: normalizedPeriod,
      monthLabel: periodLabel,
      newCount,
      oldCount,
      oldSharePercent: oldShare,
    };
  });
  const granularityRaw = asStr(root.granularity ?? nestedTrend?.granularity, "");
  let granularity: InsightsTrendGranularity =
    granularityRaw === "week" ? "week" : granularityRaw === "month" ? "month" : "month";
  if (!granularityRaw && points.length > 0) {
    granularity = points.every(isPassagesTrendWeekPoint) ? "week" : "month";
  }
  const hubFlag = root.hubImplemented ?? nestedTrend?.hubImplemented;
  return {
    hubImplemented: hubFlag === false ? false : points.length > 0 ? true : hubFlag === true,
    months: asNum(root.months ?? nestedTrend?.months, PASSAGES_TREND_MONTHS),
    weeks: root.weeks != null ? asNum(root.weeks) : undefined,
    timezone: asStr(root.timezone, "Asia/Kolkata") || "Asia/Kolkata",
    dateFrom: asStr(root.dateFrom, "") || undefined,
    dateTo: asStr(root.dateTo, "") || undefined,
    points,
    granularity,
  };
}

/** Monthly Passages old-lead % — scope filters only, not header date range. */
export async function fetchInsightsPassagesTrend(
  query: InsightsPassagesTrendQuery,
): Promise<InsightsPassagesTrendResponse> {
  const qs = buildInsightsPassagesTrendSearchParams(query).toString();
  const res = await fetch(
    `/api/crm/insights/passages-trend${qs ? `?${qs}` : ""}`,
    {
      headers: getCrmAuthHeaders(),
      cache: "no-store",
    },
  );
  const json = await readJson<unknown>(res, "Unable to load passages trend.");
  const normalized = normalizeInsightsPassagesTrend(json);
  if (query.granularity) {
    return { ...normalized, granularity: query.granularity };
  }
  return normalized;
}

/** Same Insights scope; omit matrix-only `teamPeriod`. Prefer `dateRange=current_month` for MTD. */
export function buildInsightsPerformanceCardsSearchParams(
  query: InsightsPerformanceCardsQuery,
): URLSearchParams {
  const params = buildInsightsDashboardSearchParams(query);
  params.delete("teamPeriod");
  if (
    query.dateFilter.preset === "currentMonth" &&
    !params.has("dateRange")
  ) {
    params.set("dateRange", "current_month");
  }
  if (query.bookingTargetInr != null && Number.isFinite(query.bookingTargetInr)) {
    params.set("bookingTargetInr", String(query.bookingTargetInr));
  }
  if (
    query.leadToMeetingTargetPercent != null &&
    Number.isFinite(query.leadToMeetingTargetPercent)
  ) {
    params.set(
      "leadToMeetingTargetPercent",
      String(query.leadToMeetingTargetPercent),
    );
  }
  if (
    query.meetingToBookingTargetPercent != null &&
    Number.isFinite(query.meetingToBookingTargetPercent)
  ) {
    params.set(
      "meetingToBookingTargetPercent",
      String(query.meetingToBookingTargetPercent),
    );
  }
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
    const body =
      json && typeof json === "object"
        ? (json as Record<string, unknown>)
        : null;
    const fromBody = [body?.userMessage, body?.error, body?.message]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .find((v) => v.length > 0);
    throw new Error(fromBody || fallback);
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
    progressRatio: asNum(o.progressRatio),
  };
}

/** null when Hub omits the field entirely */
function normalizeOptionalKpi(raw: unknown): InsightsKpiMetric | null {
  if (raw == null || typeof raw !== "object") return null;
  return normalizeKpi(raw);
}

function asTone(value: unknown): InsightsTone {
  const s = asStr(value);
  if (s === "green" || s === "yellow" || s === "red" || s === "neutral") return s;
  return "neutral";
}

function asTrend(value: unknown): InsightsTrend {
  const s = asStr(value);
  if (s === "up" || s === "down" || s === "flat") return s;
  return "flat";
}

function asCardStatus(value: unknown): InsightsCardStatus {
  const s = asStr(value);
  if (s === "hit" || s === "on_track" || s === "at_risk" || s === "behind") {
    return s;
  }
  return "on_track";
}

function hubLabel(value: unknown, fallback: string): string {
  const s = asStr(value).trim();
  return s || fallback;
}

export function normalizePerformanceCards(raw: unknown): PerformanceCards {
  const root = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const wrapped =
    root.performanceCards && typeof root.performanceCards === "object"
      ? (root.performanceCards as Record<string, unknown>)
      : root;
  const targets = (
    wrapped.targets && typeof wrapped.targets === "object"
      ? wrapped.targets
      : {}
  ) as Record<string, unknown>;
  const counts = (
    wrapped.counts && typeof wrapped.counts === "object" ? wrapped.counts : {}
  ) as Record<string, unknown>;
  const cards = (
    wrapped.cards && typeof wrapped.cards === "object" ? wrapped.cards : {}
  ) as Record<string, unknown>;
  const booking = (
    cards.bookingValue && typeof cards.bookingValue === "object"
      ? cards.bookingValue
      : {}
  ) as Record<string, unknown>;
  const pipeline = (
    cards.weightedPipeline && typeof cards.weightedPipeline === "object"
      ? cards.weightedPipeline
      : {}
  ) as Record<string, unknown>;
  const leadToMeeting = (
    cards.leadToMeeting && typeof cards.leadToMeeting === "object"
      ? cards.leadToMeeting
      : {}
  ) as Record<string, unknown>;
  const meetingToBooking = (
    cards.meetingToBooking && typeof cards.meetingToBooking === "object"
      ? cards.meetingToBooking
      : {}
  ) as Record<string, unknown>;

  const bookingTargetInr = asNum(targets.bookingValueInr, asNum(booking.targetInr, 30_000_000));
  const leadTarget = asNum(
    targets.leadToMeetingPercent,
    asNum(leadToMeeting.targetPercent, 75),
  );
  const meetingTarget = asNum(
    targets.meetingToBookingPercent,
    asNum(meetingToBooking.targetPercent, 40),
  );

  return {
    targets: {
      bookingValueInr: bookingTargetInr,
      leadToMeetingPercent: leadTarget,
      meetingToBookingPercent: meetingTarget,
    },
    counts: {
      leads: asNum(counts.leads, asNum(leadToMeeting.leadCount)),
      meetings: asNum(counts.meetings, asNum(leadToMeeting.meetingCount)),
      bookings: asNum(counts.bookings, asNum(meetingToBooking.bookingCount)),
    },
    cards: {
      bookingValue: {
        cardKey: "bookingValue",
        title: hubLabel(booking.title, "Booking Value"),
        valueInr: asNum(booking.valueInr),
        valueLabel: hubLabel(booking.valueLabel, "₹0"),
        targetInr: asNum(booking.targetInr, bookingTargetInr),
        targetLabel: hubLabel(booking.targetLabel, "₹3 Cr"),
        completionPercent: asNum(booking.completionPercent),
        progressRatio: asNum(booking.progressRatio),
        status: asCardStatus(booking.status),
        tone: asTone(booking.tone),
      },
      weightedPipeline: {
        cardKey: "weightedPipeline",
        title: hubLabel(pipeline.title, "Weighted Pipeline"),
        valueInr: asNum(pipeline.valueInr),
        valueLabel: hubLabel(pipeline.valueLabel, "₹0"),
        unweightedValueInr: asNum(pipeline.unweightedValueInr),
        remainingTargetInr: asNum(pipeline.remainingTargetInr),
        remainingTargetLabel: hubLabel(pipeline.remainingTargetLabel, "₹0"),
        coverageX: asNum(pipeline.coverageX),
        coverageLabel: hubLabel(pipeline.coverageLabel, "0.0x"),
        status: asCardStatus(pipeline.status),
        tone: asTone(pipeline.tone),
      },
      leadToMeeting: {
        cardKey: "leadToMeeting",
        title: hubLabel(leadToMeeting.title, "Lead → Meeting"),
        valuePercent: asNum(leadToMeeting.valuePercent),
        targetPercent: asNum(leadToMeeting.targetPercent, leadTarget),
        variancePercent: asNum(leadToMeeting.variancePercent),
        varianceLabel: hubLabel(leadToMeeting.varianceLabel, "0%"),
        leadCount: asNum(leadToMeeting.leadCount, asNum(counts.leads)),
        meetingCount: asNum(leadToMeeting.meetingCount, asNum(counts.meetings)),
        trend: asTrend(leadToMeeting.trend),
        status: asCardStatus(leadToMeeting.status),
        tone: asTone(leadToMeeting.tone),
      },
      meetingToBooking: {
        cardKey: "meetingToBooking",
        title: hubLabel(meetingToBooking.title, "Meeting → Booking"),
        valuePercent: asNum(meetingToBooking.valuePercent),
        targetPercent: asNum(meetingToBooking.targetPercent, meetingTarget),
        variancePercent: asNum(meetingToBooking.variancePercent),
        varianceLabel: hubLabel(meetingToBooking.varianceLabel, "0% VAR"),
        meetingCount: asNum(meetingToBooking.meetingCount, asNum(counts.meetings)),
        bookingCount: asNum(meetingToBooking.bookingCount, asNum(counts.bookings)),
        trend: asTrend(meetingToBooking.trend),
        status: asCardStatus(meetingToBooking.status),
        tone: asTone(meetingToBooking.tone),
      },
    },
  };
}

function normalizeLostFunnel(
  raw: unknown,
): InsightsDashboard["lostFunnel"] {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const stages = asArray<Record<string, unknown>>(o.stages).map((s) => ({
    stageKey: asStr(s.stageKey),
    stageLabel: asStr(s.stageLabel, asStr(s.stageKey)),
    count: asNum(s.count),
    dropPercent: asNum(s.dropPercent),
  }));
  if (stages.length === 0) return undefined;
  const total = asNum(o.total, stages.reduce((sum, s) => sum + s.count, 0));
  return { total, stages };
}

function normalizeHoldFunnel(
  raw: unknown,
): InsightsDashboard["holdFunnel"] {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const stages = asArray<Record<string, unknown>>(o.stages).map((s) => ({
    stageKey: asStr(s.stageKey),
    stageLabel: asStr(s.stageLabel, asStr(s.stageKey)),
    count: asNum(s.count),
    sharePercent: asNum(s.sharePercent),
  }));
  if (stages.length === 0) return undefined;
  const total = asNum(o.total, stages.reduce((sum, s) => sum + s.count, 0));
  return { total, stages };
}

function normalizeHoldPathByStage(
  raw: unknown,
): InsightsDashboard["holdPathByStage"] {
  if (!raw || typeof raw !== "object") return undefined;
  const out: InsightsHoldPathByStage = {};
  for (const [rawKey, value] of Object.entries(raw as Record<string, unknown>)) {
    const key = asStr(rawKey).trim();
    if (!key || !value || typeof value !== "object") continue;
    const o = value as Record<string, unknown>;
    const substages = asArray<Record<string, unknown>>(o.substages).map((s) => ({
      subStageKey: asStr(s.subStageKey, asStr(s.title)),
      title: asStr(s.title, asStr(s.subStageKey)),
      count: asNum(s.count),
    }));
    out[key] = {
      holdTotal: asNum(
        o.holdTotal,
        substages.reduce((sum, row) => sum + row.count, 0),
      ),
      substages,
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeConversionTrend(raw: unknown): InsightsConversionTrend {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    changePercent: o.changePercent == null ? null : asNum(o.changePercent),
    points: asArray<Record<string, unknown>>(o.points).map((p) => ({
      label: asStr(p.label),
      conversionPercent: asNum(p.conversionPercent),
    })),
    bucketField: o.bucketField == null ? null : asStr(o.bucketField),
    numeratorRule: o.numeratorRule == null ? null : asStr(o.numeratorRule),
    denominatorRule: o.denominatorRule == null ? null : asStr(o.denominatorRule),
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
      tokenValue: normalizeOptionalKpi(kpis.tokenValue),
      bookingValue: normalizeOptionalKpi(kpis.bookingValue),
      grossBooking: normalizeOptionalKpi(kpis.grossBooking),
    },
    salesFunnel: asArray<Record<string, unknown>>(r.salesFunnel).map((s) => ({
      stageKey: asStr(s.stageKey),
      stageLabel: asStr(s.stageLabel, asStr(s.stageKey)),
      count: asNum(s.count),
      countLabel: asStr(s.countLabel, "Leads"),
      value: asNum(s.value),
      conversionPercent: asNum(s.conversionPercent),
    })),
    lostFunnel: normalizeLostFunnel(r.lostFunnel),
    holdFunnel: normalizeHoldFunnel(r.holdFunnel),
    holdPathByStage: normalizeHoldPathByStage(r.holdPathByStage),
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
        active:
          typeof m.active === "boolean"
            ? m.active
            : m.active == null
              ? undefined
              : Boolean(m.active),
        targetIncentive: m.targetIncentive != null ? asNum(m.targetIncentive) : undefined,
        achievedIncentive: m.achievedIncentive != null ? asNum(m.achievedIncentive) : undefined,
        payoff:
          m.payoff != null
            ? asNum(m.payoff)
            : m.incentivePayout != null
              ? asNum(m.incentivePayout)
              : undefined,
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
    conversionTrend: normalizeConversionTrend(convTrend),
    revenueForecast: normalizeRevenueForecast(forecast),
    performanceCards: r.performanceCards
      ? normalizePerformanceCards(r.performanceCards)
      : undefined,
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

export async function fetchInsightsPerformanceCards(
  query: InsightsPerformanceCardsQuery,
): Promise<PerformanceCards> {
  const qs = buildInsightsPerformanceCardsSearchParams(query).toString();
  const res = await fetch(
    `/api/crm/insights/performance-cards${qs ? `?${qs}` : ""}`,
    {
      headers: getCrmAuthHeaders(),
      cache: "no-store",
    },
  );
  const json = await readJson<unknown>(
    res,
    "Unable to load sales performance cards.",
  );
  return normalizePerformanceCards(json);
}

export type QuotesSentPathBreakdownNow = {
  won: number;
  lost: number;
  hold: number;
};

export type QuotesSentMonthApiResult = {
  hubImplemented: boolean;
  periodStart: string | null;
  periodEnd: string | null;
  filterField: "quoteSentAt";
  quotesSentCount: number;
  /** Won/active budget only — bind big ₹ to this. */
  quotationValueInr: number;
  quotationValueAllInr?: number;
  quotationValueScope?: string;
  pathBreakdownNow?: QuotesSentPathBreakdownNow | null;
};

function unwrapInsightsPayload(json: unknown): Record<string, unknown> {
  if (!json || typeof json !== "object") return {};
  const root = json as Record<string, unknown>;
  if (root.data && typeof root.data === "object") {
    return root.data as Record<string, unknown>;
  }
  return root;
}

function normalizeQuotesSentPathBreakdown(
  raw: unknown,
): QuotesSentPathBreakdownNow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    won: asNum(o.won ?? o.active ?? o.wonTotal),
    lost: asNum(o.lost ?? o.lostTotal),
    hold: asNum(o.hold ?? o.holdTotal),
  };
}

/** Big ₹ = won/active budget only; never fall back to all-cohort totals. */
function normalizeQuotesSentWonValueInr(o: Record<string, unknown>): number {
  const explicit = asNum(
    o.quotationValueInr ?? o.wonQuotationValueInr ?? o.activeQuotationValueInr,
    Number.NaN,
  );
  if (Number.isFinite(explicit)) return explicit;
  const scope = asStr(o.quotationValueScope).toLowerCase();
  if (scope === "won_only") return 0;
  return asNum(o.quotationValue ?? o.quotationValueInr);
}

/** Hub KPI: quotes sent in window by quoteSentAt + won-only quotation value. */
export async function fetchInsightsQuotesSentMonth(
  query: InsightsPerformanceCardsQuery,
): Promise<QuotesSentMonthApiResult> {
  const qs = buildInsightsPerformanceCardsSearchParams(query).toString();
  const res = await fetch(
    `/api/crm/insights/quotes-sent-month${qs ? `?${qs}` : ""}`,
    {
      headers: getCrmAuthHeaders(),
      cache: "no-store",
    },
  );
  const json = await readJson<unknown>(
    res,
    "Unable to load quotes-sent-month insights.",
  );
  const o = unwrapInsightsPayload(json);
  return {
    hubImplemented: o.hubImplemented === true,
    periodStart: asStr(o.periodStart ?? o.dateFrom, "") || null,
    periodEnd: asStr(o.periodEnd ?? o.dateTo, "") || null,
    filterField: "quoteSentAt",
    quotesSentCount: asNum(
      o.uniqueLeadCount ??
        o.quotesSentLeadCount ??
        o.distinctLeadCount ??
        o.quotesSentCount ??
        o.quoteSentCount,
    ),
    quotationValueInr: normalizeQuotesSentWonValueInr(o),
    quotationValueAllInr: (() => {
      const all = asNum(
        o.quotationValueAllInr ?? o.totalQuotationValueInr ?? o.allQuotationValueInr,
        Number.NaN,
      );
      return Number.isFinite(all) ? all : undefined;
    })(),
    quotationValueScope: asStr(o.quotationValueScope, "") || undefined,
    pathBreakdownNow: normalizeQuotesSentPathBreakdown(o.pathBreakdownNow),
  };
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
    tokenValue: { value: 0, changeAbsolute: 0, progressRatio: 0 },
    bookingValue: { value: 0, changeAbsolute: 0, progressRatio: 0 },
    grossBooking: { value: 0, changeAbsolute: 0, progressRatio: 0 },
  },
  salesFunnel: [],
  revenueDistribution: { phases: [], observation: null },
  dropReasons: { total: 0, items: [] },
  stageVelocity: [],
  teamPerformance: [],
  leadsOverTime: { changePercent: 0, points: [] },
  conversionTrend: { changePercent: 0, points: [] },
  revenueForecast: { target: 0, actual: 0, projected: 0, actualScope: null, targetSource: null },
};

export const EMPTY_PERFORMANCE_CARDS: PerformanceCards = {
  targets: {
    bookingValueInr: 30_000_000,
    leadToMeetingPercent: 75,
    meetingToBookingPercent: 40,
  },
  counts: { leads: 0, meetings: 0, bookings: 0 },
  cards: {
    bookingValue: {
      cardKey: "bookingValue",
      title: "Booking Value",
      valueInr: 0,
      valueLabel: "₹0",
      targetInr: 30_000_000,
      targetLabel: "₹3 Cr",
      completionPercent: 0,
      progressRatio: 0,
      status: "behind",
      tone: "neutral",
    },
    weightedPipeline: {
      cardKey: "weightedPipeline",
      title: "Weighted Pipeline",
      valueInr: 0,
      valueLabel: "₹0",
      unweightedValueInr: 0,
      remainingTargetInr: 0,
      remainingTargetLabel: "₹0",
      coverageX: 0,
      coverageLabel: "0.0x",
      status: "behind",
      tone: "neutral",
    },
    leadToMeeting: {
      cardKey: "leadToMeeting",
      title: "Lead → Meeting",
      valuePercent: 0,
      targetPercent: 75,
      variancePercent: 0,
      varianceLabel: "0%",
      leadCount: 0,
      meetingCount: 0,
      trend: "flat",
      status: "behind",
      tone: "neutral",
    },
    meetingToBooking: {
      cardKey: "meetingToBooking",
      title: "Meeting → Booking",
      valuePercent: 0,
      targetPercent: 40,
      variancePercent: 0,
      varianceLabel: "0% VAR",
      meetingCount: 0,
      bookingCount: 0,
      trend: "flat",
      status: "behind",
      tone: "neutral",
    },
  },
};
