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

export const DESIGN_REFINEMENT_REVISIT_SUBSTAGE = "Design Refinement Round (Revisit)";

const DESIGN_REFINEMENT_REVISIT_RE =
  /design refinement round\s*\(\s*revisit\s*\)/i;

/**
 * UI label → pipeline substage.
 * e.g. `Meeting Scheduled (Connection)` → `Meeting Scheduled`
 *
 * `(Revisit)` is part of the substage name — do not strip it like a category suffix.
 */
export function pipelineSubStageLabel(value: string): string {
  const t = value.trim();
  if (DESIGN_REFINEMENT_REVISIT_RE.test(t)) {
    return DESIGN_REFINEMENT_REVISIT_SUBSTAGE;
  }
  return t.replace(/\s*\([^)]+\)\s*$/i, "").trim();
}

/** True when selected feedback (substage) is one of the closer cancellation/refund substages. */
export function isClosureResoneSubstage(subStageName: string): boolean {
  return CLOSURE_RESONE_SUBSTAGES.has(normSubstageLabel(pipelineSubStageLabel(subStageName)));
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
  const t = pipelineSubStageLabel(pipelineLabel);
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
  const s = pipelineSubStageLabel(subStageName);
  return (
    s === "Meeting Scheduled" ||
    s === "Meeting Rescheduled" ||
    s === DESIGN_REFINEMENT_REVISIT_SUBSTAGE ||
    s === "Fix Appointment"
  );
}

export function isDesignRefinementSchedulingSubstage(subStageName: string): boolean {
  return pipelineSubStageLabel(subStageName) === DESIGN_REFINEMENT_REVISIT_SUBSTAGE;
}

/** Short heading for the scheduling panel in Complete Task. */
export function meetingSchedulePanelTitle(subStageName: string): string {
  const s = pipelineSubStageLabel(subStageName);
  if (s === DESIGN_REFINEMENT_REVISIT_SUBSTAGE) return "Hub meeting (Design refinement)";
  if (s === "Fix Appointment") return "Hub meeting (Fix appointment)";
  return "Hub meeting (Connection)";
}

export function isMeetingCancelledSubstage(subStageName: string): boolean {
  const s = pipelineSubStageLabel(subStageName);
  return s === "Meeting Cancelled/Paused" || s === "Meeting Cancelled";
}

/** Closed → Closed Won → Booking Done (Booking). */
export function isClosedWonBookingDoneSubstage(subStageName: string): boolean {
  const s = pipelineSubStageLabel(subStageName).toLowerCase();
  return s === "booking done (booking)" || s === "booking done";
}

/** Closed → Closed Won → Token Done (no follow-up). */
export function isClosedWonTokenDoneSubstage(subStageName: string): boolean {
  return pipelineSubStageLabel(subStageName).toLowerCase() === "token done";
}

export function isClosedWonCustomerSubstage(subStageName: string): boolean {
  return (
    isClosedWonBookingDoneSubstage(subStageName) ||
    isClosedWonTokenDoneSubstage(subStageName)
  );
}

export function isClosedWonPathCategory(stageCategory: string): boolean {
  const c = stageCategory.trim().toLowerCase();
  return c === "closed won" || /\bclosed\s+won\b/.test(c);
}
