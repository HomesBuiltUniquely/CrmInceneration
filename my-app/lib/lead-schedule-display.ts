import type { Lead } from "@/lib/data";
import {
  isMeetingScheduleSubstage,
  pipelineSubStageLabel,
} from "@/lib/milestone-substage-map";

function readMilestoneSubStage(lead: Lead): string {
  return pipelineSubStageLabel(
    lead.stageBlock?.milestoneSubStage ?? lead.status ?? "",
  );
}

/**
 * Meeting date/time shown on lead detail Schedule card.
 * Prefer `meetingDate`; for Meeting Scheduled / Rescheduled / Revisit / Fix Appointment
 * use `followUpDate` (same as Complete Task Hub appointment time).
 */
export function resolveDisplayMeetingDate(lead: Lead): string {
  const direct = lead.meetingDate?.trim();
  if (direct) return direct;

  const sub = readMilestoneSubStage(lead);
  if (isMeetingScheduleSubstage(sub)) {
    return lead.followUpDate?.trim() ?? "";
  }
  return "";
}

/** Follow-up from CRM milestone / next call — read-only on detail. */
export function resolveDisplayFollowUpDate(lead: Lead): string {
  return lead.followUpDate?.trim() ?? "";
}

export function isAutoScheduleMilestone(lead: Lead): boolean {
  return isMeetingScheduleSubstage(readMilestoneSubStage(lead));
}
