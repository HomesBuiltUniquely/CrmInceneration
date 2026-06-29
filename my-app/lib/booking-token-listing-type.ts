import {
  isCancelledBookingStatus,
  isWithinCancellationWindow,
} from "@/lib/booking-token-cancellation";
import type { BookingTokenTab } from "@/app/Components/BookingToken/types";

/** Hub column + dashboard tab bucket: token | booking | cancel */
export type BookingListingType = "token" | "booking" | "cancel";

export function resolveListingType(deal: {
  bookingStatus: string;
  paymentKind?: string | null;
  remainingAmount?: number | null;
  listingType?: string | null;
}): BookingListingType {
  const fromHub = deal.listingType?.trim().toLowerCase();
  if (fromHub === "token" || fromHub === "booking" || fromHub === "cancel") {
    return fromHub;
  }

  if (isCancelledBookingStatus(deal.bookingStatus)) {
    return "cancel";
  }

  const kind = String(deal.paymentKind ?? "").toUpperCase();
  if (kind === "FULL_10%") {
    return "booking";
  }
  if (deal.remainingAmount != null && deal.remainingAmount <= 0) {
    return "booking";
  }

  return "token";
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

/** Hub rule: cancel only for token bucket + within 24h of submittedAt. */
export function canShowCancellation(
  listingType: BookingListingType,
  submittedAt: string,
  nowMs = Date.now(),
): boolean {
  return listingType === "token" && isWithinCancellationWindow(submittedAt, nowMs);
}

export function canShowPay(listingType: BookingListingType): boolean {
  return listingType === "token";
}

export function canShowConvert(listingType: BookingListingType): boolean {
  return listingType === "booking";
}

export function isCancelListingType(listingType: BookingListingType): boolean {
  return listingType === "cancel";
}
