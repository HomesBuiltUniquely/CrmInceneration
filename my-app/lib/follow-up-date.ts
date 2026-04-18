/**
 * Legacy-aligned follow-up parsing: `followUpDate` is a string (often ISO-ish).
 * Space between date and time is normalized to `T` before Date.parse (legacy behavior).
 */

export function normalizeFollowUpDateString(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  return s.replace(/^(\d{4}-\d{2}-\d{2}) (\d)/, "$1T$2");
}

export function parseFollowUpTimestampMs(raw: string | null | undefined): number | null {
  const n = normalizeFollowUpDateString(String(raw ?? ""));
  if (!n) return null;
  const ms = Date.parse(n);
  return Number.isNaN(ms) ? null : ms;
}

/** Local calendar midnight → end of same calendar day (inclusive end ms). */
export function localDayBoundsMs(now = new Date()): { start: number; end: number } {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = d.getTime();
  const end = start + 24 * 60 * 60 * 1000 - 1;
  return { start, end };
}

/** True when follow-up instant falls inside today's local date window. */
export function isFollowUpDueLocalToday(
  raw: string | null | undefined,
  now = new Date(),
): boolean {
  const ms = parseFollowUpTimestampMs(raw);
  if (ms === null) return false;
  const { start, end } = localDayBoundsMs(now);
  return ms >= start && ms <= end;
}

/** Follow-up strictly before today's local midnight (still needs parseable date). */
export function isFollowUpOverdueLocal(
  raw: string | null | undefined,
  now = new Date(),
): boolean {
  const ms = parseFollowUpTimestampMs(raw);
  if (ms === null) return false;
  const { start } = localDayBoundsMs(now);
  return ms < start;
}
