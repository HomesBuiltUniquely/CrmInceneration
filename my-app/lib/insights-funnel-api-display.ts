import type {
  InsightsFunnelMode,
  InsightsPassagesTrendPoint,
  InsightsPassagesTrendResponse,
  InsightsSalesFunnelResponse,
  InsightsSalesFunnelStage,
} from "@/lib/crm-insights-api";
import {
  isPassagesTrendWeekPoint,
  oldSharePercentFromPassagesCounts,
} from "@/lib/crm-insights-api";
import { buildRangeWeekBuckets } from "@/lib/insights-week-charts";
import { resolveFunnelCanonicalKey } from "@/lib/insights-funnel-stage-paths";

/** Passages only — which lead-age slice to show on stage bars. */
export type PassagesAgeSegment = "all" | "new" | "old";

/** Conversion % chain starts here (Fresh Lead excluded). */
export const FUNNEL_CONVERSION_BASE_STAGE = "discovery";

export type ApiFunnelDisplayStage = InsightsSalesFunnelStage & {
  displayCount: number;
  /** Discovery→stage conversion for active segment; null for Fresh Lead / Total. */
  conversionFromDiscovery: number | null;
};

export type DiscoveryToClosedSummary = {
  baseStage: string;
  overallPercent: number;
  newPercent: number | null;
  oldPercent: number | null;
  /** True when Hub sent `conversion` block. */
  fromHub: boolean;
};

function stageByKey(
  stages: InsightsSalesFunnelStage[],
): Map<string, InsightsSalesFunnelStage> {
  const map = new Map<string, InsightsSalesFunnelStage>();
  for (const s of stages) {
    const key = resolveFunnelCanonicalKey(s.stageKey || s.stageLabel);
    if (!map.has(key)) map.set(key, s);
  }
  return map;
}

export function passagesSegmentCount(
  stage: InsightsSalesFunnelStage,
  segment: PassagesAgeSegment,
): number {
  if (segment === "new") {
    return Number(stage.newCount ?? 0);
  }
  if (segment === "old") {
    return Number(stage.oldCount ?? 0);
  }
  return Number(stage.count ?? 0);
}

/**
 * Distinct Total count for Passages All | New | Old.
 * New/Old require Hub total.newCount / total.oldCount — never fall back to All.count.
 */
export function passagesSegmentTotalCount(
  modeFunnel: InsightsSalesFunnelResponse,
  totalStage: InsightsSalesFunnelStage | undefined,
  segment: PassagesAgeSegment,
): number | null {
  const hubTotal = modeFunnel.total;
  if (segment === "new") {
    if (hubTotal?.newCount != null) return Number(hubTotal.newCount);
    if (totalStage?.newCount != null) return Number(totalStage.newCount);
    return null;
  }
  if (segment === "old") {
    if (hubTotal?.oldCount != null) return Number(hubTotal.oldCount);
    if (totalStage?.oldCount != null) return Number(totalStage.oldCount);
    return null;
  }
  if (hubTotal?.count != null && Number(hubTotal.count) > 0) {
    return Number(hubTotal.count);
  }
  if (totalStage?.count != null) return Number(totalStage.count);
  return null;
}

/** Hub segment conversion % (may exceed 100). Null → Fresh Lead "—". */
export function passagesSegmentConversionPercent(
  stage: InsightsSalesFunnelStage,
  segment: PassagesAgeSegment,
  stageKey: string,
  discoverySegmentCount: number,
): number | null {
  const key = resolveFunnelCanonicalKey(stageKey);
  if (key === "fresh_lead") return null;
  if (key === "total" || key === FUNNEL_CONVERSION_BASE_STAGE) {
    return discoverySegmentCount > 0 ? 100 : 0;
  }
  if (segment === "new" && stage.newConversionPercent != null) {
    return Number(stage.newConversionPercent);
  }
  if (segment === "old" && stage.oldConversionPercent != null) {
    return Number(stage.oldConversionPercent);
  }
  if (segment === "all" && stage.conversionPercent != null) {
    return Number(stage.conversionPercent);
  }
  // FE fallback — no clamp (Old mid-funnel can exceed Discovery-in-window).
  return conversionPercentFromDiscovery(
    key,
    passagesSegmentCount(stage, segment),
    discoverySegmentCount,
  );
}

