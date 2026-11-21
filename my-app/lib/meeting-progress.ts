/** Board `progress` codes from `GET /v1/meetings/board`. */
export const MEETING_PROGRESS_CODES = [
  "SCHEDULED",
  "CANCELLED",
  "SCHEDULED_DRR",
  "IN_PROGRESS",
  "MEETING_ABANDONED",
  "MEETING_SUCCESSFUL_QUOTE_PENDING",
  "MEETING_SUCCESSFUL_QUOTE_NOT_SENT_PNF",
  "QUOTE_SENT_SUCCESSFUL",
  /** Filter-only umbrella: any successful (pending + PNF + quote sent). */
  "MEETING_SUCCESSFUL",
  "MEETING_SUCCESSFUL_DRR",
] as const;

export type MeetingProgress = (typeof MEETING_PROGRESS_CODES)[number];

/** Codes that appear as row badges (not the filter-only umbrella). */
export const MEETING_PROGRESS_ROW_CODES = [
  "SCHEDULED",
  "CANCELLED",
  "IN_PROGRESS",
  "MEETING_ABANDONED",
  "MEETING_SUCCESSFUL_QUOTE_PENDING",
  "MEETING_SUCCESSFUL_QUOTE_NOT_SENT_PNF",
  "QUOTE_SENT_SUCCESSFUL",
] as const;

export type MeetingProgressRow = (typeof MEETING_PROGRESS_ROW_CODES)[number];

export type MeetingProgressTone = {
  bg: string;
  text: string;
  dot: string;
  label: string;
  pill: string;
};

const DEFAULT_LABELS: Record<MeetingProgressRow, string> = {
  SCHEDULED: "Scheduled",
  CANCELLED: "Cancelled",
  IN_PROGRESS: "In Progress",
  MEETING_ABANDONED: "Meeting Never Happened",
  MEETING_SUCCESSFUL_QUOTE_PENDING: "Meeting Successful · Quote pending",
  MEETING_SUCCESSFUL_QUOTE_NOT_SENT_PNF: "Meeting Successful · Quote pending (PNF)",
  QUOTE_SENT_SUCCESSFUL: "Quote Sent · Successful",
};

const TONES: Record<MeetingProgressRow, MeetingProgressTone> = {
  SCHEDULED: {
    bg: "#E0ECFF",
    text: "#1E40AF",
    dot: "#1D4ED8",
    label: DEFAULT_LABELS.SCHEDULED,
    pill: "bg-[#E0ECFF] text-[#1E40AF]",
  },
  CANCELLED: {
    bg: "#FEE2E2",
    text: "#B91C1C",
    dot: "#DC2626",
    label: DEFAULT_LABELS.CANCELLED,
    pill: "bg-[#FEE2E2] text-[#B91C1C]",
  },
  IN_PROGRESS: {
    bg: "#FEF3C7",
    text: "#92400E",
    dot: "#D97706",
    label: DEFAULT_LABELS.IN_PROGRESS,
    pill: "bg-[#FEF3C7] text-[#92400E]",
  },
  MEETING_ABANDONED: {
    bg: "#FEF3F2",
    text: "#B42318",
    dot: "#B42318",
    label: DEFAULT_LABELS.MEETING_ABANDONED,
    pill: "bg-[#FEF3F2] text-[#B42318]",
  },
  MEETING_SUCCESSFUL_QUOTE_PENDING: {
    bg: "#ECFDF5",
    text: "#047857",
    dot: "#10B981",
    label: DEFAULT_LABELS.MEETING_SUCCESSFUL_QUOTE_PENDING,
    pill: "bg-[#ECFDF5] text-[#047857]",
  },
  MEETING_SUCCESSFUL_QUOTE_NOT_SENT_PNF: {
    bg: "#FFF7ED",
    text: "#C2410C",
    dot: "#EA580C",
    label: DEFAULT_LABELS.MEETING_SUCCESSFUL_QUOTE_NOT_SENT_PNF,
    pill: "bg-[#FFF7ED] text-[#C2410C]",
  },
  QUOTE_SENT_SUCCESSFUL: {
    bg: "#F0FDF4",
    text: "#14532D",
    dot: "#15803D",
    label: DEFAULT_LABELS.QUOTE_SENT_SUCCESSFUL,
    pill: "bg-[#F0FDF4] text-[#14532D]",
  },
};

/** Legacy Hub value treated as quote-pending successful. */
const LEGACY_SUCCESSFUL = "MEETING_SUCCESSFUL";

export function normalizeMeetingProgressCode(raw: string): MeetingProgress | undefined {
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if ((MEETING_PROGRESS_CODES as readonly string[]).includes(key)) {
    return key as MeetingProgress;
  }
  return undefined;
}

