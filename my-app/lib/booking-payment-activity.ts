const BOOKING_PAYMENT_TITLES: Record<string, string> = {
  BOOKING_PAYMENT_LINK_SENT: "Payment link sent",
  BOOKING_PAYMENT_LINK_COPIED: "Payment link copied",
  BOOKING_PAYMENT_LINK_RESENT: "Payment link resent",
  BOOKING_PAYMENT_LINK_EDITED: "Payment link amount edited",
  BOOKING_PAYMENT_LINK_SUPERSEDED: "Payment link replaced",
  BOOKING_PAYMENT_LINK_DELETED: "Payment link deleted",
  BOOKING_PAYMENT_LINK_CANCELLED: "Payment link cancelled",
  BOOKING_PAYMENT_DELIVERY_FAILED: "Payment link delivery failed",
  BOOKING_PAYMENT_NOT_DELIVERED: "Payment link not delivered",
  BOOKING_PAYMENT_PAID: "Online payment received",
  BOOKING_PAYMENT_STAGE: "Stage changed (Token Done / Booking Done)",
  BOOKING_PAYMENT_FAILED: "Customer payment attempt failed",
  BOOKING_PAYMENT_EXPIRED: "Payment link expired",
  BOOKING_PAYMENT_SWITCH_OFFLINE: "Switched to offline",
  BOOKING_PAYMENT_ANOMALY: "Payment review needed",
};

/** Easebuzz / payment-link lifecycle (sent, copy, resend, delete, expire, delivery). */
const PAYMENT_LINK_ACTIVITY_KEYS = new Set([
  "BOOKING_PAYMENT_LINK_SENT",
  "BOOKING_PAYMENT_LINK_COPIED",
  "BOOKING_PAYMENT_LINK_RESENT",
  "BOOKING_PAYMENT_LINK_EDITED",
  "BOOKING_PAYMENT_LINK_SUPERSEDED",
  "BOOKING_PAYMENT_LINK_DELETED",
  "BOOKING_PAYMENT_LINK_CANCELLED",
  "BOOKING_PAYMENT_DELIVERY_FAILED",
  "BOOKING_PAYMENT_NOT_DELIVERED",
  "BOOKING_PAYMENT_EXPIRED",
]);

/** Money / milestone settlement (paid, stage, failed, offline, anomaly). */
const PAYMENT_SETTLEMENT_ACTIVITY_KEYS = new Set([
  "BOOKING_PAYMENT_PAID",
  "BOOKING_PAYMENT_STAGE",
  "BOOKING_PAYMENT_FAILED",
  "BOOKING_PAYMENT_SWITCH_OFFLINE",
  "BOOKING_PAYMENT_ANOMALY",
  "BOOKING_PAYMENT_RECEIVED",
]);

export type PaymentActivityBucket = "link" | "settlement";

function normalizePaymentActivityKey(raw?: string | null): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/\s+/g, "_");
}

export function isBookingPaymentActivityType(raw?: string | null): boolean {
  const key = normalizePaymentActivityKey(raw);
  if (key.startsWith("BOOKING_PAYMENT_") || key.startsWith("PAYMENT_LINK_")) return true;
  return (
    key === "LINK_SENT" ||
    key === "LINK_DELETED" ||
    key === "LINK_CANCELLED" ||
    key === "SWITCH_OFFLINE"
  );
}

export function isPaymentLinkActivityType(raw?: string | null): boolean {
  const key = normalizePaymentActivityKey(raw);
  if (PAYMENT_LINK_ACTIVITY_KEYS.has(key)) return true;
  if (key.includes("PAYMENT_LINK") || key.endsWith("_PAYMENT_EXPIRED")) return true;
  if (key.includes("DELIVERY_FAILED") || key.includes("NOT_DELIVERED")) return true;
  return false;
}

