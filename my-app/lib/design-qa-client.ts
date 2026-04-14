"use client";

import { getCrmAuthHeaders } from "@/lib/crm-client-auth";

/** §9 `GET /api/design-qa/lead/{id}` — returns null when Hub has no row (404). */
export async function fetchDesignQaForLead(leadId: string): Promise<unknown | null> {
  const res = await fetch(`/api/crm/design-qa/lead/${encodeURIComponent(leadId)}`, {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error((await res.text()) || `Design QA failed (${res.status})`);
  return res.json() as Promise<unknown>;
}