export function coerceMeetingProgressRow(
  progress?: string | null,
  progressLabel?: string | null,
): MeetingProgressRow {
  const label = (progressLabel ?? "").trim().toLowerCase();
  if (label.includes("cancel")) return "CANCELLED";
  const code = normalizeMeetingProgressCode(progress ?? "");
  if (code === "CANCELLED") return "CANCELLED";
  if (code === LEGACY_SUCCESSFUL) return "MEETING_SUCCESSFUL_QUOTE_PENDING";
  if (code && (MEETING_PROGRESS_ROW_CODES as readonly string[]).includes(code)) {
    return code as MeetingProgressRow;
  }
  return "SCHEDULED";
}

export function meetingProgressTone(
  progress?: string | null,
  progressLabel?: string | null,
): MeetingProgressTone {
  const code = coerceMeetingProgressRow(progress, progressLabel);
  const tone = TONES[code];
  const label = (progressLabel ?? "").trim() || tone.label;
  return { ...tone, label };
}

export function isMeetingSuccessfulProgress(progress?: string | null): boolean {
  const code = normalizeMeetingProgressCode(progress ?? "");
  return (
    code === LEGACY_SUCCESSFUL ||
    code === "MEETING_SUCCESSFUL_QUOTE_PENDING" ||
    code === "MEETING_SUCCESSFUL_QUOTE_NOT_SENT_PNF" ||
    code === "QUOTE_SENT_SUCCESSFUL"
  );
}

export function isMeetingQuotePendingProgress(progress?: string | null): boolean {
  const code = normalizeMeetingProgressCode(progress ?? "");
  return (
    code === "MEETING_SUCCESSFUL_QUOTE_PENDING" ||
    code === "MEETING_SUCCESSFUL_QUOTE_NOT_SENT_PNF" ||
    code === LEGACY_SUCCESSFUL
  );
}

export function isQuoteSentSuccessfulProgress(progress?: string | null): boolean {
  return normalizeMeetingProgressCode(progress ?? "") === "QUOTE_SENT_SUCCESSFUL";
}

/** Filter chip options shown in Meeting Management (includes umbrella MEETING_SUCCESSFUL). */
export const MEETING_PROGRESS_FILTER_OPTIONS: Array<{ id: MeetingProgress; label: string }> = [
  { id: "SCHEDULED", label: DEFAULT_LABELS.SCHEDULED },
  { id: "CANCELLED", label: DEFAULT_LABELS.CANCELLED },
  { id: "SCHEDULED_DRR", label: "Scheduled (DRR)" },
  { id: "IN_PROGRESS", label: DEFAULT_LABELS.IN_PROGRESS },
  { id: "MEETING_ABANDONED", label: DEFAULT_LABELS.MEETING_ABANDONED },
  { id: "MEETING_SUCCESSFUL_QUOTE_PENDING", label: DEFAULT_LABELS.MEETING_SUCCESSFUL_QUOTE_PENDING },
  { id: "MEETING_SUCCESSFUL_QUOTE_NOT_SENT_PNF", label: DEFAULT_LABELS.MEETING_SUCCESSFUL_QUOTE_NOT_SENT_PNF },
  { id: "QUOTE_SENT_SUCCESSFUL", label: DEFAULT_LABELS.QUOTE_SENT_SUCCESSFUL },
  { id: "MEETING_SUCCESSFUL", label: "Any Meeting Successful" },
  { id: "MEETING_SUCCESSFUL_DRR", label: "Meeting Successful (DRR)" },
];

/** Progress checkboxes in the Filter panel — DRR codes stay on the ALL status menu only. */
export const MEETING_PROGRESS_PANEL_FILTER_OPTIONS = MEETING_PROGRESS_FILTER_OPTIONS.filter(
  (option) => option.id !== "SCHEDULED_DRR" && option.id !== "MEETING_SUCCESSFUL_DRR",
);

/** True when meetingLabel / meetingLevel / milestone is Design Refinement Round. */
export function isDesignRefinementMeetingLabel(label?: string | null): boolean {
  const raw = (label ?? "").trim().toLowerCase();
  if (!raw) return false;
  return (
    raw.includes("design refinement") ||
    raw === "design_refinement" ||
    raw === "drr" ||
    raw.includes("meeting scheduled(drr)") ||
    raw.includes("meeting scheduled (drr)") ||
    raw.includes("refinement round")
  );
}

