/**
 * Cross-origin session handoff from Employee Hallway → CRM.
 * Hallway opens e.g. `{CRM_FRONTEND}/auth/accept#payload=<urlencoded JSON>`
 * or `/Leads#payload=...`. CRM must copy keys into this origin's localStorage.
 */

import {
  CRM_ACTIVE_MODULE_KEY,
  CRM_DESIGNER_ID_STORAGE_KEY,
  CRM_DESIGNER_NAME_STORAGE_KEY,
  CRM_LOGIN_USERNAME_KEY,
  CRM_ROLE_STORAGE_KEY,
  CRM_TOKEN_EXPIRES_AT_STORAGE_KEY,
  CRM_TOKEN_STORAGE_KEY,
  CRM_USER_ID_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
  landingPathByRole,
  normalizeRole,
  resolveExpiresAtIso,
} from "@/lib/auth/api";

export type HallwayHandoffPayload = {
  crm_token: string;
  crm_role?: string;
  crm_user_name?: string;
  crm_login_username?: string;
  crm_user_id?: string;
  crm_active_module?: string;
  crm_designer_name?: string;
  crm_designer_id?: string;
  /** Hub login TTL — ISO string preferred. */
  crm_token_expires_at?: string;
  expiresAt?: string;
  issuedAt?: number;
  expiresInMs?: number;
  expiresInHours?: number;
};

const SESSION_KEYS = [
  CRM_TOKEN_STORAGE_KEY,
  CRM_TOKEN_EXPIRES_AT_STORAGE_KEY,
  CRM_ROLE_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
  CRM_LOGIN_USERNAME_KEY,
  CRM_USER_ID_STORAGE_KEY,
  CRM_ACTIVE_MODULE_KEY,
  CRM_DESIGNER_NAME_STORAGE_KEY,
  CRM_DESIGNER_ID_STORAGE_KEY,
] as const;

/** Extract raw `#payload=` value from a location hash (with or without leading #). */
export function extractPayloadRawFromHash(hash: string): string | null {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!h) return null;
  // Prefer dedicated payload= segment (may coexist with other hash params later).
  const parts = h.split("&");
  for (const part of parts) {
    if (part.startsWith("payload=")) {
      return part.slice("payload=".length);
    }
  }
  if (h.startsWith("payload=")) return h.slice("payload=".length);
  return null;
}

export function parseHallwayHandoffPayload(
  raw: string,
): HallwayHandoffPayload | null {
  try {
    const decoded = decodeURIComponent(raw);
    const data = JSON.parse(decoded) as unknown;
    if (!data || typeof data !== "object") return null;
    const obj = data as Record<string, unknown>;
    const token = obj.crm_token;
    if (typeof token !== "string" || !token.trim()) return null;
    return {
      crm_token: token.trim(),
      crm_role: typeof obj.crm_role === "string" ? obj.crm_role : undefined,
      crm_user_name:
        typeof obj.crm_user_name === "string" ? obj.crm_user_name : undefined,
      crm_login_username:
        typeof obj.crm_login_username === "string"
          ? obj.crm_login_username
          : undefined,
      crm_user_id:
        obj.crm_user_id != null ? String(obj.crm_user_id) : undefined,
      crm_active_module:
        typeof obj.crm_active_module === "string"
          ? obj.crm_active_module
          : undefined,
      crm_designer_name:
        typeof obj.crm_designer_name === "string"
          ? obj.crm_designer_name
          : undefined,
      crm_designer_id:
        obj.crm_designer_id != null ? String(obj.crm_designer_id) : undefined,
      crm_token_expires_at:
        typeof obj.crm_token_expires_at === "string"
          ? obj.crm_token_expires_at
          : typeof obj.expiresAt === "string"
            ? obj.expiresAt
            : undefined,
      expiresAt: typeof obj.expiresAt === "string" ? obj.expiresAt : undefined,
      issuedAt: typeof obj.issuedAt === "number" ? obj.issuedAt : undefined,
      expiresInMs:
        typeof obj.expiresInMs === "number" ? obj.expiresInMs : undefined,
      expiresInHours:
        typeof obj.expiresInHours === "number" ? obj.expiresInHours : undefined,
    };
  } catch {
    return null;
  }
}

