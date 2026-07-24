import {
  isCancelledBookingStatus,
  isWithinCancellationWindow,
} from "@/lib/booking-token-cancellation";
import { resolveCanConvertToBooking } from "@/lib/booking-token-buffer";
import type { BookingTokenTab } from "@/app/Components/BookingToken/types";

/** Hub column + dashboard tab bucket: token | booking | cancel */
export type BookingListingType = "token" | "booking" | "cancel";

function hubBookingStatus(deal: { bookingStatus: string }): string {
  return deal.bookingStatus?.trim().toLowerCase() ?? "";
}

/**
 * Booking tab only when `bookingStatus === confirmed` (after Convert or full-10% handoff).
 * Pay completing 10% stays on Token tab until Convert.
 */
export function resolveListingType(deal: {
  bookingStatus: string;
  paymentKind?: string | null;
  remainingAmount?: number | null;
  listingType?: string | null;
}): BookingListingType {
  const fromHub = deal.listingType?.trim().toLowerCase();
  const status = hubBookingStatus(deal);

  if (fromHub === "cancel" || isCancelledBookingStatus(deal.bookingStatus)) {
    return "cancel";
  }

  if (status === "confirmed") {
    return "booking";
  }

  return "token";
}

/** BFF: align Hub listingType with dashboard rules before returning to the client. */
export function applyResolvedListingType<
  T extends {
    bookingStatus: string;
    paymentKind?: string | null;
    remainingAmount?: number | null;
    listingType?: string | null;
  },
>(deal: T): T {
  return {
    ...deal,
    listingType: resolveListingType(deal),
  };
}

/** Query param for GET /booking-token/deals — omit for All tab. */
export function listingTypeQueryForTab(tab: BookingTokenTab): BookingListingType | undefined {
  if (tab === "all") return undefined;
  return tab;
}

export function listingTypeLabel(type: BookingListingType): string {
  if (type === "booking") return "Booking";
  if (type === "cancel") return "Cancel";
  return "Token";
}

/** Human label for deal-summary “Level” (Token / Booking / Cancel). */
export function dealLevelLabel(deal: {
  listingType?: string | null;
  bookingStatus?: string | null;
  isCancelled?: boolean | null;
  cancellationApprovalStatus?: string | null;
}): string {
  const listing = deal.listingType?.trim().toLowerCase();
  const status = deal.bookingStatus?.trim().toLowerCase() ?? "";
  const approval = deal.cancellationApprovalStatus?.trim().toUpperCase() ?? "";

  if (
    listing === "cancel" ||
    deal.isCancelled ||
    status === "cancelled" ||
    status === "pending_cancellation" ||
    approval === "PENDING"
  ) {
    if (status === "pending_cancellation" || approval === "PENDING") {
      return "Cancel (pending)";
    }
    return "Cancel";
  }

  if (listing === "booking" || status === "confirmed") {
    return "Booking";
  }

  return "Token";
}

export type DealLevelTone = "token" | "booking" | "cancel";

export function dealLevelTone(deal: {
  listingType?: string | null;
  bookingStatus?: string | null;
  isCancelled?: boolean | null;
  cancellationApprovalStatus?: string | null;
}): DealLevelTone {
  const label = dealLevelLabel(deal);
  if (label.startsWith("Cancel")) return "cancel";
  if (label === "Booking") return "booking";
  return "token";
}

/** Cancel within 24h of handoff — token (partial) or booking (after convert). */
export function canShowCancellation(
  listingType: BookingListingType,
  submittedAt: string,
  nowMs = Date.now(),
): boolean {
  if (listingType === "cancel") return false;
  if (!isWithinCancellationWindow(submittedAt, nowMs)) return false;
  return listingType === "token" || listingType === "booking";
}

/** Token bucket — show Pay while remaining toward 10% is due. */
export function canShowPay(
  listingType: BookingListingType,
  remainingAmount = 0,
): boolean {
  return listingType === "token" && remainingAmount > 0;
}

/** Token bucket — show Convert when Hub allows (full 10% or 9.9% buffer). */
export function canShowConvert(
  listingType: BookingListingType,
  remainingAmount = 0,
  canConvertToBooking?: boolean,
): boolean {
  if (listingType !== "token") return false;
  if (typeof canConvertToBooking === "boolean") return canConvertToBooking;
  return remainingAmount <= 0;
}

export function isTokenReadyForBookingConvert(
  listingType: BookingListingType,
  remainingAmount: number,
  tenPercentAmount: number,
  paidAmount: number,
  canConvertToBooking?: boolean,
  quoteAmount?: number,
  bufferThresholdAmount?: number,
): boolean {
  return resolveCanConvertToBooking({
    listingType,
    remainingAmount,
    canConvertToBooking: canConvertToBooking ?? null,
    tenPercentAmount,
    quoteAmount,
    paidAmount,
    bufferThresholdAmount,
  });
}

export function isCancelListingType(listingType: BookingListingType): boolean {
  return listingType === "cancel";
}
