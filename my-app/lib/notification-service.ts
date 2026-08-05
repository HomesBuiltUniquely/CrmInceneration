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

// ─── Booking raw item shape (matches proto Booking message from Go notify server) ─

/**
 * Raw booking/token item as returned by Go NotifyProject server GET /v1/bookings.
 * 
 * The Go server emits the proto `Booking` message via grpc-gateway, which 
 * translates snake_case proto fields → camelCase JSON by default.
 * 
 * We accept both camelCase and snake_case here for resilience across 
 * grpc-gateway versions and any manual snake_case config.
 * 
 * Also retains Spring booking_token_record field names as fallback in case
 * any legacy Spring data is still in the pipeline during migration.
 */
interface RawBookingItem {
  // ── Spring booking_token_record fields (camelCase from Spring JSON) ────────
  id?: string;                               // UUID primary key
  bookingStatus?: string;                    // in_progress | confirmed | cancelled …
  cancellationApprovalStatus?: string;       // NONE | PENDING | REJECTED
  cancellationReason?: string;
  cancellationRequestedByName?: string;
  cancelledAt?: string;
  createdAt?: string;
  updatedAt?: string;
  customerName?: string;
  customerPhone?: string;
  extraAmountReceived?: number;
  hubLeadId?: string;
  leadId?: number | string;
  leadIdentifier?: string;
  leadType?: string;
  listingType?: "booking" | "cancel" | "token" | string;
  paymentKind?: string;
  quoteAmount?: number;
  quoteId?: string;
  quoteVersionLabel?: string;
  remainingAmount?: number;
  submittedByName?: string;
  submittedByUserId?: number | string;
  tenPercentAmount?: number;
  tokenStatus?: string;
  amountReceived?: number;
  bookingDate?: string;
  submittedAt?: string;
  cumulativeReceived?: number;      // total cumulative paid — primary source for "paid" display
  // ── snake_case Spring fallbacks ───────────────────────────────────────────
  payment_kind?: string;
  ten_percent_amount?: number;
  amount_received?: number;
  cumulative_received?: number;     // snake_case variant
  // ── Proto Booking camelCase (Go notify server fallback) ───────────────────
  bookingId?: number;
  leadName?: string;
  paymentType?: string;                      // TOKEN | BOOKING
  paidAmount?: number;
  paymentDate?: string;
  paymentStatus?: string;                    // PENDING | SUCCESS | FAILED
  remarks?: string;
  // ── snake_case fallbacks ─────────────────────────────────────────────────
  booking_id?: number;
  lead_identifier?: string;
  lead_name?: string;
  payment_type?: string;
  paid_amount?: number;
  remaining_amount?: number;
  payment_date?: string;
  payment_status?: string;
  created_at?: string;
  [key: string]: unknown;
}

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

function defaultTitle(tag: MeetingTag, leadName?: string): string {
  switch (tag) {
    case "SCHEDULED": return "Meeting Scheduled";
    case "RESCHEDULED": return "Meeting Rescheduled";
    case "CANCELLATION": return "Meeting Cancelled";
    case "SUCCESS": return leadName ? `Meeting Successful with ${leadName}` : "Meeting Successful";
  }
}

function mapRawItem(raw: RawMeetingItem, tag: MeetingTag, index: number): NotificationItem {
  const id = String(raw.id ?? raw.meeting_id ?? `${tag.toLowerCase()}-${index}`);

  const leadName = raw.leadName ?? raw.lead_name ?? "";

  // For SUCCESS, name is baked into the title — no need to repeat in title prefix
  const title = raw.title ?? defaultTitle(tag, leadName || undefined);

  // For non-SUCCESS tags, append lead name to title if present
  const displayTitle =
    tag !== "SUCCESS" && leadName && !raw.title
      ? `${title} - ${leadName}`
      : title;

  // Build description from available meeting metadata
  const meetingDate = raw.meetingDate ?? raw.meeting_date;
  const meetingType = raw.meetingType ?? raw.meeting_type;
  const slot = raw.slot;
  const parts: string[] = [];
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
    title: displayTitle,
    description,
    timestamp,
    read: false,
    tag: tagLabel(tag),
  };
}

// ─── Lead raw item shape (matches proto Lead message) ────────────────────────

