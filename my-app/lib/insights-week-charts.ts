/**
 * Leads-over-time volume series for Insights.
 *
 * Hierarchy:
 * - Short range (≤ ~40 days, e.g. this month) → main chart = weeks → tap week → days
 * - Long range / All time → main chart = months → tap month → weeks → tap week → days
 *
 * Built from lead `createdAt` inside the Insights date window (or full inventory for All time).
 */

import type { InsightsDashboard } from "@/lib/crm-insights-api";
import { readLeadCreatedAtRaw } from "@/lib/lead-follow-up-insights";
import { crmLeadTopLevelStage, type ApiLead } from "@/lib/leads-filter";

export type InsightsDateRange = {
  submittedFrom?: string;
  submittedTo?: string;
};

export type InsightsWeekDayPoint = {
  /** Local calendar key yyyy-MM-dd */
  dateKey: string;
  weekdayShort: string;
  weekdayLong: string;
  day: number;
  monthShort: string;
  monthLong: string;
  count: number;
  /** Relative volume within the week */
  intensity: "high" | "medium" | "low" | "none";
};

export type InsightsWeekBarPoint = {
  weekIndex: number;
  shortLabel: string;
  rangeLabel: string;
  count: number;
  intensity: "high" | "medium" | "low" | "none";
  days: InsightsWeekDayPoint[];
};

export type InsightsMonthBarPoint = {
  /** yyyy-MM */
  monthKey: string;
  shortLabel: string;
  yearLabel: string;
  rangeLabel: string;
  count: number;
  intensity: "high" | "medium" | "low" | "none";
  weeks: InsightsWeekBarPoint[];
};

export type InsightsWeekCharts = {
  leadsOverTime: InsightsDashboard["leadsOverTime"];
  conversionTrend: InsightsDashboard["conversionTrend"];
  /** Main chart grain: weeks (month filter) or months (All time / long range). */
  rootLevel: "week" | "month";
  weekBars: InsightsWeekBarPoint[];
  monthBars: InsightsMonthBarPoint[];
};

