"use client";

import { useMemo, useState } from "react";
import {
  formatInsightsCount,
  formatInsightsInrCompact,
  formatInsightsPercent,
  type InsightsDashboard,
  type InsightsFunnelStage,
} from "@/lib/crm-insights-api";
import type { TokenMetricsData } from "./InsightSect2";
import { recalcFunnelConversionPercents } from "@/lib/insights-sales-funnel-investment";

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
}: Props) {
  const [funnelTab, setFunnelTab] = useState<"won" | "lost">("won");

  // Prepend "Fresh Lead" stage if not present in backend salesFunnel
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

  // Compute override values and subtext for revenue distribution phases
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
  const totalLostCount = lostFunnel?.total ?? 0;
  const lostStages = lostFunnel?.stages ?? [];

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

            {/* ON / OFF Style Pill Toggle Switcher Slider */}
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-bold transition-colors cursor-pointer select-none ${
                  funnelTab === "won" ? "text-emerald-700 font-extrabold" : "text-gray-400"
                }`}
                onClick={() => setFunnelTab("won")}
              >
                Active / Won
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={funnelTab === "lost"}
                onClick={() => setFunnelTab(funnelTab === "won" ? "lost" : "won")}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${
                  funnelTab === "won" ? "bg-emerald-500" : "bg-red-500"
                }`}
                title={`Switch to ${funnelTab === "won" ? "Lost Funnel" : "Active / Won Funnel"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${
                    funnelTab === "won" ? "translate-x-0" : "translate-x-7"
                  }`}
                />
              </button>
              <span
                className={`text-xs font-bold transition-colors cursor-pointer select-none ${
                  funnelTab === "lost" ? "text-red-600 font-extrabold" : "text-gray-400"
                }`}
                onClick={() => setFunnelTab("lost")}
              >
                Lost Funnel ({formatInsightsCount(totalLostCount)})
              </span>
            </div>
          </div>

          {funnelTab === "lost" ? (
            lostStages.length === 0 ? (
              <p className="text-sm text-gray-500">Lost funnel data not available yet.</p>
            ) : (
              <div className="space-y-5">
                {lostStages.map((stage, index) => {
                  const style = LOST_FUNNEL_STYLES[Math.min(index, LOST_FUNNEL_STYLES.length - 1)];

                  return (
                    <div key={stage.stageKey || stage.stageLabel} className="flex w-full items-center">
                      <div
                        className={`flex h-14 items-center justify-between gap-3 px-3 sm:px-5 ${style.bar} ${style.indent} ${style.width} rounded-xl shadow-xs transition-all duration-300`}
                      >
                        <span className="text-xs font-semibold sm:text-sm lg:text-base text-red-100">
                          {stage.stageLabel}
                        </span>
                        <span className="text-xs font-bold sm:text-sm lg:text-base text-white">
                          {formatInsightsCount(stage.count)} Lost Leads
                        </span>
                      </div>
                      <span className="ml-auto pl-3 text-xs font-bold text-red-600 sm:text-sm">
                        {formatInsightsPercent(stage.dropPercent, 0)} Drop
                      </span>
                    </div>
                  );
                })}
              </div>
            )
          ) : activeSalesFunnel.length === 0 ? (
            <p className="text-sm text-gray-500">No funnel data for this filter.</p>
          ) : (
            <div className="space-y-5">
              {activeSalesFunnel.map((stage, index) => {
                const style = WON_FUNNEL_STYLES[Math.min(index, WON_FUNNEL_STYLES.length - 1)];
                const key = (stage.stageKey || stage.stageLabel).toLowerCase();

                const isClosedWonStage =
                  key.includes("closed_won") ||
                  key.includes("closed won") ||
                  key === "closed" ||
                  key.includes("booking");

                let countText = `${formatInsightsCount(stage.count)} ${stage.countLabel || "Leads"}`;
                const stageValue = stage.value;

                if (isClosedWonStage) {
                  countText = `${formatInsightsCount(stage.count)} Booked Leads`;
                }

                return (
                  <div key={stage.stageKey || stage.stageLabel} className="flex w-full items-center">
                    <div
                      className={`flex h-14 items-center justify-between gap-3 px-3 sm:px-5 ${style.bar} ${style.indent} ${style.width} rounded-xl shadow-xs transition-all duration-300`}
                    >
                      <span className="text-xs font-semibold sm:text-sm lg:text-base">
                        {stage.stageLabel}
                      </span>
                      <span className="text-xs font-bold sm:text-sm lg:text-base">
                        {countText} |{" "}
                        {funnelMetricsLoading ? (
                          <span className="opacity-80">Loading…</span>
                        ) : (
                          formatInsightsInrCompact(stageValue)
                        )}
                      </span>
                    </div>
                    <span className="ml-auto pl-3 text-xs font-bold text-gray-700 sm:text-sm">
                      {formatInsightsPercent(stage.conversionPercent)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
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
                        <span className="uppercase font-bold text-gray-700 text-xs tracking-wider">
                          {phase.phaseLabel}
                        </span>
                        {phase.subtext ? (
                          <span className="ml-2 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {phase.subtext}
                          </span>
                        ) : null}
                      </div>
                      <span className="font-bold text-gray-900 text-xs sm:text-sm">
                        {quotationMetricsLoading && isQuotationPhase ? (
                          <span className="text-gray-400">Loading…</span>
                        ) : (
                          formatInsightsInrCompact(phase.value)
                        )}{" "}
                        <span className="text-gray-400 font-normal text-xs">
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
            <div className="mt-8 border-l-4 border-[#22E574] bg-emerald-50/80 p-4 rounded-r-xl">
              <p className="text-xs italic text-emerald-900 font-medium">
                &ldquo;{revenueDistribution.observation}&rdquo;
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
