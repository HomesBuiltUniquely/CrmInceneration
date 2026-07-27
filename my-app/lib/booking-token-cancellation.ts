/** Hours after Booking Done handoff when cancellation is still allowed. */
export const BOOKING_CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export function parseSubmittedAtMs(submittedAt: string): number | null {
  const ms = new Date(submittedAt).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** True when deal is still inside the 24h cancellation window. */
export function isWithinCancellationWindow(submittedAt: string, nowMs = Date.now()): boolean {
  const submittedMs = parseSubmittedAtMs(submittedAt);
  if (submittedMs == null) return false;
  return nowMs - submittedMs < BOOKING_CANCELLATION_WINDOW_MS;
}

/** True when the 24h cancellation window has ended (super admin delete). */
export function isAfterCancellationWindow(submittedAt: string, nowMs = Date.now()): boolean {
  const submittedMs = parseSubmittedAtMs(submittedAt);
  if (submittedMs == null) return false;
  return nowMs - submittedMs >= BOOKING_CANCELLATION_WINDOW_MS;
}

export function isCancelledBookingTokenDeal(deal: {
  isCancelled?: boolean;
  listingType?: string | null;
  bookingStatus?: string | null;
}): boolean {
  return (
    deal.isCancelled === true ||
    deal.listingType === "cancel" ||
    isCancelledBookingStatus(String(deal.bookingStatus ?? ""))
  );
}

/** Super admin may remove any deal from the Booking & Token dashboard. */
export function canSuperAdminDeleteBookingTokenDeal(
  _deal?: {
    isCancelled?: boolean;
    listingType?: string | null;
    bookingStatus?: string | null;
    submittedAt?: string;
  },
  _nowMs = Date.now(),
): boolean {
  return true;
}

export function cancellationWindowClosesAt(submittedAt: string): Date | null {
  const submittedMs = parseSubmittedAtMs(submittedAt);
  if (submittedMs == null) return null;
  return new Date(submittedMs + BOOKING_CANCELLATION_WINDOW_MS);
}

export function isCancelledBookingStatus(status: string): boolean {
  return status.trim().toLowerCase() === "cancelled";
}