export function stageHasPassagesSplit(stage: InsightsSalesFunnelStage): boolean {
  return (
    stage.newCount != null ||
    stage.oldCount != null ||
    stage.newSharePercent != null ||
    stage.oldSharePercent != null
  );
}

/** Stage-to-stage % from Discovery base — do NOT clamp at 100. */
export function conversionPercentFromDiscovery(
  stageKey: string,
  displayCount: number,
  discoveryBaseCount: number,
): number | null {
  const key = resolveFunnelCanonicalKey(stageKey);
  if (key === "total") return 100;
  if (key === "fresh_lead") return null;
  if (key === FUNNEL_CONVERSION_BASE_STAGE) {
    return discoveryBaseCount > 0 ? 100 : 0;
  }
  if (discoveryBaseCount <= 0) return 0;
  return (displayCount / discoveryBaseCount) * 100;
}

function discoveryCountForSegment(
  byKey: Map<string, InsightsSalesFunnelStage>,
  segment: PassagesAgeSegment,
): number {
  const discovery = byKey.get(FUNNEL_CONVERSION_BASE_STAGE);
  if (!discovery) return 0;
  return passagesSegmentCount(discovery, segment);
}

function closedCountForSegment(
  byKey: Map<string, InsightsSalesFunnelStage>,
  segment: PassagesAgeSegment,
): number {
  const closed = byKey.get("closed");
  if (!closed) return 0;
  return passagesSegmentCount(closed, segment);
}

/** Discovery → Closed % for one segment (FE fallback when Hub omits `conversion`). */
export function computeDiscoveryToClosedPercent(
  stages: InsightsSalesFunnelStage[],
  segment: PassagesAgeSegment,
): number {
  const byKey = stageByKey(stages);
  const base = discoveryCountForSegment(byKey, segment);
  const closed = closedCountForSegment(byKey, segment);
  if (base <= 0) return 0;
  return (closed / base) * 100;
}

export function resolveDiscoveryToClosedSummary(
  modeFunnel: InsightsSalesFunnelResponse | null | undefined,
  passagesSegment: PassagesAgeSegment,
): DiscoveryToClosedSummary | null {
  if (!modeFunnel) return null;
  const stages = modeFunnel.stages?.length
    ? modeFunnel.stages
    : modeFunnel.salesFunnel ?? [];
  if (stages.length === 0) return null;

  const feNew = computeDiscoveryToClosedPercent(stages, "new");
  const feOld = computeDiscoveryToClosedPercent(stages, "old");
  const feOverall = computeDiscoveryToClosedPercent(stages, passagesSegment);
  const byKey = stageByKey(stages);
  const discovery = byKey.get(FUNNEL_CONVERSION_BASE_STAGE);
  const discoveryNew = discovery ? passagesSegmentCount(discovery, "new") : 0;
  const discoveryOld = discovery ? passagesSegmentCount(discovery, "old") : 0;

  const hub = modeFunnel.conversion;
  if (hub) {
    const pickOverall =
      passagesSegment === "new" && hub.newPercent != null
        ? hub.newPercent
        : passagesSegment === "old" && hub.oldPercent != null
          ? hub.oldPercent
          : hub.overallPercent;

    // Prefer Hub; override 0/null when stage new/old counts imply a real rate.
    const newPercent =
      hub.newPercent != null &&
      !(hub.newPercent === 0 && feNew > 0 && discoveryNew > 0)
        ? hub.newPercent
        : discoveryNew > 0 || feNew > 0
          ? feNew
          : (hub.newPercent ?? null);
    const oldPercent =
      hub.oldPercent != null &&
      !(hub.oldPercent === 0 && feOld > 0 && discoveryOld > 0)
        ? hub.oldPercent
        : discoveryOld > 0 || feOld > 0
          ? feOld
          : (hub.oldPercent ?? null);

    return {
      baseStage: hub.baseStage || FUNNEL_CONVERSION_BASE_STAGE,
      overallPercent: pickOverall,
      newPercent,
      oldPercent,
      fromHub: true,
    };
  }

  return {
    baseStage: FUNNEL_CONVERSION_BASE_STAGE,
    overallPercent: feOverall,
    newPercent: feNew,
    oldPercent: feOld,
    fromHub: false,
  };
}

