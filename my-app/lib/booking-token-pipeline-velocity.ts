import type { DealRow, PipelineBar, BookingTokenTab } from "@/app/Components/BookingToken/types";
import {
  resolveBookingDateRange,
  type BookingDateFilterState,
} from "@/lib/booking-token-date-filter";
import { filterDealRowsForTab } from "@/lib/booking-token-deals-fetch";

const MONTH_LABELS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function formatMonthLabel(date: Date, showYear: boolean): string {
  const month = MONTH_LABELS[date.getMonth()] ?? "—";
  if (!showYear) return month;
  const yy = String(date.getFullYear()).slice(-2);
  return `${month} '${yy}`;
}

function buildYearPipeline(rows: DealRow[], year: number): PipelineBar[] {
  const counts = Array.from({ length: 12 }, () => 0);

  for (const row of rows) {
    if (row.listingType === "cancel") continue;
    const date = new Date(row.submittedAt);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) continue;
    counts[date.getMonth()] += 1;
  }

  return MONTH_LABELS.map((month, index) => ({
    id: `${year}-${index}`,
    month,
    value: counts[index] ?? 0,
  }));
}

function buildRangePipeline(rows: DealRow[], from: Date, to: Date): PipelineBar[] {
  const spansYears = from.getFullYear() !== to.getFullYear();
  const buckets = new Map<string, { label: string; value: number }>();
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);

  while (cursor <= end) {
    const key = monthKey(cursor);
    buckets.set(key, {
      label: formatMonthLabel(cursor, spansYears),
      value: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const row of rows) {
    if (row.listingType === "cancel") continue;
    const date = new Date(row.submittedAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = monthKey(date);
    const bucket = buckets.get(key);
    if (bucket) bucket.value += 1;
  }

  return Array.from(buckets.entries()).map(([id, bucket]) => ({
    id,
    month: bucket.label,
    value: bucket.value,
  }));
}

/** Handoffs per month — respects active date filter when set. */
export function computePipelineVelocity(
  rows: DealRow[],
  tab: BookingTokenTab = "all",
  dateFilter?: BookingDateFilterState,
): PipelineBar[] {
  const scoped = filterDealRowsForTab(rows, tab).filter((row) => row.listingType !== "cancel");
  const range = dateFilter ? resolveBookingDateRange(dateFilter) : {};

  if (range.submittedFrom && range.submittedTo) {
    const from = new Date(range.submittedFrom);
    const to = new Date(range.submittedTo);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      return buildRangePipeline(scoped, from, to);
    }
  }

  return buildYearPipeline(scoped, new Date().getFullYear());
}
