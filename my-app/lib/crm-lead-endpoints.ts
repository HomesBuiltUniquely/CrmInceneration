import type { CrmLeadType } from "@/lib/leads-filter";

/** Lead source → REST base path (v1). */
export const LEAD_TYPE_TO_BASE: Record<CrmLeadType, string> = {
  formlead: "/v1/FormLead",
  glead: "/v1/Home1",
  mlead: "/v1/MetaLead",
  addlead: "/v1/AddLead",
  websitelead: "/v1/WebsiteLead",
  walkinlead: "/v1/WalkinLead",
  whatsapplead: "/v1/WhatsappLead",
};

export function detailsUrl(leadType: CrmLeadType, id: string | number): string {
  if (leadType === "walkinlead") {
    return `${LEAD_TYPE_TO_BASE.walkinlead}/${id}`;
  }
  if (leadType === "whatsapplead") {
    return `${LEAD_TYPE_TO_BASE.whatsapplead}/details/${id}`;
  }
  return `${LEAD_TYPE_TO_BASE[leadType]}/details/${id}`;
}

/** Hub PUT paths to try (primary first) when persisting dedicated-source lead details. */
export function leadUpdatePutPaths(leadType: CrmLeadType, id: string | number): string[] {
  if (leadType === "whatsapplead") {
    return [
      `${LEAD_TYPE_TO_BASE.whatsapplead}/details/${id}`,
      `${LEAD_TYPE_TO_BASE.whatsapplead}/${id}`,
    ];
  }
  return [detailsUrl(leadType, id)];
}

export function isCrmLeadType(s: string): s is CrmLeadType {
  return s in LEAD_TYPE_TO_BASE;
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
