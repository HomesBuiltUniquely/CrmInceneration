import { BASE_URL } from "@/lib/base-url";

export const CRM_TOKEN_STORAGE_KEY = "crm_token";
export const CRM_ROLE_STORAGE_KEY = "crm_role";
export const CRM_USER_NAME_STORAGE_KEY = "crm_user_name";

export function getAuthApiBaseUrl(): string {
  return BASE_URL;
}

export type LoginResult = {
  token: string;
  user: Record<string, unknown>;
};

export function normalizeRole(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
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
    user.name ??
    user.username ??
    user.fullName ??
    user.displayName ??
    user.firstName;
  return typeof candidate === "string" ? candidate.trim() : "";
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
