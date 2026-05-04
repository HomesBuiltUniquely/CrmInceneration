import { BASE_URL } from "@/lib/base-url";

export const CRM_TOKEN_STORAGE_KEY = "crm_token";
export const CRM_ROLE_STORAGE_KEY = "crm_role";
export const CRM_USER_NAME_STORAGE_KEY = "crm_user_name";
/** Linked `Designer.name` from login / `GET /api/auth/me` — used for designer dashboard APIs. */
export const CRM_DESIGNER_NAME_STORAGE_KEY = "crm_designer_name";
export const CRM_DESIGNER_ID_STORAGE_KEY = "crm_designer_id";

export function getAuthApiBaseUrl(): string {
  return BASE_URL;
}

export function canLoadAllUsers(role?: string): boolean {
  return normalizeRole(role ?? "") === "SUPER_ADMIN";
}

export function getSalesExecEndpointForVerify(): string {
  return "/api/auth/active-sales-executives";
}

export type LoginResult = {
  token: string;
  user: Record<string, unknown>;
};

export function normalizeRole(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  // Backward compatibility: some APIs still emit PRE_SALES.
  if (normalized === "PRE_SALES") return "PRESALES_EXECUTIVE";
  if (normalized === "PRE_SALES_MANAGER") return "PRESALES_MANAGER";
  return normalized;
}

/** Extract role from common login payload shapes. */
export function getRoleFromUser(user: Record<string, unknown>): string {
  const direct =
    user.role ??
    user.userRole ??
    user.authority ??
    user.type;
  if (typeof direct === "string" && direct.trim()) return direct;

  const roles = user.roles;
  if (Array.isArray(roles) && typeof roles[0] === "string") return roles[0];
  return "";
}

/** Extract display name from common login payload shapes. */
export function getNameFromUser(user: Record<string, unknown>): string {
  const candidate =
    user.fullName ??
    user.name ??
    user.username ??
    user.displayName ??
    user.firstName;
  return typeof candidate === "string" ? candidate.trim() : "";
}

/** `Designer.name` for `/v1/Appointment/designer/{designerName}/...` (may be absent for non-designers). */
export function getDesignerNameFromUser(user: Record<string, unknown>): string {
  const v = user.designerName ?? user.designer_name;
  return typeof v === "string" ? v.trim() : "";
}

export function getDesignerIdFromUser(user: Record<string, unknown>): string | null {
  const v = user.designerId ?? user.designer_id;
  if (v == null) return null;
  return String(v);
}

export function dashboardPathByRole(role: string): string {
  const r = normalizeRole(role);
  if (r === "SUPER_ADMIN") return "/super-admin";
  if (r === "ADMIN" || r === "SALES_ADMIN") return "/admin";
  if (r === "SALES_MANAGER") return "/sales-manager";
  return "/";
}

export function hasDashboardByRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "SUPER_ADMIN" || r === "ADMIN" || r === "SALES_ADMIN";
}

/** Legacy parity: roles that may open the designer dashboard (`showDesignerDashboard`). */
export function canAccessDesignerDashboard(role: string): boolean {
  const r = normalizeRole(role);
  return (
    r === "DESIGNER" ||
    r === "DESIGN_MANAGER" ||
    r === "TERRITORY_DESIGN_MANAGER" ||
    r === "SUPER_ADMIN"
  );
}

/** First page after login by role. */
export function landingPathByRole(role: string): string {
  const r = normalizeRole(role);
  if (r === "SUPER_ADMIN" || r === "ADMIN" || r === "SALES_ADMIN") {
    return dashboardPathByRole(r);
  }
  if (
    r === "TERRITORY_DESIGN_MANAGER" ||
    r === "DESIGN_MANAGER" ||
    r === "DESIGNER"
  ) {
    return "/design-dashboard";
  }
  return "/Leads";
}

export async function login(
  username: string,
  password: string
): Promise<LoginResult> {
  const res = await fetch(`${getAuthApiBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" ? data.message : "Login failed"
    );
  }
  if (data.success === false) {
    throw new Error(
      typeof data.message === "string" ? data.message : "Login failed"
    );
  }
  const token = data.token;
  const user = data.user;
  if (typeof token !== "string" || typeof user !== "object" || user === null) {
    throw new Error("Unexpected login response from server");
  }
  return { token, user: user as Record<string, unknown> };
}

export async function getMe(token: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${getAuthApiBaseUrl()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string"
        ? data.message
        : "Failed to load current user"
    );
  }
  return data;
}

/** Unwraps `{ user: {...} }` or flat `/api/auth/me` payloads. */
export function unwrapAuthUserPayload(data: Record<string, unknown>): Record<string, unknown> {
  const u = data.user;
  if (u && typeof u === "object" && !Array.isArray(u)) {
    return u as Record<string, unknown>;
  }
  return data;
}

/**
 * GET /api/auth/users-by-role — for SALES_MANAGER JWT, executives are scoped to that manager (backend).
 */
export async function fetchSalesExecutivesForManager(
  token: string,
): Promise<Array<Record<string, unknown>>> {
  const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  const res = await fetch(
    `${getAuthApiBaseUrl()}/api/auth/users-by-role?role=${encodeURIComponent("SALES_EXECUTIVE")}`,
    { cache: "no-store", headers: { Authorization: auth } },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
}

export async function logout(token: string): Promise<void> {
  try {
    await fetch(`${getAuthApiBaseUrl()}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Still clear client session if the network fails
  }
}

export async function validateToken(
  token: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${getAuthApiBaseUrl()}/api/auth/validate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return data as Record<string, unknown>;
}
