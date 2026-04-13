import type { CrmLeadType } from "@/lib/leads-filter";

/** Lead type string for Hub appointment `description` / API payloads. */
export function crmLeadTypeToApiLabel(leadType: CrmLeadType): string {
  if (leadType === "formlead") return "Form Lead";
  if (leadType === "glead") return "G Lead";
  if (leadType === "mlead") return "M Lead";
  if (leadType === "addlead") return "Add Lead";
  if (leadType === "websitelead") return "Website Lead";
  return "Form Lead";
}