/**
 * Raw lead notification item from Go NotifyProject server.
 * Matches the proto `Lead` message exactly.
 *
 *   LeadListResponse.data → Lead[]
 *
 * Proto fields:
 *   lead_identifier string → leadIdentifier
 *   lead_name       string → leadName
 *   lead_type       string → leadType
 *   assigned_to     string → assignedTo
 *   created_at      string → createdAt
 */
interface RawLeadItem {
  // camelCase (Go JSON default)
  leadIdentifier?: string;
  leadName?: string;
  leadType?: string;
  assignedTo?: string;
  createdAt?: string;
  // snake_case fallback
  lead_identifier?: string;
  lead_name?: string;
  lead_type?: string;
  assigned_to?: string;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * Counts response shape from Go NotifyProject server.
 * Matches the proto `CountsResponse` message.
 *
 * Proto fields (all int32):
 *   total_leads, total_scheduled, total_rescheduled,
 *   total_cancelled, total_success, total_bookings
 */
export interface NotificationCounts {
  totalLeads: number;
  totalScheduled: number;
  totalRescheduled: number;
  totalCancelled: number;
  totalSuccess: number;
  totalBookings: number;
}

// ─── Booking helpers ──────────────────────────────────────────────────────────

function extractBookingItems(payload: unknown): RawBookingItem[] {
  if (!payload || typeof payload !== "object") return [];
  const asRecord = payload as Record<string, unknown>;
  // Go notify returns { data: [...] }  ← primary source now
  if (Array.isArray(asRecord.data)) return asRecord.data as RawBookingItem[];
  // Legacy: Spring returns { deals: [...] }
  if (Array.isArray(asRecord.deals)) return asRecord.deals as RawBookingItem[];
  if (Array.isArray(asRecord.items)) return asRecord.items as RawBookingItem[];
  if (Array.isArray(payload)) return payload as RawBookingItem[];
  return [];
}

function bookingTitle(raw: RawBookingItem): string {
  const lt = (raw.listingType ?? "").toString().toLowerCase();
  if (lt === "cancel" || (raw.bookingStatus ?? "").toLowerCase().includes("cancel")) {
    return "Booking Cancellation";
  }
  if (lt === "booking" || (raw.bookingStatus ?? "").toLowerCase() === "confirmed") {
    return "Booking Done";
  }

  // Token — check if full 10% is received via paymentKind or numeric comparison
  const kind = (
    raw.paymentKind ??   // Spring camelCase
    raw.payment_kind ??   // Spring snake_case fallback
    raw.paymentType ??   // Go proto
    raw.payment_type ??   // Go proto snake_case
    ""
  ).toString().trim();

  console.log(`${LOG_PREFIX} [BOOKING] bookingTitle — kind="${kind}", paid=${Number(raw.amountReceived ?? raw.paidAmount ?? raw.paid_amount ?? 0)}, target=${Number(raw.tenPercentAmount ?? raw.ten_percent_amount ?? 0)}, listingType="${raw.listingType}", bookingStatus="${raw.bookingStatus}"`);

  const paid = Number(raw.amountReceived ?? raw.amount_received ?? raw.paidAmount ?? raw.paid_amount ?? 0);
  const target = Number(raw.tenPercentAmount ?? raw.ten_percent_amount ?? 0);
  const remaining = Number(raw.remainingAmount ?? raw.remaining_amount ?? 0);
  const quoteAmount = Number(raw.quoteAmount ?? raw.quote_amount ?? 0);

  // Check if full payment is received (remaining is 0 or paid equals quote amount)
  const isFullPayment = 
    remaining === 0 || 
    (quoteAmount > 0 && paid >= quoteAmount);

  const isFullTenPercent =
    /full[\s_]*10/i.test(kind) ||               // "FULL 10%", "full_10", "full10", etc.
    kind.toUpperCase() === "BOOKING" ||          // payment_kind = BOOKING
    (target > 0 && paid >= target);             // numeric: paid >= 10% target

  // "Booking Done" for both 10% payment and full payment
  if (isFullPayment || isFullTenPercent) return "Booking Done";
  return "Token Received";
}

function fmt(n: number | string | undefined): string | undefined {
  if (n == null || n === "") return undefined;
  const num = Number(n);
  if (Number.isNaN(num)) return undefined;
  return `₹${num.toLocaleString("en-IN")}`;
}

function mapRawBookingItem(raw: RawBookingItem, index: number): NotificationItem {
  const id = String(raw.id ?? raw.bookingId ?? raw.booking_id ?? `booking-${index}`);
  const title = bookingTitle(raw);

  const parts: string[] = [];

  // Customer/Lead name — always show first
  const customerName = raw.customerName ?? raw.leadName ?? raw.lead_name ?? "";
  if (customerName) parts.push(customerName);

  // Shared paid amount resolver — tries all known field names
  const resolvePaid = () =>
    Number(raw.cumulativeReceived ?? raw.cumulative_received ?? 0) ||
    Number(raw.amountReceived ?? raw.amount_received ?? 0) ||
    Number(raw.paidAmount ?? raw.paid_amount ?? 0) ||
    (Number(raw.quoteAmount ?? raw.tenPercentAmount ?? raw.ten_percent_amount ?? 0) -
      Number(raw.remainingAmount ?? raw.remaining_amount ?? 0));

  if (title === "Booking Done") {
    const paid = resolvePaid() || Number(raw.tenPercentAmount ?? raw.ten_percent_amount ?? 0);
    const fmtPaid = fmt(paid);
    if (fmtPaid && paid > 0) parts.push(`Paid: ${fmtPaid}`);
  } else if (title === "Token Received") {
    // show kind, cumulative paid so far and what's remaining
    const kind = raw.paymentKind ?? raw.payment_kind ?? raw.paymentType ?? raw.payment_type;
    if (kind) parts.push(kind.replace(/_/g, " "));
    const paid = resolvePaid();
    const remaining = Number(raw.remainingAmount ?? raw.remaining_amount ?? 0);
    const fmtPaid = fmt(paid > 0 ? paid : undefined);
    const fmtRem = fmt(remaining);
    if (fmtPaid) parts.push(`Paid: ${fmtPaid}`);
    if (fmtRem && remaining > 0) parts.push(`Remaining: ${fmtRem}`);
  } else if (title === "Booking Cancellation" && raw.cancellationReason) {
    parts.push(`Reason: ${raw.cancellationReason}`);
  }

  const description = parts.length ? parts.join(" · ") : undefined;

  const timestamp =
    raw.createdAt ??
    raw.created_at ??
    raw.bookingDate ??
    raw.submittedAt ??
    raw.cancelledAt ??
    new Date().toISOString();

  return {
    id: `booking-${id}`,
    title,
    description,
    timestamp,
    read: false,
    tag: "Booking",
  };
}

// ─── Lead helpers ─────────────────────────────────────────────────────────────

function extractLeadItems(payload: unknown): RawLeadItem[] {
  if (!payload || typeof payload !== "object") return [];
  const asRecord = payload as Record<string, unknown>;
  if (Array.isArray(asRecord.data)) return asRecord.data as RawLeadItem[];
  if (Array.isArray(asRecord.items)) return asRecord.items as RawLeadItem[];
  if (Array.isArray(payload)) return payload as RawLeadItem[];
  return [];
}

function leadTypeLabel(leadType: string): string {
  // e.g. GOOGLE_ADS → "Google Ads", WALK_IN_LEAD → "Walk In Lead"
  return leadType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapRawLeadItem(raw: RawLeadItem, index: number): NotificationItem {
  const leadId = raw.leadIdentifier ?? raw.lead_identifier ?? `lead-${index}`;
  const leadName = raw.leadName ?? raw.lead_name ?? "";
  const leadType = raw.leadType ?? raw.lead_type ?? "";
  const assignedTo = raw.assignedTo ?? raw.assigned_to ?? "";
  const timestamp = raw.createdAt ?? raw.created_at ?? new Date().toISOString();

  // Description: type · assigned — name already in title, leadIdentifier NOT shown to user
  const parts: string[] = [];
  if (leadType) parts.push(leadTypeLabel(leadType));
  if (assignedTo) parts.push(`Assigned to: ${assignedTo}`);

  return {
    id: `lead-${leadId}`,
    title: leadName ? `New Lead - ${leadName}` : "New Lead",
    description: parts.length ? parts.join(" · ") : undefined,
    timestamp,
    read: false,
    tag: "Lead",
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

// ─── Booking endpoint fetch ───────────────────────────────────────────────────

/**
 * Fetch booking/token records from Go NotifyProject server GET /v1/bookings
 * (proxied via /api/crm/notifications/bookings).
 *
 * Returns booking notifications from the notify DB.
 * All roles see all booking notifications (no scope filtering needed here).
 */
async function fetchRawBookingItems(
  authHeader: string,
): Promise<RawBookingItem[]> {
  const url = "/api/crm/notifications/bookings";
  console.log(`${LOG_PREFIX} [BOOKING] fetching from Go notify server: ${url}`);

  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: authHeader }, cache: "no-store" });
  } catch (err) {
    console.warn(`${LOG_PREFIX} [BOOKING] fetch failed:`, err instanceof Error ? err.message : err);
    return [];
  }
  
