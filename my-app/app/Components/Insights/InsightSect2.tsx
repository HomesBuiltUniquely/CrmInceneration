"use client";

import {
  formatInsightsChangeAbsolute,
  formatInsightsChangePercent,
  formatInsightsCount,
  formatInsightsInrCompact,
  formatInsightsPercent,
  progressWidthPercent,
  type InsightsDashboard,
  type InsightsKpiMetric,
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
  /** Used only if Hub omits token/booking/gross KPIs. */
  tokenMetrics?: TokenMetricsData;
  dashboardLoading?: boolean;
};

function trendClass(positiveIsGood: boolean, value: number | null | undefined) {
  const v = Number(value ?? 0);
  if (!Number.isFinite(v) || v === 0) {
    return "bg-gray-100 text-gray-600";
  }
  const good = positiveIsGood ? v > 0 : v < 0;
  return good ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
}

function moneyFromHubOrFe(
  hub: InsightsKpiMetric | null | undefined,
  feValue: number | undefined,
): number {
  if (hub != null && Number.isFinite(hub.value)) return hub.value;
  return Number(feValue ?? 0);
}

export default function InsightSect2({
  kpis,
  tokenMetrics,
  dashboardLoading = false,
}: Props) {
  const hasHubMoney =
    kpis.tokenValue != null ||
    kpis.bookingValue != null ||
    kpis.grossBooking != null;

  const isMoneyLoading =
    dashboardLoading || (!hasHubMoney && Boolean(tokenMetrics?.loading));

  const tokenValue = moneyFromHubOrFe(kpis.tokenValue, tokenMetrics?.tokenValue);
  const bookingValue = moneyFromHubOrFe(
    kpis.bookingValue,
    tokenMetrics?.bookingValue ?? kpis.closedWon.value,
  );
  const grossBooking =
    kpis.grossBooking != null && Number.isFinite(kpis.grossBooking.value)
      ? kpis.grossBooking.value
      : tokenValue + bookingValue;

  const tokenTrend =
    kpis.tokenValue?.changeAbsolute != null
      ? formatInsightsChangeAbsolute(kpis.tokenValue.changeAbsolute)
      : tokenMetrics?.tokenCount != null
        ? `${tokenMetrics.tokenCount} Active Tokens`
        : "Token deals";
  const bookingTrend =
    kpis.bookingValue?.changeAbsolute != null
      ? formatInsightsChangeAbsolute(kpis.bookingValue.changeAbsolute)
      : tokenMetrics?.bookingCount != null
        ? `${tokenMetrics.bookingCount} Booked Deals`
        : "Booking deals";

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
      key: "tokenValue",
      label: "Token Value",
      display: isMoneyLoading ? "..." : formatInsightsInrCompact(tokenValue),
      trend: isMoneyLoading ? "…" : tokenTrend,
      trendClass: "bg-amber-100 text-amber-800",
      width: progressWidthPercent(
        kpis.tokenValue?.progressRatio ?? (tokenValue > 0 ? 0.7 : 0),
      ),
      barColor: "bg-amber-500",
    },
    {
      key: "bookingValue",
      label: "Booking Value",
      display: isMoneyLoading ? "..." : formatInsightsInrCompact(bookingValue),
      trend: isMoneyLoading ? "…" : bookingTrend,
      trendClass: "bg-emerald-100 text-emerald-800",
      width: progressWidthPercent(kpis.bookingValue?.progressRatio ?? 1),
      barColor: "bg-emerald-500",
    },
    {
      key: "grossBookingValue",
      label: "Gross Booking Value",
      display: isMoneyLoading ? "..." : formatInsightsInrCompact(grossBooking),
      trend:
        kpis.grossBooking?.changeAbsolute != null
          ? formatInsightsChangeAbsolute(kpis.grossBooking.changeAbsolute)
          : "Token + Booking",
      trendClass: "bg-indigo-100 text-indigo-800",
      width: progressWidthPercent(kpis.grossBooking?.progressRatio ?? 1),
      barColor: "bg-indigo-600",
    },
    {
      key: "conversionPercent",
      label: "Conversion %",
      display: formatInsightsPercent(kpis.conversionPercent.value),
      trend: formatInsightsChangePercent(kpis.conversionPercent.changePercent),
      trendClass: trendClass(true, kpis.conversionPercent.changePercent),
      width: progressWidthPercent(kpis.conversionPercent.progressRatio),
      barColor: "bg-emerald-500",
    },
  ];

  return (
    <main>
      <div className="mt-6 grid grid-cols-1 items-stretch gap-3.5 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-5 lg:px-8">
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