/** New vs Old share of Movement volume — prefer Hub conversion.movementNew/Old. */
export function resolvePassagesEntryShareSummary(
  modeFunnel: InsightsSalesFunnelResponse | null | undefined,
): {
  newCount: number;
  oldCount: number;
  newSharePercent: number;
  oldSharePercent: number;
} | null {
  if (!modeFunnel) return null;
  const hubNew = modeFunnel.conversion?.movementNew;
  const hubOld = modeFunnel.conversion?.movementOld;
  const agg = aggregatePassagesNewOldFromFunnel(modeFunnel);
  const newCount =
    hubNew != null && Number.isFinite(Number(hubNew))
      ? Number(hubNew)
      : agg.newCount;
  const oldCount =
    hubOld != null && Number.isFinite(Number(hubOld))
      ? Number(hubOld)
      : agg.oldCount;
  if (newCount + oldCount <= 0) return null;
  const total = newCount + oldCount;
  return {
    newCount,
    oldCount,
    newSharePercent: (newCount / total) * 100,
    oldSharePercent: (oldCount / total) * 100,
  };
}

export type BuildApiFunnelDisplayOpts = {
  modeFunnel: InsightsSalesFunnelResponse;
  funnelMode: InsightsFunnelMode;
  passagesSegment: PassagesAgeSegment;
  /** Passages: always hide Fresh Lead. Cohort: hide Fresh Lead (Hub omits; FE strips if present). */
  pathFilter: "all" | "won" | "lost" | "hold";
};

/**
 * Build display rows for Passages / Cohort Hub modes.
 * Fresh Lead omitted. Passages Total / % follow All|New|Old segment.
 */
export function buildApiModeFunnelDisplay(
  opts: BuildApiFunnelDisplayOpts,
): ApiFunnelDisplayStage[] {
  const { modeFunnel, funnelMode, passagesSegment } = opts;
  const rawStages = (modeFunnel.stages?.length
    ? modeFunnel.stages
    : modeFunnel.salesFunnel) ?? [];

  const withoutTotal = rawStages.filter(
    (s) => resolveFunnelCanonicalKey(s.stageKey || s.stageLabel) !== "total",
  );

  const milestones = withoutTotal.filter(
    (s) =>
      resolveFunnelCanonicalKey(s.stageKey || s.stageLabel) !== "fresh_lead",
  );

  const byKey = stageByKey(milestones);
  const segment: PassagesAgeSegment =
    funnelMode === "passages" ? passagesSegment : "all";
  const discoveryBase = discoveryCountForSegment(byKey, segment);

  const totalFromApi = rawStages.find(
    (s) => resolveFunnelCanonicalKey(s.stageKey || s.stageLabel) === "total",
  );

  const cohortTotalFallback =
    modeFunnel.total?.count != null && modeFunnel.total.count > 0
      ? modeFunnel.total.count
      : withoutTotal.reduce((s, x) => s + (Number(x.count) || 0), 0);

  let hubTotalCount: number;
  if (funnelMode === "passages") {
    const segmentTotal = passagesSegmentTotalCount(
      modeFunnel,
      totalFromApi,
      segment,
    );
    // Never leave New/Old stuck on All.count when Hub segment totals missing.
    hubTotalCount = segmentTotal != null ? segmentTotal : 0;
  } else {
    hubTotalCount =
      totalFromApi?.count ??
      (Number(cohortTotalFallback) || 0);
  }

  const totalStage: ApiFunnelDisplayStage = {
    ...(totalFromApi ?? {
      stageKey: "total",
      stageLabel: "Total",
      count: hubTotalCount,
      countLabel: modeFunnel.total?.countLabel || "Leads",
      value: 0,
      conversionPercent: 100,
      sharePercent: 100,
    }),
    count: hubTotalCount,
    displayCount: hubTotalCount,
    countLabel: modeFunnel.total?.countLabel || "Leads",
    conversionPercent: 100,
    conversionFromDiscovery: 100,
  };

  const milestoneRows: ApiFunnelDisplayStage[] = milestones.map((stage) => {
    const key = resolveFunnelCanonicalKey(stage.stageKey || stage.stageLabel);
    const displayCount =
      funnelMode === "passages"
        ? passagesSegmentCount(stage, segment)
        : Number(stage.count ?? 0);
    const conversionFromDiscovery =
      funnelMode === "passages"
        ? passagesSegmentConversionPercent(
            stage,
            segment,
            key,
            discoveryBase,
          )
        : conversionPercentFromDiscovery(key, displayCount, discoveryBase);

    return {
      ...stage,
      count: displayCount,
      displayCount,
      conversionPercent:
        conversionFromDiscovery != null ? conversionFromDiscovery : 0,
      conversionFromDiscovery,
    };
  });

  return [totalStage, ...milestoneRows];
}

