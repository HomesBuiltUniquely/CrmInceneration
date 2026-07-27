import type { BookingApprovalMode } from "@/app/Components/BookingToken/types";
import type { BookingListingType } from "@/lib/booking-token-listing-type";
import { calculateBookingTenPercent } from "@/lib/booking-done-payment-rules";
import { formatQuoteAmount } from "@/lib/crm-quote-links";

/** Minimum cumulative paid to convert when full 10% not yet reached. */
export const BOOKING_BUFFER_RATE = 0.099;

export function normalizeBookingApprovalMode(raw: unknown): BookingApprovalMode {
  const value = String(raw ?? "").trim().toUpperCase();
  if (value === "FULL_10") return "FULL_10";
  if (value === "BUFFER_9_9") return "BUFFER_9_9";
  return "PENDING";
}

export function readOptionalDealNumber(
  deal: Record<string, unknown>,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const value = deal[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function readOptionalDealBoolean(
  deal: Record<string, unknown>,
  ...keys: string[]
): boolean | undefined {
  for (const key of keys) {
    const value = deal[key];
    if (typeof value === "boolean") return value;
    if (value === "true" || value === 1) return true;
    if (value === "false" || value === 0) return false;
  }
  return undefined;
}

export type BookingBufferDealFields = {
  listingType?: BookingListingType | string | null;
  remainingAmount?: number | null;
  canConvertToBooking?: boolean | null;
  bookingApprovalMode?: BookingApprovalMode | string | null;
  bufferApplied?: boolean | null;
  bufferThresholdAmount?: number | null;
  shortfallAmount?: number | null;
  financeBufferNote?: string | null;
  tenPercentAmount?: number | null;
  quoteAmount?: number | null;
  paidAmount?: number | null;
  preBookingAmount?: number;
};

/** 9.9% of quote — same rounding as 10% helper (Math.round). */
export function calculateBufferThresholdAmount(quoteAmount: number | null | undefined): number {
  if (quoteAmount == null || !Number.isFinite(quoteAmount) || quoteAmount <= 0) return 0;
  return Math.round(quoteAmount * BOOKING_BUFFER_RATE);
}

export function resolveBufferThresholdAmount(
  quoteAmount: number,
  hubValue?: number | null,
): number {
  if (hubValue != null && Number.isFinite(hubValue) && hubValue > 0) return hubValue;
  return calculateBufferThresholdAmount(quoteAmount);
}

function readPaidAmount(deal: BookingBufferDealFields): number {
  return Math.max(0, deal.paidAmount ?? deal.preBookingAmount ?? 0);
}

function readQuoteAmount(deal: BookingBufferDealFields): number {
  return Math.max(0, deal.quoteAmount ?? 0);
}

function readTenPercentAmount(deal: BookingBufferDealFields): number {
  const quote = readQuoteAmount(deal);
  const fromDeal = deal.tenPercentAmount;
  if (fromDeal != null && Number.isFinite(fromDeal) && fromDeal > 0) return fromDeal;
  return calculateBookingTenPercent(quote) ?? 0;
}

/** Derive approval mode from Hub fields or payment totals. */
export function resolveBookingApprovalMode(deal: BookingBufferDealFields): BookingApprovalMode {
  const hubMode = normalizeBookingApprovalMode(deal.bookingApprovalMode);
  if (hubMode === "FULL_10" || hubMode === "BUFFER_9_9") return hubMode;

  const paid = readPaidAmount(deal);
  const tenPercent = readTenPercentAmount(deal);
  const bufferThreshold = resolveBufferThresholdAmount(
    readQuoteAmount(deal),
    deal.bufferThresholdAmount,
  );

  if (tenPercent > 0 && paid >= tenPercent) return "FULL_10";
  if (bufferThreshold > 0 && paid >= bufferThreshold) return "BUFFER_9_9";
  return "PENDING";
}

export function isBufferZonePayment(deal: BookingBufferDealFields): boolean {
  const paid = readPaidAmount(deal);
  const tenPercent = readTenPercentAmount(deal);
  const bufferThreshold = resolveBufferThresholdAmount(
    readQuoteAmount(deal),
    deal.bufferThresholdAmount,
  );
  return bufferThreshold > 0 && paid >= bufferThreshold && paid < tenPercent;
}

/** Hub `canConvertToBooking` when true; else derive from full 10% or 9.9% buffer. */
export function resolveCanConvertToBooking(deal: BookingBufferDealFields): boolean {
  const listingType = String(deal.listingType ?? "").trim().toLowerCase();
  if (listingType !== "token") return false;

  const remaining = Math.max(0, deal.remainingAmount ?? 0);
  const paid = readPaidAmount(deal);
  const tenPercent = readTenPercentAmount(deal);
  const bufferThreshold = resolveBufferThresholdAmount(
    readQuoteAmount(deal),
    deal.bufferThresholdAmount,
  );

  const clientEligible =
    remaining <= 0 ||
    (tenPercent > 0 && paid >= tenPercent) ||
    (bufferThreshold > 0 && paid >= bufferThreshold);

  if (typeof deal.canConvertToBooking === "boolean") {
    return deal.canConvertToBooking || clientEligible;
  }

  return clientEligible;
}

export function isBufferAppliedDeal(deal: BookingBufferDealFields): boolean {
  if (deal.bufferApplied === true) return true;
  if (normalizeBookingApprovalMode(deal.bookingApprovalMode) === "BUFFER_9_9") return true;
  return isBufferZonePayment(deal);
}

export function defaultFinanceBufferNote(
  remainingAmount: number,
  bufferThresholdAmount: number,
): string {
  return `Booking allowed from 9.9% buffer (min ${formatQuoteAmount(bufferThresholdAmount)}). ${formatQuoteAmount(remainingAmount)} still due toward 10% for Finance.`;
}

export type ResolvedBookingBufferFields = {
  canConvertToBooking: boolean;
  bookingApprovalMode: BookingApprovalMode;
  bufferThresholdAmount: number;
  bufferApplied: boolean;
  shortfallAmount?: number;
  financeBufferNote: string | null;
};

/** Merge Hub buffer fields with client-side 9.9% fallback. */
export function resolveBookingBufferFields(deal: BookingBufferDealFields): ResolvedBookingBufferFields {
  const quoteAmount = readQuoteAmount(deal);
  const remaining = Math.max(0, deal.remainingAmount ?? 0);
  const bufferThresholdAmount = resolveBufferThresholdAmount(quoteAmount, deal.bufferThresholdAmount);
  const bookingApprovalMode = resolveBookingApprovalMode(deal);
  const bufferApplied = isBufferAppliedDeal(deal);
  const canConvertToBooking = resolveCanConvertToBooking(deal);

  const hubNote = deal.financeBufferNote?.trim();
  const financeBufferNote =
    hubNote ||
    (bufferApplied && remaining > 0
      ? defaultFinanceBufferNote(remaining, bufferThresholdAmount)
      : null);

  return {
    canConvertToBooking,
    bookingApprovalMode,
    bufferThresholdAmount,
    bufferApplied,
    shortfallAmount:
      deal.shortfallAmount != null && Number.isFinite(deal.shortfallAmount)
        ? Math.max(0, deal.shortfallAmount)
        : bufferApplied && remaining > 0
          ? remaining
          : undefined,
    financeBufferNote,
  };
}

export function bookingApprovalModeLabel(mode: BookingApprovalMode): string {
  if (mode === "FULL_10") return "Full 10%";
  if (mode === "BUFFER_9_9") return "9.9% buffer";
  return "Pending";
}
