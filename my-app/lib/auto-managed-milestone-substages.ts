import { pipelineSubStageLabel } from "@/lib/milestone-substage-map";

/**
 * Substages set only by automation / Design Wizard / quote-share — never manual Complete Task.
 * Hub still accepts Meeting Successful for Design auto + quote sync.
 */
export const AUTO_MANAGED_MILESTONE_SUBSTAGES = [
  "Meeting Successful",
  "Booking Done (Booking)",
  "Token Done",
  "Project Cancelled After Token",
  "Project Cancelled After Booking",
  "Refund Processed",
] as const;

const AUTO_MANAGED_NORM = new Set(
  AUTO_MANAGED_MILESTONE_SUBSTAGES.map((s) => s.trim().toUpperCase()),
);

function normSubstage(label: string): string {
  return pipelineSubStageLabel(label).trim().toUpperCase();
}

/** True when substage must not appear in Complete Task feedback dropdown. */
export function isAutoManagedMilestoneSubstage(subStageName: string): boolean {
  return AUTO_MANAGED_NORM.has(normSubstage(subStageName));
}

/** Keep manual Complete Task options — drop auto-managed B&T substages. */
export function isManualCompleteTaskSubstage(subStageName: string): boolean {
  return !isAutoManagedMilestoneSubstage(subStageName);
}
