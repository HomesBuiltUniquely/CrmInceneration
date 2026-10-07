import type { CrmLeadType } from "@/lib/leads-filter";
import { LEAD_TYPE_TO_BASE } from "@/lib/crm-lead-endpoints";

export type CreateLeadSourceOption = {
  /** CRM filter / API leadType key */
  leadType: CrmLeadType;
  /** Dropdown label */
  label: string;
  /** Stored on Hub `leadSource` / badge */
  leadSourceBadge: string;
};

/**
 * Sources that support manual create from Create Lead (Super Admin picker).
 * Meta Ads (`mlead`): Hub allows Super Admin `POST /v1/MetaLead` only;
 * Instant Form / sheet / Zapier still 410 for others.
 */
export const CREATE_LEAD_SOURCE_OPTIONS: CreateLeadSourceOption[] = [
  { leadType: "formlead", label: "External Lead", leadSourceBadge: "External Lead" },
  { leadType: "glead", label: "Google Ads", leadSourceBadge: "Google Ads" },
  { leadType: "mlead", label: "Meta Ads", leadSourceBadge: "Meta Ads" },
  { leadType: "addlead", label: "Add Lead", leadSourceBadge: "Add Lead" },
  { leadType: "quikrlead", label: "Quikr Leads", leadSourceBadge: "Quikr" },
  { leadType: "ivrlead", label: "IVR Lead", leadSourceBadge: "IVR Lead" },
  { leadType: "websitelead", label: "Website Lead", leadSourceBadge: "Website Lead" },
  { leadType: "walkinlead", label: "Walk-in Lead", leadSourceBadge: "Walk-in Lead" },
  { leadType: "whatsapplead", label: "WhatsApp", leadSourceBadge: "WhatsApp" },
];

export function isCreatableLeadType(value: string): value is CrmLeadType {
  return CREATE_LEAD_SOURCE_OPTIONS.some((o) => o.leadType === value);
}

export function createLeadSourceOption(
  leadType: string,
): CreateLeadSourceOption | undefined {
  return CREATE_LEAD_SOURCE_OPTIONS.find((o) => o.leadType === leadType);
}

export function hubCreatePathForLeadType(leadType: CrmLeadType): string {
  return LEAD_TYPE_TO_BASE[leadType];
}
