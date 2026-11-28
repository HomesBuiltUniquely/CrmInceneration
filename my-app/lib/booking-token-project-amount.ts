/**
 * Token Amount / Booking Amount = full project (quote) value — never the 10% target.
 * Hub may send `tokenAmount` / `bookingAmount` as JSON numbers (or null by listing type).
 */

export type BookingTokenProjectAmountSource = {
  listingType?: string | null;
  tokenAmount?: number | null;
  bookingAmount?: number | null;
  dealValue?: number | null;
  quoteAmount?: number | null;
};

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Full project amount for Token / Booking columns.
 * Prefer listing-specific Hub fields; fall back to `dealValue` / `quoteAmount`.
 */
export function resolveBookingTokenProjectAmount(
  deal: BookingTokenProjectAmountSource,
): number {
  const listing = String(deal.listingType ?? "")
    .trim()
    .toLowerCase();
  const dealValue =
    asFiniteNumber(deal.dealValue) ?? asFiniteNumber(deal.quoteAmount) ?? 0;

  if (listing === "booking") {
    return asFiniteNumber(deal.bookingAmount) ?? dealValue;
  }
  if (listing === "token") {
    return asFiniteNumber(deal.tokenAmount) ?? dealValue;
  }
  // All / cancel / unknown — prefer whichever listing field Hub sent, else deal value.
  return (
    asFiniteNumber(deal.bookingAmount) ??
    asFiniteNumber(deal.tokenAmount) ??
    dealValue
  );
}

export function bookingTokenProjectAmountColumnHeader(
  tab: "all" | "booking" | "token" | "cancel" | string,
): string {
  const t = String(tab ?? "").trim().toLowerCase();
  if (t === "token") return "Token Amount";
  if (t === "booking") return "Booking Amount";
  return "Deal Value";
}
