import type { IncentiveBookingLead } from "@/lib/incentives-booking-data";
import { incentivePeriodKeyFromIso } from "@/lib/incentive-period";

/** Minimum token payment (INR) for 50% weighted credit when below 10%. */
export const INCENTIVE_TOKEN_HALF_MIN_INR = 25_000;

export type IncentiveWeightTier = "full" | "half" | "none";

export type IncentiveWeightedResult = {
  weightedInr: number;
  tier: IncentiveWeightTier;
  /** 100, 50, or 0 — share of quotation counted toward incentives. */
  weightPct: number;
  label: string;
};

/** Share of quotation received, e.g. 6.2 for 6.2%. */
export function paymentPctOfQuote(quoteAmount: number, amountReceived: number): number {
  if (!Number.isFinite(quoteAmount) || quoteAmount <= 0) return 0;
  if (!Number.isFinite(amountReceived) || amountReceived <= 0) return 0;
  return (amountReceived / quoteAmount) * 100;
}

/**
 * Weighted value from booking-done payment vs quotation (QV):
 * - ≥ 10% of QV received → 100% of QV
 * - Token (< 10%) with payment ≥ ₹25,000 → 50% of QV
 * - otherwise → ₹0
 */
export function calculateIncentiveWeightedValue(
  quoteAmount: number,
  amountReceived: number,
  opts?: {
    paymentKind?: string;
    remainingAmount?: number | null;
  },
): IncentiveWeightedResult {
  if (!Number.isFinite(quoteAmount) || quoteAmount <= 0) {
    return { weightedInr: 0, tier: "none", weightPct: 0, label: "No quote" };
  }
  if (!Number.isFinite(amountReceived) || amountReceived <= 0) {
    return { weightedInr: 0, tier: "none", weightPct: 0, label: "No payment" };
  }

  const tenPctAmount = Math.round(quoteAmount * 0.1);
  const paymentPct = paymentPctOfQuote(quoteAmount, amountReceived);
  const kind = String(opts?.paymentKind ?? "").toUpperCase();

  const meetsFullTenPct =
    paymentPct >= 10 ||
    amountReceived >= tenPctAmount ||
    (kind === "FULL_10%" && amountReceived >= tenPctAmount);

  if (meetsFullTenPct) {
    return {
      weightedInr: Math.round(quoteAmount),
      tier: "full",
      weightPct: 100,
      label: "Full (10% paid)",
    };
  }

  if (amountReceived >= INCENTIVE_TOKEN_HALF_MIN_INR) {
    return {
      weightedInr: Math.round(quoteAmount * 0.5),
      tier: "half",
      weightPct: 50,
      label: "Half (token ≥₹25k)",
    };
  }

  return {
    weightedInr: 0,
    tier: "none",
    weightPct: 0,
    label: "Not eligible",
  };
}

function leadRecordKey(lead: { leadType: string; leadId: number }): string {
  return `${lead.leadType}:${lead.leadId}`;
}

export type IncrementalWeightedResult = {
  /** New weighted revenue credited in this payment's month. */
  incrementalInr: number;
  /** Cumulative weighted tier after this payment. */
  cumulativeInr: number;
  tier: IncentiveWeightTier;
  label: string;
};

function recordPeriodKey(iso: string): string | null {
  return incentivePeriodKeyFromIso(iso);
}

function cumulativeWeightedForRecord(record: IncentiveBookingLead): IncentiveWeightedResult {
  return calculateIncentiveWeightedValue(record.quoteAmount, record.amountReceived, {
    paymentKind: record.paymentKind,
    remainingAmount: record.remainingAmount,
  });
}

function pickBestRecordInMonth(records: IncentiveBookingLead[]): IncentiveBookingLead {
  return records.reduce((best, cur) => {
    if (cur.amountReceived > best.amountReceived) return cur;
    if (
      cur.amountReceived === best.amountReceived &&
      new Date(cur.submittedAt).getTime() > new Date(best.submittedAt).getTime()
    ) {
      return cur;
    }
    return best;
  });
}

function monthCreditLabel(
  monthCredit: number,
  endCumulative: IncentiveWeightedResult,
  baseline: number,
  quoteAmount: number,
): string {
  if (monthCredit <= 0) return "Already credited";
  const full = Math.round(quoteAmount);
  const half = Math.round(quoteAmount * 0.5);
  if (monthCredit >= full - 1) return "Full (10% paid)";
  if (baseline > 0 && endCumulative.tier === "full" && monthCredit >= half - 1) {
    return "+50% (10% completed)";
  }
  if (monthCredit >= half - 1 && monthCredit <= half + 1) return "Half (token ≥₹25k)";
  return endCumulative.label;
}

function monthCreditTier(
  monthCredit: number,
  endCumulative: IncentiveWeightedResult,
  quoteAmount: number,
): IncentiveWeightTier {
  if (monthCredit <= 0) return "none";
  const full = Math.round(quoteAmount);
  const half = Math.round(quoteAmount * 0.5);
  if (monthCredit >= full - 1) return "full";
  if (monthCredit >= half - 1 && monthCredit <= half + 1) return "half";
  return endCumulative.tier;
}

/**
 * Credit weighted revenue per 15-day incentive period per lead.
 * - Cross-period: Jul 1–15 token 50%, Jul 16–31 completion +50%.
 * - Same period: token then full 10% → 100% for that half (not split as 50% + 50% on two rows).
 */
export function computeIncrementalWeightsByRecordId(
  allLeads: IncentiveBookingLead[],
): Map<string, IncrementalWeightedResult> {
  const byLead = new Map<string, IncentiveBookingLead[]>();
  for (const lead of allLeads) {
    const key = leadRecordKey(lead);
    const bucket = byLead.get(key) ?? [];
    bucket.push(lead);
    byLead.set(key, bucket);
  }

  const result = new Map<string, IncrementalWeightedResult>();

  for (const records of byLead.values()) {
    const byPeriod = new Map<string, IncentiveBookingLead[]>();
    for (const record of records) {
      const period = recordPeriodKey(record.submittedAt);
      if (!period) continue;
      const bucket = byPeriod.get(period) ?? [];
      bucket.push(record);
      byPeriod.set(period, bucket);
    }

    const periods = [...byPeriod.keys()].sort();
    let baseline = 0;

    for (const period of periods) {
      const periodRecords = byPeriod.get(period) ?? [];
      const best = pickBestRecordInMonth(periodRecords);
      const endCumulative = cumulativeWeightedForRecord(best);
      const periodCredit = Math.max(0, endCumulative.weightedInr - baseline);

      for (const record of periodRecords) {
        const isBest = record.id === best.id;
        const incrementalInr = isBest ? periodCredit : 0;
        result.set(record.id, {
          incrementalInr,
          cumulativeInr: endCumulative.weightedInr,
          tier: isBest
            ? monthCreditTier(periodCredit, endCumulative, record.quoteAmount)
            : "none",
          label: isBest
            ? monthCreditLabel(periodCredit, endCumulative, baseline, record.quoteAmount)
            : "Included in period total",
        });
      }

      baseline = endCumulative.weightedInr;
    }
  }

  return result;
}
