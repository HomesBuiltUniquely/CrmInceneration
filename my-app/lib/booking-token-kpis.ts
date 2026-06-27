import type { DealRow, KpiCard } from "@/app/Components/BookingToken/types";
import { formatQuoteAmount } from "@/lib/crm-quote-links";

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

/** Lead completed booking = full 10% paid (Booking tab bucket). */
export function isBookingTenPercentComplete(row: DealRow): boolean {
  return row.listingType === "booking" || row.remainingAmount <= 0;
}

export function computeBookingTokenKpis(rows: DealRow[]): KpiCard[] {
  const active = rows.filter((row) => row.listingType !== "cancel");
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
