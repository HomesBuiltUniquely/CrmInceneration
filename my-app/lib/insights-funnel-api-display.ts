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

export function stageHasPassagesSplit(stage: InsightsSalesFunnelStage): boolean {
  return (
    stage.newCount != null ||
    stage.oldCount != null ||
    stage.newSharePercent != null ||
    stage.oldSharePercent != null
  );
}

/** Stage-to-stage % from Discovery base for one segment slice. */
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
  return Math.min(100, (displayCount / discoveryBaseCount) * 100);
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
  return Math.min(100, (closed / base) * 100);
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

  const hub = modeFunnel.conversion;
  if (hub) {
    const pickOverall =
      passagesSegment === "new" && hub.newPercent != null
        ? hub.newPercent
        : passagesSegment === "old" && hub.oldPercent != null
          ? hub.oldPercent
          : hub.overallPercent;
    return {
      baseStage: hub.baseStage || FUNNEL_CONVERSION_BASE_STAGE,
      overallPercent: pickOverall,
      newPercent: hub.newPercent ?? null,
      oldPercent: hub.oldPercent ?? null,
      fromHub: true,
    };
  }

  return {
    baseStage: FUNNEL_CONVERSION_BASE_STAGE,
    overallPercent: computeDiscoveryToClosedPercent(stages, passagesSegment),
    newPercent: computeDiscoveryToClosedPercent(stages, "new"),
    oldPercent: computeDiscoveryToClosedPercent(stages, "old"),
    fromHub: false,
  };
}

export type BuildApiFunnelDisplayOpts = {
  modeFunnel: InsightsSalesFunnelResponse;
  funnelMode: InsightsFunnelMode;
  passagesSegment: PassagesAgeSegment;
  /** Cohort path tab — hide Fresh Lead when not All. Passages always hides Fresh Lead. */
  pathFilter: "all" | "won" | "lost" | "hold";
};

/**
 * Build display rows for Passages / Cohort Hub modes.
 * Applies segment counts, Discovery-based conversion %, and preserves Total unchanged.
 */
export function buildApiModeFunnelDisplay(
  opts: BuildApiFunnelDisplayOpts,
): ApiFunnelDisplayStage[] {
  const { modeFunnel, funnelMode, passagesSegment, pathFilter } = opts;
  const rawStages = (modeFunnel.stages?.length
    ? modeFunnel.stages
    : modeFunnel.salesFunnel) ?? [];

  const withoutTotal = rawStages.filter(
    (s) => resolveFunnelCanonicalKey(s.stageKey || s.stageLabel) !== "total",
  );

  const milestones =
    funnelMode === "passages"
      ? withoutTotal.filter(
          (s) =>
            resolveFunnelCanonicalKey(s.stageKey || s.stageLabel) !== "fresh_lead",
        )
      : pathFilter === "all"
        ? withoutTotal
        : withoutTotal.filter(
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

  const totalStage: ApiFunnelDisplayStage = {
    ...(totalFromApi ?? {
      stageKey: "total",
      stageLabel: "Total",
      count:
        modeFunnel.total?.count != null && modeFunnel.total.count > 0
          ? modeFunnel.total.count
          : withoutTotal.reduce((s, x) => s + (Number(x.count) || 0), 0),
      countLabel: modeFunnel.total?.countLabel || "Leads",
      value: 0,
      conversionPercent: 100,
      sharePercent: 100,
    }),
    displayCount:
      totalFromApi?.count ??
      (modeFunnel.total?.count != null && modeFunnel.total.count > 0
        ? modeFunnel.total.count
        : withoutTotal.reduce((s, x) => s + (Number(x.count) || 0), 0)),
    conversionFromDiscovery: 100,
  };

  const milestoneRows: ApiFunnelDisplayStage[] = milestones.map((stage) => {
    const key = resolveFunnelCanonicalKey(stage.stageKey || stage.stageLabel);
    const displayCount =
      funnelMode === "passages"
        ? passagesSegmentCount(stage, segment)
        : Number(stage.count ?? 0);
    const conversionFromDiscovery = conversionPercentFromDiscovery(
      key,
      displayCount,
      discoveryBase,
    );

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

/** Sum Passages new/old entry counts across milestones (excludes synthetic Total). */
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
    if (key === "total") continue;
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
