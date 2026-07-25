/** Display helpers for Booking & Token tables and drawers (IST-friendly). */

export function displayDash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

/** Business booking date from API (`YYYY-MM-DD`). */
export function formatBookingDateDisplay(isoDate: string | null | undefined): string {
  if (!isoDate?.trim()) return "—";
  const trimmed = isoDate.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return "—";
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

/** Form submitted / approval / cancellation instants (ISO-8601). */
export function formatFormSubmittedAt(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function resolveFormSubmittedInstant(
  createdAt: string | null | undefined,
  submittedAt: string | null | undefined,
): string | null {
  const created = createdAt?.trim();
  if (created) return created;
  const submitted = submittedAt?.trim();
  return submitted || null;
}
