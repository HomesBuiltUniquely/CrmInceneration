"use client";

import {
  formatInsightsChangeAbsolute,
  formatInsightsChangePercent,
  formatInsightsCount,
  formatInsightsInrCompact,
  formatInsightsPercent,
  progressWidthPercent,
  type InsightsDashboard,
} from "@/lib/crm-insights-api";

type Props = {
  kpis: InsightsDashboard["kpis"];
};

function trendClass(positiveIsGood: boolean, value: number | null | undefined) {
  const v = Number(value ?? 0);
  if (!Number.isFinite(v) || v === 0) {
    return "bg-gray-100 text-gray-600";
  }
  const good = positiveIsGood ? v > 0 : v < 0;
  return good ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600";
}

export default function InsightSect2({ kpis }: Props) {
  const cards = [
    {
      key: "totalLeads",
      label: "Total Leads",
      display: formatInsightsCount(kpis.totalLeads.value),
      trend: formatInsightsChangePercent(kpis.totalLeads.changePercent),
      trendClass: trendClass(true, kpis.totalLeads.changePercent),
      width: progressWidthPercent(kpis.totalLeads.progressRatio),
    },
    {
      key: "pipelineValue",
      label: "Pipeline Value",
      display: formatInsightsInrCompact(kpis.pipelineValue.value),
      trend: formatInsightsChangeAbsolute(kpis.pipelineValue.changeAbsolute),
      trendClass: trendClass(true, kpis.pipelineValue.changeAbsolute),
      width: progressWidthPercent(kpis.pipelineValue.progressRatio),
    },
    {
      key: "closedWon",
      label: "Closed Won",
      display: formatInsightsInrCompact(kpis.closedWon.value),
      trend: formatInsightsChangePercent(kpis.closedWon.changePercent),
      trendClass: trendClass(true, kpis.closedWon.changePercent),
      width: progressWidthPercent(kpis.closedWon.progressRatio),
    },
    {
      key: "conversionPercent",
      label: "Conversion %",
      display: formatInsightsPercent(kpis.conversionPercent.value),
      trend: formatInsightsChangePercent(kpis.conversionPercent.changePercent),
      trendClass: trendClass(true, kpis.conversionPercent.changePercent),
      width: progressWidthPercent(kpis.conversionPercent.progressRatio),
    },
  ];

  return (
    <main>
      <div
        className="mt-8 grid grid-cols-1 gap-4 px-4
            sm:grid-cols-2 sm:px-6
            lg:grid-cols-4
            sm:font-semibold tracking-wide
            md:font-bold
            lg:tracking-widest
            xl:tracking-widest
            2xl:tracking-widest"
      >
        {cards.map((card) => (
          <div
            key={card.key}
            className="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 sm:text-sm">
                  {card.label}
                </p>
                <span className="text-2xl align-baseline font-bold text-gray-900 sm:text-3xl">
                  {card.display}
                </span>
              </div>

              <h2
                className={`mt-2 inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold sm:text-sm ${card.trendClass}`}
              >
                {card.trend}
              </h2>
            </div>

            <div className="mt-8 h-1.5 rounded-full bg-gray-200">
              <div
                className="h-1.5 rounded-full bg-green-500"
                style={{ width: card.width }}
              />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
