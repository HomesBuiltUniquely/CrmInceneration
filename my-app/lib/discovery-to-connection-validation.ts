import type { Lead } from "@/lib/data";
import {
  leadPropertyGateErrorMessage,
  missingLeadPropertyGateFields,
  requiresLeadPropertyGateForCompleteTask,
} from "@/lib/milestone-advance-gates";
import { isMeetingCancelledSubstage } from "@/lib/milestone-substage-map";

export type DiscoveryToConnectionPayload = {
  milestoneStage: string;
  milestoneStageCategory: string;
  feedback: string;
};

/**
 * Server-safe guard for `handleCompleteTaskApi` — same rules as Complete Task modal:
 * Budget, Property notes, and Configuration for Fresh Lead→Connection and Discovery→Connection
 * (see `requiresLeadPropertyGateForCompleteTask`).
 */
export function validateDiscoveryToConnectionTransition(
  lead: Lead,
  payload: DiscoveryToConnectionPayload
): { valid: boolean; message: string } {
  const cancelMode = isMeetingCancelledSubstage(payload.feedback.trim());

  const gate = requiresLeadPropertyGateForCompleteTask({
    currentMilestoneStage: lead.stageBlock?.milestoneStage,
    currentMilestoneSubStage: lead.stageBlock?.milestoneSubStage,
    currentMilestoneStageCategory: lead.stageBlock?.milestoneStageCategory,
    currentStatus: lead.status,
    newMilestoneStage: payload.milestoneStage.trim(),
    newStageCategory: payload.milestoneStageCategory.trim(),
    cancelMode,
  });

  if (!gate) {
    return { valid: true, message: "" };
  }

  const missing = missingLeadPropertyGateFields(lead);
  if (missing.length === 0) {
    return { valid: true, message: "" };
  }

  return {
    valid: false,
    message: leadPropertyGateErrorMessage(missing),
  };
}
