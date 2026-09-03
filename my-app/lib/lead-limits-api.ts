import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { normalizeToArray } from "@/lib/api-normalize";

type AnyJson = Record<string, unknown>;

/** In-flight GET dedupe so multiple sections don't hammer the same endpoint. */
const inflightGet = new Map<string, Promise<unknown>>();
/** Short memory cache — limits change on write (we clear), so 45s is safe for UX speed. */
const memCache = new Map<string, { at: number; data: unknown }>();
const CACHE_TTL_MS = 45_000;
/** Fail fast instead of hanging ~60s on a stuck Hub / gateway. */
const FETCH_TIMEOUT_MS = 12_000;

function cacheKey(path: string, method: string): string {
  return `${method}:${path}`;
}

function invalidateLeadLimitsCache(): void {
  memCache.clear();
  // Leave inflight alone so the request in progress still resolves once.
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const key = cacheKey(path, method);
  const isMutation = method !== "GET";

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
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
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
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error(`Lead limits request timed out after ${Math.round(FETCH_TIMEOUT_MS / 1000)}s`);
      }
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error(`Lead limits request timed out after ${Math.round(FETCH_TIMEOUT_MS / 1000)}s`);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  })();

  if (method === "GET") {
    const guarded = withTimeout(run, FETCH_TIMEOUT_MS + 1500, "Lead limits");
    inflightGet.set(key, guarded);
    try {
      const data = await guarded;
      memCache.set(key, { at: Date.now(), data });
      return data;
    } catch (e) {
      // Don't cache failures — next open/refresh can retry.
      throw e;
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
