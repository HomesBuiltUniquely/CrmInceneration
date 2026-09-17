"use client";

import {
  formatInsightsChangePercent,
  formatInsightsCount,
  formatInsightsPercent,
  progressWidthPercent,
  type InsightsDashboard,
  type ConversionCard,
} from "@/lib/crm-insights-api";

/** Optional FE fallback when Hub money KPIs not present (legacy). */
export type TokenMetricsData = {
  tokenValue: number;
  bookingValue: number;
  futureConversionValue: number;
  tokenCount: number;
  bookingCount: number;
  loading?: boolean;
};

type Props = {
  kpis: InsightsDashboard["kpis"];
  dashboardLoading?: boolean;
  leadToMeeting?: ConversionCard | null;
  meetingToBooking?: ConversionCard | null;
};

function trendClass(positiveIsGood: boolean, value: number | null | undefined) {
  const v = Number(value ?? 0);
  if (!Number.isFinite(v) || v === 0) {
    return "bg-gray-100 text-gray-600";
  }
  const good = positiveIsGood ? v > 0 : v < 0;
  return good ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
}

function barColorFromTrend(positiveIsGood: boolean, value: number | null | undefined) {
  const v = Number(value ?? 0);
  if (!Number.isFinite(v) || v === 0) return "bg-indigo-500";
  const good = positiveIsGood ? v > 0 : v < 0;
  return good ? "bg-emerald-500" : "bg-red-500";
}

export default function InsightSect2({
  kpis,
  dashboardLoading = false,
  leadToMeeting = null,
  meetingToBooking = null,
}: Props) {
  const cards = [
    {
      key: "totalLeads",
      label: "Total Leads",
      display: dashboardLoading ? "..." : formatInsightsCount(kpis.totalLeads.value),
      trend: dashboardLoading
        ? "…"
        : formatInsightsChangePercent(kpis.totalLeads.changePercent),
      trendClass: trendClass(true, kpis.totalLeads.changePercent),
      width: progressWidthPercent(kpis.totalLeads.progressRatio),
      barColor: "bg-indigo-500",
    },
    {
      key: "leadToMeeting",
      label: "Lead → Meeting Conv %",
      display: dashboardLoading
        ? "..."
        : formatInsightsPercent(leadToMeeting?.valuePercent ?? 0),
      trend: dashboardLoading ? "…" : leadToMeeting?.varianceLabel ?? "0%",
      trendClass: trendClass(true, leadToMeeting?.variancePercent ?? 0),
      width: progressWidthPercent((leadToMeeting?.valuePercent ?? 0) / 100),
      barColor: barColorFromTrend(true, leadToMeeting?.variancePercent ?? 0),
    },
    {
      key: "meetingToBooking",
      label: "Meeting → Booking Conv",
      display: dashboardLoading
        ? "..."
        : formatInsightsPercent(meetingToBooking?.valuePercent ?? 0),
      trend: dashboardLoading ? "…" : meetingToBooking?.varianceLabel ?? "0%",
      trendClass: trendClass(true, meetingToBooking?.variancePercent ?? 0),
      width: progressWidthPercent((meetingToBooking?.valuePercent ?? 0) / 100),
      barColor: barColorFromTrend(true, meetingToBooking?.variancePercent ?? 0),
    },
    {
      key: "conversionPercent",
      label: "Conversion %",
      display: dashboardLoading
        ? "..."
        : formatInsightsPercent(kpis.conversionPercent.value),
      trend: dashboardLoading
        ? "…"
        : formatInsightsChangePercent(kpis.conversionPercent.changePercent),
      trendClass: trendClass(true, kpis.conversionPercent.changePercent),
      width: progressWidthPercent(kpis.conversionPercent.progressRatio),
      barColor: "bg-emerald-500",
    },
  ];

  return (
    <main>
      <div className="mt-6 grid grid-cols-1 items-stretch gap-3.5 px-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-4 lg:px-6">
        {cards.map((card) => (
          <div
            key={card.key}
            className="flex h-full w-full flex-col rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs transition-all hover:border-gray-300"
          >
            <div className="flex min-h-[2.75rem] items-start justify-between gap-2">
              <p className="min-w-0 flex-1 text-[11px] font-bold uppercase leading-snug tracking-wider text-gray-400">
                {card.label}
              </p>
              <span
                className={`mt-0.5 inline-block max-w-[48%] shrink-0 truncate rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-tight ${card.trendClass}`}
                title={card.trend}
              >
                {card.trend}
              </span>
            </div>

            <span className="mt-2 block min-h-[2.25rem] text-2xl font-extrabold leading-none tracking-tight text-gray-900 sm:min-h-[2.5rem] sm:text-3xl">
              {card.display}
            </span>

            <div className="mt-auto pt-6">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-1.5 rounded-full ${card.barColor} transition-all duration-300`}
                  style={{ width: card.width }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