  console.log(`${LOG_PREFIX} [BOOKING] response status: ${res.status}`);
  
  if (!res.ok) { 
    console.warn(`${LOG_PREFIX} [BOOKING] upstream ${res.status}`); 
    return []; 
  }

  let payload: unknown;
  try { 
    payload = await res.json(); 
  } catch { 
    console.warn(`${LOG_PREFIX} [BOOKING] empty or invalid JSON response`);
    return []; 
  }

  const items = extractBookingItems(payload);
  console.log(`${LOG_PREFIX} [BOOKING] extracted ${items.length} items from Go notify server`);
  
  // Log first item fields to verify Go response shape
  if (items.length > 0) {
    const s = items[0] as Record<string, unknown>;
    console.log(`${LOG_PREFIX} [BOOKING] sample fields from Go notify:`, {
      id: s.id ?? s.bookingId ?? s.booking_id,
      customerName: s.customerName,
      leadName: s.leadName ?? s.lead_name,
      leadIdentifier: s.leadIdentifier ?? s.lead_identifier,
      paymentKind: s.paymentKind,
      payment_kind: s.payment_kind,
      paymentType: s.paymentType ?? s.payment_type,
      amountReceived: s.amountReceived,
      amount_received: s.amount_received,
      paidAmount: s.paidAmount ?? s.paid_amount,
      cumulativeReceived: s.cumulativeReceived,
      cumulative_received: s.cumulative_received,
      tenPercentAmount: s.tenPercentAmount,
      ten_percent_amount: s.ten_percent_amount,
      remainingAmount: s.remainingAmount ?? s.remaining_amount,
      listingType: s.listingType,
      bookingStatus: s.bookingStatus,
      paymentStatus: s.paymentStatus ?? s.payment_status,
      createdAt: s.createdAt ?? s.created_at,
    });
  }
  return items;
}

