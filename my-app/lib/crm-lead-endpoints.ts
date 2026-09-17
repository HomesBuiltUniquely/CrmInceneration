import type { CrmLeadType } from "@/lib/leads-filter";

/**
 * Lead source → REST base path (v1).
 *
 * Meta (`mlead` → `/v1/MetaLead`): use GET list/detail, PUT update, POST verify,
 * DELETE (Admin/Super Admin), activities, and shared assign API.
 * Hub disabled `POST /v1/MetaLead` create (HTTP 410) —
 * Instant Form leads arrive via Meta webhook `/meta/webhook` only.
 */
export const LEAD_TYPE_TO_BASE: Record<CrmLeadType, string> = {
  formlead: "/v1/FormLead",
  glead: "/v1/Home1",
  mlead: "/v1/MetaLead",
  addlead: "/v1/AddLead",
  ivrlead: "/v1/IvrLead",
  websitelead: "/v1/WebsiteLead",
  walkinlead: "/v1/WalkinLead",
  whatsapplead: "/v1/WhatsappLead",
};

/** User-facing copy when Hub returns 410 for Meta create / sheet ingest. */
export const META_LEAD_CREATE_DISABLED_MESSAGE =
  "Meta Instant Form leads sync automatically from Facebook. Manual / Sheet create for Meta Ads is turned off.";

export function detailsUrl(leadType: CrmLeadType, id: string | number): string {
  if (leadType === "walkinlead") {
    return `${LEAD_TYPE_TO_BASE.walkinlead}/${id}`;
  }
  if (leadType === "whatsapplead") {
    return `${LEAD_TYPE_TO_BASE.whatsapplead}/details/${id}`;
  }
  return `${LEAD_TYPE_TO_BASE[leadType]}/details/${id}`;
}

/** Hub DELETE paths to try (primary first) when removing a CRM lead row. */
export function leadDeletePaths(leadType: CrmLeadType, id: string | number): string[] {
  const base = LEAD_TYPE_TO_BASE[leadType];
  if (leadType === "whatsapplead") {
    return [`${base}/${id}`, `${base}/details/${id}`];
  }
  return [`${base}/${id}`];
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
