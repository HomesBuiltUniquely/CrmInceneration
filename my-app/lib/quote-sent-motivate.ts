/** Motivational lines shown on Quote Sent activity rows and send celebration. */
export const QUOTE_SENT_MOTIVATE_LINES = [
  "The hardest part is done — now turn this quote into a yes.",
  "Belief sells. Follow up with confidence; this deal is yours to win.",
  "A quote in their inbox is a door half open. Walk through it.",
  "Great salespeople don't wait — they follow up while interest is warm.",
  "You're closer than you think. One strong call can close this.",
  "Opportunity favors action. Reach out today and own the next step.",
  "Trust your work. The customer already said yes once — guide them home.",
  "Champions close what others leave waiting. Make this one count.",
] as const;

/**
 * True for Hub `QUOTE_SENT_TO_CUSTOMER` / "Quote Sent to Customer" text.
 * Never matches legacy "Quote link set" (Get Quote / save link only).
 */
export function isQuoteSentActivityText(...parts: Array<string | null | undefined>): boolean {
  const text = parts
    .map((p) => String(p ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
  if (!text) return false;
  // Legacy audit rows — not customer-send proof.
  if (/quote\s*link\s*(set|changed)/.test(text)) return false;
  if (text.includes("quote_sent_to_customer")) return true;
  if (/quote\s*sent\s*to\s*customer/.test(text)) return true;
  if (/\bquote\s*sent\b/.test(text)) return true;
  return false;
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Stable pick from seed (activity id) so the line does not flicker on re-render. */
export function pickQuoteSentMotivateLine(seed = ""): string {
  const lines = QUOTE_SENT_MOTIVATE_LINES;
  const idx = hashSeed(seed || String(Date.now())) % lines.length;
  return lines[idx];
}

export function pickRandomQuoteSentMotivateLine(): string {
  const lines = QUOTE_SENT_MOTIVATE_LINES;
  return lines[Math.floor(Math.random() * lines.length)];
}
