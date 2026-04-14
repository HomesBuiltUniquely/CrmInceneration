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
