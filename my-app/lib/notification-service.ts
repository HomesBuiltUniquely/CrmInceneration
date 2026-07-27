"use client";

/**
 * notification-service.ts
 *
 * Client-side service that fetches meeting notifications from the 4 CRM proxy
 * endpoints, maps Go server payloads → NotificationItem[], aggregates, and
 * sorts newest-first.
 *
 * RBAC filtering is applied per-endpoint on raw items BEFORE they are mapped
 * to NotificationItem.  This keeps all business logic out of the UI layer.
 *
 * Response envelope from Go server:
 *   { "data": [...] }          ← primary
 *   { "items": [...] }         ← fallback
 *   [...]                      ← raw array fallback
 *   {}                         ← empty — returns []
 */

import type { NotificationItem } from "@/app/Components/Notification/Notify";
import { CRM_LOGIN_USERNAME_KEY, normalizeRole } from "@/lib/auth/api";
import { applyNotificationRbacFilter } from "@/lib/notification-rbac-filter";

const LOG_PREFIX = "[notification-service]";

// ─── Go server raw item shape ─────────────────────────────────────────────────

/**
 * Raw notification item as returned by the Go NotifyProject server.
 *
 * Lead-identity fields:
 *   leadIdentifier / lead_identifier — business ID (e.g. "GL-2026-00123").
 *     This is the primary key used by the frontend RBAC filter to look up
 *     ownership in the /api/crm/leads map.
 *
 *   assignedToId / assigned_to_id / salesExecutiveId — numeric user IDs that
 *     the Go server MAY include in future payloads.  The RBAC filter currently
 *     resolves ownership via the lead map, but these fields are preserved here
 *     so that if the Go server starts sending them we can use them directly
 *     without a schema change.
 */
interface RawMeetingItem {
  // Identity
  id?: string | number;
  meeting_id?: string | number;
  // Content
  title?: string;
  description?: string;
  message?: string;
  // Lead info — BOTH camelCase and snake_case variants preserved for RBAC filter
  leadIdentifier?: string;
  lead_identifier?: string;
  leadName?: string;
  lead_name?: string;
  /**
   * Numeric ID of the sales executive assigned to this lead.
   * The Go server does not currently emit this field; it is declared here so
   * that future Go-server enrichment can be consumed without a type change.
   * The RBAC filter resolves ownership via the /api/crm/leads map using
   * leadIdentifier as the join key.
   */
  assignedToId?: number;
  assigned_to_id?: number;
  salesExecutiveId?: number;
  sales_executive_id?: number;
  // Meeting details
  meetingDate?: string;
  meeting_date?: string;
  slot?: string;
  meetingType?: string;
  meeting_type?: string;
  milestone?: string;
  // Timestamps — arrival time (when the record was inserted into notify_db)
  // The Go server may use any of these field names. We try all variants.
  timestamp?: string;
  createdAt?: string;
  created_at?: string;
  scheduledAt?: string;
  scheduled_at?: string;
  notifiedAt?: string;
  notified_at?: string;
  insertedAt?: string;
  inserted_at?: string;
  arrivedAt?: string;
  arrived_at?: string;
  notifyTime?: string;
  notify_time?: string;
  eventTime?: string;
  event_time?: string;
}

type MeetingTag = "SCHEDULED" | "RESCHEDULED" | "CANCELLATION" | "SUCCESS";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractItems(payload: unknown): RawMeetingItem[] {
  if (!payload || typeof payload !== "object") return [];

  // { "data": [...] }
  const asRecord = payload as Record<string, unknown>;
  if (Array.isArray(asRecord.data)) return asRecord.data as RawMeetingItem[];

  // { "items": [...] }
  if (Array.isArray(asRecord.items)) return asRecord.items as RawMeetingItem[];

  // Raw array
  if (Array.isArray(payload)) return payload as RawMeetingItem[];

  // Empty envelope {} — not an error, just no data
  return [];
}

function tagLabel(tag: MeetingTag): string {
  return tag.charAt(0) + tag.slice(1).toLowerCase(); // "Scheduled", "Cancellation" …
}

function defaultTitle(tag: MeetingTag): string {
  switch (tag) {
    case "SCHEDULED": return "Meeting Scheduled";
    case "RESCHEDULED": return "Meeting Rescheduled";
    case "CANCELLATION": return "Meeting Cancelled";
    case "SUCCESS": return "Meeting Completed";
  }
}

