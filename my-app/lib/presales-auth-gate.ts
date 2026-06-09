import {
  CRM_DESIGNER_ID_STORAGE_KEY,
  CRM_DESIGNER_NAME_STORAGE_KEY,
  CRM_ROLE_STORAGE_KEY,
  CRM_TOKEN_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
  getRoleFromUser,
  normalizeRole,
} from "@/lib/auth/api";

/** Client cache when admin deactivates on this browser (until backend login block ships). */
export const CRM_PRESALES_INACTIVE_IDS_KEY = "crm_presales_inactive_ids";

const PRESALES_INACTIVE_MESSAGE =
  "Your presales account is inactive. Contact your manager or admin.";

export function isPresalesRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "PRESALES_EXECUTIVE" || r === "PRESALES_MANAGER";
}

export function presalesInactiveLoginMessage(): string {
  return PRESALES_INACTIVE_MESSAGE;
}

export function readUserActiveFlag(user: Record<string, unknown>): boolean | null {
  const candidates = [user.active, user.isActive, user.enabled];
  for (const value of candidates) {
    if (value === false || value === "false" || value === 0 || value === "0") return false;
    if (value === true || value === "true" || value === 1 || value === "1") return true;
  }
  return null;
}

/** Presales list rows + admin toggle cache (Hub list APIs often omit or stale `active`). */
export function readPresalesRowActiveStatus(row: Record<string, unknown>): boolean {
  const id = Number(row.id ?? 0);
  if (id > 0 && getPresalesInactiveIdSet().has(id)) return false;
  return readUserActiveFlag(row) ?? true;
}

export function mergePresalesUserRecords(
  existing: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  if (!existing) return { ...incoming };
  const merged: Record<string, unknown> = { ...existing, ...incoming };
  const id = Number(merged.id ?? 0);
  if (id > 0 && getPresalesInactiveIdSet().has(id)) {
    merged.active = false;
    merged.enabled = false;
    return merged;
  }
  if (readUserActiveFlag(existing) === false || readUserActiveFlag(incoming) === false) {
    merged.active = false;
    merged.enabled = false;
  }
  return merged;
}

export function presalesStatusUpdatePayload(active: boolean): Record<string, boolean> {
  return { active, enabled: active, isActive: active };
}

export function getPresalesInactiveIdSet(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(CRM_PRESALES_INACTIVE_IDS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0));
  } catch {
    return new Set();
  }
}

export function setPresalesUserInactiveFlag(userId: number, inactive: boolean): void {
  if (typeof window === "undefined" || userId <= 0) return;
  const set = getPresalesInactiveIdSet();
  if (inactive) set.add(userId);
  else set.delete(userId);
  window.localStorage.setItem(CRM_PRESALES_INACTIVE_IDS_KEY, JSON.stringify([...set]));
}

export function clearCrmSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CRM_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(CRM_ROLE_STORAGE_KEY);
  window.localStorage.removeItem(CRM_USER_NAME_STORAGE_KEY);
  window.localStorage.removeItem(CRM_DESIGNER_NAME_STORAGE_KEY);
  window.localStorage.removeItem(CRM_DESIGNER_ID_STORAGE_KEY);
  try {
    window.sessionStorage.removeItem("crm_leads_view_persist");
    window.sessionStorage.removeItem("crm_header_persist");
  } catch {
    // ignore
  }
}

export type PresalesSessionGateResult = {
  allowed: boolean;
  message?: string;
};

function isUserMarkedInactiveLocally(userId: number): boolean {
  return userId > 0 && getPresalesInactiveIdSet().has(userId);
}

export async function checkPresalesSessionAllowed(
  token: string,
): Promise<PresalesSessionGateResult> {
  if (!token.trim()) {
    return { allowed: false, message: PRESALES_INACTIVE_MESSAGE };
  }
  try {
    const res = await fetch("/api/crm/presales-session-gate", {
      method: "GET",
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && data.allowed === true) return { allowed: true };
    const message =
      typeof data.message === "string" ? data.message : PRESALES_INACTIVE_MESSAGE;
    return { allowed: false, message };
  } catch {
    return { allowed: false, message: PRESALES_INACTIVE_MESSAGE };
  }
}

/** Block inactive presales users at login / route guard (frontend until Hub enforces). */
export async function assertPresalesCanUseSession(
  token: string,
  user: Record<string, unknown>,
): Promise<void> {
  const role = getRoleFromUser(user);
  if (!isPresalesRole(role)) return;

  const userId = Number(user.id ?? 0);
  if (isUserMarkedInactiveLocally(userId)) {
    throw new Error(PRESALES_INACTIVE_MESSAGE);
  }

  const localActive = readUserActiveFlag(user);
  if (localActive === false) {
    throw new Error(PRESALES_INACTIVE_MESSAGE);
  }

  const gate = await checkPresalesSessionAllowed(token);
  if (!gate.allowed) {
    if (userId > 0) setPresalesUserInactiveFlag(userId, true);
    throw new Error(gate.message ?? PRESALES_INACTIVE_MESSAGE);
  }
}
