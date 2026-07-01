import type { BookingTokenTab, DealRow, KpiCard } from "@/app/Components/BookingToken/types";
import { formatQuoteAmount } from "@/lib/crm-quote-links";
import { filterDealRowsForTab } from "@/lib/booking-token-deals-fetch";

export function formatCompactInr(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return formatQuoteAmount(0);
  const abs = Math.abs(amount);
  if (abs >= 10_000_000) {
    return `₹${(amount / 10_000_000).toFixed(2).replace(/\.?0+$/, "")}Cr`;
  }
  if (abs >= 100_000) {
    return `₹${(amount / 100_000).toFixed(2).replace(/\.?0+$/, "")}L`;
  }
  if (abs >= 1_000) {
    return `₹${(amount / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return formatQuoteAmount(amount);
}

/** Lead completed booking = promoted to Booking bucket after Convert. */
export function isBookingTenPercentComplete(row: DealRow): boolean {
  return row.listingType === "booking";
}

function computeCancelTabKpis(rows: DealRow[]): KpiCard[] {
  const cancelled = rows.filter((row) => row.listingType === "cancel");
  const cancelledValue = cancelled.reduce((sum, row) => sum + row.dealValueAmount, 0);
  const refundedDeposits = cancelled.reduce((sum, row) => sum + row.paidAmount, 0);
  const count = cancelled.length;
  const countBar = count > 0 ? Math.min(100, count * 12) : 0;

  return [
    {
      id: "total",
      label: "Cancelled Deals",
      value: String(count),
      trend: count === 1 ? "in range" : "in range",
      trendUp: false,
      trendUrgent: count > 0,
      barTone: "orange",
      barWidth: countBar,
    },
    {
      id: "rate",
      label: "Cancelled Value",
      value: formatCompactInr(cancelledValue),
      trend: "deal value",
      trendUp: false,
      barTone: "orange",
      barWidth: cancelledValue > 0 ? 40 : 0,
    },
    {
      id: "pending",
      label: "Token Stage",
      value: String(cancelled.filter((row) => row.bookingStatus !== "confirmed").length),
      trend: "before booking",
      trendUp: false,
      barTone: "orange",
      barWidth: count > 0 ? 30 : 0,
    },
    {
      id: "deposits",
      label: "Deposits Held",
      value: formatCompactInr(refundedDeposits),
      trend: `${count} cancel${count === 1 ? "" : "s"}`,
      trendUp: false,
      barTone: "orange",
      barWidth: refundedDeposits > 0 ? 35 : 0,
    },
  ];
}

export function computeBookingTokenKpis(
  rows: DealRow[],
  tab: BookingTokenTab = "all",
): KpiCard[] {
  const scoped = filterDealRowsForTab(rows, tab);

  if (tab === "cancel") {
    return computeCancelTabKpis(scoped);
  }

  const active = scoped.filter((row) => row.listingType !== "cancel");
  const bookingDone = active.filter(isBookingTenPercentComplete);
  const tokenDeals = active.filter((row) => row.listingType === "token");

  const totalBookingValue = bookingDone.reduce((sum, row) => sum + row.tenPercentAmount, 0);
  const totalTenPercentTargets = active.reduce((sum, row) => sum + row.tenPercentAmount, 0);
  const bookingValuePct =
    totalTenPercentTargets > 0 ? (totalBookingValue / totalTenPercentTargets) * 100 : 0;

  const preBookingDeposits = tokenDeals.reduce((sum, row) => sum + row.paidAmount, 0);
  const pendingTokens = tokenDeals.length;

  const bookingDoneBar =
    active.length > 0 ? Math.min(100, Math.round((bookingDone.length / active.length) * 100)) : 0;
  const bookingValueBar = Math.min(100, Math.round(bookingValuePct));
  const tokenBar =
    active.length > 0 ? Math.min(100, Math.round((pendingTokens / active.length) * 100)) : 0;
  const depositBar =
    totalTenPercentTargets > 0
      ? Math.min(100, Math.round((preBookingDeposits / totalTenPercentTargets) * 100))
      : 0;

  return [
    {
      id: "total",
      label: "Total Booking Value",
      value: formatCompactInr(totalBookingValue),
      trend: `${bookingDone.length} booked`,
      trendUp: bookingDone.length > 0,
      barTone: "green",
      barWidth: bookingDoneBar || (totalBookingValue > 0 ? 8 : 0),
    },
    {
      id: "rate",
      label: "Booking Value",
      value: `${bookingValuePct.toFixed(1)}%`,
      trend: "of 10% target",
      trendUp: bookingValuePct >= 50,
      barTone: "green",
      barWidth: bookingValueBar,
    },
    {
      id: "pending",
      label: "Pending Tokens",
      value: String(pendingTokens),
      trend: pendingTokens > 0 ? "partial 10%" : "none",
      trendUp: false,
      trendUrgent: pendingTokens > 0,
      barTone: "orange",
      barWidth: tokenBar,
    },
    {
      id: "deposits",
      label: "Pre-Booking Deposits",
      value: formatCompactInr(preBookingDeposits),
      trend: `${tokenDeals.length} token${tokenDeals.length === 1 ? "" : "s"}`,
      trendUp: preBookingDeposits > 0,
      barTone: "green",
      barWidth: depositBar,
    },
  ];
}
