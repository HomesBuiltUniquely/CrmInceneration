import { getCrmAuthHeaders } from "@/lib/crm-client-auth";

type AnyJson = Record<string, unknown>;

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
  assign: (payload: AnyJson) => call<AnyJson>("assign", { method: "POST", body: JSON.stringify(payload) }),
  bulkAssign: (payload: AnyJson) => call<AnyJson>("bulk-assign", { method: "POST", body: JSON.stringify(payload) }),
  unassignedLeads: (params?: URLSearchParams | string) =>
    call<AnyJson>(`unassigned-leads${params ? `?${params.toString()}` : ""}`),
  bulkAssignPreview: (payload: AnyJson) => call<AnyJson>("bulk-assign-preview", { method: "POST", body: JSON.stringify(payload) }),
  bulkAssignExecute: (payload: AnyJson) => call<AnyJson>("bulk-assign-execute", { method: "POST", body: JSON.stringify(payload) }),
};
