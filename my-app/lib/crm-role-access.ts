import { normalizeRole } from "@/lib/auth/api";
import type { CrmLeadType } from "@/lib/leads-filter";
import { CRM_LEAD_TYPES } from "@/lib/leads-filter";
import { isIvrLeadTypeKey } from "@/lib/ivr-lead-source";
import { isPresalesRole as isPresalesRoleUtil } from "@/lib/roleUtils";

export type LeadTypeFilterKey = "all" | CrmLeadType | "verified" | "ivr_call";

const ALL_LEAD_TYPES: CrmLeadType[] = [...CRM_LEAD_TYPES];

export function toRoleKey(role: string): string {
  return normalizeRole(role);
}

export function isPresalesRole(role: string): boolean {
  return isPresalesRoleUtil(role);
}

export {
  isSalesRole,
  isAdminRole,
  canViewBothMilestonePipelines,
  crmPipelineRoleParam,
} from "@/lib/roleUtils";

/** All CRM lead sources allowed in `/v1/leads/filter` proxy (visibility still enforced upstream). */
export function getAllowedLeadTypesForRole(_role: string): CrmLeadType[] {
  return [...ALL_LEAD_TYPES];
}

export function isLeadTypeAllowedForRole(role: string, leadType: string): boolean {
  if (leadType === "all" || leadType === "verified" || isIvrLeadTypeKey(leadType)) return true;
  return getAllowedLeadTypesForRole(role).includes(leadType as CrmLeadType);
}

export function sanitizeLeadTypeForRole(
  role: string,
  leadType: string,
  fallback: CrmLeadType = "formlead",
): LeadTypeFilterKey {
  if (isIvrLeadTypeKey(leadType)) return "ivrlead";
  if (isLeadTypeAllowedForRole(role, leadType)) {
    return leadType as LeadTypeFilterKey;
  }
  return fallback;
}

export function getLeadTypeFilterOptions(
  role: string,
): Array<{ value: LeadTypeFilterKey; label: string }> {
  if (isPresalesRole(role)) {
    return [
      { value: "all", label: "All Types" },
      { value: "formlead", label: "External Lead" },
      { value: "glead", label: "Google Ads" },
      { value: "mlead", label: "Meta Ads" },
      { value: "addlead", label: "Add Lead" },
      { value: "ivrlead", label: "IVR Lead" },
      { value: "websitelead", label: "Website Lead" },
      { value: "walkinlead", label: "Walk-in Lead" },
      { value: "whatsapplead", label: "WhatsApp" },
    ];
  }
  return [
    { value: "all", label: "All Types" },
    { value: "addlead", label: "Add Lead" },
    { value: "ivrlead", label: "IVR Lead" },
    { value: "formlead", label: "External Lead" },
    { value: "glead", label: "Google Ads" },
    { value: "mlead", label: "Meta Ads" },
    { value: "websitelead", label: "Website Lead" },
    { value: "walkinlead", label: "Walk-in Lead" },
    { value: "whatsapplead", label: "WhatsApp" },
  ];
}
