import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { normalizeToArray } from "@/lib/api-normalize";

type AnyJson = Record<string, unknown>;

/** In-flight GET dedupe so multiple sections don't hammer the same endpoint. */
const inflightGet = new Map<string, Promise<unknown>>();
/** Short memory cache — limits change on write (we clear), so 45s is safe for UX speed. */
const memCache = new Map<string, { at: number; data: unknown }>();
const CACHE_TTL_MS = 45_000;
/**
 * Hub `/v1/lead-limits/users` is often slow in prod. Do NOT abort early —
 * roster UI paints from users-by-role; stats merge when this finally returns.
 * Hard ceiling only to avoid forever-hung tabs (proxy aligns with this).
 */
const FETCH_TIMEOUT_MS = 90_000;
/** Lightweight paths (default limit) should fail faster. */
const FAST_PATH_TIMEOUT_MS = 20_000;

function cacheKey(path: string, method: string): string {
  return `${method}:${path}`;
}

function pathTimeoutMs(path: string): number {
  const p = path.replace(/^\//, "").split("?")[0] ?? path;
  if (p === "default" || p === "renovation/default") return FAST_PATH_TIMEOUT_MS;
  return FETCH_TIMEOUT_MS;
}

function invalidateLeadLimitsCache(): void {
  memCache.clear();
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const key = cacheKey(path, method);
  const isMutation = method !== "GET";
  const timeoutMs = pathTimeoutMs(path);

  if (method === "GET") {
    const hit = memCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return hit.data as T;
    }
    const pending = inflightGet.get(key) as Promise<T> | undefined;
    if (pending) return pending;
  }

  const run = (async (): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`/api/lead-limits/${path}`, {
        ...init,
        signal: controller.signal,
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
    } catch (e) {
      if (
        (e instanceof DOMException && e.name === "AbortError") ||
        (e instanceof Error && e.name === "AbortError")
      ) {
        throw new Error(
          `Lead limits request timed out after ${Math.round(timeoutMs / 1000)}s`,
        );
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  })();

  if (method === "GET") {
    inflightGet.set(key, run);
    try {
      const data = await run;
      memCache.set(key, { at: Date.now(), data });
      return data;
    } finally {
      inflightGet.delete(key);
    }
  }

  try {
    const data = await run;
    if (isMutation) invalidateLeadLimitsCache();
    return data;
  } catch (e) {
    if (isMutation) invalidateLeadLimitsCache();
    throw e;
  }
}

/** Extract user rows from common lead-limits / renovation payload shapes. */
export function extractLeadLimitUsers(raw: unknown): AnyJson[] {
  if (Array.isArray(raw)) return raw as AnyJson[];
  if (!raw || typeof raw !== "object") return [];
  const o = raw as AnyJson;
  const buckets: unknown[] = [
    o.users,
    o.salesExecutives,
    o.salesManagers,
    o.presalesExecutives,
    o.presalesManagers,
    o.data,
    o.content,
    o.result,
    o.items,
    o.records,
    o.rows,
  ];
  const out: AnyJson[] = [];
  const seen = new Set<string>();
  for (const b of buckets) {
    if (!Array.isArray(b)) continue;
    for (const row of b) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const r = row as AnyJson;
      const id = String(r.userId ?? r.id ?? "");
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      out.push(r);
    }
  }
  if (out.length > 0) return out;
  return normalizeToArray<AnyJson>(raw);
}

export const leadLimitsApi = {
  /** Bypass cache (e.g. after explicit Refresh). */
  invalidateCache: invalidateLeadLimitsCache,

  getDefault: (opts?: { force?: boolean }) => {
    if (opts?.force) invalidateLeadLimitsCache();
    return call<AnyJson>("default");
  },
  setDefault: (defaultLimit: number) =>
    call<AnyJson>("default", { method: "POST", body: JSON.stringify({ defaultLimit }) }),
  getUserLimit: (userId: number | string) => call<AnyJson>(`user/${userId}`),
  setUserLimit: (userId: number | string, limit: number) =>
    call<AnyJson>(`user/${userId}`, { method: "POST", body: JSON.stringify({ limit }) }),
  bulkUsers: (payload: AnyJson) =>
    call<AnyJson>("bulk/users", { method: "POST", body: JSON.stringify(payload) }),
  bulkRoles: (payload: AnyJson) =>
    call<AnyJson>("bulk/roles", { method: "POST", body: JSON.stringify(payload) }),
  listUsers: async (opts?: { force?: boolean }) => {
    if (opts?.force) invalidateLeadLimitsCache();
    const raw = await call<unknown>("users");
    return extractLeadLimitUsers(raw);
  },
  getRenovationLimits: (opts?: { force?: boolean }) => {
    if (opts?.force) invalidateLeadLimitsCache();
    return call<AnyJson>("renovation");
  },
  setRenovationDefault: (limit: number) =>
    call<AnyJson>("renovation/default", { method: "POST", body: JSON.stringify({ limit }) }),
  setUserRenovationLimit: (userId: number | string, limit: number) =>
    call<AnyJson>(`renovation/user/${userId}`, { method: "POST", body: JSON.stringify({ limit }) }),
};
