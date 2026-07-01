/** Digits-only phone for wa.me (opens existing chat when one exists for that number). */
export function normalizePhoneForWhatsApp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppChatUrl(phone: string): string | null {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}`;
}

/** Opens WhatsApp chat in a new tab; returns false when phone is missing/invalid. */
export function openWhatsAppChat(phone: string): boolean {
  const url = buildWhatsAppChatUrl(phone);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
