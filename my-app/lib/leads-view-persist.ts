import type { SpringPage, ApiLead } from "@/lib/leads-filter";

export const LEADS_VIEW_PERSIST_KEY = "crm:lead-mgmt:view:v1";
export const LEADS_SCROLL_ROOT_ID = "crm-leads-scroll-root";
const LEADS_SCROLL_RESTORE_FLAG = "crm:leads:restore-scroll:v1";

export type LeadsViewPersistedState = {
  page?: number;
  size?: number;
  scrollY?: number;
  salesAdminFilter?: string;
  salesManagerFilter?: string;
  salesExecFilter?: string;
  presalesManagerFilter?: string;
  presalesExecFilter?: string;
  insightTableMode?: string | null;
};

export function getLeadsScrollRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(LEADS_SCROLL_ROOT_ID);
}

/** Scroll position of the CRM main column (not `window` on desktop layouts). */
export function readLeadsScrollPosition(): number {
  const root = getLeadsScrollRoot();
  if (root && root.scrollHeight > root.clientHeight + 1) {
    return root.scrollTop;
  }
  return window.scrollY;
}

export function readLeadsViewPersistedState(): LeadsViewPersistedState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(LEADS_VIEW_PERSIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LeadsViewPersistedState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function mergeLeadsViewPersistedState(
  patch: Partial<LeadsViewPersistedState>,
): void {
  if (typeof window === "undefined") return;
  try {
    const next = { ...readLeadsViewPersistedState(), ...patch };
    window.sessionStorage.setItem(LEADS_VIEW_PERSIST_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / private mode errors.
  }
}

/** Call before navigating to a lead detail page. */
export function persistLeadsListScrollBeforeNavigate(): void {
  if (typeof window === "undefined") return;
  mergeLeadsViewPersistedState({ scrollY: readLeadsScrollPosition() });
  try {
    window.sessionStorage.setItem(LEADS_SCROLL_RESTORE_FLAG, "1");
  } catch {
    // ignore
  }
}

export function shouldRestoreLeadsListScroll(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(LEADS_SCROLL_RESTORE_FLAG) === "1";
  } catch {
    return false;
  }
}

export function getPersistedLeadsScrollY(): number | null {
  const y = Number(readLeadsViewPersistedState().scrollY ?? 0);
  return Number.isFinite(y) && y > 0 ? y : null;
}

export function clearLeadsScrollRestoreFlag(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(LEADS_SCROLL_RESTORE_FLAG);
  } catch {
    // ignore
  }
}

/** @deprecated Prefer shouldRestoreLeadsListScroll + getPersistedLeadsScrollY */
export function consumeLeadsScrollRestoreTarget(): number | null {
  if (!shouldRestoreLeadsListScroll()) return null;
  clearLeadsScrollRestoreFlag();
  return getPersistedLeadsScrollY();
}

export function applyLeadsListScroll(y: number): void {
  if (typeof window === "undefined" || y <= 0) return;
  const root = getLeadsScrollRoot();
  if (root) root.scrollTop = y;
  window.scrollTo({ top: y, left: 0, behavior: "auto" });
}

/** Re-apply after heatmap/table layout settles (async fetches often reset scroll). */
export function scheduleLeadsListScrollRestore(y: number): void {
  applyLeadsListScroll(y);
  requestAnimationFrame(() => applyLeadsListScroll(y));
  window.setTimeout(() => applyLeadsListScroll(y), 0);
  window.setTimeout(() => applyLeadsListScroll(y), 80);
  window.setTimeout(() => applyLeadsListScroll(y), 200);
  window.setTimeout(() => applyLeadsListScroll(y), 450);
}

type LeadsListCacheEntry = {
  data: SpringPage<ApiLead>;
  visibleFilteredTotal: number | null;
  at: number;
};

const LIST_CACHE_TTL_MS = 3 * 60 * 1000;
const listCache = new Map<string, LeadsListCacheEntry>();

export function buildLeadsListCacheKey(parts: Record<string, string | number | boolean | null | undefined>): string {
  return JSON.stringify(parts);
}

export function readLeadsListCache(key: string): LeadsListCacheEntry | null {
  const hit = listCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > LIST_CACHE_TTL_MS) {
    listCache.delete(key);
    return null;
  }
  return hit;
}

export function writeLeadsListCache(
  key: string,
  data: SpringPage<ApiLead>,
  visibleFilteredTotal: number | null,
): void {
  listCache.set(key, { data, visibleFilteredTotal, at: Date.now() });
}
