import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { normalizeToArray } from "@/lib/api-normalize";

type AnyJson = Record<string, unknown>;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, {
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

async function list(path: string): Promise<AnyJson[]> {
  const raw = await call<unknown>(path);
  return normalizeToArray<AnyJson>(raw);
}

export const adminPanelApi = {
  createManager: (payload: AnyJson) =>
    call<AnyJson>("create-manager", { method: "POST", body: JSON.stringify(payload) }),
  createSalesExecutive: (payload: AnyJson) =>
    call<AnyJson>("create-sales-executive", { method: "POST", body: JSON.stringify(payload) }),
  createPreSales: (payload: AnyJson) =>
    call<AnyJson>("create-pre-sales", { method: "POST", body: JSON.stringify(payload) }),
  createAdmin: (payload: AnyJson) =>
    call<AnyJson>("create-admin", { method: "POST", body: JSON.stringify(payload) }),
  listManagers: () => list("managers"),
  listSalesExecutives: () => list("sales-executives"),
  listPreSales: () => list("pre-sales"),
  listDesignManagers: () => list("design-managers"),
  listDesigners: () => list("designers"),
  listAdmins: () => list("admins"),
  listAllUsers: () => list("all-users"),
  branchTransferUsers: () => list("branch-transfer-users"),
  /** Super Admin: optional `userId` filters audit trail (`GET .../branch-transfer-history?userId=`). */
  branchTransferHistory: (userId?: number | string) => {
    const q =
      userId !== undefined && String(userId).trim() !== ""
        ? `?userId=${encodeURIComponent(String(userId))}`
        : "";
    return list(`branch-transfer-history${q}`);
  },
  /** Body: `{ userId, toBranch, reason? }` per backend contract. */
  branchTransfer: (payload: AnyJson) =>
    call<AnyJson>("branch-transfer", { method: "POST", body: JSON.stringify(payload) }),
  /** Master API: PUT /v1/SalesExecutive/{id}/status with raw boolean body. */
  setSalesExecutiveStatus: async (id: number | string, active: boolean) => {
    const res = await fetch(`/api/sales-executive/${id}/status`, {
      method: "PUT",
      cache: "no-store",
      credentials: "include",
      headers: getCrmAuthHeaders({
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
      body: JSON.stringify(active),
    });
    const data = (await res.json().catch(() => ({}))) as AnyJson;
    if (!res.ok) {
      const msg = typeof data.message === "string" ? data.message : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  },
  updateSalesExecutive: (id: number | string, payload: AnyJson) =>
    call<AnyJson>(`sales-executives/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteSalesExecutive: (id: number | string) =>
    call<AnyJson>(`sales-executives/${id}`, { method: "DELETE" }),
  updatePreSales: (id: number | string, payload: AnyJson) =>
    call<AnyJson>(`pre-sales/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deletePreSales: (id: number | string) => call<AnyJson>(`pre-sales/${id}`, { method: "DELETE" }),
  createDesignManager: (payload: AnyJson) =>
    call<AnyJson>("create-design-manager", { method: "POST", body: JSON.stringify(payload) }),
  createDesigner: (payload: AnyJson) =>
    call<AnyJson>("create-designer", { method: "POST", body: JSON.stringify(payload) }),
  updateDesignManager: (id: number | string, payload: AnyJson) =>
    call<AnyJson>(`design-managers/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  updateDesigner: (id: number | string, payload: AnyJson) =>
    call<AnyJson>(`designers/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteDesignManager: (id: number | string) =>
    call<AnyJson>(`design-managers/${id}`, { method: "DELETE" }),
  deleteDesigner: (id: number | string) =>
    call<AnyJson>(`designers/${id}`, { method: "DELETE" }),
  deleteManager: (id: number | string) => call<AnyJson>(`delete-manager/${id}`, { method: "DELETE" }),
  deleteAdmin: (id: number | string) => call<AnyJson>(`delete-admin/${id}`, { method: "DELETE" }),
};
