/**
 * Legacy-aligned follow-up parsing: `followUpDate` is a string (often ISO-ish).
 * Space between date and time is normalized to `T` before Date.parse (legacy behavior).
 */

import { FOLLOW_UP_DATE_CLEAR_SENTINEL } from "@/lib/lead-schedule-payload";

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

export const DEFAULT_FOLLOW_UP_OFFSET_MS = 2 * 60 * 60 * 1000;

/** Previous auto-save default — used to upgrade leads still on +1h. */
const LEGACY_FOLLOW_UP_OFFSET_MS = 60 * 60 * 1000;

/** Hub §14 schedule datetime (`YYYY-MM-DDTHH:mm:ss`, local). */
export function formatHubFollowUpDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/** `<input type="datetime-local">` value — minutes only (browser default step = 60). */
export function formatDateTimeLocalInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** New intake default: enquiry/created instant + 2 hours (7:08 PM → 9:08 PM). */
export function defaultFollowUpFromEnquiryRaw(
  enquiryRaw: string | null | undefined,
  offsetMs = DEFAULT_FOLLOW_UP_OFFSET_MS,
): string {
  const normalized = normalizeFollowUpDateString(String(enquiryRaw ?? "").trim());
  const ms = parseFollowUpTimestampMs(normalized);
  if (ms === null) return normalized;
  return formatHubFollowUpDateTime(new Date(ms + offsetMs));
}

function isMidnightFollowUpInstant(normalized: string): boolean {
  return /T00:00(?::00)?(?:\.\d+)?(?:Z)?$/.test(normalized);
}

/** Correct legacy auto-saves that stamped midnight instead of enquiry time + 1h. */
export function isStaleMidnightAutoFollowUp(
  storedRaw: string | null | undefined,
  enquiryRaw: string | null | undefined,
): boolean {
  const storedNorm = normalizeFollowUpDateString(String(storedRaw ?? "").trim());
  if (!storedNorm || !isMidnightFollowUpInstant(storedNorm)) return false;

  const enquiryMs = parseFollowUpTimestampMs(enquiryRaw);
  if (enquiryMs === null) return false;

  const enquiryDate = new Date(enquiryMs);
  if (enquiryDate.getHours() === 0 && enquiryDate.getMinutes() === 0) return false;

  const storedMs = parseFollowUpTimestampMs(storedNorm);
  if (storedMs === null) return false;

  const storedDate = new Date(storedMs);
  return (
    storedDate.getFullYear() === enquiryDate.getFullYear() &&
    storedDate.getMonth() === enquiryDate.getMonth() &&
    storedDate.getDate() === enquiryDate.getDate()
  );
}

/** Upgrade leads auto-saved with the old +1 hour rule. */
export function isStaleLegacyOneHourAutoFollowUp(
  storedRaw: string | null | undefined,
  enquiryRaw: string | null | undefined,
): boolean {
  const storedMs = parseFollowUpTimestampMs(storedRaw);
  const enquiryMs = parseFollowUpTimestampMs(enquiryRaw);
  if (storedMs === null || enquiryMs === null) return false;
  const legacyTarget = enquiryMs + LEGACY_FOLLOW_UP_OFFSET_MS;
  return Math.abs(storedMs - legacyTarget) <= 60 * 1000;
}

function localCalendarDayStartMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatFollowUpCalendarDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatFollowUpDateTimeDetail(date: Date, rawNormalized: string): string {
  const datePart = formatFollowUpCalendarDate(date);
  const hasTime =
    /T\d{1,2}:\d{2}/.test(rawNormalized) ||
    /^\d{4}-\d{2}-\d{2} \d/.test(rawNormalized.trim());
  if (!hasTime) return datePart;

  const h = date.getHours();
  const hour12 = h % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${datePart}, ${hour12}:${minutes} ${ampm}`;
}

export type FollowUpDueDateTone = "today" | "tomorrow" | "yesterday" | "overdue" | "default";

export type FollowUpDueDateDisplay = {
  label: string;
  detail: string;
  tone: FollowUpDueDateTone;
};

/** List-column label: Today / Tomorrow / Yesterday, otherwise the calendar date. */
export function formatFollowUpDueDateLabel(
  raw: string | null | undefined,
  now = new Date(),
): FollowUpDueDateDisplay {
  const normalized = normalizeFollowUpDateString(String(raw ?? ""));
  if (!normalized || normalized === FOLLOW_UP_DATE_CLEAR_SENTINEL) {
    return { label: "—", detail: "", tone: "default" };
  }

  const ms = parseFollowUpTimestampMs(normalized);
  if (ms === null) return { label: "—", detail: "", tone: "default" };

  const followUpDate = new Date(ms);
  const detail = formatFollowUpDateTimeDetail(followUpDate, normalized);
  const todayStart = localCalendarDayStartMs(now);
  const followUpStart = localCalendarDayStartMs(followUpDate);
  const diffDays = Math.round((followUpStart - todayStart) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return { label: "Today", detail, tone: "today" };
  if (diffDays === 1) return { label: "Tomorrow", detail, tone: "tomorrow" };
  if (diffDays === -1) return { label: "Yesterday", detail, tone: "yesterday" };

  const label = formatFollowUpCalendarDate(followUpDate);
  if (diffDays < -1) return { label, detail, tone: "overdue" };
  return { label, detail, tone: "default" };
}

/**
 * When Hub has no follow-up yet, default to enquiry/created + 2 hours
 * (e.g. lead at 7:08 PM → due 9:08 PM; 11:50 PM → tomorrow 1:50 AM).
 * Re-inquiry: prefer the latest enquiry touch + 2 hours.
 */
export function resolveEffectiveFollowUpDateRaw(
  followUpRaw: string | null | undefined,
  createdRaw?: string | null | undefined,
  options?: { isReinquiry?: boolean; updatedRaw?: string | null | undefined },
): string {
  const followUp = normalizeFollowUpDateString(String(followUpRaw ?? "").trim());
  const created = normalizeFollowUpDateString(String(createdRaw ?? "").trim());
  const updated = normalizeFollowUpDateString(String(options?.updatedRaw ?? "").trim());

  if (followUp === FOLLOW_UP_DATE_CLEAR_SENTINEL) return "";

  const latestEnquiry = (() => {
    const createdMs = parseFollowUpTimestampMs(created);
    const updatedMs = parseFollowUpTimestampMs(updated);
    if (createdMs === null && updatedMs === null) return "";
    if (createdMs === null) return updated;
    if (updatedMs === null) return created;
    return updatedMs >= createdMs ? updated : created;
  })();

  const enquiryBase = latestEnquiry || created;

  if (options?.isReinquiry && latestEnquiry) {
    const latestMs = parseFollowUpTimestampMs(latestEnquiry);
    const followUpMs = followUp ? parseFollowUpTimestampMs(followUp) : null;
    if (latestMs !== null && (followUpMs === null || latestMs >= followUpMs)) {
      return defaultFollowUpFromEnquiryRaw(latestEnquiry);
    }
  }

  if (followUp) {
    if (isStaleMidnightAutoFollowUp(followUp, enquiryBase)) {
      return defaultFollowUpFromEnquiryRaw(enquiryBase);
    }
    if (isStaleLegacyOneHourAutoFollowUp(followUp, enquiryBase)) {
      return defaultFollowUpFromEnquiryRaw(enquiryBase);
    }
    return followUp;
  }

  if (enquiryBase) return defaultFollowUpFromEnquiryRaw(enquiryBase);
  return "";
}
