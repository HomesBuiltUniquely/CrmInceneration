const BOOKING_PAYMENT_TITLES: Record<string, string> = {
  BOOKING_PAYMENT_LINK_SENT: "Payment link sent",
  BOOKING_PAYMENT_LINK_COPIED: "Payment link copied",
  BOOKING_PAYMENT_LINK_RESENT: "Payment link resent",
  BOOKING_PAYMENT_LINK_EDITED: "Payment link amount edited",
  BOOKING_PAYMENT_LINK_SUPERSEDED: "Payment link replaced",
  BOOKING_PAYMENT_DELIVERY_FAILED: "Payment link delivery failed",
  BOOKING_PAYMENT_NOT_DELIVERED: "Payment link not delivered",
  BOOKING_PAYMENT_PAID: "Online payment received",
  BOOKING_PAYMENT_FAILED: "Online payment failed",
  BOOKING_PAYMENT_EXPIRED: "Payment link expired",
  BOOKING_PAYMENT_SWITCH_OFFLINE: "Switched to offline payment",
  BOOKING_PAYMENT_ANOMALY: "Payment review needed",
};

export function isBookingPaymentActivityType(raw?: string | null): boolean {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/\s+/g, "_")
    .startsWith("BOOKING_PAYMENT_");
}

export function formatBookingPaymentActivityTitle(
  rawType?: string | null,
  description?: string | null,
): string {
  const key = String(rawType ?? "")
    .toUpperCase()
    .replace(/\s+/g, "_");
  const title = BOOKING_PAYMENT_TITLES[key];
  if (title) return title;
  if (description?.trim()) return description.trim();
  return "Booking payment";
}
