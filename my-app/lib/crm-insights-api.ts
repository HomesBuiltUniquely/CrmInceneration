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
  conversionTrend: {
    changePercent?: number | null;
    points: InsightsChartPoint[];
  };
  revenueForecast: {
    target: number;
    actual: number;
    projected: number;
  };
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

export type QuotesSentMonthApiResult = {
  hubImplemented: boolean;
  periodStart: string | null;
  periodEnd: string | null;
  filterField: "quoteSentAt";
  quotesSentCount: number;
  quotationValueInr: number;
};

function unwrapInsightsPayload(json: unknown): Record<string, unknown> {
  if (!json || typeof json !== "object") return {};
  const root = json as Record<string, unknown>;
  if (root.data && typeof root.data === "object") {
    return root.data as Record<string, unknown>;
  }
  return root;
}

/** Hub KPI: quotes sent in window by quoteSentAt + sum of quotation value. */
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
    quotationValueInr: asNum(
      o.quotationValueInr ?? o.quotationValue ?? o.totalQuotationValueInr,
    ),
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
  revenueForecast: { target: 0, actual: 0, projected: 0 },
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
