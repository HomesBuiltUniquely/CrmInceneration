import type { ApiLead } from "@/lib/leads-filter";
import {
  extractQuoteSentFields,
  isQuoteSentLead,
} from "@/lib/quote-sent-info";
import { stableLeadKey } from "@/lib/insights-lead-investment";
import { isLostPathLead } from "@/lib/lead-lost-segment";
import { isHoldPathLabel } from "@/lib/insights-funnel-stage-paths";
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
export type QuotesSentPathBreakdownNow = {
  won: number;
  lost: number;
  hold: number;
};

export type QuotesSentMonthMetrics = {
  periodStart: string | null;
  periodEnd: string | null;
  filterField: "quoteSentAt";
  /** Distinct leads quoted in window (includes lost + hold + won). */
  quotesSentCount: number;
  /** Won/active quotation budget only — big ₹ on Weighted Pipeline card. */
  quotationValueInr: number;
  /** Full month cohort total (optional; Hub `quotationValueAllInr`). */
  quotationValueAllInr?: number;
  quotationValueScope?: "won_only" | "all" | string;
  /** Current path split of the same month cohort (Hub `pathBreakdownNow`). */
  pathBreakdownNow?: QuotesSentPathBreakdownNow | null;
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

function inInclusiveWindow(ms: number, periodStart?: string, periodEnd?: string): boolean {
  const fromMs = periodStart ? Date.parse(periodStart) : NaN;
  const toMs = periodEnd ? Date.parse(periodEnd) : NaN;
  if (Number.isFinite(fromMs) && ms < fromMs) return false;
  if (Number.isFinite(toMs) && ms > toMs) return false;
  return true;
}

export function leadQuoteSentInWindow(
  lead: ApiLead,
  periodStart?: string,
  periodEnd?: string,
): boolean {
  if (!isQuoteSentLead(lead)) return false;
  const sentMs = readLeadQuoteSentAtMs(lead);
  // Hub rule: COALESCE(lastQuoteSentAt, quoteSentAt) — no createdAt fallback.
  if (sentMs == null) return false;
  return inInclusiveWindow(sentMs, periodStart, periodEnd);
}

function isHoldPathLead(lead: ApiLead): boolean {
  const sub = String(lead.stage?.milestoneSubStage ?? "").trim();
  const cat = String(lead.stage?.milestoneStageCategory ?? "").trim();
  return isHoldPathLabel(sub, cat);
}

export function computeQuotesSentPathBreakdownNow(
  leads: ApiLead[],
): QuotesSentPathBreakdownNow {
  const breakdown: QuotesSentPathBreakdownNow = { won: 0, lost: 0, hold: 0 };
  for (const lead of leads) {
    if (isLostPathLead(lead)) breakdown.lost += 1;
    else if (isHoldPathLead(lead)) breakdown.hold += 1;
    else breakdown.won += 1;
  }
  return breakdown;
}

/** Won/active path — excludes lost and hold (matches Hub won-only quotation value). */
export function isWonActiveQuotedLead(lead: ApiLead): boolean {
  return !isLostPathLead(lead) && !isHoldPathLead(lead);
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
  const unique = new Map<string, ApiLead>();
  for (const lead of matched) {
    unique.set(stableLeadKey(lead), lead);
  }
  const uniqueLeads = Array.from(unique.values());
  let quotationValueInr = 0;
  let quotationValueAllInr = 0;
  if (args.investments) {
    for (const lead of uniqueLeads) {
      const inv = args.investments.get(stableLeadKey(lead)) ?? 0;
      quotationValueAllInr += inv;
      if (isWonActiveQuotedLead(lead)) quotationValueInr += inv;
    }
  }
  return {
    periodStart: args.periodStart ?? null,
    periodEnd: args.periodEnd ?? null,
    filterField: "quoteSentAt",
    quotesSentCount: uniqueLeads.length,
    quotationValueInr,
    quotationValueAllInr,
    quotationValueScope: "won_only",
    pathBreakdownNow: computeQuotesSentPathBreakdownNow(uniqueLeads),
    source: "crm",
  };
}
