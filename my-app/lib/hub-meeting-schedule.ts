export const HUB_MEETING_TIMELINE_START_MIN = 11 * 60;
export const HUB_MEETING_TIMELINE_END_MIN = 19 * 60;
export const HUB_MEETING_DURATION_MIN = 90;
export const HUB_MEETING_SLOT_STEP_MIN = 30;

export type BookedTimelineBlock = {
  id: string;
  startMin: number;
  endMin: number;
  label: string;
  sublabel?: string;
};

export function minutesToHubTimeLabel(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatHubTimeRange(startMin: number, endMin: number): string {
  return `${minutesToHubTimeLabel(startMin)} – ${minutesToHubTimeLabel(endMin)}`;
}

export function listHubMeetingStartOptions(): number[] {
  const options: number[] = [];
  for (
    let m = HUB_MEETING_TIMELINE_START_MIN;
    m + HUB_MEETING_DURATION_MIN <= HUB_MEETING_TIMELINE_END_MIN;
    m += HUB_MEETING_SLOT_STEP_MIN
  ) {
    options.push(m);
  }
  return options;
}

export function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB;
}

export function isHubMeetingStartAvailable(
  startMin: number,
  booked: BookedTimelineBlock[],
): boolean {
  const endMin = startMin + HUB_MEETING_DURATION_MIN;
  if (endMin > HUB_MEETING_TIMELINE_END_MIN) return false;
  return !booked.some((b) => rangesOverlap(startMin, endMin, b.startMin, b.endMin));
}

function parseIsoToMinutesOnDate(iso: string, dateIso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (dateIso.trim() && localDate !== dateIso.trim()) return null;
  return d.getHours() * 60 + d.getMinutes();
}

function labelFromDescription(desc: string): { label: string; sublabel?: string } {
  const trimmed = desc.trim();
  const leadMatch = trimmed.match(/Lead ID:\s*(\d+)/i);
  const nameMatch = trimmed.match(/Meeting with\s+(.+?)\s*-\s*Lead ID:/i);
  if (nameMatch) {
    return {
      label: nameMatch[1].trim(),
      sublabel: leadMatch ? `BLR-A${leadMatch[1]}` : undefined,
    };
  }
  if (leadMatch) return { label: `Lead #${leadMatch[1]}` };
  return { label: trimmed.slice(0, 40) || "Booked" };
}

export function appointmentToBookedBlock(
  raw: unknown,
  dateIso: string,
  index: number,
): BookedTimelineBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const startIso = String(o.startTime ?? o.start ?? "");
  const endIso = String(o.endTime ?? o.end ?? "");
  const startMin = parseIsoToMinutesOnDate(startIso, dateIso);
  const endMin = parseIsoToMinutesOnDate(endIso, dateIso);
  if (startMin === null || endMin === null || endMin <= startMin) return null;

  const customerName =
    typeof o.customerName === "string" && o.customerName.trim()
      ? o.customerName.trim()
      : "";
  const desc = typeof o.description === "string" ? o.description : "";
  const parsed = customerName
    ? { label: customerName, sublabel: desc.match(/Lead ID:\s*(\d+)/i)?.[1] ? `BLR-A${desc.match(/Lead ID:\s*(\d+)/i)![1]}` : undefined }
    : labelFromDescription(desc);

  const id = String(o.id ?? o.appointmentId ?? index);
  return {
    id,
    startMin: Math.max(startMin, HUB_MEETING_TIMELINE_START_MIN),
    endMin: Math.min(endMin, HUB_MEETING_TIMELINE_END_MIN),
    label: parsed.label,
    sublabel: parsed.sublabel,
  };
}

export function computeHubTimelineStats(booked: BookedTimelineBlock[]): {
  availableLabel: string;
  bookedLabel: string;
  utilizationPct: number;
} {
  const windowMin = HUB_MEETING_TIMELINE_END_MIN - HUB_MEETING_TIMELINE_START_MIN;
  let bookedMin = 0;
  for (const b of booked) {
    bookedMin += Math.max(0, b.endMin - b.startMin);
  }
  const availableMin = Math.max(0, windowMin - bookedMin);
  const utilizationPct = windowMin > 0 ? Math.round((bookedMin / windowMin) * 100) : 0;
  return {
    availableLabel: formatDurationLabel(availableMin),
    bookedLabel: formatDurationLabel(bookedMin),
    utilizationPct,
  };
}

function formatDurationLabel(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h 00m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function buildHubMeetingDateTimeIso(dateIso: string, startMin: number): string {
  const h = Math.floor(startMin / 60);
  const m = startMin % 60;
  return `${dateIso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export function formatHubMeetingDateLabel(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateIso;
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "short",
  });
}

export function findEarliestAvailableStart(booked: BookedTimelineBlock[]): number | null {
  for (const start of listHubMeetingStartOptions()) {
    if (isHubMeetingStartAvailable(start, booked)) return start;
  }
  return null;
}
