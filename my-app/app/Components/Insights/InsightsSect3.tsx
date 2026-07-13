"use client";

import {
  formatInsightsCount,
  formatInsightsInrCompact,
  formatInsightsPercent,
  type InsightsDashboard,
  type InsightsFunnelStage,
} from "@/lib/crm-insights-api";

type Props = {
  salesFunnel: InsightsFunnelStage[];
  revenueDistribution: InsightsDashboard["revenueDistribution"];
};

const FUNNEL_STYLES = [
  { bar: "bg-[#111827] text-white", indent: "", width: "w-[86%]" },
  {
    bar: "bg-[#233044] text-white",
    indent: "ml-2 sm:ml-5 lg:ml-8",
    width: "w-[78%]",
  },
  {
    bar: "bg-[#41516A] text-white",
    indent: "ml-4 sm:ml-9 lg:ml-14",
    width: "w-[70%]",
  },
  {
    bar: "bg-[#59677D] text-white",
    indent: "ml-6 sm:ml-12 lg:ml-20",
    width: "w-[62%]",
  },
  {
    bar: "bg-[#22E574] text-gray-900",
    indent: "ml-8 sm:ml-16 lg:ml-28",
    width: "w-[54%]",
  },
];

const PHASE_COLORS = ["bg-[#111827]", "bg-[#334155]", "bg-[#64748B]", "bg-[#22E574]"];

export default function InsightSect3({
  salesFunnel,
  revenueDistribution,
}: Props) {
  return (
    <main className="mt-10 px-4">
      <div className="mx-auto flex max-w-[1300px] flex-col gap-8 lg:flex-row">
        <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:w-[68%]">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-xl font-bold">Sales Funnel Efficiency</h2>
            <div className="flex h-6 w-6 items-center justify-center rounded-full border text-gray-400">
              i
            </div>
          </div>

          {salesFunnel.length === 0 ? (
            <p className="text-sm text-gray-500">No funnel data for this filter.</p>
          ) : (
            <div className="space-y-6">
              {salesFunnel.map((stage, index) => {
                const style = FUNNEL_STYLES[Math.min(index, FUNNEL_STYLES.length - 1)];
                return (
                  <div key={stage.stageKey || stage.stageLabel} className="flex w-full items-center">
                    <div
                      className={`flex h-14 items-center justify-between gap-3 px-3 sm:px-5 ${style.bar} ${style.indent} ${style.width}`}
                    >
                      <span className="text-xs sm:text-sm lg:text-base">
                        {stage.stageLabel}
                      </span>
                      <span className="text-xs font-bold sm:text-sm lg:text-base">
                        {formatInsightsCount(stage.count)}{" "}
                        {stage.countLabel || "Leads"} |{" "}
                        {formatInsightsInrCompact(stage.value)}
                      </span>
                    </div>
                    <span className="ml-auto pl-3 text-xs sm:text-sm">
                      {formatInsightsPercent(stage.conversionPercent)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:w-[32%]">
          <h2 className="mb-8 text-xl font-bold">Revenue Distribution</h2>
          {revenueDistribution.phases.length === 0 ? (
            <p className="text-sm text-gray-500">No revenue phase data.</p>
          ) : (
            <div className="space-y-7">
              {revenueDistribution.phases.map((phase, index) => (
                <div key={phase.phaseKey || phase.phaseLabel}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="uppercase">{phase.phaseLabel}</span>
                    <span>
                      {formatInsightsInrCompact(phase.value)} (
                      {formatInsightsPercent(phase.percent, 0)})
                    </span>
                  </div>
                  <div className="h-4 bg-gray-200">
                    <div
                      className={`h-4 ${PHASE_COLORS[index % PHASE_COLORS.length]}`}
                      style={{
                        width: `${Math.min(100, Math.max(0, phase.percent))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {revenueDistribution.observation ? (
            <div className="mt-8 border-l-4 border-[#22E574] bg-green-50 p-4">
              <p className="text-sm italic text-gray-500">
                &ldquo;{revenueDistribution.observation}&rdquo;
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
