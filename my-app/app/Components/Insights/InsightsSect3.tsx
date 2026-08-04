"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatInsightsCount,
  formatInsightsInrCompact,
  formatInsightsPercent,
  type InsightsDashboard,
  type InsightsFunnelStage,
} from "@/lib/crm-insights-api";
import type { TokenMetricsData } from "./InsightSect2";
import { recalcFunnelConversionPercents } from "@/lib/insights-sales-funnel-investment";
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
};

const WON_FUNNEL_STYLES = [
  { bar: "bg-[#111827] text-white", indent: "", width: "w-[92%]" },
  { bar: "bg-[#1E293B] text-white", indent: "ml-1 sm:ml-3 lg:ml-5", width: "w-[84%]" },
  { bar: "bg-[#334155] text-white", indent: "ml-2 sm:ml-6 lg:ml-10", width: "w-[76%]" },
  { bar: "bg-[#475569] text-white", indent: "ml-3 sm:ml-9 lg:ml-15", width: "w-[68%]" },
  { bar: "bg-[#64748B] text-white", indent: "ml-4 sm:ml-12 lg:ml-20", width: "w-[60%]" },
  { bar: "bg-[#22E574] text-gray-900", indent: "ml-5 sm:ml-15 lg:ml-25", width: "w-[52%]" },
];

const LOST_FUNNEL_STYLES = [
  { bar: "bg-[#7F1D1D] text-white", indent: "", width: "w-[92%]" },
  { bar: "bg-[#991B1B] text-white", indent: "ml-1 sm:ml-3 lg:ml-5", width: "w-[84%]" },
  { bar: "bg-[#B91C1C] text-white", indent: "ml-2 sm:ml-6 lg:ml-10", width: "w-[76%]" },
  { bar: "bg-[#DC2626] text-white", indent: "ml-3 sm:ml-9 lg:ml-15", width: "w-[68%]" },
  { bar: "bg-[#EF4444] text-white", indent: "ml-4 sm:ml-12 lg:ml-20", width: "w-[60%]" },
  { bar: "bg-[#F87171] text-gray-950", indent: "ml-5 sm:ml-15 lg:ml-25", width: "w-[52%]" },
];

const PHASE_COLORS = ["bg-[#111827]", "bg-[#334155]", "bg-[#64748B]", "bg-[#22E574]"];

type SubstageItem = {
  title: string;
  count: number;
};