// ─── Lead endpoint fetch ──────────────────────────────────────────────────────

/**
 * Fetch raw lead notification items from Go /v1/leads.
 * Returns all leads from notify DB, but RBAC filtering will be applied
 * by the caller to ensure users only see leads they have access to.
 */
async function fetchRawLeadItems(
  authHeader: string,
): Promise<RawLeadItem[]> {
  const url = "/api/crm/notifications/leads";
  console.log(`${LOG_PREFIX} 🔍 [LEAD] fetching from Go notify server: ${url}`);

  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: authHeader }, cache: "no-store" });
  } catch (err) {
    console.error(`${LOG_PREFIX} ❌ [LEAD] fetch failed:`, err instanceof Error ? err.message : err);
    return [];
  }

  console.log(`${LOG_PREFIX} 📡 [LEAD] response status: ${res.status}`);

  if (!res.ok) {
    console.warn(`${LOG_PREFIX} ⚠️ [LEAD] upstream ${res.status}`);
    return [];
  }

  let payload: unknown;
  try { payload = await res.json(); } catch {
    console.warn(`${LOG_PREFIX} ⚠️ [LEAD] empty or invalid JSON response`);
    return [];
  }

  const items = extractLeadItems(payload);
  console.log(`${LOG_PREFIX} ✅ [LEAD] extracted ${items.length} lead notification items`);

  // Log details of each lead notification
  if (items.length > 0) {
    console.log(`${LOG_PREFIX} 📋 [LEAD] All lead notifications:`, items.map((item, i) => ({
      index: i,
      leadIdentifier: item.leadIdentifier ?? item.lead_identifier,
      leadName: item.leadName ?? item.lead_name,
      leadType: item.leadType ?? item.lead_type,
      assignedTo: item.assignedTo ?? item.assigned_to,
      createdAt: item.createdAt ?? item.created_at,
    })));
  }

  return items;
}

// ─── Counts fetch ─────────────────────────────────────────────────────────────

/**
 * Fetch global notification counts from Go /v1/counts.
 * Returns a zeroed object on any failure so callers never throw.
 */
