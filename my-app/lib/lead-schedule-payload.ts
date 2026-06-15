/**
 * Hub schedule date contract (Project-ERP backend guide §3.1 + §14).
 *
 * | dateField  | JSON PUT/GET field | DB column        |
 * |------------|--------------------|------------------|
 * | followUp   | followUpDate       | follow_up_date   |
 * | meeting    | meetingDate        | meeting_date     |
 *
 * §14 save example:
 * { "meetingDate": "2026-06-21T11:00:00", "followUpDate": "2026-06-21T11:00:00" }
 */
export const HUB_FOLLOW_UP_DATE_FIELD = "followUpDate";
export const HUB_MEETING_DATE_FIELD = "meetingDate";

/** Legacy read aliases — not primary PUT keys per backend §14. */
export const HUB_FOLLOW_UP_READ_ALIASES = [
  "follow_up_date",
  "nextFollowUp",
  "next_follow_up",
  "nextCallDate",
  "next_call_date",
  "FollowUpDate",
] as const;

export const HUB_MEETING_READ_ALIASES = [
  "meeting_date",
  "siteVisitDate",
  "site_visit_date",
  "visitDate",
  "visit_date",
  "appointmentDate",
  "appointment_date",
] as const;

function pickStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pickFromDynamic(detail: Record<string, unknown>, ...keys: string[]): string {
  const df = detail.dynamicFields;
  if (!df || typeof df !== "object" || Array.isArray(df)) return "";
  return pickStr(df as Record<string, unknown>, ...keys);
}

/** Hub compares by date prefix; normalize space → T for consistency. */
export function normalizeHubScheduleDateString(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  return s.replace(/^(\d{4}-\d{2}-\d{2}) (\d)/, "$1T$2");
}

export type HubScheduleDateInput = {
  followUpDate?: string;
  meetingDate?: string;
  /**
   * Meeting Scheduled / appointment: store the same instant on
   * `follow_up_date` and `meeting_date` (backend §14).
   */
  mirrorFollowUpToMeeting?: boolean;
};

/** Align follow-up + meeting before Hub PUT. */
export function alignHubScheduleDates(input: HubScheduleDateInput): {
  followUpDate?: string;
  meetingDate?: string;
} {
  let followUp = normalizeHubScheduleDateString(input.followUpDate ?? "");
  let meeting = normalizeHubScheduleDateString(input.meetingDate ?? "");

  if (input.mirrorFollowUpToMeeting && followUp) {
    meeting = followUp;
  }

  return {
    ...(followUp ? { followUpDate: followUp } : {}),
    ...(meeting ? { meetingDate: meeting } : {}),
  };
}

export function resolveFollowUpValue(body: Record<string, unknown>): string {
  return normalizeHubScheduleDateString(
    pickStr(body, HUB_FOLLOW_UP_DATE_FIELD, ...HUB_FOLLOW_UP_READ_ALIASES) ||
      pickFromDynamic(body, HUB_FOLLOW_UP_DATE_FIELD, ...HUB_FOLLOW_UP_READ_ALIASES),
  );
}

export function resolveMeetingValue(body: Record<string, unknown>): string {
  return normalizeHubScheduleDateString(
    pickStr(body, HUB_MEETING_DATE_FIELD, ...HUB_MEETING_READ_ALIASES) ||
      pickFromDynamic(body, HUB_MEETING_DATE_FIELD, ...HUB_MEETING_READ_ALIASES),
  );
}

/**
 * Minimal PUT body per backend §14 — only canonical JSON field names.
 * Do not merge full GET detail for schedule-only updates.
 */
export function buildHubScheduleDatePutBody(opts: HubScheduleDateInput): Record<string, unknown> {
  const aligned = alignHubScheduleDates(opts);
  const body: Record<string, unknown> = {};
  if (aligned.followUpDate) body[HUB_FOLLOW_UP_DATE_FIELD] = aligned.followUpDate;
  if (aligned.meetingDate) body[HUB_MEETING_DATE_FIELD] = aligned.meetingDate;
  return body;
}

/** Mirror canonical + legacy aliases when saving inside a full lead PUT body. */
export function applyScheduleDatesToHubPayload(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const followUp = resolveFollowUpValue(body);
  const meeting = resolveMeetingValue(body);

  if (followUp) {
    body[HUB_FOLLOW_UP_DATE_FIELD] = followUp;
    for (const k of HUB_FOLLOW_UP_READ_ALIASES) {
      body[k] = followUp;
    }
  }

  if (meeting) {
    body[HUB_MEETING_DATE_FIELD] = meeting;
    for (const k of HUB_MEETING_READ_ALIASES) {
      body[k] = meeting;
    }
  }

  const df = body.dynamicFields;
  if (df && typeof df === "object" && !Array.isArray(df)) {
    const dfo = { ...(df as Record<string, unknown>) };
    if (followUp) {
      dfo[HUB_FOLLOW_UP_DATE_FIELD] = followUp;
      dfo.nextFollowUp = followUp;
    }
    if (meeting) {
      dfo[HUB_MEETING_DATE_FIELD] = meeting;
      dfo.siteVisitDate = meeting;
    }
    body.dynamicFields = dfo;
  }

  return body;
}

export function hubScheduleDatesPersisted(
  detail: Record<string, unknown>,
  expected: { followUpDate?: string; meetingDate?: string },
): { followUpOk: boolean; meetingOk: boolean } {
  const gotFollowUp = resolveFollowUpValue(detail);
  const gotMeeting = resolveMeetingValue(detail);
  const wantFollowUp = normalizeHubScheduleDateString(expected.followUpDate ?? "");
  const wantMeeting = normalizeHubScheduleDateString(expected.meetingDate ?? "");
  return {
    followUpOk: !wantFollowUp || gotFollowUp === wantFollowUp,
    meetingOk: !wantMeeting || gotMeeting === wantMeeting,
  };
}
