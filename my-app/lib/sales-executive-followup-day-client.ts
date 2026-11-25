"use client";

import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { localCalendarDateKey } from "@/lib/se-followup-motivational-quotes";
import type { FollowUpBriefRow } from "@/lib/sales-executive-followup-day-brief";

export const SNAPSHOT_TOKEN_STORAGE_PREFIX = "crm:se-followup-snapshot-token:";

export type FollowUpDayApiResponse = {
  ok: boolean;
  variant: "morning" | "evening";
  firstName?: string;
  quote: string;
  counts: {
    totalDue: number;
    followupsActive: number;
    followupsClosure: number;
    overdueTotal: number;
    overdueActive: number;
    overdueClosure: number;
    completed?: number;
    left?: number;
    olderOverdueCleared?: number;
  };
  firstUp?: FollowUpBriefRow[];
  pending?: FollowUpBriefRow[];
  snapshotToken?: string;
  generatedAt: string;
  meta?: {
    degraded?: boolean;
    reason?: string;
    allOutstandingFromSnapshot?: boolean;
  };
  code?: string;
  error?: string;
};

export function seFollowUpApiEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_SE_FOLLOWUP_API?.trim().toLowerCase();
  if (flag === "0" || flag === "false") return false;
  return true;
}

export function readStoredSnapshotToken(viewerKey: string, dateKey: string): string {
  if (typeof window === "undefined" || !viewerKey) return "";
  try {
    return (
      window.localStorage.getItem(`${SNAPSHOT_TOKEN_STORAGE_PREFIX}${viewerKey}:${dateKey}`) ?? ""
    ).trim();
  } catch {
    return "";
  }
}

export function writeStoredSnapshotToken(
  viewerKey: string,
  dateKey: string,
  token: string,
): void {
  if (typeof window === "undefined" || !viewerKey || !token) return;
  try {
    window.localStorage.setItem(`${SNAPSHOT_TOKEN_STORAGE_PREFIX}${viewerKey}:${dateKey}`, token);
  } catch {
    /* ignore */
  }
}

function b64urlDecodeUtf8(value: string): string {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Evening CTA table filter — keys from server-signed snapshot token body. */
export function readTodaySnapshotLeadKeySet(
  viewerKey: string,
  dateKey = localCalendarDateKey(),
): ReadonlySet<string> {
  const token = readStoredSnapshotToken(viewerKey, dateKey);
  if (!token) return new Set();
  const body = token.split(".")[0];
  if (!body) return new Set();
  try {
    const parsed = JSON.parse(b64urlDecodeUtf8(body)) as {
      items?: { leadKey?: string }[];
    };
    const keys = new Set<string>();
    for (const item of parsed.items ?? []) {
      const k = String(item.leadKey ?? "").trim();
      if (k) keys.add(k);
    }
    return keys;
  } catch {
    return new Set();
  }
}

export async function fetchFollowUpDayBrief(args: {
  variant: "morning" | "evening";
  snapshotToken?: string;
  tzOffsetMinutes?: number;
}): Promise<FollowUpDayApiResponse> {
  const qs = new URLSearchParams();
  qs.set("variant", args.variant);
  if (args.variant === "evening" && args.snapshotToken?.trim()) {
    qs.set("snapshotToken", args.snapshotToken.trim());
  }
  const headers = getCrmAuthHeaders({ Accept: "application/json" });
  if (typeof args.tzOffsetMinutes === "number" && Number.isFinite(args.tzOffsetMinutes)) {
    (headers as Record<string, string>)["X-Client-Tz-Offset"] = String(args.tzOffsetMinutes);
  }
  const res = await fetch(`/api/crm/sales-executive/follow-up-day?${qs.toString()}`, {
    cache: "no-store",
    credentials: "include",
    headers,
  });
  const json = (await res.json().catch(() => ({}))) as FollowUpDayApiResponse;
  if (!res.ok) {
    return {
      ok: false,
      variant: args.variant,
      firstName: "",
      quote: "",
      counts: {
        totalDue: 0,
        followupsActive: 0,
        followupsClosure: 0,
        overdueTotal: 0,
        overdueActive: 0,
        overdueClosure: 0,
      },
      generatedAt: new Date().toISOString(),
      code: json.code,
      error: json.error ?? `Request failed (${res.status})`,
    };
  }
  return json;
}