function mapRawItem(raw: RawMeetingItem, tag: MeetingTag, index: number): NotificationItem {
  const id = String(raw.id ?? raw.meeting_id ?? `${tag.toLowerCase()}-${index}`);

  const title = raw.title ?? defaultTitle(tag);

  // Build description from available meeting metadata
  const leadName = raw.leadName ?? raw.lead_name;
  const meetingDate = raw.meetingDate ?? raw.meeting_date;
  const meetingType = raw.meetingType ?? raw.meeting_type;
  const slot = raw.slot;
  const parts: string[] = [];
  if (leadName) parts.push(leadName);
  if (meetingDate) {
    try {
      parts.push(new Date(meetingDate).toLocaleString("en-IN", { dateStyle: "medium" }));
    } catch {
      parts.push(meetingDate);
    }
  }
  if (slot) parts.push(slot);
  if (meetingType) parts.push(meetingType.replace(/_/g, " "));
  const description =
    raw.description ?? raw.message ?? (parts.length ? parts.join(" · ") : undefined);

  // ── Arrival timestamp (when this notification entered notify_db) ──────────
  // Priority: any "created/inserted/notified/arrived" field → fallback to
  // meeting_date (the scheduled date) → current time as last resort.
  // We deliberately do NOT use meeting_date as the primary because it is a
  // future-scheduled date, not when the notification was created.
  const arrivalTimestamp =
    raw.created_at ??
    raw.createdAt ??
    raw.inserted_at ??
    raw.insertedAt ??
    raw.notified_at ??
    raw.notifiedAt ??
    raw.arrived_at ??
    raw.arrivedAt ??
    raw.notify_time ??
    raw.notifyTime ??
    raw.event_time ??
    raw.eventTime ??
    raw.timestamp ??
    raw.scheduled_at ??
    raw.scheduledAt ??
    null;

  // If no arrival time found, fall back to meeting_date so we at least show
  // something meaningful instead of "just now" (current time).
  const timestamp =
    arrivalTimestamp ??
    raw.meetingDate ??
    raw.meeting_date ??
    new Date().toISOString();

  return {
    id: `${tag.toLowerCase()}-${id}`,
    title,
    description,
    timestamp,
    read: false,
    tag: tagLabel(tag),
  };
}

// ─── Scope resolution (preserves existing RBAC passed to Go server) ───────────

/**
 * Returns the `scope` query-param value for a given role:
 *   SUPER_ADMIN / ADMIN / SALES_ADMIN → "all"
 *   SALES_MANAGER / PRESALES_MANAGER / DESIGN_MANAGER / TERRITORY_DESIGN_MANAGER → "team"
 *   everything else (executives, designers) → "own"
 */
function scopeForRole(role: string): "all" | "team" | "own" {
  const r = normalizeRole(role);
  if (r === "SUPER_ADMIN" || r === "ADMIN" || r === "SALES_ADMIN") return "all";
  if (r === "SALES_MANAGER" || r === "PRESALES_MANAGER") return "team";
  return "own";
}

// ─── Single-endpoint fetch ────────────────────────────────────────────────────

/**
 * Fetch raw items from one meeting endpoint and return them WITHOUT mapping
 * to NotificationItem yet.  The caller applies RBAC filtering on the raw
 * array (which still carries lead_identifier) before mapping.
 *
 * @param loginUsername  The credential typed at login — matches
 *                       leadDetails.assigned_to in the Go database.
 *                       Distinct from the display name stored in crm_user_name.
 */
async function fetchRawEndpointItems(
  path: string,
  tag: MeetingTag,
  role: string,
  loginUsername: string,
  authHeader: string,
): Promise<RawMeetingItem[]> {
  const scope = scopeForRole(role);
  // Pass loginUsername (the credential) as `username` so the Go backend's
  // LOWER(TRIM(ld.assigned_to)) = LOWER(TRIM(?)) comparison matches.
  const qs = new URLSearchParams({ role, username: loginUsername, scope }).toString();
  const url = `${path}?${qs}`;

  console.log(`${LOG_PREFIX} [${tag}] fetching: ${url}`);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: authHeader },
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network error";
    console.warn(`${LOG_PREFIX} [${tag}] fetch failed for ${url}:`, msg);
    return [];
  }

  console.log(`${LOG_PREFIX} [${tag}] response status: ${res.status}`);

  if (!res.ok) {
    console.warn(`${LOG_PREFIX} [${tag}] upstream ${res.status} for ${url}`);
    return [];
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    // e.g. empty 204 body — not an error
    console.log(`${LOG_PREFIX} [${tag}] empty response body`);
    return [];
  }

  const items = extractItems(payload);
  console.log(`${LOG_PREFIX} [${tag}] extracted ${items.length} items`);
  // Log the first raw item so we can see exactly which timestamp fields the Go server sends
  if (items.length > 0) {
    const sample = items[0] as Record<string, unknown>;
    const tsFields = Object.fromEntries(
      Object.entries(sample).filter(([k]) =>
        /time|date|at|stamp/i.test(k)
      )
    );
    console.log(`${LOG_PREFIX} [${tag}] sample timestamp fields:`, tsFields);
  }
  return items;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Aggregates notifications from all 4 meeting endpoints, applies frontend
 * RBAC filtering, and returns the final sorted list.
 *
 * Filtering happens on raw items (still carrying lead_identifier) so that
 * no UI component types need to be changed.
 *
 * Returns [] if token is missing rather than throwing.
 */
