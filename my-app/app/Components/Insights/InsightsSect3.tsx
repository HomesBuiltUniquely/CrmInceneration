"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatInsightsCount,
  formatInsightsInrCompact,
  formatInsightsPercent,
  type InsightsDashboard,
  type InsightsFunnelStage,
} from "@/lib/crm-insights-api";
import type { TokenMetricsData } from "./InsightSect2";
import { recalcFunnelConversionPercents, recalcFunnelSharePercents } from "@/lib/insights-sales-funnel-investment";
import {
  resolveFunnelCanonicalKey,
  type FunnelStagePathDataMap,
} from "@/lib/insights-funnel-stage-paths";

type Props = {
  salesFunnel: InsightsFunnelStage[];
  lostFunnel?: InsightsDashboard["lostFunnel"];
  revenueDistribution: InsightsDashboard["revenueDistribution"];
  totalLeadsCount?: number;
  tokenMetrics?: TokenMetricsData;
  quotationCount?: number;
  quotationValue?: number | null;
  quotationMetricsLoading?: boolean;
  funnelStageValues?: Record<string, number> | null;
  funnelMetricsLoading?: boolean;
  stagePathData?: FunnelStagePathDataMap;
  stagePathLoading?: boolean;
  /** When true, stage bars are current-in-milestone inventory (not pool total / cumulative). */
  useCurrentStageInventory?: boolean;
};

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

