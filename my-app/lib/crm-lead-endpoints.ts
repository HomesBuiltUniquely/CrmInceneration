import type { CrmLeadType } from "@/lib/leads-filter";

/** Lead source → REST base path (v1). */
export const LEAD_TYPE_TO_BASE: Record<CrmLeadType, string> = {
  formlead: "/v1/FormLead",
  glead: "/v1/Home1",
  mlead: "/v1/MetaLead",
  addlead: "/v1/AddLead",
  websitelead: "/v1/WebsiteLead",
};

export function isCrmLeadType(s: string): s is CrmLeadType {
  return s in LEAD_TYPE_TO_BASE;
}

export function detailsUrl(leadType: CrmLeadType, id: string | number): string {
  return `${LEAD_TYPE_TO_BASE[leadType]}/details/${id}`;
}

export function activitiesUrl(leadType: CrmLeadType, id: string | number): string {
  return `${LEAD_TYPE_TO_BASE[leadType]}/activities/${id}`;
}

export function activityUrl(leadType: CrmLeadType, id: string | number): string {
  return `${LEAD_TYPE_TO_BASE[leadType]}/activity/${id}`;
}

export function verifyUrl(leadType: CrmLeadType, id: string | number): string {
  return `${LEAD_TYPE_TO_BASE[leadType]}/verify/${id}`;
}
