import { COMPACT_MAX } from "../app/Components/MeetingManagement/slot-constants";

export type SlotMode = "single" | "compact" | "count";

export type SlotMeeting = {
  id: string;
  /** Local calendar day `YYYY-MM-DD`. Never derived from a UTC instant. */
  date: string;
  /** Minutes from local midnight. */
  startMin: number;
  customer?: string;
  phone?: string;
  meetingType?: string;
  designer?: string;
  value?: number;
  status?: string;
};

export type DayHourGroups<T> = Record<string, Record<number, T[]>>;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function blankToEmpty(value: string | undefined | null): string {
  const text = (value ?? "").trim();
  if (!text || text === "—" || text === "-" || text.toLowerCase() === "undefined" || text.toLowerCase() === "unassigned") {
    return "";
  }
  return text;
}

/** Hour of the local day key. Does not parse the date as UTC. */
export function slotHour(startMin: number): number | null {
  if (!Number.isFinite(startMin)) return null;
  const hour = Math.floor(startMin / 60);
  if (hour < 0 || hour > 23) return null;
  return hour;
}

export function groupMeetingsByDayHour<T extends SlotMeeting>(meetings: readonly T[]): DayHourGroups<T> {
  const grouped: DayHourGroups<T> = {};
  for (const meeting of meetings) {
    if (!meeting || !DAY_KEY.test(meeting.date ?? "")) continue;
    const hour = slotHour(meeting.startMin);
    if (hour == null) continue;
    const day = grouped[meeting.date] ?? (grouped[meeting.date] = {});
    const bucket = day[hour] ?? (day[hour] = []);
    bucket.push(meeting);
  }
  for (const day of Object.values(grouped)) {
    for (const hour of Object.keys(day)) {
      day[Number(hour)].sort((a, b) => a.startMin - b.startMin || blankToEmpty(a.customer).localeCompare(blankToEmpty(b.customer)));
    }
  }
  return grouped;
}

export function getSlotMode(count: number, compactMax = COMPACT_MAX): SlotMode {
  if (!Number.isFinite(count) || count <= 1) return "single";
  if (count <= compactMax) return "compact";
  return "count";
}

export type MeetingTypeKind = "showroom" | "virtual" | "unset";

/** Site visit has no color token in this presentation, so it uses the unset pair. */
export function meetingTypeKind(type: string | undefined): MeetingTypeKind {
  const key = blankToEmpty(type).toLowerCase();
  if (!key) return "unset";
  if (key.includes("virtual") || key.includes("meet")) return "virtual";
  if (key.includes("showroom")) return "showroom";
  return "unset";
}

export function formatSlotTime(startMin: number): string {
  const hour = slotHour(startMin);
  if (hour == null) return "";
  const minute = Math.floor(startMin) % 60;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")}`;
}

export function formatSlotClock(startMin: number): string {
  const hour = slotHour(startMin);
  if (hour == null) return "";
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${formatSlotTime(startMin)} ${suffix}`;
}

export type KnownSlotStatus = "COMPLETED" | "IN PROGRESS" | "SCHEDULED";

export function knownSlotStatus(status: string | undefined): KnownSlotStatus | null {
  if (status === "COMPLETED" || status === "IN PROGRESS" || status === "SCHEDULED") return status;
  return null;
}

export function slotAriaLabel(meeting: SlotMeeting): string {
  const parts = [formatSlotClock(meeting.startMin), blankToEmpty(meeting.customer), blankToEmpty(meeting.meetingType)];
  const status = knownSlotStatus(meeting.status);
  if (status === "COMPLETED") parts.push("Completed");
  if (status === "IN PROGRESS") parts.push("In progress");
  if (status === "SCHEDULED") parts.push("Scheduled");
  return parts.filter(Boolean).join(", ");
}
