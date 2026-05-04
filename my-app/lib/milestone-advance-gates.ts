import { isLostCategory } from "@/lib/crm-pipeline";
import { normalizeStageKey } from "@/lib/milestone-progress";

/** Pipeline top-level stage names from `crm-pipeline` `nested[].stage` (case-insensitive). */
const DISCOVERY_STAGE = "Discovery";
const CONNECTION_STAGE = "Connection";
const EXPERIENCE_DESIGN_STAGE = "Experience & Design";

export function matchesMilestoneStage(
  label: string | null | undefined,
  canonical: string
): boolean {
  const a = normalizeStageKey(label ?? "");
  const b = normalizeStageKey(canonical);
  return a.length > 0 && a === b;
}

export type LeadPropertyGateFields = {
  budget: string | null | undefined;
  propertyNotes: string | null | undefined;
  configuration: string | null | undefined;
};

export function missingLeadPropertyGateFields(
  lead: LeadPropertyGateFields
): Array<"Budget" | "Property notes" | "Configuration"> {
  const missing: Array<"Budget" | "Property notes" | "Configuration"> = [];
  if (!(lead.budget ?? "").trim()) missing.push("Budget");
  if (!(lead.propertyNotes ?? "").trim()) missing.push("Property notes");
  if (!(lead.configuration ?? "").trim()) missing.push("Configuration");
  return missing;
}

export function leadPropertyGateErrorMessage(
  missing: Array<"Budget" | "Property notes" | "Configuration">,
): string {
  if (missing.length === 0) return "";
  return `Fill ${missing.join(", ")} on the Lead tab (required for Discovery → Connection and Experience & Design; cannot be empty).`;
}

/**
 * Budget, Property notes, and Configuration are required when:
 * - Moving **Discovery** → **Connection**, or
 * - The milestone move involves **Experience & Design** (entering, leaving, or changing substage there).
 * Skipped for meeting-cancel flows (`cancelMode`) and LOST category moves.
 */
export function requiresLeadPropertyGateForCompleteTask(args: {
  currentMilestoneStage: string | null | undefined;
  newMilestoneStage: string | null | undefined;
  newStageCategory: string | null | undefined;
  cancelMode: boolean;
}): boolean {
  if (args.cancelMode) return false;
  const cat = args.newStageCategory ?? "";
  if (cat && isLostCategory(cat)) return false;

  const cur = args.currentMilestoneStage ?? "";
  const next = args.newMilestoneStage ?? "";

  const discoveryToConnection =
    matchesMilestoneStage(cur, DISCOVERY_STAGE) &&
    matchesMilestoneStage(next, CONNECTION_STAGE);
  if (discoveryToConnection) return true;

  const newIsExperienceDesign = matchesMilestoneStage(
    next,
    EXPERIENCE_DESIGN_STAGE,
  );
  const currentIsExperienceDesign = matchesMilestoneStage(
    cur,
    EXPERIENCE_DESIGN_STAGE,
  );
  if (newIsExperienceDesign || currentIsExperienceDesign) return true;

  return false;
}

/** @deprecated Use {@link requiresLeadPropertyGateForCompleteTask} — gate now includes Experience & Design. */
export function requiresLeadFieldsForDiscoveryToConnection(args: {
  currentMilestoneStage: string | null | undefined;
  newMilestoneStage: string | null | undefined;
  newStageCategory: string | null | undefined;
  cancelMode: boolean;
}): boolean {
  return requiresLeadPropertyGateForCompleteTask(args);
}
