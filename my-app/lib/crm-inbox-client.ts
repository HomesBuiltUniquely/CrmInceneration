"use client";

import {
  mapInboxRowToNotificationItem,
  parseInboxListPayload,
  type CrmInboxRow,
} from "@/lib/crm-inbox-mapper";
import type { NotificationItem } from "@/app/Components/Notification/Notify";
import { readStoredCrmToken } from "@/lib/crm-client-auth";

const INBOX_LIMIT = 200;

function authHeaders(): HeadersInit {
  const token = readStoredCrmToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchCrmInboxNotifications(): Promise<NotificationItem[]> {
  const qs = new URLSearchParams({ limit: String(INBOX_LIMIT) });
  const res = await fetch(`/api/crm/inbox?${qs}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = await res.json().catch(() => ({}));
  return parseInboxListPayload(json).map((row: CrmInboxRow) =>
    mapInboxRowToNotificationItem(row),
  );
}

export async function markCrmInboxRead(id: string): Promise<void> {
  await fetch(`/api/crm/inbox/${encodeURIComponent(id)}/read`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function markCrmInboxReadAll(): Promise<void> {
  await fetch(`/api/crm/inbox/read-all`, {
    method: "POST",
    headers: authHeaders(),
  });
}