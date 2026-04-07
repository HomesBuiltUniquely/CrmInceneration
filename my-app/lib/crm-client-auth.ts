"use client";

import { CRM_TOKEN_STORAGE_KEY } from "@/lib/auth/api";

/** JWT / token from login (`crm_token`) or legacy keys — use on browser fetches to `/api/crm/*`. */
export function readStoredCrmToken(): string | null {
  if (typeof window === "undefined") return null;
  const fromLogin = window.localStorage.getItem(CRM_TOKEN_STORAGE_KEY);
  if (fromLogin) return fromLogin;
  for (const k of ["crm_access_token", "access_token", "token", "authToken"]) {
    const v = window.localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

export function getCrmAuthHeaders(extra?: HeadersInit): HeadersInit {
  const h = new Headers(extra);
  const t = readStoredCrmToken();
  if (t) h.set("Authorization", t.startsWith("Bearer ") ? t : `Bearer ${t}`);
  return h;
}