/** Week + month series for short date ranges (toggle in Sect6 / Passages trend). */
export type InsightsVolumeChartBundle = {
  defaultGranularity: "week" | "month";
  showGranularityToggle: boolean;
  week: InsightsWeekCharts;
  month: InsightsWeekCharts;
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfLocalMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfLocalMonth(d: Date): Date {
  return endOfLocalDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function formatAxisDay(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toMonthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Closed phase for conversion % (same top-stage idea as funnel Closed). */
function isClosedPhaseLead(lead: ApiLead): boolean {
  const s = crmLeadTopLevelStage(lead).trim().toLowerCase();
  return s === "closed" || s.startsWith("closed");
}

type WeekBucket = {
  index: number;
  start: Date;
  end: Date;
  label: string;
};

type MonthBucket = {
  key: string;
  start: Date;
  end: Date;
  shortLabel: string;
  yearLabel: string;
  rangeLabel: string;
};

/**
 * Split [from, to] into successive week slots (≤7 days each).
 * Month of 28–31 days → 4–5 weeks only.
 */
export function buildRangeWeekBuckets(
  range: InsightsDateRange,
  maxWeeks = 6,
): WeekBucket[] {
  const fromMs = range.submittedFrom ? Date.parse(range.submittedFrom) : NaN;
  const toMs = range.submittedTo ? Date.parse(range.submittedTo) : NaN;
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) {
    return [];
  }

  let cursor = startOfLocalDay(new Date(fromMs));
  const rangeEnd = startOfLocalDay(new Date(toMs));
  const buckets: WeekBucket[] = [];
  let i = 0;

  while (cursor.getTime() <= rangeEnd.getTime() && i < maxWeeks) {
    const weekStart = new Date(cursor);
    const weekEndCandidate = new Date(cursor);
    weekEndCandidate.setDate(weekEndCandidate.getDate() + 6);
    const weekEnd =
      weekEndCandidate.getTime() > rangeEnd.getTime()
        ? new Date(rangeEnd)
        : weekEndCandidate;

    const sameDay = weekStart.getTime() === weekEnd.getTime();
    const label = sameDay
      ? formatAxisDay(weekStart)
      : `${formatAxisDay(weekStart)}–${formatAxisDay(weekEnd)}`;

    buckets.push({
      index: i,
      start: weekStart,
      end: endOfLocalDay(weekEnd),
      label,
    });

    cursor = startOfLocalDay(new Date(weekEnd));
    cursor.setDate(cursor.getDate() + 1);
    i += 1;
  }

  return buckets;
}

function buildMonthBuckets(from: Date, to: Date, maxMonths = 24): MonthBucket[] {
  const endMonth = startOfLocalMonth(to);
  let cursor = startOfLocalMonth(from);
  const out: MonthBucket[] = [];

  while (cursor.getTime() <= endMonth.getTime() && out.length < maxMonths + 8) {
    const monthEnd = endOfLocalMonth(cursor);
    const clippedStart =
      cursor.getTime() < from.getTime() ? startOfLocalDay(from) : cursor;
    const clippedEnd = monthEnd.getTime() > to.getTime() ? endOfLocalDay(to) : monthEnd;
    if (clippedStart.getTime() <= clippedEnd.getTime()) {
      const yearLabel = String(cursor.getFullYear());
      const shortLabel = cursor.toLocaleDateString("en-IN", { month: "short" });
      out.push({
        key: toMonthKey(cursor),
        start: clippedStart,
        end: clippedEnd,
        shortLabel,
        yearLabel,
        rangeLabel: `${shortLabel} ${yearLabel}`,
      });
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  // Prefer recent months when the series is long.
  if (out.length > maxMonths) return out.slice(out.length - maxMonths);
  return out;
}

function leadCreatedMs(lead: ApiLead): number {
  const raw = readLeadCreatedAtRaw(lead);
  return raw ? Date.parse(raw) : NaN;
}

function pctChange(first: number, last: number): number | null {
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  if (first === 0) return last === 0 ? 0 : 100;
  return Math.round(((last - first) / Math.abs(first)) * 1000) / 10;
}

/**
 * Badge for incomplete months: ignore trailing empty buckets
 * so we don't show −100% when the last period simply has no data yet.
 */
function leadVolumeChangePercent(counts: number[]): number | null {
  if (counts.length === 0) return null;
  let lastIdx = counts.length - 1;
  while (lastIdx > 0 && (counts[lastIdx] ?? 0) === 0) lastIdx -= 1;
  if (lastIdx === 0) return 0;
  const last = counts[lastIdx] ?? 0;
  const prev = counts[lastIdx - 1] ?? 0;
  return pctChange(prev, last);
}

/** Rank counts into high / medium / low among positive values (zeros = none). */
export function intensityFromCounts(
  counts: number[],
): Array<"high" | "medium" | "low" | "none"> {
  const positive = counts.filter((c) => c > 0);
  if (positive.length === 0) {
    return counts.map(() => "none" as const);
  }
  const sorted = [...positive].sort((a, b) => a - b);
  const lowCut = sorted[Math.floor((sorted.length - 1) * 0.33)] ?? 0;
  const highCut = sorted[Math.ceil((sorted.length - 1) * 0.66)] ?? lowCut;

  return counts.map((c) => {
    if (c <= 0) return "none";
    if (c >= highCut && highCut > 0) return "high";
    if (c <= lowCut) return "low";
    return "medium";
  });
}

function buildDaysForWeek(
  week: WeekBucket,
  dayCountMap: Map<string, number>,
): InsightsWeekDayPoint[] {
  const days: InsightsWeekDayPoint[] = [];
  const cursor = startOfLocalDay(week.start);
  const endDay = startOfLocalDay(week.end);

  while (cursor.getTime() <= endDay.getTime()) {
    const key = toDateKey(cursor);
    days.push({
      dateKey: key,
      weekdayShort: cursor.toLocaleDateString("en-IN", { weekday: "short" }),
      weekdayLong: cursor.toLocaleDateString("en-IN", { weekday: "long" }),
      day: cursor.getDate(),
      monthShort: cursor.toLocaleDateString("en-IN", { month: "short" }),
      monthLong: cursor.toLocaleDateString("en-IN", { month: "long" }),
      count: dayCountMap.get(key) ?? 0,
      intensity: "none",
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const counts = days.map((d) => d.count);
  const levels = intensityFromCounts(counts);
  return days.map((d, i) => ({ ...d, intensity: levels[i]! }));
}

function buildWeekBarsInRange(
  rangeStart: Date,
  rangeEnd: Date,
  leads: ApiLead[],
): InsightsWeekBarPoint[] {
  const buckets = buildRangeWeekBuckets(
    {
      submittedFrom: rangeStart.toISOString(),
      submittedTo: rangeEnd.toISOString(),
    },
    6,
  );
  if (buckets.length === 0) return [];

  const leadCounts = buckets.map(() => 0);
  const dayMaps = buckets.map(() => new Map<string, number>());

  for (const lead of leads) {
    const t = leadCreatedMs(lead);
    if (!Number.isFinite(t)) continue;
    const idx = buckets.findIndex((b) => t >= b.start.getTime() && t <= b.end.getTime());
    if (idx < 0) continue;
    leadCounts[idx]! += 1;
    const dayKey = toDateKey(new Date(t));
    const map = dayMaps[idx]!;
    map.set(dayKey, (map.get(dayKey) ?? 0) + 1);
  }

  const weekLevels = intensityFromCounts(leadCounts);
  return buckets.map((b, i) => ({
    weekIndex: i,
    shortLabel: `W${i + 1}`,
    rangeLabel: b.label,
    count: leadCounts[i] ?? 0,
    intensity: weekLevels[i]!,
    days: buildDaysForWeek(b, dayMaps[i]!),
  }));
}

function resolveChartWindow(
  leads: ApiLead[],
  range: InsightsDateRange,
): { from: Date; to: Date } | null {
  const fromMs = range.submittedFrom ? Date.parse(range.submittedFrom) : NaN;
  const toMs = range.submittedTo ? Date.parse(range.submittedTo) : NaN;

  if (Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs >= fromMs) {
    return { from: startOfLocalDay(new Date(fromMs)), to: endOfLocalDay(new Date(toMs)) };
  }

  // All time (or missing bounds): span lead activity through today.
  let minMs = Infinity;
  let maxMs = -Infinity;
  for (const lead of leads) {
    const t = leadCreatedMs(lead);
    if (!Number.isFinite(t)) continue;
    if (t < minMs) minMs = t;
    if (t > maxMs) maxMs = t;
  }
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) return null;

  const today = endOfLocalDay(new Date());
  const from = startOfLocalMonth(new Date(minMs));
  const toCandidate = endOfLocalMonth(new Date(maxMs));
  const to = toCandidate.getTime() > today.getTime() ? today : toCandidate;
  if (from.getTime() > to.getTime()) return null;
  return { from, to };
}

function buildWeekRoot(
  leads: ApiLead[],
  from: Date,
  to: Date,
): InsightsWeekCharts | null {
  const buckets = buildRangeWeekBuckets(
    {
      submittedFrom: from.toISOString(),
      submittedTo: to.toISOString(),
    },
    6,
  );
  if (buckets.length === 0) return null;

  const leadCounts = buckets.map(() => 0);
  const closedCounts = buckets.map(() => 0);
  const dayMaps = buckets.map(() => new Map<string, number>());

  for (const lead of leads) {
    const t = leadCreatedMs(lead);
    if (!Number.isFinite(t)) continue;
    if (t < from.getTime() || t > to.getTime()) continue;
    const idx = buckets.findIndex((b) => t >= b.start.getTime() && t <= b.end.getTime());
    if (idx < 0) continue;
    leadCounts[idx]! += 1;
    if (isClosedPhaseLead(lead)) closedCounts[idx]! += 1;
    const dayKey = toDateKey(new Date(t));
    const map = dayMaps[idx]!;
    map.set(dayKey, (map.get(dayKey) ?? 0) + 1);
  }

  const weekLevels = intensityFromCounts(leadCounts);
  const weekBars: InsightsWeekBarPoint[] = buckets.map((b, i) => ({
    weekIndex: i,
    shortLabel: `W${i + 1}`,
    rangeLabel: b.label,
    count: leadCounts[i] ?? 0,
    intensity: weekLevels[i]!,
    days: buildDaysForWeek(b, dayMaps[i]!),
  }));

  const leadPoints = weekBars.map((w) => ({
    label: `${w.shortLabel} · ${w.rangeLabel}`,
    count: w.count,
  }));

  const conversionPoints = buckets.map((b, i) => {
    const leadsN = leadCounts[i] ?? 0;
    const closedN = closedCounts[i] ?? 0;
    const conversionPercent =
      leadsN > 0 ? Math.round((closedN / leadsN) * 1000) / 10 : 0;
    return {
      label: `W${i + 1} · ${b.label}`,
      conversionPercent,
    };
  });

  const firstConv = conversionPoints[0]?.conversionPercent ?? 0;
  const lastConv =
    conversionPoints[conversionPoints.length - 1]?.conversionPercent ?? 0;

  return {
    rootLevel: "week",
    weekBars,
    monthBars: [],
    leadsOverTime: {
      changePercent: leadVolumeChangePercent(leadCounts),
      points: leadPoints,
    },
    conversionTrend: {
      changePercent: pctChange(firstConv, lastConv),
      points: conversionPoints,
    },
  };
}

function buildMonthRoot(
  leads: ApiLead[],
  from: Date,
  to: Date,
): InsightsWeekCharts | null {
  const months = buildMonthBuckets(from, to, 24);
  if (months.length === 0) return null;

  const scopedLeads = leads.filter((lead) => {
    const t = leadCreatedMs(lead);
    return Number.isFinite(t) && t >= from.getTime() && t <= to.getTime();
  });

  const leadCounts = months.map(() => 0);
  const closedCounts = months.map(() => 0);
  const monthWeeks: InsightsWeekBarPoint[][] = months.map((m) =>
    buildWeekBarsInRange(m.start, m.end, scopedLeads),
  );

  for (const lead of scopedLeads) {
    const t = leadCreatedMs(lead);
    const idx = months.findIndex((m) => t >= m.start.getTime() && t <= m.end.getTime());
    if (idx < 0) continue;
    leadCounts[idx]! += 1;
    if (isClosedPhaseLead(lead)) closedCounts[idx]! += 1;
  }

  const levels = intensityFromCounts(leadCounts);
  const monthBars: InsightsMonthBarPoint[] = months.map((m, i) => ({
    monthKey: m.key,
    shortLabel: m.shortLabel,
    yearLabel: m.yearLabel,
    rangeLabel: m.rangeLabel,
    count: leadCounts[i] ?? 0,
    intensity: levels[i]!,
    weeks: monthWeeks[i] ?? [],
  }));

  const leadPoints = monthBars.map((m) => ({
    label: m.rangeLabel,
    count: m.count,
  }));

  const conversionPoints = months.map((m, i) => {
    const leadsN = leadCounts[i] ?? 0;
    const closedN = closedCounts[i] ?? 0;
    const conversionPercent =
      leadsN > 0 ? Math.round((closedN / leadsN) * 1000) / 10 : 0;
    return {
      label: m.rangeLabel,
      conversionPercent,
    };
  });

  const firstConv = conversionPoints[0]?.conversionPercent ?? 0;
  const lastConv =
    conversionPoints[conversionPoints.length - 1]?.conversionPercent ?? 0;

  return {
    rootLevel: "month",
    weekBars: [],
    monthBars,
    leadsOverTime: {
      changePercent: leadVolumeChangePercent(leadCounts),
      points: leadPoints,
    },
    conversionTrend: {
      changePercent: pctChange(firstConv, lastConv),
      points: conversionPoints,
    },
  };
}

/**
 * Rebuild chart series for Insights Leads over time (week or month root).
 * Supports All time (open range derived from leads) and month / multi-month filters.
 */
export function buildInsightsWeekChartsFromLeads(
  leads: ApiLead[],
  range: InsightsDateRange,
): InsightsWeekCharts | null {
  const bundle = buildInsightsVolumeChartBundle(leads, range);
  if (!bundle) return null;
  return bundle.defaultGranularity === "week" ? bundle.week : bundle.month;
}

function buildTrailingMonthRoot(
  leads: ApiLead[],
  end: Date,
  monthCount = 6,
): InsightsWeekCharts | null {
  const to = endOfLocalDay(end);
  const from = startOfLocalMonth(
    new Date(end.getFullYear(), end.getMonth() - (monthCount - 1), 1),
  );
  return buildMonthRoot(leads, from, to);
}

/**
 * Builds week + month chart data. Short ranges expose a Week | Month toggle;
 * long ranges default to months only.
 */
export function buildInsightsVolumeChartBundle(
  leads: ApiLead[],
  range: InsightsDateRange,
): InsightsVolumeChartBundle | null {
  const window = resolveChartWindow(leads, range);
  if (!window) return null;

  const { from, to } = window;
  const spanDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  const isShortRange = spanDays <= 40;

  if (isShortRange) {
    const week = buildWeekRoot(leads, from, to);
    if (!week) return null;
    const month =
      buildTrailingMonthRoot(leads, to, 12) ??
      buildMonthRoot(leads, from, to) ??
      week;
    return {
      defaultGranularity: "week",
      showGranularityToggle: true,
      week,
      month,
    };
  }

  const month = buildMonthRoot(leads, from, to);
  if (!month) return null;
  return {
    defaultGranularity: "month",
    showGranularityToggle: false,
    week: month,
    month,
  };
}
