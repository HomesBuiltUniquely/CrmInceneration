import type { Lead } from "@/lib/data";

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Client fallback when `lead.designQaLink` is not on the API yet (e.g. Meeting Scheduled before email).
 * New CRM: prefer GET `designQaLink` on the lead; show copy strip when that field is set or this returns true.
 */
export function shouldShowDesignQaLink(lead: Lead): boolean {
  const milestoneSubStage = normalizeLabel(lead.stageBlock?.milestoneSubStage ?? "");
  const legacySubStage = normalizeLabel(lead.status ?? "");
  const nestedLegacySubstage = normalizeLabel(lead.stageBlock?.substage?.substage ?? "");
  const milestoneStage = normalizeLabel(lead.stageBlock?.milestoneStage ?? "");

  const looksScheduledMeeting = (value: string) =>
    value.includes("meeting scheduled") ||
    value.includes("meeting rescheduled") ||
    value.includes("schedule online meeting") ||
    value.includes("schedule offline meeting");

  if (looksScheduledMeeting(milestoneSubStage)) return true;
  if (looksScheduledMeeting(legacySubStage)) return true;
  if (looksScheduledMeeting(nestedLegacySubstage)) return true;

  const looksPostFirstMeetingOrSchedulingQueue = (value: string) =>
    value.includes("design refinement round") || value.includes("fix appointment");

  if (looksPostFirstMeetingOrSchedulingQueue(milestoneSubStage)) return true;
  if (looksPostFirstMeetingOrSchedulingQueue(legacySubStage)) return true;
  if (looksPostFirstMeetingOrSchedulingQueue(nestedLegacySubstage)) return true;

  return milestoneStage === "connection" && legacySubStage.includes("meeting");
}
