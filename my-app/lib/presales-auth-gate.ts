import {
  CRM_DESIGNER_ID_STORAGE_KEY,
  CRM_DESIGNER_NAME_STORAGE_KEY,
  CRM_ROLE_STORAGE_KEY,
  CRM_TOKEN_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
  getRoleFromUser,
  normalizeRole,
  unwrapAuthUserPayload,
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

/** Block inactive presales users at login / route guard (frontend until Hub enforces). */
export async function checkPresalesSessionAllowed(
  token: string,
  sessionUser?: Record<string, unknown>,
): Promise<PresalesSessionGateResult> {
  const user = sessionUser ?? {};
  const role = getRoleFromUser(user);
  const userId = Number(user.id ?? user.userId ?? 0);

  if (!isPresalesRole(role)) {
    return { allowed: true };
  }

  if (isUserMarkedInactiveLocally(userId)) {
    return { allowed: false, message: PRESALES_INACTIVE_MESSAGE };
  }

  const explicitActive = readUserActiveFlag(user);
  if (explicitActive === false) {
    return { allowed: false, message: PRESALES_INACTIVE_MESSAGE };
  }

  try {
    const auth = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    const res = await fetch("/api/crm/presales-session-gate", {
      cache: "no-store",
      credentials: "include",
      headers: { Authorization: auth, Accept: "application/json" },
    });
    const json = (await res.json().catch(() => ({}))) as PresalesSessionGateResult & {
      message?: string;
    };
    if (res.ok && json.allowed === false) {
      return { allowed: false, message: json.message ?? PRESALES_INACTIVE_MESSAGE };
    }
  } catch {
    // Network — fall through; explicit flags already handled.
  }

  return { allowed: true };
}

export async function assertPresalesCanUseSession(
  token: string,
  rawMe?: Record<string, unknown>,
): Promise<PresalesSessionGateResult> {
  const user = rawMe ? unwrapAuthUserPayload(rawMe) : {};
  return checkPresalesSessionAllowed(token, user);
}
