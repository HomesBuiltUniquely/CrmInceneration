import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { normalizeToArray } from "@/lib/api-normalize";
import { getAuthApiBaseUrl, normalizeRole } from "@/lib/auth/api";
import { isPresalesExecutiveRole, isUserActive } from "@/lib/user-active";
import { leadLimitsApi } from "@/lib/lead-limits-api";

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
    const message =
      (data as AnyJson).message ??
      (data as AnyJson).error ??
      (data as AnyJson).userMessage;
    const msg = typeof message === "string" ? message : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function callAuth<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getAuthApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: getCrmAuthHeaders({
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as T & AnyJson;
  if (!res.ok || data.success === false) {
    const message = data.message ?? data.error ?? data.userMessage;
    const msg = typeof message === "string" ? message : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function withPreferredParentId(payload: AnyJson): AnyJson {
  const next: AnyJson = { ...payload };
  const rawParent = next.parentId ?? next.managerId;
  if (rawParent !== undefined && rawParent !== null && String(rawParent).trim() !== "") {
    const parsed = Number(rawParent);
    next.parentId = Number.isFinite(parsed) ? parsed : rawParent;
  }
  delete next.managerId;
  return next;
}

async function list(path: string): Promise<AnyJson[]> {
  const raw = await call<unknown>(path);
  return normalizeToArray<AnyJson>(raw);
}

function userRecordRole(u: AnyJson): string {
  const candidate = u.role ?? u.userRole ?? u.authority ?? u.type ?? "";
  return normalizeRole(String(candidate));
}

function isActiveUserRecord(u: AnyJson): boolean {
  return isUserActive(u as { active?: boolean; isActive?: boolean });
}

function mergeUsersById(primary: AnyJson[], secondary: AnyJson[]): AnyJson[] {
  const map = new Map<string, AnyJson>();
  const keyOf = (u: AnyJson): string | null => {
    const id = u.id ?? u.userId;
    if (id == null || String(id).trim() === "") return null;
    return String(id);
  };
  for (const u of primary) {
    const k = keyOf(u);
    if (k) map.set(k, u);
  }
  for (const u of secondary) {
    const k = keyOf(u);
    if (k && !map.has(k)) map.set(k, u);
  }
  return [...map.values()];
}

/**
 * Sales managers for admin UI: combines GET managers + users-by-role(SALES_MANAGER).
 * Production backends sometimes return an empty managers list; the role query is a reliable fallback.
 */
async function listSalesManagersMerged(): Promise<AnyJson[]> {
  const [fromManagers, fromRole] = await Promise.all([
    list("managers").catch(() => [] as AnyJson[]),
    list(`users-by-role?role=${encodeURIComponent("SALES_MANAGER")}`).catch(() => [] as AnyJson[]),
  ]);
  const a = fromManagers.filter(isActiveUserRecord);
  const b = fromRole
    .filter(isActiveUserRecord)
    .filter((u) => userRecordRole(u) === "SALES_MANAGER");
  return mergeUsersById(a, b);
}

/**
 * Legacy CRM hierarchical list: GET /v1/SalesExecutive/all (proxied).
 * For SALES_MANAGER JWT, backend returns only executives under that manager (typically active only).
 */
function isExcludedPresalesExecListRole(role: string): boolean {
  const r = normalizeRole(role);
  return (
    r === "PRESALES_MANAGER" ||
    r === "SALES_MANAGER" ||
    r === "SALES_EXECUTIVE" ||
    r === "SALES_ADMIN" ||
    r === "ADMIN" ||
    r === "SUPER_ADMIN"
  );
}

/**
 * Merged presales executives for admin UI — combines GET /v1/PreSales/all,
 * users-by-role(PRESALES_EXECUTIVE|PRE_SALES), and admin pre-sales list.
 * Production backends sometimes return an empty /all list; role queries are a reliable fallback.
 */
async function listPresalesExecutivesMerged(): Promise<AnyJson[]> {
  const [fromLegacy, fromRole, fromLegacyRole, fromAdmin, fromLeadLimits] = await Promise.all([
    listPresalesExecutivesLegacyAll().catch(() => [] as AnyJson[]),
    list(`users-by-role?role=${encodeURIComponent("PRESALES_EXECUTIVE")}`).catch(
      () => [] as AnyJson[],
    ),
    list(`users-by-role?role=${encodeURIComponent("PRE_SALES")}`).catch(() => [] as AnyJson[]),
    list("pre-sales").catch(() => [] as AnyJson[]),
    leadLimitsApi.listUsers().catch(() => [] as AnyJson[]),
  ]);

  const fromLeadLimitsExecs = fromLeadLimits.filter((u) =>
    isPresalesExecutiveRole(userRecordRole(u)),
  );

  const executiveSourceIds = new Set<string>();
  for (const u of [...fromLegacy, ...fromRole, ...fromLegacyRole, ...fromLeadLimitsExecs]) {
    const k = String(u.id ?? u.userId ?? "").trim();
    if (k) executiveSourceIds.add(k);
  }

  const merged = mergeUsersById(
    mergeUsersById(fromLegacy, fromRole),
    mergeUsersById(fromLegacyRole, mergeUsersById(fromAdmin, fromLeadLimitsExecs)),
  );

  return merged.filter((u) => {
    const role = userRecordRole(u);
    if (isExcludedPresalesExecListRole(role)) return false;
    if (isPresalesExecutiveRole(role)) return true;
    const id = String(u.id ?? u.userId ?? "").trim();
    return Boolean(id && executiveSourceIds.has(id));
  });
}

async function listPresalesExecutivesLegacyAll(): Promise<AnyJson[]> {
  const res = await fetch(`/api/pre-sales/all`, {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  const data = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    const msg = (data as AnyJson).message;
    throw new Error(typeof msg === "string" ? msg : `HTTP ${res.status}`);
  }
  return normalizeToArray<AnyJson>(data);
}

async function listSalesExecutivesLegacyAll(): Promise<AnyJson[]> {
  const res = await fetch(`/api/sales-executive/all`, {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  const data = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    const msg = (data as AnyJson).message;
    throw new Error(typeof msg === "string" ? msg : `HTTP ${res.status}`);
  }
  return normalizeToArray<AnyJson>(data);
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
  /** SUPER_ADMIN / ADMIN: create SALES_ADMIN via auth register-with-role. */
  createSalesAdmin: (payload: AnyJson) =>
    callAuth<AnyJson>("/api/auth/register-with-role", {
      method: "POST",
      body: JSON.stringify(withPreferredParentId({ ...payload, role: "SALES_ADMIN" })),
    }),
  listManagers: () => list("managers"),
  /** All managers from GET /api/admin/managers (includes inactive). */
  listManagersAll: () => list("managers"),
  /** Merged active sales managers for parent dropdowns in create-user forms. */
  listSalesManagersMerged: () => listSalesManagersMerged(),
  listSalesExecutives: () => list("sales-executives"),
  /** GET /v1/SalesExecutive/all — use for Sales Manager team table (see API spec). */
  listSalesExecutivesLegacyAll: () => listSalesExecutivesLegacyAll(),
  /** GET /v1/PreSales/all — includes inactive executives for admin roles. */
  listPresalesExecutivesLegacyAll: () => listPresalesExecutivesLegacyAll(),
  /** Merged presales executives (see {@link listPresalesExecutivesMerged}). */
  listPresalesExecutivesMerged: () => listPresalesExecutivesMerged(),
  listPreSales: () => list("pre-sales"),
  listDesignManagers: () => list("design-managers"),
  listDesigners: () => list("designers"),
  listAdmins: () => list("admins"),
  listAllUsers: () => list("all-users"),
  listUsersByRole: (role: string) => list(`users-by-role?role=${encodeURIComponent(role)}`),
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
  /** Master API: PUT /v1/PreSales/{id}/status with raw boolean body. */
  setPresalesExecutiveStatus: async (id: number | string, active: boolean) => {
    const res = await fetch(`/api/pre-sales/${id}/status`, {
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
  /** PUT /api/admin/managers/{id}/status with raw boolean body (login blocked only). */
  setManagerStatus: async (id: number | string, active: boolean) => {
    const res = await fetch(`/api/admin/managers/${id}/status`, {
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
  /** POST /api/admin/assign-sales-executive-to-manager */
  assignSalesExecutiveToManager: (payload: { salesExecutiveId: number; managerId: number }) =>
    call<AnyJson>("assign-sales-executive-to-manager", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteSalesExecutive: (id: number | string) =>
    call<AnyJson>(`sales-executives/${id}`, { method: "DELETE" }),
  updatePreSales: (id: number | string, payload: AnyJson) =>
    call<AnyJson>(`pre-sales/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deletePreSales: (id: number | string) => call<AnyJson>(`pre-sales/${id}`, { method: "DELETE" }),
  createDesignManager: (payload: AnyJson) =>
    callAuth<AnyJson>("/api/auth/register-with-role", {
      method: "POST",
      body: JSON.stringify(withPreferredParentId(payload)),
    }),
  createDesigner: (payload: AnyJson) =>
    callAuth<AnyJson>("/api/auth/register-with-role", {
      method: "POST",
      body: JSON.stringify(withPreferredParentId(payload)),
    }),
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
