import type { ApiLead } from "@/lib/leads-filter";
import {
  extractQuoteSentFields,
  isQuoteSentLead,
} from "@/lib/quote-sent-info";
import { stableLeadKey } from "@/lib/insights-lead-investment";
import {
  resolveBookingDateRange,
  type BookingDateFilterState,
} from "@/lib/booking-token-date-filter";
import { getLocalMonthRangeIsoDates } from "@/lib/presales-heatmap-helpers";

/**
 * Quotes sent in a date window, keyed off quoteSentAt (not lead createdAt).
 *
 * Lead created last month + quote sent this month → counted this month.
 * Timestamp used: lastQuoteSentAt ?? quoteSentAt.
 */
export type QuotesSentMonthMetrics = {
  periodStart: string | null;
  periodEnd: string | null;
  filterField: "quoteSentAt";
  quotesSentCount: number;
  quotationValueInr: number;
  source: "hub" | "crm";
};

export const EMPTY_QUOTES_SENT_MONTH: QuotesSentMonthMetrics = {
  periodStart: null,
  periodEnd: null,
  filterField: "quoteSentAt",
  quotesSentCount: 0,
  quotationValueInr: 0,
  source: "crm",
};

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function ymdToInstant(ymd: string, end = false): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = end
    ? endOfLocalDay(new Date(y, m - 1, d))
    : startOfLocalDay(new Date(y, m - 1, d));
  return dt.toISOString();
}

/** Insights date window; if All time, use current calendar month. */
export function quotesSentMonthDateWindow(
  dateFilter: BookingDateFilterState,
): { periodStart?: string; periodEnd?: string } {
  const range = resolveBookingDateRange(dateFilter);
  if (range.submittedFrom || range.submittedTo) {
    return { periodStart: range.submittedFrom, periodEnd: range.submittedTo };
  }
  const { from, to } = getLocalMonthRangeIsoDates();
  return {
    periodStart: ymdToInstant(from, false),
    periodEnd: ymdToInstant(to, true),
  };
}

export function readLeadQuoteSentAtMs(lead: ApiLead): number | null {
  const fields = extractQuoteSentFields(lead as Record<string, unknown>);
  const iso = fields.lastQuoteSentAt || fields.quoteSentAt;
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export function leadQuoteSentInWindow(
  lead: ApiLead,
  periodStart?: string,
  periodEnd?: string,
): boolean {
  if (!isQuoteSentLead(lead)) return false;
  const sentMs = readLeadQuoteSentAtMs(lead);
  if (sentMs == null) return false;
  const fromMs = periodStart ? Date.parse(periodStart) : NaN;
  const toMs = periodEnd ? Date.parse(periodEnd) : NaN;
  if (Number.isFinite(fromMs) && sentMs < fromMs) return false;
  if (Number.isFinite(toMs) && sentMs > toMs) return false;
  return true;
}

export function listLeadsQuoteSentInWindow(
  leads: ApiLead[],
  periodStart?: string,
  periodEnd?: string,
): ApiLead[] {
  return leads.filter((lead) => leadQuoteSentInWindow(lead, periodStart, periodEnd));
}

export function computeQuotesSentMonthMetrics(
  leads: ApiLead[],
  args: {
    periodStart?: string;
    periodEnd?: string;
    investments?: Map<string, number>;
  },
): QuotesSentMonthMetrics {
  const matched = listLeadsQuoteSentInWindow(leads, args.periodStart, args.periodEnd);
  let quotationValueInr = 0;
  if (args.investments) {
    for (const lead of matched) {
      quotationValueInr += args.investments.get(stableLeadKey(lead)) ?? 0;
    }
  }
  return {
    periodStart: args.periodStart ?? null,
    periodEnd: args.periodEnd ?? null,
    filterField: "quoteSentAt",
    quotesSentCount: matched.length,
    quotationValueInr,
    source: "crm",
  };
}
