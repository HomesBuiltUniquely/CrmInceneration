/** Motivational lines for Online payment received (Token vs Booking). */

export type PaymentReceivedKind = "token" | "booking";

export const TOKEN_PAYMENT_MOTIVATE_LINES = [
  "Token in — trust locked. Guide them confidently to the full booking.",
  "First money is belief. Protect this lead and finish the journey.",
  "A token means they chose you. Now make the next step effortless.",
  "Momentum starts with a token. Follow through while commitment is fresh.",
  "They invested trust. Turn this token into a sealed booking.",
  "Small payment, big signal. Own the follow-up and close strong.",
] as const;

export const BOOKING_PAYMENT_MOTIVATE_LINES = [
  "Booking advance received — this deal is real. Deliver excellence next.",
  "Money talks. Celebrate this win and keep the customer experience flawless.",
  "Full commitment unlocked. Now convert excitement into a lasting project.",
  "They paid for the vision. Make every next touchpoint worth it.",
  "Booking secured. Champions protect wins — stay sharp till handover.",
  "This payment is proof. Lead with clarity and finish like a pro.",
] as const;

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

function joinedText(...parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => String(p ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

/** Infer token vs booking from Hub activity type / description / note / stage. */
export function detectPaymentReceivedKind(
  ...parts: Array<string | null | undefined>
): PaymentReceivedKind {
  const text = joinedText(...parts);
  if (!text) return "token";

  // Explicit Hub paymentKind / stage cues win first.
  if (
    /payment\s*kind[^a-z0-9]{0,8}(full|booking)|["']kind["']\s*[:=]\s*["']?(full|booking)/.test(
      text,
    ) ||
    /booking\s*done|full[_\s-]?10|10\s*%\s*(booking|payment)|booking\s*advance/.test(text)
  ) {
    return "booking";
  }
  if (
    /payment\s*kind[^a-z0-9]{0,8}token|["']kind["']\s*[:=]\s*["']?token|token\s*done/.test(
      text,
    )
  ) {
    return "token";
  }

  // Prefer booking when both words appear only if booking-done / full payment is clear.
  if (/\bbooking\b/.test(text) && !/\btoken\b/.test(text)) return "booking";
  if (/\btoken\b/.test(text)) return "token";
  if (/\bbooking\b/.test(text)) return "booking";
  return "token";
}

export function isOnlinePaymentReceivedActivity(
  rawType?: string | null,
  ...textParts: Array<string | null | undefined>
): boolean {
  const key = String(rawType ?? "")
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (
    key === "BOOKING_PAYMENT_PAID" ||
    key.endsWith("_PAYMENT_PAID") ||
    key === "BOOKING_PAYMENT_RECEIVED"
  ) {
    return true;
  }
  const text = joinedText(rawType, ...textParts);
  return /online\s*payment\s*received|payment\s*received\b|webhook\s*confirmed\s*payment/.test(
    text,
  );
}

export function isBookingPaymentStageActivity(
  rawType?: string | null,
  ...textParts: Array<string | null | undefined>
): boolean {
  const key = String(rawType ?? "")
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (key === "BOOKING_PAYMENT_STAGE" || key.endsWith("_PAYMENT_STAGE")) return true;
  const text = joinedText(rawType, ...textParts);
  return (
    /milestone.*(token\s*done|booking\s*done)/.test(text) ||
    /(token\s*done|booking\s*done\s*\(booking\))/.test(text)
  );
}

export function isBookingPaymentFailedActivity(rawType?: string | null): boolean {
  const key = String(rawType ?? "")
    .toUpperCase()
    .replace(/\s+/g, "_");
  return key === "BOOKING_PAYMENT_FAILED" || key.endsWith("_PAYMENT_FAILED");
}

export function paymentReceivedHeadline(kind: PaymentReceivedKind): string {
  return kind === "booking" ? "Booking payment received" : "Token payment received";
}

export function paymentStageHeadline(kind: PaymentReceivedKind): string {
  return kind === "booking"
    ? "Stage changed (Booking Done)"
    : "Stage changed (Token Done)";
}

export function pickPaymentReceivedMotivateLine(
  kind: PaymentReceivedKind,
  seed = "",
): string {
  const lines =
    kind === "booking" ? BOOKING_PAYMENT_MOTIVATE_LINES : TOKEN_PAYMENT_MOTIVATE_LINES;
  const idx = hashSeed(seed || String(Date.now())) % lines.length;
  return lines[idx]!;
}
