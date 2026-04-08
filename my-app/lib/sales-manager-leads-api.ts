import { getCrmAuthHeaders } from "@/lib/crm-client-auth";

type AnyJson = Record<string, unknown>;

async function call<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as T & AnyJson;
  if (!res.ok) {
    const msg = typeof (data as AnyJson).message === "string" ? (data as AnyJson).message : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const salesManagerLeadsApi = {
  myLeads: (params?: URLSearchParams | string) =>
    call<AnyJson>(`/api/crm/sales-manager/my-leads${params ? `?${params.toString()}` : ""}`),
  teamLeads: (params?: URLSearchParams | string) =>
    call<AnyJson>(`/api/crm/sales-manager/team-leads${params ? `?${params.toString()}` : ""}`),
  presalesSearch: (params?: URLSearchParams | string) =>
    call<AnyJson>(`/api/crm/presales-search${params ? `?${params.toString()}` : ""}`),
};
