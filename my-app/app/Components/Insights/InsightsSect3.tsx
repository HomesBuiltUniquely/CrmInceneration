"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatInsightsCount,
  formatInsightsInrCompact,
  formatInsightsPercent,
  type InsightsDashboard,
  type InsightsFunnelMode,
  type InsightsFunnelPathFilter,
  type InsightsFunnelStage,
  type InsightsSalesFunnelResponse,
  type InsightsPassagesTrendResponse,
} from "@/lib/crm-insights-api";
import { recalcFunnelConversionPercents, recalcFunnelSharePercents } from "@/lib/insights-sales-funnel-investment";
import {
  buildApiModeFunnelDisplay,
  passagesSplitLabel,
  resolveDiscoveryToClosedSummary,
  stageHasPassagesSplit,
  type PassagesAgeSegment,
} from "@/lib/insights-funnel-api-display";
import {
  funnelStageHasHoldPath,
  mergeHubHoldPathByStage,
  resolveFunnelCanonicalKey,
  type FunnelStagePathDataMap,
} from "@/lib/insights-funnel-stage-paths";
import PassagesOldShareTrendPanel from "./PassagesOldShareTrendPanel";
import InsightsSegmentedControl from "./InsightsSegmentedControl";
import type { BookingDateFilterState } from "@/lib/booking-token-date-filter";
import type { InsightsTrendGranularity } from "@/lib/crm-insights-api";

type Props = {
  salesFunnel: InsightsFunnelStage[];
  lostFunnel?: InsightsDashboard["lostFunnel"];
  holdFunnel?: InsightsDashboard["holdFunnel"];
  holdPathByStage?: InsightsDashboard["holdPathByStage"];
  totalLeadsCount?: number;
  funnelStageValues?: Record<string, number> | null;
  funnelMetricsLoading?: boolean;
  stagePathData?: FunnelStagePathDataMap;
  stagePathLoading?: boolean;
  /** When true, stage bars are current-in-milestone inventory (not pool total / cumulative). */
  useCurrentStageInventory?: boolean;
  /** Measure camera: Current | Passages | Cohort. */
  funnelMode?: InsightsFunnelMode;
  onFunnelModeChange?: (mode: InsightsFunnelMode) => void;
  /** Synced path tab (required for Hub passages/cohort). */
  pathFilter?: InsightsFunnelPathFilter;
  onPathFilterChange?: (path: InsightsFunnelPathFilter) => void;
  /** Hub response for passages / cohort (null while on current). */
  modeFunnel?: InsightsSalesFunnelResponse | null;
  modeFunnelLoading?: boolean;
  modeFunnelError?: string;
  /** Passages / Cohort — Super Admin only (preview + under construction). */
  canUseAdvancedFunnelModes?: boolean;
  /** Trailing monthly old-lead % (Passages tab only). */
  passagesTrend?: InsightsPassagesTrendResponse | null;
  passagesTrendLoading?: boolean;
  passagesTrendGranularity?: InsightsTrendGranularity;
  onPassagesTrendGranularityChange?: (value: InsightsTrendGranularity) => void;
  dateFilter?: BookingDateFilterState;
};

const FUNNEL_MODE_OPTIONS: Array<{
  id: InsightsFunnelMode;
  label: string;
  short: string;
  hint: string;
  /** Super Admin preview only until product launches. */
  previewOnly?: boolean;
}> = [
  {
    id: "current",
    label: "Current",
    short: "Now",
    hint: "Who is sitting in each stage right now (Journey heatmap).",
  },
  {
    id: "passages",
    label: "Passages",
    short: "Moved",
    hint: "Stage entries in selected dates — split by leads created in range (New) vs before (Old).",
    previewOnly: true,
  },
  {
    id: "cohort",
    label: "Cohort",
    short: "Cohort",
    hint: "Leads created in selected dates — stages reached as of today (live snapshot).",
    previewOnly: true,
  },
];

function funnelModeSubtitle(mode: InsightsFunnelMode): string {
  switch (mode) {
    case "passages":
      return "Stage entries in the selected dates — New vs Old split by lead created date";
    case "cohort":
      return "Leads created in the selected dates — milestone reach as of today";
    default:
      return "Who is in each stage right now (same as Journey heatmap)";
  }
}

const WON_FUNNEL_BAR_COLORS = [
  "bg-[#0B1220] text-white",
  "bg-[#111827] text-white",
  "bg-[#1E293B] text-white",
  "bg-[#334155] text-white",
  "bg-[#475569] text-white",
  "bg-[#64748B] text-white",
  "bg-[#94A3B8] text-gray-900",
];

const LOST_FUNNEL_BAR_COLORS = [
  "bg-[#450A0A] text-white",
  "bg-[#7F1D1D] text-white",
  "bg-[#991B1B] text-white",
  "bg-[#B91C1C] text-white",
  "bg-[#DC2626] text-white",
  "bg-[#EF4444] text-white",
  "bg-[#F87171] text-gray-950",
];

const HOLD_FUNNEL_BAR_COLORS = [
  "bg-[#78350F] text-white",
  "bg-[#92400E] text-white",
  "bg-[#B45309] text-white",
  "bg-[#D97706] text-white",
  "bg-[#F59E0B] text-gray-950",
  "bg-[#FBBF24] text-gray-950",
  "bg-[#FCD34D] text-gray-950",
];

/**
 * Perfect centered pyramid widths (equal inset both sides).
 * Strong even steps so All / Won / Lost all read as a funnel.
 */
function funnelPyramidWidthPercent(index: number, stageCount: number): number {
  if (stageCount <= 1) return 100;
  const maxW = 100;
  const minW = 52;
  const step = (maxW - minW) / (stageCount - 1);
  return Math.round((maxW - index * step) * 10) / 10;
}