export function isPaymentSettlementActivityType(raw?: string | null): boolean {
  const key = normalizePaymentActivityKey(raw);
  if (PAYMENT_SETTLEMENT_ACTIVITY_KEYS.has(key)) return true;
  if (key.endsWith("_PAYMENT_PAID") || key.endsWith("_PAYMENT_STAGE")) return true;
  if (key.endsWith("_PAYMENT_FAILED") || key.includes("SWITCH_OFFLINE")) return true;
  return false;
}

/** Split Payments activity filter into link vs money rows. */
export function classifyPaymentActivityBucket(
  rawType?: string | null,
  ...textParts: Array<string | null | undefined>
): PaymentActivityBucket {
  if (isPaymentLinkActivityType(rawType)) return "link";
  if (isPaymentSettlementActivityType(rawType)) return "settlement";
  const text = [rawType, ...textParts]
    .map((p) => String(p ?? "").toLowerCase())
    .join(" ");
  if (
    /payment\s*link|easebuzz|link\s*(sent|copied|resent|deleted|cancelled|expired)/.test(text) &&
    !/payment\s*received|milestone|token\s*done|booking\s*done|webhook\s*confirmed/.test(text)
  ) {
    return "link";
  }
  if (
    /online\s*payment\s*received|payment\s*received|milestone|token\s*done|booking\s*done|webhook\s*confirmed|switch(?:ed)?\s*to\s*offline/.test(
      text,
    )
  ) {
    return "settlement";
  }
  if (
    isBookingPaymentActivityType(rawType) &&
    /link|expired|deliver|copy|resend|edit|cancel|delet/.test(text)
  ) {
    return "link";
  }
  return isBookingPaymentActivityType(rawType) ? "settlement" : "link";
}

export function formatBookingPaymentActivityDetail(activity: {
  description?: string | null;
  note?: string | null;
  change?: { old?: string | null; new?: string | null } | null;
}): string {
  const parts: string[] = [];
  const description = activity.description?.trim() ?? "";
  const note = activity.note?.trim() ?? "";
  if (description) parts.push(description);
  if (note && note !== description) parts.push(note);
  const oldValue = activity.change?.old?.trim() ?? "";
  const newValue = activity.change?.new?.trim() ?? "";
  if (oldValue || newValue) {
    const line = `${oldValue || "—"} → ${newValue || "—"}`;
    if (!parts.includes(line)) parts.push(line);
  }
  return parts.join("\n");
}

export function formatBookingPaymentActivityTitle(
  rawType?: string | null,
  description?: string | null,
): string {
  const key = normalizePaymentActivityKey(rawType);
  const aliases: Record<string, string> = {
    LINK_SENT: "BOOKING_PAYMENT_LINK_SENT",
    LINK_DELETED: "BOOKING_PAYMENT_LINK_DELETED",
    LINK_CANCELLED: "BOOKING_PAYMENT_LINK_CANCELLED",
    COPIED: "BOOKING_PAYMENT_LINK_COPIED",
    RESENT: "BOOKING_PAYMENT_LINK_RESENT",
    EDITED: "BOOKING_PAYMENT_LINK_EDITED",
    SUPERSEDED: "BOOKING_PAYMENT_LINK_SUPERSEDED",
    SWITCH_OFFLINE: "BOOKING_PAYMENT_SWITCH_OFFLINE",
    EXPIRED: "BOOKING_PAYMENT_EXPIRED",
    PAID: "BOOKING_PAYMENT_PAID",
    STAGE: "BOOKING_PAYMENT_STAGE",
    FAILED: "BOOKING_PAYMENT_FAILED",
  };
  const resolved = aliases[key] ?? key;
  const title = BOOKING_PAYMENT_TITLES[resolved];
  if (title) return title;
  if (description?.trim()) return description.trim();
  return "Booking payment";
}

export {
  detectPaymentReceivedKind,
  isBookingPaymentFailedActivity,
  isBookingPaymentStageActivity,
  isOnlinePaymentReceivedActivity,
  paymentReceivedHeadline,
  paymentStageHeadline,
  pickPaymentReceivedMotivateLine,
  type PaymentReceivedKind,
} from "@/lib/payment-received-motivate";
