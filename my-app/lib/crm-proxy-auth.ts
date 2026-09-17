import type { NextRequest } from "next/server";

/** Forward browser Bearer and/or cookies; use dev token only when client sends no Authorization. */
export function upstreamAuthHeaders(req: NextRequest): HeadersInit {
  const h: HeadersInit = {};
  const auth = req.headers.get("authorization");
  if (auth) {
    h.Authorization = auth;
  } else {
    const dev = process.env.CRM_DEV_BEARER_TOKEN;
    if (dev) {
      h.Authorization = dev.startsWith("Bearer ") ? dev : `Bearer ${dev}`;
    }
  }
  const cookie = req.headers.get("cookie");
  if (cookie) {
    h.Cookie = cookie;
  }
  return h;
}

/**
 * When Sales Admin scopes a manager, Hub may accept act-as so my-leads/team-leads
 * match that manager's JWT inventory (Fresh Lead parity).
 */
export function withActAsUserHeaders(
  base: HeadersInit,
  actAsUserId: number | string | null | undefined,
): HeadersInit {
  const id = Number(actAsUserId ?? 0);
  if (!Number.isFinite(id) || id <= 0) return base;
  const h = new Headers(base);
  const idStr = String(id);
  h.set("X-Act-As-User-Id", idStr);
  h.set("X-Act-As-User", idStr);
  h.set("X-Impersonate-User-Id", idStr);
  return h;
}

/** Plain header map for APIs that require `Record<string, string>`. */
export function upstreamAuthHeaderRecord(req: NextRequest): Record<string, string> {
  const h: Record<string, string> = {};
  const auth = req.headers.get("authorization");
  if (auth) {
    h.Authorization = auth;
  } else {
    const dev = process.env.CRM_DEV_BEARER_TOKEN;
    if (dev) {
      h.Authorization = dev.startsWith("Bearer ") ? dev : `Bearer ${dev}`;
    }
  }
  const cookie = req.headers.get("cookie");
  if (cookie) {
    h.Cookie = cookie;
  }
  return h;
}