export function readHallwayHandoffFromLocation(
  loc: Pick<Location, "hash"> = window.location,
): HallwayHandoffPayload | null {
  const raw = extractPayloadRawFromHash(loc.hash || "");
  if (!raw) return null;
  return parseHallwayHandoffPayload(raw);
}

/** Wipe prior CRM session so leftover admin/exec tokens cannot stick. */
export function clearCrmSessionStorage(): void {
  for (const key of SESSION_KEYS) {
    localStorage.removeItem(key);
  }
}

/**
 * Write Hallway session into this origin's localStorage.
 * Overwrites any existing session (fixes "opens as admin" leftover).
 */
export function applyHallwayHandoffToStorage(
  payload: HallwayHandoffPayload,
): string {
  clearCrmSessionStorage();

  localStorage.setItem(CRM_TOKEN_STORAGE_KEY, payload.crm_token);

  const expiresIso = resolveExpiresAtIso({
    expiresAt: payload.crm_token_expires_at || payload.expiresAt,
    issuedAt: payload.issuedAt,
    expiresInMs: payload.expiresInMs,
    expiresInHours: payload.expiresInHours,
  });
  if (expiresIso) {
    localStorage.setItem(CRM_TOKEN_EXPIRES_AT_STORAGE_KEY, expiresIso);
  }

  const role = normalizeRole(payload.crm_role ?? "");
  if (role) {
    localStorage.setItem(CRM_ROLE_STORAGE_KEY, role);
  }

  if (payload.crm_user_name?.trim()) {
    localStorage.setItem(CRM_USER_NAME_STORAGE_KEY, payload.crm_user_name.trim());
  }
  if (payload.crm_login_username?.trim()) {
    localStorage.setItem(
      CRM_LOGIN_USERNAME_KEY,
      payload.crm_login_username.trim(),
    );
  }
  if (payload.crm_user_id?.trim()) {
    localStorage.setItem(CRM_USER_ID_STORAGE_KEY, payload.crm_user_id.trim());
  }

  const moduleFromPayload = payload.crm_active_module?.trim().toLowerCase();
  if (
    moduleFromPayload === "crm" ||
    moduleFromPayload === "presales" ||
    moduleFromPayload === "design" ||
    moduleFromPayload === "admin"
  ) {
    localStorage.setItem(CRM_ACTIVE_MODULE_KEY, moduleFromPayload);
  } else if (role) {
    const r = role;
    if (r === "PRESALES_EXECUTIVE" || r === "PRESALES_MANAGER") {
      localStorage.setItem(CRM_ACTIVE_MODULE_KEY, "presales");
    } else {
      localStorage.setItem(CRM_ACTIVE_MODULE_KEY, "crm");
    }
  }

  if (payload.crm_designer_name?.trim()) {
    localStorage.setItem(
      CRM_DESIGNER_NAME_STORAGE_KEY,
      payload.crm_designer_name.trim(),
    );
  }
  if (payload.crm_designer_id?.trim()) {
    localStorage.setItem(
      CRM_DESIGNER_ID_STORAGE_KEY,
      payload.crm_designer_id.trim(),
    );
  }

  return landingPathByRole(role);
}

/** Remove `#payload=...` without reloading. */
export function clearHandoffHashFromUrl(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}`);
}

/**
 * If the current URL has `#payload=...`, apply it and clear the hash.
 * Returns landing path when applied, otherwise null.
 */
export function tryConsumeHallwayHandoffFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const payload = readHallwayHandoffFromLocation();
  if (!payload) return null;
  const landing = applyHallwayHandoffToStorage(payload);
  clearHandoffHashFromUrl();
  return landing;
}
