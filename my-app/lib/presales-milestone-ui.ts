import { normalizeStageKey } from "@/lib/milestone-progress";

/** Shown when user picks Assigned in feedback; complete verify section instead. */
export const PRESALES_VERIFY_HANDOFF_MESSAGE =
  "Select Assigned and complete the verify section below to hand off to sales.";

/** Unverified lead: Won / Assigned cannot be saved via Complete Task PUT. */
export const PRESALES_VERIFY_LEAD_REQUIRED_MESSAGE =
  "Use Verify Lead to move to sales. Data Conversion / Won / Assigned is set after verification, not from Complete Task.";

/** True when presales milestone selection is post-verify handoff (not allowed via Complete Task). */
export function isPresalesVerifyHandoffSelection(args: {
  stage: string;
  category: string;
  subStage: string;
  feedbackLabel?: string;
}): boolean {
  if (normalizeStageKey(args.stage) !== "data conversion") return false;
  const cat = args.category.trim().toLowerCase();
  const sub = (args.subStage || args.feedbackLabel || "").trim().toLowerCase();
  if (cat.includes("won") && (sub.includes("assigned") || sub === "assigned" || sub === "assign"))
    return true;
  if (sub.includes("assigned") && sub.includes("won")) return true;
  return false;
}