export function passagesSplitLabel(stage: InsightsSalesFunnelStage): string | null {
  if (!stageHasPassagesSplit(stage)) return null;
  const newC = Number(stage.newCount ?? 0);
  const oldC = Number(stage.oldCount ?? 0);
  const newP = stage.newSharePercent;
  const oldP = stage.oldSharePercent;
  const newPart =
    newP != null
      ? `${newC.toLocaleString("en-IN")} new (${Math.round(newP)}%)`
      : `${newC.toLocaleString("en-IN")} new`;
  const oldPart =
    oldP != null
      ? `${oldC.toLocaleString("en-IN")} old (${Math.round(oldP)}%)`
      : `${oldC.toLocaleString("en-IN")} old`;
  return `${newPart} · ${oldPart}`;
}

function istMonthKey(d = new Date()): string {
  // Asia/Kolkata calendar month for Passages trend alignment with Hub.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

function istMonthLabel(monthKey: string): string {
  const [ys, ms] = monthKey.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthKey;
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

/** Sum Passages new/old entry counts across milestones (excludes Total + Fresh Lead). */
export function aggregatePassagesNewOldFromFunnel(
  modeFunnel: InsightsSalesFunnelResponse | null | undefined,
): { newCount: number; oldCount: number; oldSharePercent: number } {
  if (!modeFunnel) return { newCount: 0, oldCount: 0, oldSharePercent: 0 };
  const stages = (modeFunnel.stages?.length
    ? modeFunnel.stages
    : modeFunnel.salesFunnel) ?? [];
  let newCount = 0;
  let oldCount = 0;
  for (const s of stages) {
    const key = resolveFunnelCanonicalKey(s.stageKey || s.stageLabel);
    if (key === "total" || key === "fresh_lead") continue;
    newCount += Number(s.newCount ?? 0);
    oldCount += Number(s.oldCount ?? 0);
  }
  return {
    newCount,
    oldCount,
    oldSharePercent: oldSharePercentFromPassagesCounts(newCount, oldCount),
  };
}

/**
 * When Hub `passages-trend` returns empty / all-zero months, seed the current IST
 * month from the live Passages funnel (same new/old rules) so the chart isn't flat.
 */
export function enrichPassagesTrendWithLiveFunnel(
  trend: InsightsPassagesTrendResponse | null | undefined,
  modeFunnel: InsightsSalesFunnelResponse | null | undefined,
): InsightsPassagesTrendResponse | null {
  if (!trend) return null;
  const live = aggregatePassagesNewOldFromFunnel(modeFunnel);
  if (live.newCount + live.oldCount <= 0) return trend;

  const monthKey = istMonthKey();
  const points = [...(trend.points ?? [])];
  const monthPoints = points.filter((p) => !isPassagesTrendWeekPoint(p));
  const allMonthSharesZero =
    monthPoints.length === 0 ||
    monthPoints.every((p) => Number(p.oldSharePercent ?? 0) === 0 && Number(p.newCount ?? 0) + Number(p.oldCount ?? 0) === 0);

  const seed: InsightsPassagesTrendPoint = {
    period: monthKey,
    periodLabel: istMonthLabel(monthKey),
    month: monthKey,
    monthLabel: istMonthLabel(monthKey),
    newCount: live.newCount,
    oldCount: live.oldCount,
    oldSharePercent: live.oldSharePercent,
  };

  const idx = points.findIndex((p) => {
    if (isPassagesTrendWeekPoint(p)) return false;
    const key = (p.period || p.month || "").slice(0, 7);
    return key === monthKey;
  });

  if (idx >= 0) {
    const existing = points[idx]!;
    const existingTotal = Number(existing.newCount ?? 0) + Number(existing.oldCount ?? 0);
    if (existingTotal <= 0 || Number(existing.oldSharePercent ?? 0) === 0) {
      points[idx] = { ...existing, ...seed };
    }
  } else if (allMonthSharesZero || monthPoints.length === 0) {
    points.push(seed);
  } else {
    // Hub has other months with data but missing current — append.
    points.push(seed);
  }

  // Ensure trailing empty month shells so pager still shows history context.
  if (monthPoints.length === 0 && points.filter((p) => !isPassagesTrendWeekPoint(p)).length === 1) {
    for (let i = 11; i >= 1; i -= 1) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key === monthKey) continue;
      if (points.some((p) => (p.period || p.month || "").slice(0, 7) === key)) continue;
      points.unshift({
        period: key,
        periodLabel: istMonthLabel(key),
        month: key,
        monthLabel: istMonthLabel(key),
        newCount: 0,
        oldCount: 0,
        oldSharePercent: 0,
      });
    }
  }

  points.sort((a, b) => {
    if (isPassagesTrendWeekPoint(a) || isPassagesTrendWeekPoint(b)) return 0;
    return String(a.period).localeCompare(String(b.period));
  });

  return {
    ...trend,
    hubImplemented: trend.hubImplemented || live.newCount + live.oldCount > 0,
    points,
    granularity: trend.granularity ?? "month",
  };
}

