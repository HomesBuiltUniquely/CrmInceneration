import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import {
  isIvrInboundLead,
  isIvrLeadTypeKey,
} from "@/lib/ivr-lead-source";
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

/** Hub delete API bucket — physical table, not IVR tile label. */
export function deleteApiLeadTypeForRow(
  leadType: string | null | undefined,
  _leadSource?: unknown,
): string {
  if (isIvrLeadTypeKey(leadType)) return "ivrlead";
  return String(leadType ?? "").trim().toLowerCase() || "formlead";
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

async function deleteLeadByApiType(
  leadType: string,
  id: number | string,
): Promise<HubDeleteBody> {
  if (isIvrLeadTypeKey(leadType)) {
    return deleteIvrLead(id);
  }
  const res = await fetch(
    `/api/crm/lead/${encodeURIComponent(leadType)}/${encodeURIComponent(String(id))}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: getCrmAuthHeaders(),
      cache: "no-store",
    },
  );
  const body = await readHubBody(res);
  if (!res.ok || body.success === false) {
    throw new Error(hubMessage(body, "Failed to delete lead"));
  }
  return body;
}

/**
 * Delete one IVR inbound row using the correct Hub table:
 * - `ivrlead` → DELETE /v1/IvrLead/{id}
 * - legacy `addlead` + IVR Call → DELETE /v1/AddLead/{id}
 */
export async function deleteIvrInboundLead(
  leadType: string | null | undefined,
  leadSource: unknown,
  id: number | string,
): Promise<HubDeleteBody> {
  if (!isIvrInboundLead(leadType, leadSource)) {
    throw new Error("Not an IVR inbound lead");
  }
  return deleteLeadByApiType(deleteApiLeadTypeForRow(leadType, leadSource), id);
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

async function deleteAddLeadsBulk(ids: number[]): Promise<HubDeleteBody> {
  const numericIds = ids.filter((id) => Number.isInteger(id) && id > 0);
  if (numericIds.length === 0) {
    throw new Error("No valid IDs provided");
  }
  const res = await fetch("/api/admin/bulk-delete-addleads", {
    method: "DELETE",
    credentials: "include",
    headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ids: numericIds }),
  });
  const body = await readHubBody(res);
  if (!res.ok || body.success === false) {
    throw new Error(hubMessage(body, "Failed to delete Add Lead"));
  }
  return body;
}

type IvrInboundDeleteRow = {
  id: number | string;
  leadType?: string | null;
  leadSource?: unknown;
};

/** Bulk delete IVR inbound rows — splits ids across ivrlead + legacy addlead tables. */
export async function deleteIvrInboundLeads(rows: IvrInboundDeleteRow[]): Promise<HubDeleteBody> {
  const ivrIds: number[] = [];
  const legacyAddLeadIds: number[] = [];
  const identifierIds: string[] = [];

  for (const row of rows) {
    if (!isIvrInboundLead(row.leadType, row.leadSource)) continue;
    const n = typeof row.id === "number" ? row.id : Number(row.id);
    if (isIvrLeadTypeKey(row.leadType)) {
      if (Number.isInteger(n) && n > 0) ivrIds.push(n);
      else identifierIds.push(String(row.id));
      continue;
    }
    if (Number.isInteger(n) && n > 0) legacyAddLeadIds.push(n);
    else identifierIds.push(String(row.id));
  }

  if (ivrIds.length === 0 && legacyAddLeadIds.length === 0 && identifierIds.length === 0) {
    throw new Error("No valid IDs provided");
  }

  let last: HubDeleteBody = { success: true };
  if (ivrIds.length > 0) {
    last = await deleteIvrLeadsBulk(ivrIds);
  }
  if (legacyAddLeadIds.length > 0) {
    last = await deleteAddLeadsBulk(legacyAddLeadIds);
  }
  for (const id of identifierIds) {
    const row = rows.find((item) => String(item.id) === id);
    if (!row) continue;
    last = await deleteIvrInboundLead(row.leadType, row.leadSource, id);
  }
  return last;
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
