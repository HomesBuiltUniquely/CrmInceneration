import { pipelineSubStageLabel } from "@/lib/milestone-substage-map";

/** Substages set only by Booking & Token / cancellation automation — never manual Complete Task. */
export const AUTO_MANAGED_MILESTONE_SUBSTAGES = [
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
