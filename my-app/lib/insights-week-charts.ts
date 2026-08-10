/**
 * Leads-over-time / conversion-trend buckets **only for the selected Insights date range**.
 * Hub may return WEEK 1…N for a wider window; this rebuilds W1…Wk from lead `createdAt`
 * inside `dateFrom`–`dateTo` (e.g. current calendar month → ~4–5 weeks) with day breakdown.
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

export type InsightsWeekCharts = {
  leadsOverTime: InsightsDashboard["leadsOverTime"];
  conversionTrend: InsightsDashboard["conversionTrend"];
  /** Rich week series for iOS-style drill-down (only when FE rebuild runs). */
  weekBars: InsightsWeekBarPoint[];
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
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
 * Badge for incomplete months: ignore trailing empty weeks (future days still 0)
 * so we don't show −100% when W5 is simply not reached yet.
 */
function leadVolumeChangePercent(counts: number[]): number | null {
  if (counts.length === 0) return null;
  let lastIdx = counts.length - 1;
  while (lastIdx > 0 && (counts[lastIdx] ?? 0) === 0) lastIdx -= 1;
  if (lastIdx === 0) return 0;
  // Prefer adjacent completed weeks (last vs previous) for readable trend.
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

/**
 * Rebuild chart series for a **bounded** Insights window (month / short custom).
 * Returns null for open-ended (All time) or long ranges — keep Hub month series.
 */
export function buildInsightsWeekChartsFromLeads(
  leads: ApiLead[],
  range: InsightsDateRange,
): InsightsWeekCharts | null {
  const fromMs = range.submittedFrom ? Date.parse(range.submittedFrom) : NaN;
  const toMs = range.submittedTo ? Date.parse(range.submittedTo) : NaN;
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) {
    return null;
  }
  // Only for ~month-length windows (avoids truncating 3m/6m/1y Hub series at 6 weeks).
  const spanDays = (toMs - fromMs) / (24 * 60 * 60 * 1000);
  if (spanDays > 40) return null;

  const buckets = buildRangeWeekBuckets(range, 6);
  if (buckets.length === 0) return null;

  const leadCounts = buckets.map(() => 0);
  const closedCounts = buckets.map(() => 0);
  const dayMaps = buckets.map(() => new Map<string, number>());

  for (const lead of leads) {
    const t = leadCreatedMs(lead);
    if (!Number.isFinite(t)) continue;
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
    leadsOverTime: {
      changePercent: leadVolumeChangePercent(leadCounts),
      points: leadPoints,
    },
    conversionTrend: {
      changePercent: pctChange(firstConv, lastConv),
      points: conversionPoints,
    },
    weekBars,
  };
}
