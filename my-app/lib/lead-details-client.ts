import type { CrmLeadType } from "@/lib/leads-filter";
import { CRM_TOKEN_STORAGE_KEY } from "@/lib/auth/api";

function readBearer(): string | null {
  if (typeof window === "undefined") return null;
  const fromLogin = window.localStorage.getItem(CRM_TOKEN_STORAGE_KEY);
  if (fromLogin) return fromLogin;
  for (const k of ["crm_access_token", "access_token", "token", "authToken"]) {
    const v = window.localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

function authHeaders(): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  const t = readBearer();
  if (t) h.Authorization = t.startsWith("Bearer ") ? t : `Bearer ${t}`;
  return h;
}

export async function getLeadDetail(leadType: CrmLeadType, id: string): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/crm/lead/${leadType}/${id}`, {
    cache: "no-store",
    credentials: "include",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Record<string, unknown>>;
}

export async function getLeadActivities(leadType: CrmLeadType, id: string): Promise<unknown> {
  const res = await fetch(`/api/crm/lead/${leadType}/${id}/activities`, {
    cache: "no-store",
    credentials: "include",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function putLeadDetail(
  leadType: CrmLeadType,
  id: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/crm/lead/${leadType}/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<Record<string, unknown>>;
}

export async function postManualActivity(
  leadType: CrmLeadType,
  id: string,
  activityType: "CALL" | "WHATSAPP" | "SMS" | "NOTE",
  value: string
): Promise<string> {
  const res = await fetch(`/api/crm/lead/${leadType}/${id}/activity`, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify({ activityType, value }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text;
}
