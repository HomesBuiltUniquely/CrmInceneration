export type BookingPaymentKind = "FULL_10%" | "TOKEN";

export function calculateBookingTenPercent(quoteAmount: number | null | undefined): number | null {
  if (quoteAmount == null || !Number.isFinite(quoteAmount) || quoteAmount <= 0) {
    return null;
  }
  return Math.round(quoteAmount * 0.1);
}

/** Compare received payment against 10% of selected quote amount. */
export function classifyBookingPayment(
  receivedAmount: number | null,
  quoteAmount: number | null | undefined,
): BookingPaymentKind | null {
  if (receivedAmount == null || receivedAmount <= 0) return null;

  const tenPercent = calculateBookingTenPercent(quoteAmount);
  if (tenPercent == null) return "TOKEN";

  // Treat exact 10% (or any amount at/above it) as full booking advance paid.
  if (receivedAmount >= tenPercent) return "FULL_10%";
  return "TOKEN";
}

export function bookingPaymentKindLabel(kind: BookingPaymentKind): string {
  return kind === "FULL_10%" ? "Full 10% paid" : "Token amount paid";
}

export function bookingPaymentKindDescription(
  kind: BookingPaymentKind,
  receivedAmount: number,
  tenPercent: number | null,
): string {
  if (kind === "FULL_10%") {
    return tenPercent != null
      ? `Received amount meets the required 10% booking advance of ₹${tenPercent.toLocaleString("en-IN")}.`
      : "Received amount meets the required 10% booking advance.";
  }
  return tenPercent != null
    ? `Received amount is below the required 10% booking advance of ₹${tenPercent.toLocaleString("en-IN")}. This will be recorded as token paid.`
    : "Received amount will be recorded as token paid.";
}

/** Live FE preview when rebinding quote on Token Pay (matches Hub nearest-₹ 10%). */
export type QuoteRebindPreview = {
  quoteAmount: number;
  tenPercentAmount: number;
  paidSoFar: number;
  remainingAmount: number;
  extraAmountReceived: number;
  dueNow: number;
};

export function previewQuoteChange(input: {
  amountReceived?: number | null;
  extraAmountReceived?: number | null;
  totalAmountReceived?: number | null;
  quoteAmount: number;
}): QuoteRebindPreview | null {
  const quoteAmount = Number(input.quoteAmount);
  if (!Number.isFinite(quoteAmount) || quoteAmount <= 0) return null;

  const amountReceived = Number(input.amountReceived ?? 0);
  const extraReceived = Number(input.extraAmountReceived ?? 0);
  const totalReceived = Number(input.totalAmountReceived ?? NaN);
  const paidSoFar = Number.isFinite(totalReceived)
    ? Math.max(0, totalReceived)
    : Math.max(0, amountReceived) + Math.max(0, extraReceived);

  const tenPercentAmount = Math.round(quoteAmount * 0.1);
  const remainingAmount = Math.max(0, tenPercentAmount - paidSoFar);
  const extraAmountReceived = Math.max(0, paidSoFar - tenPercentAmount);

  return {
    quoteAmount,
    tenPercentAmount,
    paidSoFar,
    remainingAmount,
    extraAmountReceived,
    dueNow: remainingAmount,
  };
}
