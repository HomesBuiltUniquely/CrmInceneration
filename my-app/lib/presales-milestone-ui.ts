import { normalizeStageKey } from "@/lib/milestone-progress";

/** Shown when user picks Assigned in feedback; complete verify section instead. */
export const PRESALES_VERIFY_HANDOFF_MESSAGE =
  "Select Assigned and complete the verify section below to hand off to sales.";

/** Unverified lead: Won / Assigned cannot be saved via Complete Task PUT. */
export const PRESALES_VERIFY_LEAD_REQUIRED_MESSAGE =
  "Use Verify Lead to move to sales. Data Conversion / Won / Assigned is set after verification, not from Complete Task.";

/** Missing pincode before Completing Task → Data Conversion / Won / Renovation. */
export const PRESALES_RENOVATION_PINCODE_REQUIRED_MESSAGE =
  "Pincode is required for Renovation handoff. Enter the property pincode below and save again.";

/** True when presales milestone selection is Verify → Assigned (not Renovation). */
export function isPresalesVerifyHandoffSelection(args: {
  stage: string;
  category: string;
  subStage: string;
  feedbackLabel?: string;
}): boolean {
  if (normalizeStageKey(args.stage) !== "data conversion") return false;
  const cat = args.category.trim().toLowerCase();
  const sub = (args.subStage || args.feedbackLabel || "").trim().toLowerCase();
  // Renovation is its own Complete Task handoff — never route through Verify Lead.
  if (sub.includes("renovation")) return false;
  if (cat.includes("won") && (sub.includes("assigned") || sub === "assigned" || sub === "assign"))
    return true;
  if (sub.includes("assigned") && sub.includes("won")) return true;
  return false;
}

/** True when Complete Task selection is Data Conversion / Won / Renovation (verify-equivalent PUT). */
export function isPresalesRenovationHandoffSelection(args: {
  stage: string;
  category: string;
  subStage: string;
  feedbackLabel?: string;
}): boolean {
  if (normalizeStageKey(args.stage) !== "data conversion") return false;
  const cat = normalizeStageKey(args.category);
  const sub = (args.subStage || args.feedbackLabel || "").trim().toUpperCase();
  return cat === "won" && sub === "RENOVATION";
}

export function isPresalesRenovationPincodeError(message: string): boolean {
  return /pin\s*code|pincode/i.test(message) && /renovation|required/i.test(message);
}
