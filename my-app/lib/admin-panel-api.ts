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
    const msg =
      typeof (data as AnyJson).message === "string"
        ? (data as AnyJson).message
        : `HTTP ${res.status}`;
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
  updateSalesExecutive: (id: number | string, payload: AnyJson) =>
    call<AnyJson>(`sales-executives/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteSalesExecutive: (id: number | string) =>
    call<AnyJson>(`sales-executives/${id}`, { method: "DELETE" }),
  updatePreSales: (id: number | string, payload: AnyJson) =>
    call<AnyJson>(`pre-sales/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deletePreSales: (id: number | string) => call<AnyJson>(`pre-sales/${id}`, { method: "DELETE" }),
  deleteManager: (id: number | string) => call<AnyJson>(`delete-manager/${id}`, { method: "DELETE" }),
  deleteAdmin: (id: number | string) => call<AnyJson>(`delete-admin/${id}`, { method: "DELETE" }),
};
