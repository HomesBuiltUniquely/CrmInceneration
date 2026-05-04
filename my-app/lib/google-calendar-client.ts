"use client";

import { getCrmAuthHeaders } from "@/lib/crm-client-auth";

type GStatus = { success?: boolean; connected?: boolean; googleEmail?: string; message?: string };
type GConnect = { success?: boolean; connectUrl?: string; url?: string; authUrl?: string; message?: string };
type GEvent = { id?: string; summary?: string; start?: string; end?: string; htmlLink?: string; description?: string; organizer?: { email?: string; displayName?: string }; attendees?: { email?: string; displayName?: string }[] };

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export async function fetchGoogleCalendarStatus(): Promise<GStatus> {
  const res = await fetch("/api/google-calendar/status", {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  return readJson<GStatus>(res);
}

/** Optional `returnUrl` is forwarded to Hub OAuth (`GET …/connect-url?returnUrl=`). */
export async function fetchGoogleCalendarConnectUrl(returnUrl?: string): Promise<string> {
  const qs = new URLSearchParams();
  if (returnUrl?.trim()) qs.set("returnUrl", returnUrl.trim());
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(`/api/google-calendar/connect-url${suffix}`, {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  const data = await readJson<GConnect>(res);
  const u = data.connectUrl ?? data.url ?? data.authUrl;
  if (!u) throw new Error(data.message ?? "Connect URL missing");
  return u;
}

export async function disconnectGoogleCalendar(): Promise<void> {
  const res = await fetch("/api/google-calendar/disconnect", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  await readJson<Record<string, unknown>>(res);
}

export async function fetchGoogleMyEvents(timeMin?: string, timeMax?: string): Promise<GEvent[]> {
  const qs = new URLSearchParams();
  if (timeMin) qs.set("timeMin", timeMin);
  if (timeMax) qs.set("timeMax", timeMax);
  const url = `/api/google-calendar/my-events${qs.toString() ? `?${qs.toString()}` : ""}`;
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  const data = await readJson<unknown>(res);
  if (Array.isArray(data)) return data as GEvent[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.events)) return o.events as GEvent[];
    if (Array.isArray(o.items)) return o.items as GEvent[];
    if (Array.isArray(o.data)) return o.data as GEvent[];
  }
  return [];
}
