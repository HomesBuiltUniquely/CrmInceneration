import type { Lead } from "@/lib/data";
import {
  isMeetingScheduleSubstage,
  pipelineSubStageLabel,
  isClosedWonBookingDoneSubstage,
  isClosedWonCustomerSubstage,
  isClosedWonPathCategory,
} from "@/lib/milestone-substage-map";
import { isLostCategory } from "@/lib/crm-pipeline";

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
  if (isLeadFollowUpHidden(lead)) return "";
  return lead.followUpDate?.trim() ?? "";
}

export function isAutoScheduleMilestone(lead: Lead): boolean {
  return isMeetingScheduleSubstage(readMilestoneSubStage(lead));
}

export function isLeadFollowUpHidden(lead: Lead): boolean {
  const category = (lead.stageBlock?.milestoneStageCategory ?? lead.stageBlock?.presalesMilestoneCategory ?? "").trim();
  const subStage = (lead.stageBlock?.milestoneSubStage ?? lead.stageBlock?.presalesMilestoneSubStage ?? lead.status ?? "").trim();
  const stage = (lead.stageBlock?.milestoneStage ?? lead.stageBlock?.presalesMilestoneStage ?? "").trim();

  if (isLostCategory(category)) return true;
  if (
    stage.toLowerCase() === "closed" &&
    isClosedWonPathCategory(category) &&
    isClosedWonCustomerSubstage(subStage)
  ) return true;

  return false;
}