/**
 * Fill missing week `rangeLabel` (e.g. "1–7 Sep") from Insights date bounds
 * so W1…W5 are identifiable when Hub only sends weekIndex.
 */
export function enrichPassagesTrendWeekRangeLabels(
  points: InsightsPassagesTrendPoint[],
  dateFrom?: string | null,
  dateTo?: string | null,
): InsightsPassagesTrendPoint[] {
  if (!dateFrom?.trim() || !dateTo?.trim() || points.length === 0) return points;
  const buckets = buildRangeWeekBuckets(
    { submittedFrom: dateFrom.trim(), submittedTo: dateTo.trim() },
    6,
  );
  if (buckets.length === 0) return points;

  return points.map((p) => {
    if (!isPassagesTrendWeekPoint(p)) return p;
    if (p.rangeLabel?.trim()) return p;
    const weekNum =
      p.weekIndex && p.weekIndex > 0
        ? p.weekIndex
        : Number((p.period.match(/^W(\d+)$/i) || [])[1] || 0);
    const bucket = weekNum > 0 ? buckets[weekNum - 1] : undefined;
    if (!bucket) return p;
    return {
      ...p,
      rangeLabel: bucket.label,
      periodLabel:
        p.periodLabel && !/^W\d+$/i.test(p.periodLabel)
          ? p.periodLabel
          : `W${weekNum} · ${bucket.label}`,
    };
  });
}
