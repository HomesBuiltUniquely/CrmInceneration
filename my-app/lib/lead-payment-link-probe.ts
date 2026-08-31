import type { ActivityItem, Lead } from "@/lib/data";
import { isBookingPaymentActivityType } from "@/lib/booking-payment-activity";

const TERMINAL_PAYMENT_ACTIVITY = new Set([
  "BOOKING_PAYMENT_PAID",
  "BOOKING_PAYMENT_EXPIRED",
  "BOOKING_PAYMENT_LINK_SUPERSEDED",
  "BOOKING_PAYMENT_SWITCH_OFFLINE",
]);

function normalizePaymentActivityType(raw?: string | null): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function latestBookingPaymentActivity(
  activities: ActivityItem[] | undefined,
): ActivityItem | null {
  for (const activity of activities ?? []) {
    if (isBookingPaymentActivityType(activity.rawActivityType)) {
      return activity;
    }
  }
  return null;
}

/** Skip GET .../payment-links/active unless lead history suggests a link may still be open. */
export function shouldProbeActivePaymentLink(lead: Pick<Lead, "activities">): boolean {
  const latest = latestBookingPaymentActivity(lead.activities);
  if (!latest) return false;

  const key = normalizePaymentActivityType(latest.rawActivityType);
  if (TERMINAL_PAYMENT_ACTIVITY.has(key)) return false;
  return key.startsWith("BOOKING_PAYMENT_");
}