async function fetchRawCounts(authHeader: string): Promise<NotificationCounts> {
  const zero: NotificationCounts = {
    totalLeads: 0, totalScheduled: 0, totalRescheduled: 0,
    totalCancelled: 0, totalSuccess: 0, totalBookings: 0,
  };

  const url = "/api/crm/notifications/counts";
  console.log(`${LOG_PREFIX} [COUNTS] fetching: ${url}`);

  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: authHeader }, cache: "no-store" });
  } catch (err) {
    console.warn(`${LOG_PREFIX} [COUNTS] fetch failed:`, err instanceof Error ? err.message : err);
    return zero;
  }
  if (!res.ok) { console.warn(`${LOG_PREFIX} [COUNTS] upstream ${res.status}`); return zero; }

  let raw: Record<string, unknown>;
  try { raw = (await res.json()) as Record<string, unknown>; } catch { return zero; }

  // Accept both camelCase and snake_case from grpc-gateway
  const n = (key: string, alt: string) =>
    Number(raw[key] ?? raw[alt] ?? 0);

  const counts: NotificationCounts = {
    totalLeads: n("totalLeads", "total_leads"),
    totalScheduled: n("totalScheduled", "total_scheduled"),
    totalRescheduled: n("totalRescheduled", "total_rescheduled"),
    totalCancelled: n("totalCancelled", "total_cancelled"),
    totalSuccess: n("totalSuccess", "total_success"),
    totalBookings: n("totalBookings", "total_bookings"),
  };

  console.log(`${LOG_PREFIX} [COUNTS]`, counts);
  return counts;
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
  console.log(`${LOG_PREFIX} ════════════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} 🚀 loadNotifications START`);
  console.log(`${LOG_PREFIX} ════════════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} 📋 Parameters: role=${role}, username=${username}, hasToken=${!!token}`);

  if (!token) {
    console.log(`${LOG_PREFIX} ❌ no token — skipping fetch`);
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

  console.log(`${LOG_PREFIX} 🔑 Login username: "${loginUsername}" (credential for Go backend matching)`);

  // ── Step 1: Fetch from all endpoints in parallel ──────────────────────────
  // Meetings: role/username/scope-scoped  →  RBAC-filtered below
  // Bookings: all roles see all           →  bypass RBAC
  // Leads:    all roles see all           →  bypass RBAC

  console.log(`${LOG_PREFIX} 📡 Fetching from 6 endpoints in parallel...`);
  const fetchStart = Date.now();

  const [rawResults, rawBookings, rawLeads] = await Promise.all([
    Promise.allSettled([
      fetchRawEndpointItems("/api/crm/meetings/scheduled", "SCHEDULED", role, loginUsername, authHeader),
      fetchRawEndpointItems("/api/crm/meetings/rescheduled", "RESCHEDULED", role, loginUsername, authHeader),
      fetchRawEndpointItems("/api/crm/meetings/cancellation", "CANCELLATION", role, loginUsername, authHeader),
      fetchRawEndpointItems("/api/crm/meetings/success", "SUCCESS", role, loginUsername, authHeader),
    ]),
    fetchRawBookingItems(authHeader),
    fetchRawLeadItems(authHeader),
  ]);

  const fetchDuration = Date.now() - fetchStart;
  console.log(`${LOG_PREFIX} ✅ All fetches completed in ${fetchDuration}ms`);

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

  console.log(`${LOG_PREFIX} 📊 Raw items breakdown:`);
  console.log(`${LOG_PREFIX}   - Meetings (all tags): ${allRaw.length} items`);
  console.log(`${LOG_PREFIX}   - Bookings: ${rawBookings.length} items`);
  console.log(`${LOG_PREFIX}   - Leads: ${rawLeads.length} items`);
  console.log(`${LOG_PREFIX}   - TOTAL before RBAC: ${allRaw.length + rawBookings.length + rawLeads.length}`);
  console.log(`${LOG_PREFIX} 🔒 Applying RBAC filter to ${allRaw.length} meeting items...`);
  console.log(`${LOG_PREFIX} 📋 role=${role}, username=${username}, loginUsername=${loginUsername}`);

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
    console.log(`${LOG_PREFIX} 📋 Sample normalized raw items (first 3):`, normalizedRaw.slice(0, 3).map((item) => ({
      id: item.id,
      leadIdentifier: item.leadIdentifier,
      __assignedId: item.__assignedId,
      __notifyTag: item.__notifyTag,
      title: item.title,
    })));
  }

  const rbacStart = Date.now();
  const filteredRaw = await applyNotificationRbacFilter(
    normalizedRaw,
    token,
    role,
    username,
  );
  const rbacDuration = Date.now() - rbacStart;

  console.log(`${LOG_PREFIX} ✅ RBAC filter completed in ${rbacDuration}ms`);
  console.log(`${LOG_PREFIX} 📊 RBAC Result: ${allRaw.length} → ${filteredRaw.length} meeting items (${allRaw.length - filteredRaw.length} filtered out)`);

  // ── Step 4: Map filtered raw items → NotificationItem ─────────────────────
  const all: NotificationItem[] = filteredRaw.map((item, i) => {
    const tag = (item as TaggedItem).__notifyTag ?? "SCHEDULED";
    return mapRawItem(item as RawMeetingItem, tag, i);
  });

  // ── Step 4b: Apply RBAC filtering to LEAD notifications ────────────────────
  // Normalize lead items to include leadIdentifier for filtering
  const normalizedLeads = rawLeads.map((item) => ({
    ...item,
    leadIdentifier: (item.leadIdentifier ?? item.lead_identifier ?? "").trim(),
  }));

  console.log(`${LOG_PREFIX} 🔒 Applying RBAC filter to ${normalizedLeads.length} lead items...`);
  const rbacLeadsStart = Date.now();
  const filteredLeads = await applyNotificationRbacFilter(
    normalizedLeads,
    token,
    role,
    username,
  );
  const rbacLeadsDuration = Date.now() - rbacLeadsStart;
  console.log(`${LOG_PREFIX} ✅ Lead RBAC filter completed in ${rbacLeadsDuration}ms`);
  console.log(`${LOG_PREFIX} 📊 Lead RBAC Result: ${normalizedLeads.length} → ${filteredLeads.length} lead items (${normalizedLeads.length - filteredLeads.length} filtered out)`);

  // ── Step 4c: Booking items → NotificationItem (no RBAC - all roles see all) ──
  const bookingNotifications = rawBookings.map((item, i) => mapRawBookingItem(item, i));
  const leadNotifications = filteredLeads.map((item, i) => mapRawLeadItem(item as RawLeadItem, i));

  all.push(...bookingNotifications, ...leadNotifications);
  console.log(
    `${LOG_PREFIX} 📊 Added booking: ${bookingNotifications.length}, leads: ${leadNotifications.length} (after RBAC)`,
  );

  // ── Step 5: Deduplicate by id (guard against same item from multiple sources)
  const seen = new Set<string>();
  const deduped = all.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  if (all.length !== deduped.length) {
    console.log(`${LOG_PREFIX} ℹ️ Deduplicated: ${all.length} → ${deduped.length} (${all.length - deduped.length} duplicates removed)`);
  }

  // ── Step 6: Sort newest-first ─────────────────────────────────────────────
  deduped.sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    if (Number.isNaN(tA) || Number.isNaN(tB)) return 0;
    return tB - tA;
  });

  console.log(`${LOG_PREFIX} ════════════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} 🎯 loadNotifications COMPLETE`);
  console.log(`${LOG_PREFIX} 📊 Final result: ${deduped.length} total notifications`);
  console.log(`${LOG_PREFIX} ⏱️ Total time: ${Date.now() - (fetchStart - fetchDuration)}ms (fetch: ${fetchDuration}ms, rbac: ${rbacDuration}ms)`);
  console.log(`${LOG_PREFIX} ════════════════════════════════════════════════════════════════`);

  return deduped;
}

/**
 * Fetch global notification counts from the Go notify server.
 * Returns zeroed counts on any failure — safe to call without try/catch.
 *
 * Proto: CountsResponse
 *   total_leads, total_scheduled, total_rescheduled,
 *   total_cancelled, total_success, total_bookings
 */
export async function loadNotificationCounts(
  token: string | null,
): Promise<NotificationCounts> {
  const zero: NotificationCounts = {
    totalLeads: 0, totalScheduled: 0, totalRescheduled: 0,
    totalCancelled: 0, totalSuccess: 0, totalBookings: 0,
  };
  if (!token) return zero;
  const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  return fetchRawCounts(authHeader);
}
