import { normalizeStageKey } from "@/lib/milestone-progress";

/** Shown when Complete Task tries verify-handoff before Verify Lead (Hub `userMessage` parity). */
export const PRESALES_VERIFY_HANDOFF_MESSAGE =
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
  if (cat.includes("won") && (sub.includes("assigned") || sub === "assigned")) return true;
  if (sub.includes("assigned") && sub.includes("won")) return true;
  return false;
}
