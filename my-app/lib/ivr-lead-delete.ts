import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { isIvrInboundLead } from "@/lib/ivr-lead-source";
import { isAdminRole } from "@/lib/roleUtils";

export const IVR_DELETE_CONFIRM_TITLE = "Delete this IVR lead?";
export const IVR_DELETE_CONFIRM_BODY =
  "This cannot be undone. Related timeline, appointments, and booking-token rows for that lead are removed on the server.";

export function canDeleteIvrLead(role: string | null | undefined): boolean {
  return isAdminRole(role ?? "");
}

export function isIvrLeadDeleteTarget(
  leadType: string | null | undefined,
  leadSource?: unknown,
): boolean {
  return isIvrInboundLead(leadType, leadSource);
}

type HubDeleteBody = {
  success?: boolean;
  message?: string;
  deletedCount?: number;
  failedCount?: number;
  failedIds?: number[];
};

function hubMessage(body: HubDeleteBody, fallback: string): string {
  return typeof body.message === "string" && body.message.trim()
    ? body.message.trim()
    : fallback;
}

async function readHubBody(res: Response): Promise<HubDeleteBody> {
  return ((await res.json().catch(() => ({}))) ?? {}) as HubDeleteBody;
}

/** Single IVR delete — `DELETE /v1/IvrLead/{id}` via CRM proxy. Numeric PK preferred; `IV-…` accepted. */
export async function deleteIvrLead(id: number | string): Promise<HubDeleteBody> {
  const res = await fetch(`/api/crm/lead/ivrlead/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
    credentials: "include",
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  const body = await readHubBody(res);
  if (!res.ok || body.success === false) {
    throw new Error(hubMessage(body, "Failed to delete IVR lead"));
  }
  return body;
}

/** Bulk IVR delete — numeric PKs only. Never send `IV-…` identifiers. */
export async function deleteIvrLeadsBulk(ids: number[]): Promise<HubDeleteBody> {
  const numericIds = ids.filter((id) => Number.isInteger(id) && id > 0);
  if (numericIds.length === 0) {
    throw new Error("No valid IDs provided");
  }
  const res = await fetch("/api/admin/bulk-delete-ivrleads", {
    method: "DELETE",
    credentials: "include",
    headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ids: numericIds }),
  });
  const body = await readHubBody(res);
  if (!res.ok || body.success === false) {
    throw new Error(hubMessage(body, "Failed to delete IVR lead"));
  }
  return body;
}

export async function deleteIvrLeads(ids: Array<number | string>): Promise<HubDeleteBody> {
  if (ids.length === 1) {
    return deleteIvrLead(ids[0]!);
  }
  const numericIds: number[] = [];
  const identifierIds: string[] = [];
  for (const id of ids) {
    const n = typeof id === "number" ? id : Number(id);
    if (Number.isInteger(n) && n > 0) numericIds.push(n);
    else identifierIds.push(String(id));
  }
  let last: HubDeleteBody = { success: true };
  if (numericIds.length > 0) {
    last = await deleteIvrLeadsBulk(numericIds);
  }
  for (const id of identifierIds) {
    last = await deleteIvrLead(id);
  }
  if (numericIds.length === 0 && identifierIds.length === 0) {
    throw new Error("No valid IDs provided");
  }
  return last;
}
