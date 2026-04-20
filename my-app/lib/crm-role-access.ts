import { normalizeRole } from "@/lib/auth/api";
import type { CrmLeadType } from "@/lib/leads-filter";

export type LeadTypeFilterKey = "all" | CrmLeadType | "verified";

const PRESALES_ALLOWED_LEAD_TYPES: CrmLeadType[] = ["formlead", "addlead", "websitelead"];
const ALL_LEAD_TYPES: CrmLeadType[] = ["formlead", "glead", "mlead", "addlead", "websitelead"];

export function toRoleKey(role: string): string {
  return normalizeRole(role);
}

export function isPresalesRole(role: string): boolean {
  const roleKey = toRoleKey(role);
  return roleKey === "PRESALES_MANAGER" || roleKey === "PRESALES_EXECUTIVE";
}

export function getAllowedLeadTypesForRole(role: string): CrmLeadType[] {
  return isPresalesRole(role) ? [...PRESALES_ALLOWED_LEAD_TYPES] : [...ALL_LEAD_TYPES];
}

export function isLeadTypeAllowedForRole(role: string, leadType: string): boolean {
  if (leadType === "all" || leadType === "verified") return true;
  return getAllowedLeadTypesForRole(role).includes(leadType as CrmLeadType);
}

export function sanitizeLeadTypeForRole(
  role: string,
  leadType: string,
  fallback: CrmLeadType = "formlead",
): LeadTypeFilterKey {
  if (isLeadTypeAllowedForRole(role, leadType)) {
    return leadType as LeadTypeFilterKey;
  }
  return fallback;
}

export function getLeadTypeFilterOptions(
  role: string,
  includeVerified = false,
): Array<{ value: LeadTypeFilterKey; label: string }> {
  if (isPresalesRole(role)) {
    return [
      { value: "all", label: "All Types" },
      { value: "formlead", label: "External Lead" },
      { value: "addlead", label: "Add Lead" },
      { value: "websitelead", label: "Website Lead" },
    ];
  }
  return [
    { value: "all", label: "All Types" },
    { value: "addlead", label: "Add Lead" },
    { value: "formlead", label: "External Lead" },
    { value: "glead", label: "Google Ads" },
    { value: "mlead", label: "Meta Ads" },
    { value: "websitelead", label: "Website Lead" },
    ...(includeVerified ? [{ value: "verified" as const, label: "Verified Leads" }] : []),
  ];
}
