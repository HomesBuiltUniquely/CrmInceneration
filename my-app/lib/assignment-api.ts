import { getCrmAuthHeaders } from "@/lib/crm-client-auth";

type AnyJson = Record<string, unknown>;

export type AssignLeadPayload = {
  leadType: string;
  leadId: number;
  salesExecutiveId: number;
  /** G/M/Website verified sales → presales only (min 3 chars). Optional otherwise. */
  reassignReason?: string;
  /**
   * Reassign popup: Yes → true, No → false.
   * Omitted → Hub defaults to true (legacy). Alias `sendWhatsApp` also accepted upstream.
   * When true and new assignee is sales on a verified lead: contact_us_msg + take_action_msg.
   */
  notifyCustomer?: boolean;
};

export type BulkAssignPayload = {
  leadType: string;
  leadIds: number[];
  assignmentMode: string;
  assignees: Array<{ userId: number; percentage?: number }>;
  reassignReason?: string;
  notifyCustomer?: boolean;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/assignment/${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as T & AnyJson;
  if (!res.ok) {
    const message = (data as AnyJson).message;
    const msg = typeof message === "string" ? message : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const assignmentApi = {
  assign: (payload: AssignLeadPayload) =>
    call<AnyJson>("assign", { method: "POST", body: JSON.stringify(payload) }),
  bulkAssign: (payload: BulkAssignPayload) =>
    call<AnyJson>("bulk-assign", { method: "POST", body: JSON.stringify(payload) }),
  unassignedLeads: (params?: URLSearchParams | string) =>
    call<AnyJson>(`unassigned-leads${params ? `?${params.toString()}` : ""}`),
  bulkAssignPreview: (payload: BulkAssignPayload) =>
    call<AnyJson>("bulk-assign-preview", { method: "POST", body: JSON.stringify(payload) }),
  bulkAssignExecute: (payload: BulkAssignPayload) =>
    call<AnyJson>("bulk-assign-execute", { method: "POST", body: JSON.stringify(payload) }),
};