type SubstageItem = {
  title: string;
  count: number;
};

function SubstageList({
  items,
  pathTone,
  loading,
}: {
  items: SubstageItem[];
  pathTone: "won" | "lost" | "hold";
  loading?: boolean;
}) {
  const sorted = useMemo(() => [...items].sort((a, b) => b.count - a.count), [items]);
  const hasLeads = sorted.some((s) => s.count > 0);
  const topAccent =
    pathTone === "won"
      ? "border-emerald-300/80 bg-gradient-to-br from-emerald-50 to-white shadow-[0_10px_28px_rgba(16,185,129,0.14)] ring-1 ring-emerald-200/80"
      : pathTone === "hold"
        ? "border-amber-300/80 bg-gradient-to-br from-amber-50 to-white shadow-[0_10px_28px_rgba(245,158,11,0.14)] ring-1 ring-amber-200/80"
        : "border-red-300/80 bg-gradient-to-br from-red-50 to-white shadow-[0_10px_28px_rgba(239,68,68,0.12)] ring-1 ring-red-200/80";
  const topBadge =
    pathTone === "won"
      ? "bg-emerald-100 text-emerald-700"
      : pathTone === "hold"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-700";

  if (loading) {
    return (
      <div className="space-y-2.5" aria-busy="true" aria-label="Loading substages">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-xl border border-gray-100 bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    );
  }

  // True empty = no substage catalog; all-zero still lists rows so user sees path structure
  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-xs font-medium text-gray-500">
        No leads on this path yet
      </div>
    );
  }

  if (!hasLeads) {
    return (
      <div className="space-y-2.5">
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-4 text-center text-xs font-medium text-gray-500">
          No leads on this path yet
        </div>
        {sorted.map((item) => (
          <div
            key={item.title}
            className="flex items-center justify-between rounded-xl border border-gray-100 bg-white/80 p-3 opacity-70"
          >
            <span className="truncate text-xs font-semibold text-gray-600">{item.title}</span>
            <span className="ml-3 shrink-0 text-xs font-bold tabular-nums text-gray-400">
              0 leads
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {sorted.map((item, idx) => {
        const isTop = idx === 0 && item.count > 0;
        const delayMs = isTop ? 80 : 120 + idx * 45;

        return (
          <div
            key={item.title}
            style={{ animationDelay: `${delayMs}ms` }}
            className={`flex items-center justify-between rounded-xl border p-3.5 transition-[box-shadow,transform] duration-300 ease-out ${
              isTop
                ? `insights-substage-row-top ${topAccent}`
                : "insights-substage-row border-gray-200/90 bg-white/90 hover:border-gray-300 hover:shadow-sm"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={`truncate text-xs font-semibold ${isTop ? "text-gray-900" : "text-gray-700"}`}
              >
                {item.title}
              </span>
              {isTop ? (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${topBadge}`}
                >
                  Top
                </span>
              ) : null}
            </div>
            <span className="ml-3 shrink-0 text-xs font-bold tabular-nums text-gray-900">
              {formatInsightsCount(item.count)}{" "}
              <span className="font-medium text-gray-500">
                {item.count === 1 ? "lead" : "leads"}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SubstageModal({
  stageLabel,
  funnelTab,
  wonSubstages,
  lostSubstages,
  holdSubstages,
  loading,
  onClose,
}: {
  stageLabel: string;
  funnelTab: "all" | "won" | "lost" | "hold";
  wonSubstages: SubstageItem[];
  lostSubstages: SubstageItem[];
  holdSubstages: SubstageItem[];
  loading?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const showWon = funnelTab === "all" || funnelTab === "won";
  const showLost = funnelTab === "all" || funnelTab === "lost";
  const showHold = funnelTab === "all" || funnelTab === "hold";

  const pathFilterLabel =
    funnelTab === "all"
      ? "All paths"
      : funnelTab === "won"
        ? "Won path"
        : funnelTab === "hold"
          ? "On Hold path"
          : "Lost path";

  const pathFilterClass =
    funnelTab === "won"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200/80"
      : funnelTab === "lost"
        ? "bg-red-50 text-red-700 ring-red-200/80"
        : funnelTab === "hold"
          ? "bg-amber-50 text-amber-800 ring-amber-200/80"
          : "bg-slate-100 text-slate-700 ring-slate-200/80";

  return (
    <div
      className="insights-funnel-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="insights-funnel-modal relative max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.22)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="funnel-substage-title"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-800 via-indigo-500 to-emerald-400" />

        <div className="max-h-[85vh] overflow-y-auto p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h3 id="funnel-substage-title" className="text-lg font-bold text-gray-900">
                {stageLabel}
              </h3>
              <p className="mt-1 text-sm text-gray-500">Substage breakdown</p>
              <span
                className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${pathFilterClass}`}
              >
                {pathFilterLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-gray-400 transition-all duration-200 hover:rotate-90 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {showWon ? (
              <div>
                {funnelTab === "all" ? (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                      Won path substages
                    </h4>
                  </div>
                ) : null}
                <SubstageList items={wonSubstages} pathTone="won" loading={loading} />
              </div>
            ) : null}

            {showLost ? (
              <div>
                {funnelTab === "all" ? (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                      Lost path substages
                    </h4>
                  </div>
                ) : null}
                <SubstageList items={lostSubstages} pathTone="lost" loading={loading} />
              </div>
            ) : null}

            {showHold ? (
              <div>
                {funnelTab === "all" ? (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                      On Hold substages
                    </h4>
                  </div>
                ) : null}
                <SubstageList items={holdSubstages} pathTone="hold" loading={loading} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InsightSect3({
  salesFunnel,
  lostFunnel,
  holdFunnel,
  holdPathByStage,
  totalLeadsCount,
  funnelStageValues,
  funnelMetricsLoading,
  stagePathData: stagePathDataProp = {},
  stagePathLoading = false,
  useCurrentStageInventory = false,
  funnelMode = "current",
  onFunnelModeChange,
  pathFilter: pathFilterProp,
  onPathFilterChange,
  modeFunnel = null,
  modeFunnelLoading = false,
  modeFunnelError = "",
  canUseAdvancedFunnelModes = false,
  passagesTrend = null,
  passagesTrendLoading = false,
  passagesTrendGranularity = "month",
  onPassagesTrendGranularityChange,
  dateFilter,
}: Props) {
  const [funnelTab, setFunnelTab] = useState<"all" | "won" | "lost" | "hold">(
    pathFilterProp ?? "all",
  );
  const [passagesAgeSegment, setPassagesAgeSegment] =
    useState<PassagesAgeSegment>("all");
  const [passagesTrendPanelOpen, setPassagesTrendPanelOpen] = useState(false);
  const [selectedStagePopup, setSelectedStagePopup] = useState<string | null>(null);

  const visibleFunnelModes = useMemo(
    () =>
      FUNNEL_MODE_OPTIONS.filter(
        (opt) => !opt.previewOnly || canUseAdvancedFunnelModes,
      ),
    [canUseAdvancedFunnelModes],
  );

  const funnelModeSegments = useMemo(
    () =>
      visibleFunnelModes.map((opt) => ({
        id: opt.id,
        label: opt.label,
        shortLabel: opt.short,
        title: opt.previewOnly
          ? `${opt.hint} (Under construction — Super Admin preview)`
          : opt.hint,
        badge: opt.previewOnly ? "WIP" : undefined,
      })),
    [visibleFunnelModes],
  );

  const passagesAgeSegments = useMemo(
    () =>
      (["all", "new", "old"] as const).map((seg) => ({
        id: seg,
        label: seg === "all" ? "All" : seg.charAt(0).toUpperCase() + seg.slice(1),
        activeClassName:
          seg === "new"
            ? "bg-emerald-600 shadow-sm"
            : seg === "old"
              ? "bg-slate-700 shadow-sm"
              : "bg-slate-900 shadow-sm",
      })),
    [],
  );

  const pathFilterSegments = useMemo(
    () =>
      (["all", "won", "lost", "hold"] as const).map((tab) => ({
        id: tab,
        label:
          tab === "all"
            ? "All"
            : tab === "won"
              ? "Won"
              : tab === "hold"
                ? "Hold"
                : "Lost",
        activeClassName:
          tab === "won"
            ? "bg-emerald-600 shadow-sm"
            : tab === "lost"
              ? "bg-red-600 shadow-sm"
              : tab === "hold"
                ? "bg-amber-500 shadow-sm"
                : "bg-slate-900 shadow-sm",
        inactiveTextClassName:
          tab === "won"
            ? "text-slate-600 hover:text-emerald-700"
            : tab === "lost"
              ? "text-slate-600 hover:text-red-700"
              : tab === "hold"
                ? "text-slate-600 hover:text-amber-800"
                : "text-slate-600 hover:text-slate-900",
      })),
    [],
  );

  const isApiMode =
    canUseAdvancedFunnelModes &&
    (funnelMode === "passages" || funnelMode === "cohort");
  const isPassagesMode = funnelMode === "passages";
  const showPassagesTrendGranularityToggle =
    dateFilter?.preset === "currentMonth" ||
    dateFilter?.preset === "previousMonth";
  const isCohortMode = funnelMode === "cohort";
  /** Won/Lost/Hold tabs — Current inventory only. */
  const showPathTabs = !isApiMode;
  const showUnderConstruction =
    canUseAdvancedFunnelModes &&
    (funnelMode === "passages" || funnelMode === "cohort");

  useEffect(() => {
    if (pathFilterProp && pathFilterProp !== funnelTab) {
      setFunnelTab(pathFilterProp);
    }
  }, [pathFilterProp, funnelTab]);

  useEffect(() => {
    if (isPassagesMode && funnelTab !== "all") {
      setFunnelTab("all");
      onPathFilterChange?.("all");
    }
  }, [isPassagesMode, funnelTab, onPathFilterChange]);

  useEffect(() => {
    if (isCohortMode && funnelTab !== "all") {
      setFunnelTab("all");
      onPathFilterChange?.("all");
    }
  }, [isCohortMode, funnelTab, onPathFilterChange]);

  useEffect(() => {
    if (!isPassagesMode) {
      setPassagesTrendPanelOpen(false);
    }
  }, [isPassagesMode]);

  useEffect(() => {
    if (!isPassagesMode && passagesAgeSegment !== "all") {
      setPassagesAgeSegment("all");
    }
  }, [isPassagesMode, passagesAgeSegment]);

  const setPathTab = (tab: "all" | "won" | "lost" | "hold") => {
    setFunnelTab(tab);
    setSelectedStagePopup(null);
    onPathFilterChange?.(tab);
  };

  /** Hub holdPathByStage wins over client Hold heuristics. */
  const stagePathData = useMemo(
    () => mergeHubHoldPathByStage(stagePathDataProp, holdPathByStage),
    [stagePathDataProp, holdPathByStage],
  );

  const apiRawStageByKey = useMemo(() => {
    const map: Record<string, InsightsSalesFunnelResponse["stages"][number]> = {};
    if (!modeFunnel) return map;
    for (const s of modeFunnel.stages ?? modeFunnel.salesFunnel ?? []) {
      const k = resolveFunnelCanonicalKey(s.stageKey || s.stageLabel);
      if (!map[k]) map[k] = s;
    }
    return map;
  }, [modeFunnel]);

  const apiDisplayFunnel = useMemo(() => {
    if (!isApiMode || !modeFunnel) return [];
    return buildApiModeFunnelDisplay({
      modeFunnel,
      funnelMode,
      passagesSegment: passagesAgeSegment,
      pathFilter: funnelTab,
    });
  }, [
    isApiMode,
    modeFunnel,
    funnelMode,
    passagesAgeSegment,
    funnelTab,
  ]);

  const discoveryConversionSummary = useMemo(
    () => resolveDiscoveryToClosedSummary(modeFunnel, passagesAgeSegment),
    [modeFunnel, passagesAgeSegment],
  );

  const apiPathBreakdownByKey = useMemo(() => {
    const map: Record<string, { won: number; lost: number; hold: number }> = {};
    if (!modeFunnel) return map;
    for (const s of modeFunnel.stages ?? modeFunnel.salesFunnel ?? []) {
      const k = resolveFunnelCanonicalKey(s.stageKey || s.stageLabel);
      if (s.pathBreakdown) map[k] = s.pathBreakdown;
    }
    return map;
  }, [modeFunnel]);

  const fullSalesFunnel = useMemo(() => {
    if (isApiMode) {
      return apiDisplayFunnel.map((s) => ({
        stageKey: s.stageKey,
        stageLabel: s.stageLabel,
        count: s.displayCount,
        countLabel: s.countLabel,
        value: s.value,
        conversionPercent: s.conversionPercent,
      }));
    }

    // Authoritative inventory: never replace Fresh Lead with pool total
    if (useCurrentStageInventory && salesFunnel.length > 0) {
      return salesFunnel;
    }

    // Hub fallback only — do NOT inject totalLeadsCount as Fresh Lead
    const hasFresh = salesFunnel.some((s) => {
      const k = (s.stageKey || s.stageLabel).toLowerCase();
      return k.includes("fresh") || k.includes("new lead") || k.includes("received");
    });
    if (hasFresh) return salesFunnel;

    return salesFunnel;
  }, [salesFunnel, useCurrentStageInventory, isApiMode, apiDisplayFunnel]);

  const activeSalesFunnel = useMemo(() => {
    if (isApiMode) return fullSalesFunnel;

    const withCounts = fullSalesFunnel.map((stage) => {
      const key = stage.stageKey || stage.stageLabel;
      let count = stage.count;

      let value = stage.value;
      if (funnelStageValues && !funnelMetricsLoading) {
        const override =
          funnelStageValues[key] ??
          funnelStageValues[stage.stageLabel] ??
          funnelStageValues[resolveFunnelCanonicalKey(key)];
        if (override != null) value = override;
      }

      return { ...stage, count, value };
    });

    return useCurrentStageInventory
      ? recalcFunnelSharePercents(withCounts)
      : recalcFunnelConversionPercents(withCounts);
  }, [
    fullSalesFunnel,
    funnelMetricsLoading,
    funnelStageValues,
    useCurrentStageInventory,
    isApiMode,
  ]);

  const lostStages = lostFunnel?.stages ?? [];
  const hasAlignedLostStages = lostStages.some((s) => {
    const k = resolveFunnelCanonicalKey(s.stageKey || s.stageLabel);
    return k !== "fresh_lead" && k !== "total";
  });

  const holdStages = holdFunnel?.stages ?? [];
  const hasHubHoldFunnel = holdStages.length > 0;

  const lostCountByStageKey = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of lostStages) {
      const k = resolveFunnelCanonicalKey(s.stageKey || s.stageLabel);
      map[k] = s.count;
    }
    return map;
  }, [lostStages]);

  const holdCountByStageKey = useMemo(() => {
    const map: Record<string, number> = {};
    if (hasHubHoldFunnel) {
      for (const s of holdStages) {
        const k = resolveFunnelCanonicalKey(s.stageKey || s.stageLabel);
        map[k] = s.count;
      }
      return map;
    }
    for (const [key, path] of Object.entries(stagePathData)) {
      map[key] = path.holdTotal ?? 0;
    }
    return map;
  }, [hasHubHoldFunnel, holdStages, stagePathData]);

  const holdShareByStageKey = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of holdStages) {
      const k = resolveFunnelCanonicalKey(s.stageKey || s.stageLabel);
      map[k] = Number(s.sharePercent) || 0;
    }
    return map;
  }, [holdStages]);

  const wonSegmentTotal = useMemo(() => {
    let sum = 0;
    for (const stage of activeSalesFunnel) {
      const key = resolveFunnelCanonicalKey(stage.stageKey || stage.stageLabel);
      if (key === "fresh_lead" || key === "total") continue;
      const path = stagePathData[key];
      const lost = lostCountByStageKey[key] ?? path?.lostTotal ?? 0;
      const won = path?.wonTotal ?? Math.max(0, stage.count - lost);
      sum += won;
    }
    return sum;
  }, [activeSalesFunnel, stagePathData, lostCountByStageKey]);

  const wonSegmentValue = useMemo(() => {
    let sum = 0;
    for (const stage of activeSalesFunnel) {
      const key = resolveFunnelCanonicalKey(stage.stageKey || stage.stageLabel);
      if (key === "fresh_lead" || key === "total") continue;
      const path = stagePathData[key];
      const lost = lostCountByStageKey[key] ?? path?.lostTotal ?? 0;
      const won = path?.wonTotal ?? Math.max(0, stage.count - lost);
      if (won <= 0 || stage.count <= 0) continue;
      // Approximate won investment share from current stage inventory value
      sum += (Number(stage.value) || 0) * (won / stage.count);
    }
    return sum;
  }, [activeSalesFunnel, stagePathData, lostCountByStageKey]);

  const holdSegmentTotal = useMemo(() => {
    if (holdFunnel?.total != null && Number.isFinite(holdFunnel.total) && hasHubHoldFunnel) {
      return holdFunnel.total;
    }
    return Object.values(holdCountByStageKey).reduce((sum, n) => sum + (Number(n) || 0), 0);
  }, [holdFunnel?.total, hasHubHoldFunnel, holdCountByStageKey]);

  /**
   * Display funnel:
   * - Total bar always (All / Won / Lost / Hold)
   * - Fresh Lead bar only on All (hidden on Won / Lost / Hold)
   * - Won Total = sum of won-path stage counts
   * - Lost Total = sum of Lost Segment stage counts
   * - Hold Total = Hub holdFunnel (prefer) or mapped On Hold path
   */
  const displaySalesFunnel = useMemo(() => {
    const isSyntheticTotalStage = (s: InsightsFunnelStage) =>
      resolveFunnelCanonicalKey(s.stageKey || s.stageLabel) === "total";

    // Passages / cohort: Hub already path-filtered + returned share %.
    // Deduplicate by canonical key so React keys stay unique (Hub may send Total twice).
    if (isApiMode) {
      const seen = new Set<string>();
      return activeSalesFunnel.filter((s) => {
        const key = resolveFunnelCanonicalKey(s.stageKey || s.stageLabel);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Hold tab: Hub catalog-gated stages only when holdFunnel is present.
    // Always strip Hub's own Total — we prepend a single synthetic Total bar below.
    const milestoneStages: InsightsFunnelStage[] =
      funnelTab === "hold" && hasHubHoldFunnel
        ? holdStages
            .filter((s) => resolveFunnelCanonicalKey(s.stageKey || s.stageLabel) !== "total")
            .map((s) => ({
              stageKey: s.stageKey,
              stageLabel: s.stageLabel,
              count: s.count,
              countLabel: "On Hold",
              value: 0,
              conversionPercent: Number(s.sharePercent) || 0,
            }))
        : funnelTab === "hold"
          ? activeSalesFunnel.filter((s) => {
              const key = resolveFunnelCanonicalKey(s.stageKey || s.stageLabel);
              if (key === "fresh_lead" || key === "total") return false;
              return funnelStageHasHoldPath(stagePathData[key]);
            })
          : activeSalesFunnel.filter((s) => {
              const key = resolveFunnelCanonicalKey(s.stageKey || s.stageLabel);
              if (key === "total") return false;
              if (funnelTab !== "all" && key === "fresh_lead") return false;
              return true;
            });

    const inventoryStages = activeSalesFunnel.filter((s) => !isSyntheticTotalStage(s));
    const poolTotal =
      totalLeadsCount != null && totalLeadsCount > 0
        ? totalLeadsCount
        : inventoryStages.reduce((sum, s) => sum + (Number(s.count) || 0), 0);

    const lostSegmentTotal =
      lostFunnel?.total != null && lostFunnel.total > 0
        ? lostFunnel.total
        : (lostFunnel?.stages ?? []).reduce((sum, s) => sum + (Number(s.count) || 0), 0);

    // Current-in-stage: sum is the pool. Cumulative roll-up: first stage already ≈ full value.
    const poolValue = useCurrentStageInventory
      ? inventoryStages.reduce((sum, s) => sum + (Number(s.value) || 0), 0)
      : Number(inventoryStages[0]?.value ?? 0) ||
        inventoryStages.reduce((sum, s) => sum + (Number(s.value) || 0), 0);

    let totalCount = poolTotal;
    let totalValue = poolValue;
    let countLabel = "Leads";
    if (funnelTab === "won") {
      totalCount = wonSegmentTotal;
      totalValue = wonSegmentValue;
      countLabel = "Won Leads";
    } else if (funnelTab === "lost") {
      totalCount = lostSegmentTotal;
      countLabel = "Lost Leads";
    } else if (funnelTab === "hold") {
      totalCount = holdSegmentTotal;
      countLabel = "On Hold Leads";
    }

    const totalStage: InsightsFunnelStage = {
      stageKey: "total",
      stageLabel: "Total",
      count: totalCount,
      countLabel,
      value: totalValue,
      conversionPercent: 100,
    };

    // Hub Hold bars already carry sharePercent — don't recompute from sales inventory.
    if (funnelTab === "hold" && hasHubHoldFunnel) {
      return [totalStage, ...milestoneStages];
    }

    // Percents for milestone bars stay based on inventory (exclude Total from recalculation)
    const withPercents = useCurrentStageInventory
      ? recalcFunnelSharePercents(milestoneStages)
      : recalcFunnelConversionPercents(milestoneStages);

    return [totalStage, ...withPercents];
  }, [
    activeSalesFunnel,
    funnelTab,
    hasHubHoldFunnel,
    holdCountByStageKey,
    holdSegmentTotal,
    holdStages,
    isApiMode,
    lostFunnel?.stages,
    lostFunnel?.total,
    stagePathData,
    totalLeadsCount,
    useCurrentStageInventory,
    wonSegmentTotal,
    wonSegmentValue,
  ]);

  const activeStagePopupDetails = useMemo(() => {
    if (!selectedStagePopup) return null;
    const stage = displaySalesFunnel.find(
      (s) => resolveFunnelCanonicalKey(s.stageKey || s.stageLabel) === selectedStagePopup,
    );
    const label = stage ? stage.stageLabel : selectedStagePopup;
    const path = stagePathData[selectedStagePopup];
    return {
      stageLabel: label,
      wonSubstages: path?.wonSubstages ?? [],
      lostSubstages: path?.lostSubstages ?? [],
      holdSubstages: path?.holdSubstages ?? [],
    };
  }, [selectedStagePopup, displaySalesFunnel, stagePathData]);

  return (
    <main className="mt-6 px-4">
      <div className="mx-auto max-w-[1300px]">
        <div className="w-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-md sm:p-5">
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Sales Funnel
                </h2>
                <p
                  key={funnelMode}
                  className="mt-0.5 text-xs text-slate-500 animate-in fade-in slide-in-from-bottom-1 duration-300"
                >
                  {funnelModeSubtitle(funnelMode)}
                </p>
              </div>

              {canUseAdvancedFunnelModes ? (
                <InsightsSegmentedControl
                  ariaLabel="Funnel measure mode"
                  segments={funnelModeSegments}
                  value={funnelMode}
                  onChange={(id) => {
                    onFunnelModeChange?.(id as InsightsFunnelMode);
                    if (id !== "passages") {
                      setPassagesAgeSegment("all");
                    }
                    setSelectedStagePopup(null);
                  }}
                  className="self-start shadow-sm"
                />
              ) : null}
            </div>

            {showUnderConstruction ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
                <span className="rounded-md bg-amber-400/90 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-950">
                  Under construction
                </span>
                <span className="font-medium text-amber-800/90">
                  Super Admin preview — you can use {funnelMode === "passages" ? "Passages" : "Cohort"} now; not launched for other roles yet.
                </span>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <p className="max-w-xl text-[11px] font-medium leading-snug text-slate-400">
                {FUNNEL_MODE_OPTIONS.find((o) => o.id === funnelMode)?.hint}
              </p>
              <div className="flex flex-wrap items-center gap-2">
              {isPassagesMode ? (
                <>
                <InsightsSegmentedControl
                  ariaLabel="Passages lead age"
                  segments={passagesAgeSegments}
                  value={passagesAgeSegment}
                  onChange={(id) => setPassagesAgeSegment(id as PassagesAgeSegment)}
                />
                <button
                  type="button"
                  aria-label="Old lead share trend"
                  aria-pressed={passagesTrendPanelOpen}
                  title="Old lead share trend"
                  onClick={() => setPassagesTrendPanelOpen((o) => !o)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-[1.04] active:scale-[0.96] ${
                    passagesTrendPanelOpen
                      ? "border-slate-900 bg-slate-900 text-white shadow-md ring-2 ring-slate-900/20"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow-sm"
                  }`}
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden>
                    <path d="M3 14l4-5 3 3 7-8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                </>
              ) : null}
              {showPathTabs ? (
                <InsightsSegmentedControl
                  ariaLabel="Funnel path filter"
                  segments={pathFilterSegments}
                  value={funnelTab}
                  onChange={(id) => setPathTab(id as InsightsFunnelPathFilter)}
                />
              ) : null}
              </div>
            </div>
          </div>

          {isApiMode && modeFunnelLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm font-medium text-slate-500">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              Loading {funnelMode === "passages" ? "passages" : "cohort"} funnel…
            </div>
          ) : isApiMode && modeFunnelError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {modeFunnelError}
            </div>
          ) : isApiMode &&
            funnelMode === "passages" &&
            modeFunnel &&
            modeFunnel.passagesAvailable === false ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <p className="font-bold">Passages not available yet</p>
              <p className="mt-1 text-xs font-medium text-amber-800/90">
                {modeFunnel.passagesUnavailableReason ||
                  "Stage transition history is empty for this scope. Current and Cohort modes still work."}
              </p>
            </div>
          ) : displaySalesFunnel.length === 0 ? (
            <p className="text-sm text-gray-500">No funnel data for this filter.</p>
          ) : (
            <div
              className={`mx-auto flex w-full max-w-[1300px] overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                isPassagesMode && passagesTrendPanelOpen
                  ? "flex-row items-stretch gap-0"
                  : "flex-col"
              }`}
            >
              <div
                className={`min-w-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                  isPassagesMode && passagesTrendPanelOpen
                    ? "w-[56%] shrink-0 border-r border-slate-100 pr-4"
                    : "w-full"
                }`}
              >
            <div className="relative mx-auto max-w-5xl pt-1">
              {isApiMode && discoveryConversionSummary ? (
                <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 px-3 py-2.5 sm:col-span-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                      Discovery → Closed
                      {isPassagesMode && passagesAgeSegment !== "all"
                        ? ` (${passagesAgeSegment})`
                        : ""}
                    </p>
                    <p className="mt-0.5 text-xl font-bold tabular-nums text-indigo-950">
                      {formatInsightsPercent(discoveryConversionSummary.overallPercent, 1)}
                    </p>
                    <p className="text-[10px] text-indigo-700/80">
                      From {discoveryConversionSummary.baseStage} base
                      {discoveryConversionSummary.fromHub
                        ? ""
                        : " · estimated locally (Hub conversion block missing)"}
                    </p>
                  </div>
                  {isPassagesMode &&
                  discoveryConversionSummary.newPercent != null &&
                  discoveryConversionSummary.oldPercent != null ? (
                    <>
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                          New leads
                        </p>
                        <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-900">
                          {formatInsightsPercent(discoveryConversionSummary.newPercent, 1)}
                        </p>
                        <p className="text-[10px] text-emerald-800/80">Created inside date range</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Old leads
                        </p>
                        <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">
                          {formatInsightsPercent(discoveryConversionSummary.oldPercent, 1)}
                        </p>
                        <p className="text-[10px] text-slate-600">Created before range, moved in period</p>
                      </div>
                    </>
                  ) : isCohortMode && modeFunnel?.cohortProgress ? (
                    <>
                      <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                          In progress
                        </p>
                        <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-950">
                          {formatInsightsCount(modeFunnel.cohortProgress.inProgressCount ?? 0)}
                          {modeFunnel.cohortProgress.inProgressPercent != null
                            ? ` · ${formatInsightsPercent(modeFunnel.cohortProgress.inProgressPercent, 0)}`
                            : ""}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Final outcome
                        </p>
                        <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">
                          {formatInsightsCount(modeFunnel.cohortProgress.finalOutcomeCount ?? 0)}
                          {modeFunnel.cohortProgress.finalOutcomePercent != null
                            ? ` · ${formatInsightsPercent(modeFunnel.cohortProgress.finalOutcomePercent, 0)}`
                            : ""}
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {selectedStagePopup ? (
                <div
                  className="pointer-events-none absolute inset-0 z-10 rounded-xl bg-slate-900/[0.04] backdrop-blur-[1px] transition-opacity duration-300"
                  aria-hidden
                />
              ) : null}

              <div className="relative w-full space-y-1.5">
                {displaySalesFunnel.map((stage, index) => {
                  const canonicalKey = resolveFunnelCanonicalKey(stage.stageKey || stage.stageLabel);
                  const isTotal = canonicalKey === "total";
                  const isFreshLead = canonicalKey === "fresh_lead";
                  const isClosedWonStage = canonicalKey === "closed";
                  const pathBreakdown = stagePathData[canonicalKey];

                  const lostCount = hasAlignedLostStages
                    ? (lostCountByStageKey[canonicalKey] ?? 0)
                    : (lostCountByStageKey[canonicalKey] ?? pathBreakdown?.lostTotal ?? 0);
                  const holdCount = hasHubHoldFunnel
                    ? (holdCountByStageKey[canonicalKey] ?? 0)
                    : (holdCountByStageKey[canonicalKey] ?? pathBreakdown?.holdTotal ?? 0);
                  const apiBd = apiPathBreakdownByKey[canonicalKey];
                  const wonCount = apiBd
                    ? apiBd.won
                    : (pathBreakdown?.wonTotal ?? Math.max(0, stage.count - lostCount));
                  const badgeLost = apiBd ? apiBd.lost : lostCount;
                  const badgeHold = apiBd ? apiBd.hold : holdCount;

                  // API modes are already path-filtered — use Hub count as-is.
                  let displayCount = stage.count;
                  if (!isApiMode && !isTotal) {
                    if (funnelTab === "won") displayCount = wonCount;
                    else if (funnelTab === "lost") displayCount = lostCount;
                    else if (funnelTab === "hold") displayCount = holdCount;
                  }

                  const useLostStyle = funnelTab === "lost";
                  const useHoldStyle = funnelTab === "hold";
                  const palette = useLostStyle
                    ? LOST_FUNNEL_BAR_COLORS
                    : useHoldStyle
                      ? HOLD_FUNNEL_BAR_COLORS
                      : WON_FUNNEL_BAR_COLORS;
                  let barColor =
                    palette[Math.min(index, palette.length - 1)] ?? palette[palette.length - 1]!;
                  if (isClosedWonStage && !useLostStyle && !useHoldStyle) {
                    barColor = "bg-[#22C55E] text-gray-950";
                  }

                  const widthPct = funnelPyramidWidthPercent(index, displaySalesFunnel.length);
                  const sideInsetPct = (100 - widthPct) / 2;

                  const displayLabel = isClosedWonStage ? "Closed" : stage.stageLabel;

                  let countText = `${formatInsightsCount(displayCount)} ${stage.countLabel || "Leads"}`;
                  if (isTotal) {
                    countText =
                      funnelTab === "lost"
                        ? `${formatInsightsCount(displayCount)} Lost Leads`
                        : funnelTab === "won"
                          ? `${formatInsightsCount(displayCount)} Won Leads`
                          : funnelTab === "hold"
                            ? `${formatInsightsCount(displayCount)} On Hold Leads`
                            : `${formatInsightsCount(displayCount)} Leads`;
                  } else if (isClosedWonStage && funnelTab !== "lost" && funnelTab !== "hold") {
                    countText = `${formatInsightsCount(displayCount)} Leads`;
                  } else if (funnelTab === "lost") {
                    countText = `${formatInsightsCount(displayCount)} Lost Leads`;
                  } else if (funnelTab === "hold") {
                    countText = `${formatInsightsCount(displayCount)} On Hold`;
                  }

                  const stageValue =
                    !isApiMode && funnelTab === "won" && !isTotal && stage.count > 0
                      ? (Number(stage.value) || 0) * (wonCount / stage.count)
                      : stage.value;
                  const isPopupOpen = selectedStagePopup === canonicalKey;
                  const isClickable = !isApiMode && !isFreshLead && !isTotal;
                  const isDimmed = Boolean(selectedStagePopup) && !isPopupOpen;

                  const showPathBadge =
                    showPathTabs && funnelTab === "all" && !isFreshLead && !isTotal;

                  const wonLostBadgeClass = isClosedWonStage
                    ? "inline-flex h-4 max-w-[10rem] items-center truncate rounded bg-black/15 px-1 text-[8px] font-semibold whitespace-nowrap text-gray-950 sm:max-w-none sm:px-1.5 sm:text-[9px]"
                    : "inline-flex h-4 max-w-[10rem] items-center truncate rounded bg-white/20 px-1 text-[8px] font-semibold whitespace-nowrap text-white/90 sm:max-w-none sm:px-1.5 sm:text-[9px]";

                  const rawApiStage = apiRawStageByKey[canonicalKey];
                  const passagesSplit =
                    isPassagesMode &&
                    passagesAgeSegment === "all" &&
                    !isTotal &&
                    rawApiStage &&
                    stageHasPassagesSplit(rawApiStage)
                      ? passagesSplitLabel(rawApiStage)
                      : null;

                  const percentLabel = isTotal
                    ? formatInsightsPercent(100)
                    : isApiMode && isFreshLead
                      ? "—"
                      : isApiMode
                      ? formatInsightsPercent(stage.conversionPercent)
                      : funnelTab === "lost"
                      ? `${formatInsightsPercent(
                          lostStages.find(
                            (s) =>
                              resolveFunnelCanonicalKey(s.stageKey || s.stageLabel) ===
                              canonicalKey,
                          )?.dropPercent ?? 0,
                          0,
                        )} Drop`
                      : funnelTab === "won"
                        ? formatInsightsPercent(
                            wonSegmentTotal > 0 ? (wonCount / wonSegmentTotal) * 100 : 0,
                          )
                        : funnelTab === "hold"
                          ? formatInsightsPercent(
                              holdShareByStageKey[canonicalKey] ??
                                (holdSegmentTotal > 0
                                  ? (holdCount / holdSegmentTotal) * 100
                                  : 0),
                              0,
                            )
                          : formatInsightsPercent(stage.conversionPercent);

                  const metricsText =
                    !isApiMode &&
                    funnelTab !== "lost" &&
                    funnelTab !== "hold" &&
                    !isTotal &&
                    !isFreshLead
                      ? `${countText} | ${
                          funnelMetricsLoading ? "…" : formatInsightsInrCompact(stageValue)
                        }`
                      : countText;

                  return (
                    <div key={`${canonicalKey}-${index}`} className="w-full">
                    <div
                      className={`flex w-full items-stretch transition-all duration-500 ease-out ${
                        isDimmed ? "scale-[0.985] opacity-45 blur-[0.3px]" : "opacity-100"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div
                          className="transition-[padding] duration-500 ease-out"
                          style={{
                            paddingLeft: `${sideInsetPct}%`,
                            paddingRight: `${sideInsetPct}%`,
                          }}
                        >
                          <div
                            onClick={
                              isClickable
                                ? () => setSelectedStagePopup(isPopupOpen ? null : canonicalKey)
                                : undefined
                            }
                            title={isClickable ? "Click to view substage breakdown" : undefined}
                            className={`flex h-11 w-full items-center gap-1.5 px-2.5 sm:h-12 sm:gap-2 sm:px-3.5 ${barColor} rounded-lg shadow-xs transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:z-10 hover:-translate-y-0.5 hover:scale-[1.008] hover:shadow-[0_8px_20px_rgba(15,23,42,0.18)] ${
                              isClickable ? "cursor-pointer active:scale-[0.995]" : "cursor-default"
                            } ${
                              isPopupOpen
                                ? "insights-funnel-bar-lift z-10 shadow-[0_12px_28px_rgba(15,23,42,0.22)] ring-2 ring-white/35"
                                : ""
                            }`}
                          >
                            <span className="w-[4.75rem] shrink-0 truncate text-left text-[10px] font-semibold sm:w-[6rem] sm:text-xs">
                              {displayLabel}
                            </span>
                            <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
                              <span className="text-right text-[10px] font-bold whitespace-nowrap tabular-nums sm:text-xs">
                                {metricsText}
                              </span>
                              {showPathBadge ? (
                                <span className={wonLostBadgeClass} title={`${wonCount} won · ${badgeLost} lost · ${badgeHold} hold`}>
                                  {formatInsightsCount(wonCount)} won ·{" "}
                                  {formatInsightsCount(badgeLost)} lost ·{" "}
                                  {formatInsightsCount(badgeHold)} hold
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                      <span
                        className={`flex w-[3.25rem] shrink-0 items-center justify-end text-right text-[10px] font-bold whitespace-nowrap tabular-nums sm:w-[4rem] sm:text-xs transition-opacity duration-300 ${
                          isDimmed ? "text-gray-400" : "text-gray-700"
                        }`}
                      >
                        {percentLabel}
                      </span>
                    </div>
                  {passagesSplit ? (
                    <p
                      className="truncate px-2 text-[9px] font-medium text-slate-500 sm:px-3"
                      style={{
                        paddingLeft: `calc(${sideInsetPct}% + 0.5rem)`,
                        paddingRight: `calc(${sideInsetPct}% + 0.5rem)`,
                      }}
                    >
                      {passagesSplit}
                    </p>
                  ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
              </div>

              {isPassagesMode && passagesTrendPanelOpen ? (
                <div className="w-[44%] min-w-0 shrink-0 pl-2 animate-in fade-in slide-in-from-right-3 duration-500">
                  <PassagesOldShareTrendPanel
                    points={passagesTrend?.points ?? []}
                    loading={passagesTrendLoading}
                    hubImplemented={passagesTrend?.hubImplemented ?? false}
                    granularity={passagesTrendGranularity}
                    onGranularityChange={onPassagesTrendGranularityChange}
                    showGranularityToggle={showPassagesTrendGranularityToggle}
                    onClose={() => setPassagesTrendPanelOpen(false)}
                  />
                </div>
              ) : null}
            </div>
          )}

          {selectedStagePopup && activeStagePopupDetails ? (
            <SubstageModal
              stageLabel={activeStagePopupDetails.stageLabel}
              funnelTab={funnelTab}
              wonSubstages={activeStagePopupDetails.wonSubstages}
              lostSubstages={activeStagePopupDetails.lostSubstages}
              holdSubstages={activeStagePopupDetails.holdSubstages}
              loading={stagePathLoading}
              onClose={() => setSelectedStagePopup(null)}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}
