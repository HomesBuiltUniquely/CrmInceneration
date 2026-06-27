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

export function cancellationWindowClosesAt(submittedAt: string): Date | null {
  const submittedMs = parseSubmittedAtMs(submittedAt);
  if (submittedMs == null) return null;
  return new Date(submittedMs + BOOKING_CANCELLATION_WINDOW_MS);
}

export function isCancelledBookingStatus(status: string): boolean {
  return status.trim().toLowerCase() === "cancelled";
}
