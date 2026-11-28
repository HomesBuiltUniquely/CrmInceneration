/**
 * CRM session TTL (Hub `auth.token.ttl-ms=86400000` → 24h).
 * On expiry → clear storage → Hallway portal (production) or CRM `/login` (localhost).
 */

import {
  CRM_TOKEN_EXPIRES_AT_STORAGE_KEY,
  CRM_TOKEN_STORAGE_KEY,
  persistTokenExpiry,
  resolveExpiresAtIso,
  validateToken,
} from "@/lib/auth/api";
import { clearCrmSessionStorage } from "@/lib/auth/hallway-handoff";
import { redirectToAuthEntry } from "@/lib/auth/hallway-portal";

export { persistTokenExpiry, resolveExpiresAtIso };

export const SESSION_EXPIRED_ERROR_CODE = "SESSION_EXPIRED";
export const SESSION_EXPIRED_MESSAGE = "Session expired. Please login again.";
export const CRM_AUTH_FLASH_MESSAGE_KEY = "crm_auth_flash_message";

let logoutInFlight = false;
let fetchPatched = false;

export function readTokenExpiresAt(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CRM_TOKEN_EXPIRES_AT_STORAGE_KEY)?.trim();
  return raw || null;
}

/** True when stored expiresAt is in the past (client-side gate before API). */
export function isStoredTokenExpired(nowMs = Date.now()): boolean {
  const iso = readTokenExpiresAt();
  if (!iso) return false;
  const end = Date.parse(iso);
  if (!Number.isFinite(end)) return false;
  return nowMs >= end;
}

export function isSessionExpiredPayload(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  const code = String(obj.errorCode ?? obj.code ?? "").trim().toUpperCase();
  if (code === SESSION_EXPIRED_ERROR_CODE) return true;
  if (obj.valid === false && /session expired/i.test(String(obj.message ?? ""))) {
    return true;
  }
  return false;
}

export function stashSessionExpiredFlash(message = SESSION_EXPIRED_MESSAGE): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CRM_AUTH_FLASH_MESSAGE_KEY, message);
  } catch {
    /* ignore */
  }
}

export function consumeAuthFlashMessage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const msg = window.sessionStorage.getItem(CRM_AUTH_FLASH_MESSAGE_KEY)?.trim() || null;
    window.sessionStorage.removeItem(CRM_AUTH_FLASH_MESSAGE_KEY);
    return msg;
  } catch {
    return null;
  }
}

/**
 * Clear CRM auth storage and send user to Hallway login (or localhost `/login`).
 * Safe to call multiple times — only the first run redirects.
 */
export function forceSessionExpiredLogout(message = SESSION_EXPIRED_MESSAGE): void {
  if (typeof window === "undefined") return;
  if (logoutInFlight) return;
  logoutInFlight = true;
  stashSessionExpiredFlash(message);
  try {
    clearCrmSessionStorage();
  } finally {
    redirectToAuthEntry();
  }
}

export async function readResponseSessionExpired(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  try {
    const data = (await res.clone().json()) as unknown;
    return isSessionExpiredPayload(data);
  } catch {
    return false;
  }
}

/** App boot / tab focus: ask Hub if the token is still valid. */
export async function validateStoredSessionOrLogout(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const token = window.localStorage.getItem(CRM_TOKEN_STORAGE_KEY)?.trim();
  if (!token) return false;

  if (isStoredTokenExpired()) {
    forceSessionExpiredLogout();
    return false;
  }

  try {
    const data = await validateToken(token);
    if (isSessionExpiredPayload(data) || data.valid === false) {
      forceSessionExpiredLogout(
        typeof data.message === "string" && data.message.trim()
          ? data.message.trim()
          : SESSION_EXPIRED_MESSAGE,
      );
      return false;
    }
    return true;
  } catch {
    // Network blip — do not force logout; API 401 path still covers expiry.
    return true;
  }
}

/**
 * Patch `window.fetch` once: on 401 + SESSION_EXPIRED → Hallway re-login.
 * Skips auth login itself to avoid loops.
 */
export function installSessionExpiredFetchGuard(): void {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (isStoredTokenExpired()) {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (!isAuthLoginUrl(url)) {
        forceSessionExpiredLogout();
        return new Response(
          JSON.stringify({
            valid: false,
            errorCode: SESSION_EXPIRED_ERROR_CODE,
            message: SESSION_EXPIRED_MESSAGE,
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    const res = await originalFetch(input, init);
    if (res.status === 401) {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (!isAuthLoginUrl(url) && (await readResponseSessionExpired(res))) {
        forceSessionExpiredLogout();
      }
    }
    return res;
  };
}

function isAuthLoginUrl(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes("/api/auth/login");
}
