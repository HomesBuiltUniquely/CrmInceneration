/** Minimum token payment (INR) for 50% weighted credit when below 10%. */
export const INCENTIVE_TOKEN_HALF_MIN_INR = 25_000;

/** Minimum token payment (% of quote) for 50% weighted credit when below 10%. */
export const INCENTIVE_TOKEN_HALF_MIN_PCT = 5;

export type IncentiveWeightTier = "full" | "half" | "none";

export type IncentiveWeightedResult = {
  weightedInr: number;
  tier: IncentiveWeightTier;
  /** 100, 50, or 0 — share of quotation counted toward incentives. */
  weightPct: number;
  label: string;
};

/**
 * Weighted value from booking-done payment vs quotation (QV):
 * - ≥ 10% of QV received → 100% of QV
 * - < 10% and (≥ 5% of QV or ≥ ₹25,000) → 50% of QV
 * - otherwise → 0
 */
export function calculateIncentiveWeightedValue(
  quoteAmount: number,
  amountReceived: number,
): IncentiveWeightedResult {
  if (!Number.isFinite(quoteAmount) || quoteAmount <= 0) {
    return { weightedInr: 0, tier: "none", weightPct: 0, label: "No quote" };
  }
  if (!Number.isFinite(amountReceived) || amountReceived <= 0) {
    return { weightedInr: 0, tier: "none", weightPct: 0, label: "No payment" };
  }

  const tenPctAmount = Math.round(quoteAmount * 0.1);
  const fivePctAmount = Math.round(quoteAmount * (INCENTIVE_TOKEN_HALF_MIN_PCT / 100));

  if (amountReceived >= tenPctAmount) {
    return {
      weightedInr: Math.round(quoteAmount),
      tier: "full",
      weightPct: 100,
      label: "Full (10% paid)",
    };
  }

  const qualifiesHalf =
    amountReceived >= fivePctAmount || amountReceived >= INCENTIVE_TOKEN_HALF_MIN_INR;

  if (qualifiesHalf) {
    return {
      weightedInr: Math.round(quoteAmount * 0.5),
      tier: "half",
      weightPct: 50,
      label: "Half (token)",
    };
  }

  return {
    weightedInr: 0,
    tier: "none",
    weightPct: 0,
    label: "Not eligible",
  };
}
