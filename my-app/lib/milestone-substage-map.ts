import { isLostCategory } from "@/lib/crm-pipeline";

/**
 * Closer-stage substages that require `resone` on PUT (same field as LOST).
 * Match pipeline labels case-insensitively.
 */
const CLOSURE_RESONE_SUBSTAGES = new Set([
  "PROJECT CANCELLED AFTER TOKEN",
  "PROJECT CANCELLED AFTER BOOKING",
  "REFUND PROCESSED",
]);

function normSubstageLabel(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

/** True when selected feedback (substage) is one of the closer cancellation/refund substages. */
export function isClosureResoneSubstage(subStageName: string): boolean {
  return CLOSURE_RESONE_SUBSTAGES.has(normSubstageLabel(subStageName));
}

/**
 * When true, Complete Task must collect a reason → sent as `resone` on save.
 * LOST path category **or** closer substages (token/booking cancel, refund).
 */
export function requiresResoneField(path: string, feedback: string): boolean {
  if (isLostCategory(path)) return true;
  return isClosureResoneSubstage(feedback);
}

/**
 * Pipeline catalog may use labels that differ from legacy backend triggers.
 * See spec: persist `Meeting Cancelled` so cancellation email + appointment delete run.
 */
export function normalizeMilestoneSubStageForApi(pipelineLabel: string): string {
  const t = pipelineLabel.trim();
  if (t === "Meeting Cancelled/Paused") {
    return "Meeting Cancelled";
  }
  return t;
}

/**
 * Sub-stages that use the same slot-based `POST /v1/Appointment` flow in Complete Task
 * (first design meeting, fix-appointment queue, or design refinement revisit — see E2E guide).
 */
export function isMeetingScheduleSubstage(subStageName: string): boolean {
  const s = subStageName.trim();
  return (
    s === "Meeting Scheduled" ||
    s === "Meeting Rescheduled" ||
    s === "Design Refinement Round (Revisit)" ||
    s === "Fix Appointment"
  );
}

export function isDesignRefinementSchedulingSubstage(subStageName: string): boolean {
  return subStageName.trim() === "Design Refinement Round (Revisit)";
}

/** Short heading for the scheduling panel in Complete Task. */
export function meetingSchedulePanelTitle(subStageName: string): string {
  const s = subStageName.trim();
  if (s === "Design Refinement Round (Revisit)") return "Hub meeting (Design refinement)";
  if (s === "Fix Appointment") return "Hub meeting (Fix appointment)";
  return "Hub meeting (Connection)";
}

export function isMeetingCancelledSubstage(subStageName: string): boolean {
  const s = subStageName.trim();
  return s === "Meeting Cancelled/Paused" || s === "Meeting Cancelled";
}
