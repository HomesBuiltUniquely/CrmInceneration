"use client";

import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";

/** Verify lead button for Presales Executive (legacy PRE_SALES normalizes to this role). */
export function canPresalesVerifyLead(): boolean {
  if (typeof window === "undefined") return false;
  const r = normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY));
  return r === "PRESALES_EXECUTIVE";
}
