import type { CrmLeadType } from "@/lib/leads-filter";
import { isIvrLeadTypeKey } from "@/lib/ivr-lead-source";

/** Lead type string for Hub appointment `description` / API payloads. */
export function crmLeadTypeToApiLabel(leadType: CrmLeadType): string {
  if (leadType === "formlead") return "Form Lead";
  if (leadType === "glead") return "G Lead";
  if (leadType === "mlead") return "M Lead";
  if (leadType === "addlead") return "Add Lead";
  if (leadType === "ivrlead") return "IVR Lead";
  if (leadType === "websitelead") return "Website Lead";
  if (leadType === "walkinlead") return "Walk-in Lead";
  if (leadType === "whatsapplead") return "WhatsApp";
  return "Form Lead";
}

/**
 * Hub assign / bulk-assign `leadType` labels.
 * Meta accepts `Meta Ads` or `M Lead` — prefer `Meta Ads` (Instant Form handoff).
 * Presales Manager transfer must include Meta the same as Google/Form/WhatsApp.
 */
export function crmLeadTypeToAssignmentLabel(leadType: string): string {
  if (leadType === "formlead") return "Form Lead";
  if (leadType === "glead") return "G Lead";
  if (leadType === "mlead") return "Meta Ads";
  if (leadType === "addlead") return "Add Lead";
  if (isIvrLeadTypeKey(leadType)) return "IVR Lead";
  if (leadType === "websitelead") return "Website Lead";
  if (leadType === "walkinlead") return "Walk-in Lead";
  if (leadType === "whatsapplead") return "WhatsApp";
  return "Form Lead";
}