export async function loadNotifications(
  token: string | null,
  role: string,
  username: string,
): Promise<NotificationItem[]> {
  if (!token) {
    console.log(`${LOG_PREFIX} no token — skipping fetch`);
    return [];
  }

  const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

  // loginUsername: the credential stored at login time, matching leadDetails.assigned_to.
  // Falls back to the display-name `username` param if the new key isn't present
  // (existing sessions that logged in before CRM_LOGIN_USERNAME_KEY was added).
  const loginUsername =
    (typeof window !== "undefined"
      ? window.localStorage.getItem(CRM_LOGIN_USERNAME_KEY)?.trim()
      : null) || username;

  // ── Step 1: Fetch raw items from all 4 endpoints in parallel ──────────────
  const rawResults = await Promise.allSettled([
    fetchRawEndpointItems("/api/crm/meetings/scheduled", "SCHEDULED", role, loginUsername, authHeader),
    fetchRawEndpointItems("/api/crm/meetings/rescheduled", "RESCHEDULED", role, loginUsername, authHeader),
    fetchRawEndpointItems("/api/crm/meetings/cancellation", "CANCELLATION", role, loginUsername, authHeader),
    fetchRawEndpointItems("/api/crm/meetings/success", "SUCCESS", role, loginUsername, authHeader),
  ]);

  // Each endpoint returns { tag, items } so we can re-associate after filtering
  type TaggedRaw = { tag: MeetingTag; items: RawMeetingItem[] };
  const tags: MeetingTag[] = ["SCHEDULED", "RESCHEDULED", "CANCELLATION", "SUCCESS"];
  const taggedBatches: TaggedRaw[] = rawResults.map((res, i) => ({
    tag: tags[i],
    items: res.status === "fulfilled" ? (res.value ?? []) : [],
  }));

  // ── Step 2: Merge all raw items into a flat array for RBAC filtering ───────
  // Attach tag to each item so we can re-split after filtering.
  type TaggedItem = RawMeetingItem & { __notifyTag: MeetingTag };

  const allRaw: TaggedItem[] = taggedBatches.flatMap(({ tag, items }) =>
    items.map((item) => ({ ...item, __notifyTag: tag })),
  );

  console.log(`${LOG_PREFIX} raw items before RBAC filter: ${allRaw.length}`);
  console.log(`${LOG_PREFIX} role=${role}, username=${username}, loginUsername=${loginUsername}`);

  // ── Step 3: Apply RBAC filter on raw items (lead_identifier still present) ─
  // applyNotificationRbacFilter expects FilterableNotificationItem which only
  // requires { leadIdentifier?: string }.  We satisfy that because RawMeetingItem
  // has both leadIdentifier and lead_identifier.  We expose the unified key by
  // normalising before passing in.
  const normalizedRaw = allRaw.map((item) => ({
    ...item,
    // Unified key the filter reads from
    leadIdentifier: (item.leadIdentifier ?? item.lead_identifier ?? "").trim(),
    // Numeric assignee ID — used as a stronger identity fallback for SALES_EXECUTIVE
    // when leadIdentifier is blank or the name-based map match fails.
    // The Go server may emit any of these field names.
    __assignedId:
      item.assignedToId ??
      item.assigned_to_id ??
      item.salesExecutiveId ??
      item.sales_executive_id ??
      null,
  }));

  // Log sample items for debugging
  if (normalizedRaw.length > 0) {
    console.log(`${LOG_PREFIX} sample raw items:`, normalizedRaw.slice(0, 3).map((item) => ({
      id: item.id,
      leadIdentifier: item.leadIdentifier,
      __assignedId: item.__assignedId,
      title: item.title,
    })));
  }

  const filteredRaw = await applyNotificationRbacFilter(
    normalizedRaw,
    token,
    role,
    username,
  );

  console.log(`${LOG_PREFIX} raw items after RBAC filter: ${filteredRaw.length}`);

  // ── Step 4: Map filtered raw items → NotificationItem ─────────────────────
  const all: NotificationItem[] = filteredRaw.map((item, i) => {
    const tag = (item as TaggedItem).__notifyTag ?? "SCHEDULED";
    return mapRawItem(item as RawMeetingItem, tag, i);
  });

  // ── Step 5: Deduplicate by id (guard against same item from multiple sources)
  const seen = new Set<string>();
  const deduped = all.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  // ── Step 6: Sort newest-first ─────────────────────────────────────────────
  deduped.sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    if (Number.isNaN(tA) || Number.isNaN(tB)) return 0;
    return tB - tA;
  });

  console.log(`${LOG_PREFIX} total notifications after filter + dedup: ${deduped.length}`);
  return deduped;
}