function SubstageList({
  items,
  pathTone,
}: {
  items: SubstageItem[];
  pathTone: "won" | "lost";
}) {
  const sorted = useMemo(() => [...items].sort((a, b) => b.count - a.count), [items]);
  const hasLeads = sorted.some((s) => s.count > 0);

  if (!hasLeads) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-xs font-medium text-gray-500">
        No leads on this path yet
      </div>
    );
  }

  const topAccent =
    pathTone === "won"
      ? "border-emerald-300/80 bg-gradient-to-r from-emerald-50/90 to-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.35)] ring-1 ring-emerald-200/80"
      : "border-red-300/80 bg-gradient-to-r from-red-50/90 to-white shadow-[0_8px_24px_-8px_rgba(239,68,68,0.3)] ring-1 ring-red-200/80";

  const topBadge =
    pathTone === "won"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-red-100 text-red-700";

  return (
    <div className="space-y-2.5">
      {sorted.map((item, idx) => {
        const isTop = idx === 0 && item.count > 0;
        return (
          <div
            key={item.title}
            style={{ animationDelay: `${idx * 55}ms` }}
            className={`insights-substage-in flex items-center justify-between rounded-xl border p-3.5 transition-all duration-300 ease-out ${
              isTop
                ? `insights-substage-top-lift z-[1] relative ${topAccent}`
                : "border-gray-200/90 bg-gray-50/70 hover:-translate-y-0.5 hover:border-gray-300 hover:bg-white hover:shadow-sm"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={`truncate text-xs font-semibold tracking-wide text-gray-800 ${
                  isTop ? "uppercase" : ""
                }`}
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
            <span
              className={`ml-3 shrink-0 tabular-nums ${
                isTop ? "text-sm font-extrabold text-gray-900" : "text-xs font-bold text-gray-900"
              }`}
            >
              {formatInsightsCount(item.count)}{" "}
              <span className={`font-normal ${isTop ? "text-gray-600" : "text-gray-500"}`}>
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
  onClose,
}: {
  stageLabel: string;
  funnelTab: "all" | "won" | "lost";
  wonSubstages: SubstageItem[];
  lostSubstages: SubstageItem[];
  onClose: () => void;
}) {
  const [closing, setClosing] = useState(false);

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, 220);
  };

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closing]);

  const showWon = funnelTab === "all" || funnelTab === "won";
  const showLost = funnelTab === "all" || funnelTab === "lost";

  const pathFilterLabel =
    funnelTab === "all"
      ? "All (Won & Lost)"
      : funnelTab === "won"
        ? "Won Path"
        : "Lost Path";

  const pathFilterPill =
    funnelTab === "won"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200/80"
      : funnelTab === "lost"
        ? "bg-red-50 text-red-700 ring-red-200/80"
        : "bg-slate-100 text-slate-700 ring-slate-200/80";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${
        closing ? "insights-backdrop-out" : "insights-backdrop-in"
      } bg-slate-950/50 backdrop-blur-md`}
      onClick={requestClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="funnel-substage-title"
    >
      <div
        className={`relative max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_24px_64px_-16px_rgba(15,23,42,0.35)] ${
          closing ? "insights-modal-out" : "insights-modal-in"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 bg-gradient-to-b from-gray-50/80 to-white px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="funnel-substage-title" className="text-lg font-bold text-gray-900">
                {stageLabel} Substage Breakdown
              </h3>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>Path filter:</span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${pathFilterPill}`}
                >
                  {pathFilterLabel}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={requestClose}
              className="rounded-full p-2 text-gray-400 transition-all duration-200 hover:scale-105 hover:bg-gray-100 hover:text-gray-700 active:scale-95"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="max-h-[calc(85vh-5.5rem)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6 [scrollbar-gutter:stable]">
          <div className="space-y-7">
            {showWon ? (
              <div>
                {funnelTab === "all" ? (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                      Won Path Substages
                    </h4>
                  </div>
                ) : null}
                <SubstageList items={wonSubstages} pathTone="won" />
              </div>
            ) : null}

            {showLost ? (
              <div>
                {funnelTab === "all" ? (
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                      Lost Path Substages
                    </h4>
                  </div>
                ) : null}
                <SubstageList items={lostSubstages} pathTone="lost" />
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
}: Props) {
  const [funnelTab, setFunnelTab] = useState<"all" | "won" | "lost">("all");
  const [selectedStagePopup, setSelectedStagePopup] = useState<string | null>(null);

  const fullSalesFunnel = useMemo(() => {
    const hasFresh = salesFunnel.some((s) => {
      const k = (s.stageKey || s.stageLabel).toLowerCase();
      return k.includes("fresh") || k.includes("new lead") || k.includes("received");
    });

    if (hasFresh || !totalLeadsCount) return salesFunnel;

    const topValue = salesFunnel[0]?.value ?? 0;
    const freshStage: InsightsFunnelStage = {
      stageKey: "fresh_lead",
      stageLabel: "Fresh Lead",
      count: totalLeadsCount,
      countLabel: "Leads",
      value: topValue,
      conversionPercent: 100,
    };
    return [freshStage, ...salesFunnel];
  }, [salesFunnel, totalLeadsCount]);

  const activeSalesFunnel = useMemo(() => {
    const withCounts = fullSalesFunnel.map((stage) => {
      const key = stage.stageKey || stage.stageLabel;
      let count = stage.count;

      const stageKeyNorm = key.toLowerCase();
      const isClosedWonStage =
        stageKeyNorm.includes("closed_won") ||
        stageKeyNorm.includes("closed won") ||
        stageKeyNorm === "closed" ||
        stageKeyNorm.includes("booking");

      if (isClosedWonStage && tokenMetrics?.bookingCount != null) {
        count = Math.max(stage.count, tokenMetrics.bookingCount);
      }

      let value = stage.value;
      if (funnelStageValues && !funnelMetricsLoading) {
        const override = funnelStageValues[key] ?? funnelStageValues[stage.stageLabel];
        if (override != null) value = override;
      }

      return { ...stage, count, value };
    });

    return recalcFunnelConversionPercents(withCounts);
  }, [fullSalesFunnel, funnelMetricsLoading, funnelStageValues, tokenMetrics?.bookingCount]);

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
  const lostStages = lostFunnel?.stages ?? [];

  const lostCountByStageKey = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of lostStages) {
      const k = resolveFunnelCanonicalKey(s.stageKey || s.stageLabel);
      map[k] = s.count;
    }
    return map;
  }, [lostStages]);

  const activeStagePopupDetails = useMemo(() => {
    if (!selectedStagePopup) return null;
    const stage = activeSalesFunnel.find(
      (s) => resolveFunnelCanonicalKey(s.stageKey || s.stageLabel) === selectedStagePopup,
    );
    const label = stage ? stage.stageLabel : selectedStagePopup;
    const path = stagePathData[selectedStagePopup];
    return {
      stageLabel: label,
      wonSubstages: path?.wonSubstages ?? [],
      lostSubstages: path?.lostSubstages ?? [],
    };
  }, [selectedStagePopup, activeSalesFunnel, stagePathData]);

  return (
    <main className="mt-10 px-4">
      <div className="mx-auto flex max-w-[1300px] flex-col gap-8 lg:flex-row">
        {/* Sales Funnel Efficiency */}
        <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:w-[68%]">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Sales Funnel Efficiency</h2>
              <p className="mt-0.5 text-xs text-gray-500">Stage-by-stage lead progression & lost drop analysis</p>
            </div>

            <div className="flex items-center gap-1 self-start rounded-lg border border-gray-200 bg-gray-100 p-0.5 sm:self-auto">
              {(["all", "won", "lost"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFunnelTab(tab)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-300 ease-out ${
                    funnelTab === tab
                      ? tab === "won"
                        ? "bg-emerald-600 font-bold text-white shadow-md shadow-emerald-600/25"
                        : tab === "lost"
                          ? "bg-red-600 font-bold text-white shadow-md shadow-red-600/25"
                          : "bg-slate-900 font-bold text-white shadow-md shadow-slate-900/20"
                      : "text-gray-600 hover:bg-gray-200/60 hover:text-gray-900"
                  }`}
                >
                  {tab === "all" ? "All" : tab === "won" ? "Won" : "Lost"}
                </button>
              ))}
            </div>
          </div>

          {activeSalesFunnel.length === 0 ? (
            <p className="text-sm text-gray-500">No funnel data for this filter.</p>
          ) : (
            <div
              className={`space-y-5 transition-opacity duration-300 ${
                selectedStagePopup ? "opacity-100" : ""
              }`}
            >
              {activeSalesFunnel.map((stage, index) => {
                const canonicalKey = resolveFunnelCanonicalKey(stage.stageKey || stage.stageLabel);
                const isFreshLead = canonicalKey === "fresh_lead";
                const isClosedWonStage = canonicalKey === "closed";
                const pathBreakdown = stagePathData[canonicalKey];

                const wonCount = pathBreakdown?.wonTotal ?? stage.count;
                const lostCount = pathBreakdown?.lostTotal ?? lostCountByStageKey[canonicalKey] ?? 0;

                let displayCount = stage.count;
                if (funnelTab === "won") displayCount = wonCount;
                else if (funnelTab === "lost") displayCount = lostCount;

                const useLostStyle = funnelTab === "lost";
                const style = useLostStyle
                  ? LOST_FUNNEL_STYLES[Math.min(index, LOST_FUNNEL_STYLES.length - 1)]
                  : WON_FUNNEL_STYLES[Math.min(index, WON_FUNNEL_STYLES.length - 1)];

                let countText = `${formatInsightsCount(displayCount)} ${stage.countLabel || "Leads"}`;
                if (isClosedWonStage && funnelTab !== "lost") {
                  countText = `${formatInsightsCount(displayCount)} Booked Leads`;
                } else if (funnelTab === "lost") {
                  countText = `${formatInsightsCount(displayCount)} Lost Leads`;
                }

                const stageValue = stage.value;
                const isPopupOpen = selectedStagePopup === canonicalKey;
                const isClickable = !isFreshLead;
                const isDimmed = Boolean(selectedStagePopup) && !isPopupOpen;

                return (
                  <div
                    key={stage.stageKey || stage.stageLabel}
                    className={`flex w-full items-center transition-all duration-300 ease-out ${
                      isDimmed ? "scale-[0.985] opacity-45" : "opacity-100"
                    }`}
                  >
                    <div
                      onClick={
                        isClickable
                          ? () => setSelectedStagePopup(isPopupOpen ? null : canonicalKey)
                          : undefined
                      }
                      title={isClickable ? "Click to view substage breakdown" : undefined}
                      className={`flex h-14 items-center justify-between gap-3 px-3 sm:px-5 ${style.bar} ${style.indent} ${style.width} rounded-xl transition-all duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isClickable ? "cursor-pointer" : ""
                      } ${
                        isPopupOpen
                          ? "relative z-10 -translate-y-2 scale-[1.025] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.45)] ring-2 ring-white/40"
                          : isClickable
                            ? "shadow-xs hover:-translate-y-1 hover:shadow-lg hover:shadow-black/20 active:scale-[0.995]"
                            : "shadow-xs"
                      }`}
                    >
                      <span className="text-xs font-semibold sm:text-sm lg:text-base">
                        {stage.stageLabel}
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-2 text-right">
                        <span className="text-xs font-bold sm:text-sm lg:text-base">
                          {countText}
                          {funnelTab !== "lost" ? (
                            <>
                              {" | "}
                              {funnelMetricsLoading ? (
                                <span className="opacity-80">Loading…</span>
                              ) : (
                                formatInsightsInrCompact(stageValue)
                              )}
                            </>
                          ) : null}
                        </span>
                        {funnelTab === "all" && !isFreshLead ? (
                          <span className="rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white/90">
                            {formatInsightsCount(wonCount)} won · {formatInsightsCount(lostCount)} lost
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span
                      className={`ml-auto pl-3 text-xs font-bold sm:text-sm transition-opacity duration-300 ${
                        isDimmed ? "text-gray-400" : "text-gray-700"
                      }`}
                    >
                      {funnelTab === "lost"
                        ? `${formatInsightsPercent(
                            lostStages.find(
                              (s) =>
                                resolveFunnelCanonicalKey(s.stageKey || s.stageLabel) ===
                                canonicalKey,
                            )?.dropPercent ?? 0,
                            0,
                          )} Drop`
                        : formatInsightsPercent(stage.conversionPercent)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {selectedStagePopup && activeStagePopupDetails ? (
            <SubstageModal
              stageLabel={activeStagePopupDetails.stageLabel}
              funnelTab={funnelTab}
              wonSubstages={activeStagePopupDetails.wonSubstages}
              lostSubstages={activeStagePopupDetails.lostSubstages}
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