/** Open DRR calendar booking (for Meeting Scheduled (DRR) filter only). */
export function isScheduledDrrMeeting(row: {
  meetingLabel?: string | null;
  meetingLevel?: string | null;
  milestoneSubStage?: string | null;
  meetingStatus?: string | null;
  progress?: string | null;
}): boolean {
  const isDrr =
    isDesignRefinementMeetingLabel(row.meetingLabel) ||
    isDesignRefinementMeetingLabel(row.meetingLevel) ||
    isDesignRefinementMeetingLabel(row.milestoneSubStage);
  if (!isDrr) return false;
  if (row.meetingStatus === "CANCELLED" || row.meetingStatus === "RESCHEDULED") return false;
  if (isMeetingSuccessfulProgress(row.progress)) return false;
  if (normalizeMeetingProgressCode(row.progress ?? "") === "MEETING_ABANDONED") return false;
  return row.meetingStatus === "SCHEDULED" || row.meetingStatus == null || row.progress === "SCHEDULED";
}

/** Successful DRR visit (for Meeting Successful (DRR) filter only). */
export function isSuccessfulDrrMeeting(row: {
  meetingLabel?: string | null;
  meetingLevel?: string | null;
  milestoneSubStage?: string | null;
  meetingStatus?: string | null;
  progress?: string | null;
}): boolean {
  const isDrr =
    isDesignRefinementMeetingLabel(row.meetingLabel) ||
    isDesignRefinementMeetingLabel(row.meetingLevel) ||
    isDesignRefinementMeetingLabel(row.milestoneSubStage);
  if (!isDrr) return false;
  if (row.meetingStatus === "CANCELLED") return false;
  return isMeetingSuccessfulProgress(row.progress);
}

/** CRM Progress column for DRR rows — filters stay separate. */
export function drrProgressDisplayLabel(row: {
  meetingLabel?: string | null;
  meetingLevel?: string | null;
  milestoneSubStage?: string | null;
  meetingStatus?: string | null;
  progress?: string | null;
}): string | undefined {
  if (isSuccessfulDrrMeeting(row)) return "Meeting Successful (DRR)";
  if (isScheduledDrrMeeting(row)) return "Scheduled (DRR)";
  return undefined;
}

/** True when a row matches the selected progress filters (umbrella expands). */
export function meetingProgressMatchesFilter(
  rowProgress: string | undefined,
  selected: MeetingProgress[],
  row?: {
    meetingLabel?: string | null;
    meetingLevel?: string | null;
    milestoneSubStage?: string | null;
    meetingStatus?: string | null;
  },
): boolean {
  if (selected.length === 0) return true;
  const code = normalizeMeetingProgressCode(rowProgress ?? "") ?? "SCHEDULED";
  for (const want of selected) {
    if (want === "SCHEDULED_DRR") {
      if (isScheduledDrrMeeting({ ...row, progress: rowProgress })) return true;
      continue;
    }
    if (want === "MEETING_SUCCESSFUL_DRR") {
      if (isSuccessfulDrrMeeting({ ...row, progress: rowProgress })) return true;
      continue;
    }
    if (want === "MEETING_SUCCESSFUL") {
      if (isMeetingSuccessfulProgress(code)) return true;
      continue;
    }
    if (
      want === "MEETING_SUCCESSFUL_QUOTE_PENDING" ||
      want === "MEETING_SUCCESSFUL_QUOTE_NOT_SENT_PNF" ||
      want === "QUOTE_SENT_SUCCESSFUL"
    ) {
      if (isSuccessfulDrrMeeting({ ...row, progress: rowProgress })) continue;
    }
    if (code === want) return true;
    if (want === "MEETING_SUCCESSFUL_QUOTE_PENDING" && code === LEGACY_SUCCESSFUL) return true;
  }
  return false;
}

/** Drop SCHEDULED_DRR before calling Hub (Hub has no such progress code). */
export function hubProgressQueryCodes(selected: MeetingProgress[]): MeetingProgress[] {
  const withoutDrr = selected.filter(
    (code) => code !== "SCHEDULED_DRR" && code !== "MEETING_SUCCESSFUL_DRR",
  );
  const hasSuccessfulDrr = selected.includes("MEETING_SUCCESSFUL_DRR");
  const successfulHubCodes: MeetingProgressRow[] = [
    "MEETING_SUCCESSFUL_QUOTE_PENDING",
    "MEETING_SUCCESSFUL_QUOTE_NOT_SENT_PNF",
    "QUOTE_SENT_SUCCESSFUL",
  ];
  if (withoutDrr.length === 0) {
    // Narrow Hub to successful rows; client keeps only DRR successful.
    if (hasSuccessfulDrr) return successfulHubCodes;
    if (selected.includes("SCHEDULED_DRR")) return [];
    return [];
  }
  const next = [...withoutDrr];
  if (hasSuccessfulDrr && !next.some((code) => isMeetingSuccessfulProgress(code))) {
    next.push(...successfulHubCodes);
  }
  return [...new Set(next)];
}
