import { normalizeStageKey } from "@/lib/milestone-progress";

/** Legacy message when verify-handoff is attempted without the verify panel flow. */
export const PRESALES_VERIFY_HANDOFF_MESSAGE =
  "Select Assigned and complete the verify section below to hand off to sales.";

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
