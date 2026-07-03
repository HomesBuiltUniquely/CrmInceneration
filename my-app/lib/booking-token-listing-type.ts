import {
  isCancelledBookingStatus,
  isWithinCancellationWindow,
} from "@/lib/booking-token-cancellation";
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

export function canShowPay(
  listingType: BookingListingType,
  remainingAmount = 0,
): boolean {
  return listingType === "token" && remainingAmount > 0;
}

/** Full 10% paid in token bucket — manual promote to booking tab. */
export function canShowConvert(
  listingType: BookingListingType,
  remainingAmount = 0,
): boolean {
  return listingType === "token" && remainingAmount <= 0;
}

export function isTokenReadyForBookingConvert(
  listingType: BookingListingType,
  remainingAmount: number,
  tenPercentAmount: number,
  paidAmount: number,
): boolean {
  if (listingType !== "token" || remainingAmount > 0) return false;
  if (tenPercentAmount <= 0) return paidAmount > 0;
  return paidAmount >= tenPercentAmount;
}

export function isCancelListingType(listingType: BookingListingType): boolean {
  return listingType === "cancel";
}