const PHASE_COLORS = ["bg-[#111827]", "bg-[#334155]", "bg-[#64748B]", "bg-[#22E574]"];

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
  pathTone: "won" | "lost";
  loading?: boolean;
}) {
  const sorted = useMemo(() => [...items].sort((a, b) => b.count - a.count), [items]);
  const hasLeads = sorted.some((s) => s.count > 0);
  const topAccent =
    pathTone === "won"
      ? "border-emerald-300/80 bg-gradient-to-br from-emerald-50 to-white shadow-[0_10px_28px_rgba(16,185,129,0.14)] ring-1 ring-emerald-200/80"
      : "border-red-300/80 bg-gradient-to-br from-red-50 to-white shadow-[0_10px_28px_rgba(239,68,68,0.12)] ring-1 ring-red-200/80";
  const topBadge =
    pathTone === "won"
      ? "bg-emerald-100 text-emerald-700"
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
  loading,
  onClose,
}: {
  stageLabel: string;
  funnelTab: "all" | "won" | "lost";
  wonSubstages: SubstageItem[];
  lostSubstages: SubstageItem[];
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

  const pathFilterLabel =
    funnelTab === "all" ? "All paths" : funnelTab === "won" ? "Won path" : "Lost path";

  const pathFilterClass =
    funnelTab === "won"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200/80"
      : funnelTab === "lost"
        ? "bg-red-50 text-red-700 ring-red-200/80"
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InsightSect3({
  salesFunnel,
  lostFunnel,
  revenueDistribution,
  totalLeadsCount,
  tokenMetrics,
  quotationCount,
  quotationValue,
  quotationMetricsLoading,
  funnelStageValues,
  funnelMetricsLoading,
  stagePathData = {},
  stagePathLoading = false,
  useCurrentStageInventory = false,
}: Props) {
  const [funnelTab, setFunnelTab] = useState<"all" | "won" | "lost">("all");
  const [selectedStagePopup, setSelectedStagePopup] = useState<string | null>(null);

  const fullSalesFunnel = useMemo(() => {
    // Authoritative inventory: never replace Fresh Lead with pool total
    if (useCurrentStageInventory && salesFunnel.length > 0) {
      return salesFunnel;
    }

    // Hub fallback only — do NOT inject totalLeadsCount as Fresh Lead
    // (Fresh Lead is a milestone stage inventory, not all leads)
    const hasFresh = salesFunnel.some((s) => {
      const k = (s.stageKey || s.stageLabel).toLowerCase();
      return k.includes("fresh") || k.includes("new lead") || k.includes("received");
    });
    if (hasFresh) return salesFunnel;

    // If Hub omits Fresh Lead stage, leave stages as-is (no synthetic total-as-fresh)
    return salesFunnel;
  }, [salesFunnel, useCurrentStageInventory]);

  const activeSalesFunnel = useMemo(() => {
    const withCounts = fullSalesFunnel.map((stage) => {
      const key = stage.stageKey || stage.stageLabel;
      let count = stage.count;

      // Closed inventory already comes from milestone counts when aligned —
      // do not inflate with bookingCount (that caused 133 vs heatmap 128)

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
  ]);

  const lostStages = lostFunnel?.stages ?? [];

  const lostCountByStageKey = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of lostStages) {
      const k = resolveFunnelCanonicalKey(s.stageKey || s.stageLabel);
      map[k] = s.count;
    }
    return map;
  }, [lostStages]);

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

  /**
   * Display funnel:
   * - Total bar always (All / Won / Lost)
   * - Fresh Lead bar only on All (hidden on Won / Lost)
   * - Won Total = sum of won-path stage counts
   * - Lost Total = sum of Lost Segment stage counts
   */
  const displaySalesFunnel = useMemo(() => {
    const milestoneStages =
      funnelTab === "all"
        ? activeSalesFunnel
        : activeSalesFunnel.filter(
            (s) => resolveFunnelCanonicalKey(s.stageKey || s.stageLabel) !== "fresh_lead",
          );

    const poolTotal =
      totalLeadsCount != null && totalLeadsCount > 0
        ? totalLeadsCount
        : activeSalesFunnel.reduce((sum, s) => sum + (Number(s.count) || 0), 0);

    const lostSegmentTotal =
      lostFunnel?.total != null && lostFunnel.total > 0
        ? lostFunnel.total
        : (lostFunnel?.stages ?? []).reduce((sum, s) => sum + (Number(s.count) || 0), 0);

    // Current-in-stage: sum is the pool. Cumulative roll-up: first stage already ≈ full value.
    const poolValue = useCurrentStageInventory
      ? activeSalesFunnel.reduce((sum, s) => sum + (Number(s.value) || 0), 0)
      : Number(activeSalesFunnel[0]?.value ?? 0) ||
        activeSalesFunnel.reduce((sum, s) => sum + (Number(s.value) || 0), 0);

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
    }

    const totalStage: InsightsFunnelStage = {
      stageKey: "total",
      stageLabel: "Total",
      count: totalCount,
      countLabel,
      value: totalValue,
      conversionPercent: 100,
    };

    // Percents for milestone bars stay based on inventory (exclude Total from recalculation)
    const withPercents = useCurrentStageInventory
      ? recalcFunnelSharePercents(milestoneStages)
      : recalcFunnelConversionPercents(milestoneStages);

    return [totalStage, ...withPercents];
  }, [
    activeSalesFunnel,
    funnelTab,
    lostFunnel?.stages,
    lostFunnel?.total,
    totalLeadsCount,
    useCurrentStageInventory,
    wonSegmentTotal,
    wonSegmentValue,
  ]);

  const phasesWithOverrides = revenueDistribution.phases.map((phase) => {
    const key = (phase.phaseKey || phase.phaseLabel).toLowerCase();
    const isDesign = key.includes("design");
    const isQuotation = key.includes("quotation") || key.includes("proposal");

    let subtext: string | undefined = undefined;
    let val = phase.value;

    if (isDesign) {
      if (tokenMetrics?.bookingValue && tokenMetrics.bookingValue > 0) {
        val = tokenMetrics.bookingValue;
      }
      if (tokenMetrics?.bookingCount != null) {
        subtext = `${tokenMetrics.bookingCount} Booked Leads`;
      }
    } else if (isQuotation) {
      if (quotationValue != null && !quotationMetricsLoading) {
        val = quotationValue;
      }
      if (quotationCount != null) {
        subtext = `${formatInsightsCount(quotationCount)} Quote Sent Leads`;
      }
    }

    return {
      ...phase,
      value: val,
      subtext,
    };
  });

  const totalPhaseValue = phasesWithOverrides.reduce((sum, p) => sum + p.value, 0);

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
    };
  }, [selectedStagePopup, displaySalesFunnel, stagePathData]);

  return (
    <main className="mt-10 px-4">
      <div className="mx-auto flex max-w-[1300px] flex-col gap-8 lg:flex-row">
        {/* Sales Funnel Efficiency */}
        <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:w-[68%]">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Sales Funnel Efficiency</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Current leads in each milestone stage (same as Journey heatmap)
              </p>
            </div>

            <div className="flex items-center gap-1 self-start rounded-lg border border-gray-200 bg-gray-100 p-0.5 sm:self-auto">
              {(["all", "won", "lost"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setFunnelTab(tab);
                    setSelectedStagePopup(null);
                  }}
                  className={`min-w-[4.75rem] cursor-pointer rounded-md px-3 py-1.5 text-center text-xs font-semibold transition-all duration-200 ease-out ${
                    funnelTab === tab
                      ? tab === "won"
                        ? "bg-emerald-600 font-bold text-white shadow-xs hover:bg-emerald-500 hover:shadow-md hover:brightness-110"
                        : tab === "lost"
                          ? "bg-red-600 font-bold text-white shadow-xs hover:bg-red-500 hover:shadow-md hover:brightness-110"
                          : "bg-slate-900 font-bold text-white shadow-xs hover:bg-slate-800 hover:shadow-md hover:brightness-110"
                      : tab === "won"
                        ? "text-gray-600 hover:bg-emerald-100 hover:text-emerald-700 hover:shadow-xs"
                        : tab === "lost"
                          ? "text-gray-600 hover:bg-red-100 hover:text-red-700 hover:shadow-xs"
                          : "text-gray-600 hover:bg-slate-200 hover:text-slate-900 hover:shadow-xs"
                  }`}
                >
                  {tab === "all" ? "All" : tab === "won" ? "Won" : "Lost"}
                </button>
              ))}
            </div>
          </div>

          {displaySalesFunnel.length === 0 ? (
            <p className="text-sm text-gray-500">No funnel data for this filter.</p>
          ) : (
            <div className="relative">
              {selectedStagePopup ? (
                <div
                  className="pointer-events-none absolute inset-0 z-10 rounded-xl bg-slate-900/[0.04] backdrop-blur-[1px] transition-opacity duration-300"
                  aria-hidden
                />
              ) : null}

              <div className="relative w-full space-y-2.5">
                {displaySalesFunnel.map((stage, index) => {
                  const canonicalKey = resolveFunnelCanonicalKey(stage.stageKey || stage.stageLabel);
                  const isTotal = canonicalKey === "total";
                  const isFreshLead = canonicalKey === "fresh_lead";
                  const isClosedWonStage = canonicalKey === "closed";
                  const pathBreakdown = stagePathData[canonicalKey];

                  const lostCount =
                    lostCountByStageKey[canonicalKey] ?? pathBreakdown?.lostTotal ?? 0;
                  const wonCount = pathBreakdown?.wonTotal ?? Math.max(0, stage.count - lostCount);

                  let displayCount = stage.count;
                  if (!isTotal) {
                    if (funnelTab === "won") displayCount = wonCount;
                    else if (funnelTab === "lost") displayCount = lostCount;
                  }

                  const useLostStyle = funnelTab === "lost";
                  const palette = useLostStyle ? LOST_FUNNEL_BAR_COLORS : WON_FUNNEL_BAR_COLORS;
                  let barColor =
                    palette[Math.min(index, palette.length - 1)] ?? palette[palette.length - 1]!;
                  if (isClosedWonStage && !useLostStyle) {
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
                          : `${formatInsightsCount(displayCount)} Leads`;
                  } else if (isClosedWonStage && funnelTab !== "lost") {
                    countText = `${formatInsightsCount(displayCount)} Leads`;
                  } else if (funnelTab === "lost") {
                    countText = `${formatInsightsCount(displayCount)} Lost Leads`;
                  }

                  const stageValue =
                    funnelTab === "won" && !isTotal && stage.count > 0
                      ? (Number(stage.value) || 0) * (wonCount / stage.count)
                      : stage.value;
                  const isPopupOpen = selectedStagePopup === canonicalKey;
                  const isClickable = !isFreshLead && !isTotal;
                  const isDimmed = Boolean(selectedStagePopup) && !isPopupOpen;

                  const showWonLostBadge =
                    funnelTab === "all" && !isFreshLead && !isTotal;

                  const wonLostBadgeClass = isClosedWonStage
                    ? "inline-flex h-5 items-center rounded-md bg-black/15 px-1.5 text-[9px] font-semibold whitespace-nowrap text-gray-950 sm:h-6 sm:px-2 sm:text-[10px]"
                    : "inline-flex h-5 items-center rounded-md bg-white/20 px-1.5 text-[9px] font-semibold whitespace-nowrap text-white/90 sm:h-6 sm:px-2 sm:text-[10px]";

                  const percentLabel = isTotal
                    ? formatInsightsPercent(100)
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
                        : formatInsightsPercent(stage.conversionPercent);

                  const metricsText =
                    funnelTab !== "lost" && !isTotal && !isFreshLead
                      ? `${countText} | ${
                          funnelMetricsLoading ? "…" : formatInsightsInrCompact(stageValue)
                        }`
                      : countText;

                  return (
                    <div
                      key={stage.stageKey || stage.stageLabel}
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
                            className={`flex h-12 w-full items-center gap-2 px-2.5 sm:h-14 sm:gap-3 sm:px-4 ${barColor} rounded-xl shadow-xs transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:z-10 hover:-translate-y-1.5 hover:scale-[1.015] hover:shadow-[0_14px_32px_rgba(15,23,42,0.22)] ${
                              isClickable ? "cursor-pointer active:scale-[0.995]" : "cursor-default"
                            } ${
                              isPopupOpen
                                ? "insights-funnel-bar-lift z-10 shadow-[0_18px_40px_rgba(15,23,42,0.28)] ring-2 ring-white/35"
                                : ""
                            }`}
                          >
                            <span className="w-[5.5rem] shrink-0 truncate text-left text-[11px] font-semibold sm:w-[7rem] sm:text-sm">
                              {displayLabel}
                            </span>
                            <div className="ml-auto flex min-w-0 items-center justify-end gap-2 sm:gap-2.5">
                              <span className="text-right text-[11px] font-bold whitespace-nowrap tabular-nums sm:text-sm">
                                {metricsText}
                              </span>
                              {showWonLostBadge ? (
                                <span className={wonLostBadgeClass}>
                                  {formatInsightsCount(wonCount)} won ·{" "}
                                  {formatInsightsCount(lostCount)} lost
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                      <span
                        className={`flex w-[3.75rem] shrink-0 items-center justify-end text-right text-[11px] font-bold whitespace-nowrap tabular-nums sm:w-[5rem] sm:text-sm transition-opacity duration-300 ${
                          isDimmed ? "text-gray-400" : "text-gray-700"
                        }`}
                      >
                        {percentLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedStagePopup && activeStagePopupDetails ? (
            <SubstageModal
              stageLabel={activeStagePopupDetails.stageLabel}
              funnelTab={funnelTab}
              wonSubstages={activeStagePopupDetails.wonSubstages}
              lostSubstages={activeStagePopupDetails.lostSubstages}
              loading={stagePathLoading}
              onClose={() => setSelectedStagePopup(null)}
            />
          ) : null}
        </div>

        {/* Revenue Distribution */}
        <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:w-[32%]">
          <h2 className="mb-2 text-xl font-bold text-gray-900">Revenue Distribution</h2>
          <p className="mb-6 text-xs text-gray-500">Booking value in design phase & quotation breakdown</p>

          {phasesWithOverrides.length === 0 ? (
            <p className="text-sm text-gray-500">No revenue phase data.</p>
          ) : (
            <div className="space-y-7">
              {phasesWithOverrides.map((phase, index) => {
                const calcPercent =
                  totalPhaseValue > 0
                    ? Math.min(100, Math.round((phase.value / totalPhaseValue) * 100))
                    : phase.percent;
                const phaseKey = (phase.phaseKey || phase.phaseLabel).toLowerCase();
                const isQuotationPhase =
                  phaseKey.includes("quotation") || phaseKey.includes("proposal");

                return (
                  <div key={phase.phaseKey || phase.phaseLabel}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                          {phase.phaseLabel}
                        </span>
                        {phase.subtext ? (
                          <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                            {phase.subtext}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-xs font-bold text-gray-900 sm:text-sm">
                        {quotationMetricsLoading && isQuotationPhase ? (
                          <span className="text-gray-400">Loading…</span>
                        ) : (
                          formatInsightsInrCompact(phase.value)
                        )}{" "}
                        <span className="text-xs font-normal text-gray-400">
                          ({formatInsightsPercent(calcPercent, 0)})
                        </span>
                      </span>
                    </div>
                    <div className="h-3.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-3.5 rounded-full ${PHASE_COLORS[index % PHASE_COLORS.length]} transition-all duration-300`}
                        style={{
                          width: `${Math.min(100, Math.max(0, calcPercent))}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {revenueDistribution.observation ? (
            <div className="mt-8 rounded-r-xl border-l-4 border-[#22E574] bg-emerald-50/80 p-4">
              <p className="text-xs font-medium italic text-emerald-900">
                &ldquo;{revenueDistribution.observation}&rdquo;
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
