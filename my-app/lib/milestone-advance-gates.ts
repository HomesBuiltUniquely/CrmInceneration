import { isLostCategory } from "@/lib/crm-pipeline";
import { normalizeStageKey } from "@/lib/milestone-progress";

/** Pipeline top-level stage names from `crm-pipeline` `nested[].stage` (case-insensitive). */
const DISCOVERY_STAGE = "Discovery";
const CONNECTION_STAGE = "Connection";

/** True when the lead is still in the Fresh Lead intake phase (own stage or Discovery + fresh substage/category). */
export function isFreshLeadMilestonePosition(
  milestoneStage: string | null | undefined,
  milestoneSubStage: string | null | undefined,
  milestoneStageCategory: string | null | undefined,
): boolean {
  const st = normalizeStageKey(milestoneStage ?? "");
  const sub = normalizeStageKey(milestoneSubStage ?? "");
  const cat = normalizeStageKey(milestoneStageCategory ?? "");
  const isFreshToken = (s: string) =>
    s === "fresh lead" || s === "fresh leads" || /^fresh\s+leads?$/.test(s);
  if (isFreshToken(st)) return true;
  if (isFreshToken(sub)) return true;
  if (isFreshToken(cat)) return true;
  return false;
}

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

function isEffectivelyEmptyField(value: string | null | undefined): boolean {
  const v = String(value ?? "").trim();
  if (!v) return true;
  const normalized = v.toLowerCase().replace(/[\s._\-–—/]+/g, "");
  if (!normalized) return true;
  return (
    normalized === "na" ||
    normalized === "none" ||
    normalized === "null" ||
    normalized === "undefined"
  );
}

export function missingLeadPropertyGateFields(
  lead: LeadPropertyGateFields
): Array<"Budget" | "Property notes" | "Configuration"> {
  const missing: Array<"Budget" | "Property notes" | "Configuration"> = [];
  if (isEffectivelyEmptyField(lead.budget)) missing.push("Budget");
  if (isEffectivelyEmptyField(lead.propertyNotes)) missing.push("Property notes");
  if (isEffectivelyEmptyField(lead.configuration)) missing.push("Configuration");
  return missing;
}

export function leadPropertyGateErrorMessage(
  missing: Array<"Budget" | "Property notes" | "Configuration">,
): string {
  if (missing.length === 0) return "";
  return `Fill ${missing.join(", ")} on the Lead tab (required for Fresh Lead → Connection or Discovery → Connection; cannot be empty).`;
}

/**
 * Budget, Property notes, and Configuration are required when:
 * - Moving **Fresh Lead** → **Connection**, or
 * - Moving **Discovery** → **Connection**.
 * Skipped for meeting-cancel flows (`cancelMode`) and LOST category moves.
 */
export function requiresLeadPropertyGateForCompleteTask(args: {
  currentMilestoneStage: string | null | undefined;
  currentMilestoneSubStage?: string | null | undefined;
  currentMilestoneStageCategory?: string | null | undefined;
  newMilestoneStage: string | null | undefined;
  newStageCategory: string | null | undefined;
  cancelMode: boolean;
}): boolean {
  if (args.cancelMode) return false;
  const cat = args.newStageCategory ?? "";
  if (cat && isLostCategory(cat)) return false;

  const cur = args.currentMilestoneStage ?? "";
  const next = args.newMilestoneStage ?? "";

  const isFresh = isFreshLeadMilestonePosition(
    args.currentMilestoneStage,
    args.currentMilestoneSubStage,
    args.currentMilestoneStageCategory,
  );
  const freshLeadToConnection =
    isFresh && matchesMilestoneStage(next, CONNECTION_STAGE);
  if (freshLeadToConnection) return true;

  const discoveryToConnection =
    matchesMilestoneStage(cur, DISCOVERY_STAGE) &&
    matchesMilestoneStage(next, CONNECTION_STAGE);
  if (discoveryToConnection) return true;

  return false;
}

/** @deprecated Use {@link requiresLeadPropertyGateForCompleteTask}. */
export function requiresLeadFieldsForDiscoveryToConnection(args: {
  currentMilestoneStage: string | null | undefined;
  newMilestoneStage: string | null | undefined;
  newStageCategory: string | null | undefined;
  cancelMode: boolean;
}): boolean {
  return requiresLeadPropertyGateForCompleteTask(args);
}
