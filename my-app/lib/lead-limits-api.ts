import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { normalizeToArray } from "@/lib/api-normalize";

type AnyJson = Record<string, unknown>;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/lead-limits/${path}`, {
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
    const message = (data as AnyJson).message;
    const msg = typeof message === "string" ? message : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const leadLimitsApi = {
  getDefault: () => call<AnyJson>("default"),
  setDefault: (defaultLimit: number) => call<AnyJson>("default", { method: "POST", body: JSON.stringify({ defaultLimit }) }),
  getUserLimit: (userId: number | string) => call<AnyJson>(`user/${userId}`),
  setUserLimit: (userId: number | string, limit: number) =>
    call<AnyJson>(`user/${userId}`, { method: "POST", body: JSON.stringify({ limit }) }),
  bulkUsers: (payload: AnyJson) => call<AnyJson>("bulk/users", { method: "POST", body: JSON.stringify(payload) }),
  bulkRoles: (payload: AnyJson) => call<AnyJson>("bulk/roles", { method: "POST", body: JSON.stringify(payload) }),
  listUsers: async () => {
    const raw = await call<unknown>("users");
    return normalizeToArray<AnyJson>(raw);
  },
};
