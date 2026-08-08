"use client";

import type { NotificationItem } from "@/app/Components/Notification/Notify";
import { CRM_LOGIN_USERNAME_KEY, normalizeRole } from "@/lib/auth/api";
import { applyNotificationRbacFilter } from "@/lib/notification-rbac-filter";

const LOG_PREFIX = "[notification-service]";

// ─── Go server raw item shape ─────────────────────────────────────────────────

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
  assignedTo?: string;
  assigned_to?: string;
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
  assigned_to?: string;
  assignedTo?: string;
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

function buildMeetingTitle(tag: MeetingTag, leadName?: string, assignedTo?: string): string {
  const lead = leadName?.trim();
  const by = assignedTo?.trim() ? ` by ${assignedTo.trim()}` : "";

  switch (tag) {
    case "SCHEDULED":
      return lead
        ? `Meeting scheduled with ${lead}${by}`
        : `Meeting scheduled${by}`;
    case "RESCHEDULED":
      return lead
        ? `Meeting rescheduled with ${lead}${by}`
        : `Meeting rescheduled${by}`;
    case "CANCELLATION":
      return lead
        ? `Meeting with ${lead} cancelled${by}`
        : `Meeting cancelled${by}`;
    case "SUCCESS":
      return lead
        ? `Meeting with ${lead} was successful${by}.`
        : `Meeting was successful${by}.`;
  }
}

function mapRawItem(raw: RawMeetingItem, tag: MeetingTag, index: number): NotificationItem {
  // Use a stable ID based on meeting_id or id from the backend
  const meetingId = String(raw.meeting_id ?? raw.id ?? "");
  
  // Generate deterministic fallback ID using immutable fields instead of array index
  let id: string;
  if (meetingId) {
    id = `${tag.toLowerCase()}-${meetingId}`;
  } else {
    // Build deterministic ID from immutable fields: tag + leadIdentifier + meetingDate + timestamp
    const leadId = (raw.leadIdentifier ?? raw.lead_identifier ?? "").trim();
    const meetingDate = (raw.meetingDate ?? raw.meeting_date ?? "").trim();
    const timestamp = (raw.created_at ?? raw.createdAt ?? raw.timestamp ?? "").trim();
    
    // Use a combination of available immutable fields
    const deterministic = [
      tag.toLowerCase(),
      leadId,
      meetingDate,
      timestamp,
    ].filter(Boolean).join("-");
    
    // If we have enough immutable data, use it; otherwise fall back to index
    id = deterministic.length > tag.length + 1
      ? `${deterministic}`
      : `${tag.toLowerCase()}-fallback-${index}`;
  }

  const leadName = raw.leadName ?? raw.lead_name ?? "";
  const assignedTo = raw.assignedTo ?? raw.assigned_to ?? "";

  // Always build the title from our template so it includes leadName and assignedTo.
  // raw.title is intentionally ignored — the Go backend sends a legacy value
  // (e.g. "SCHEDULED meeting with test6") that must not override the formatted message.
  const title = buildMeetingTitle(tag, leadName || undefined, assignedTo || undefined);

  const displayTitle = title;

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

  // For SUCCESS (and any tag where meetingDate/slot/meetingType are absent),
  // fall back to created_at formatted as a readable date + time.
  if (parts.length === 0 && tag === "SUCCESS") {
    const fallbackTs =
      raw.created_at ??
      raw.createdAt ??
      raw.inserted_at ??
      raw.insertedAt ??
      raw.notified_at ??
      raw.notifiedAt ??
      raw.timestamp ??
      null;
    if (fallbackTs) {
      try {
        const d = new Date(fallbackTs);
        const datePart = d.toLocaleString("en-IN", { dateStyle: "medium" });
        const timePart = d.toLocaleString("en-IN", { timeStyle: "short" });
        parts.push(`${datePart} · ${timePart}`);
      } catch {
        parts.push(fallbackTs);
      }
    }
  }

  const description =
    raw.description ?? raw.message ?? (parts.length ? parts.join(" · ") : undefined);
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


  const timestamp = arrivalTimestamp ?? raw.meetingDate ?? raw.meeting_date ?? "";

  return {
    id,
    title: displayTitle,
    description,
    timestamp,
    read: false,
    tag: tagLabel(tag),
  };
}

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

function bookingTitle(raw: RawBookingItem, assignedTo?: string): string {
  const by = assignedTo?.trim() ? ` by ${assignedTo.trim()}` : "";
  const leadName = (raw.customerName ?? raw.leadName ?? raw.lead_name ?? "").trim();
  const withLead = leadName ? ` for ${leadName}` : "";
  const fromLead = leadName ? ` from ${leadName}` : "";

  const lt = (raw.listingType ?? "").toString().toLowerCase();
  if (lt === "cancel" || (raw.bookingStatus ?? "").toLowerCase().includes("cancel")) {
       return `Booking Cancellation${withLead}${by}.`;
  }
  if (lt === "booking" || (raw.bookingStatus ?? "").toLowerCase() === "confirmed") {
     return `Booking completed${withLead}${by}.`;
  }

  // Token — check if full 10% is received via paymentKind or numeric comparison
  const kind = (
    raw.paymentKind ??
    raw.payment_kind ??
    raw.paymentType ??
    raw.payment_type ??
    ""
  ).toString().trim();

  console.log(`${LOG_PREFIX} [BOOKING] bookingTitle — kind="${kind}", paid=${Number(raw.amountReceived ?? raw.paidAmount ?? raw.paid_amount ?? 0)}, target=${Number(raw.tenPercentAmount ?? raw.ten_percent_amount ?? 0)}, listingType="${raw.listingType}", bookingStatus="${raw.bookingStatus}"`);

  const paid = Number(raw.amountReceived ?? raw.amount_received ?? raw.paidAmount ?? raw.paid_amount ?? 0);
  const target = Number(raw.tenPercentAmount ?? raw.ten_percent_amount ?? 0);
  const remaining = Number(raw.remainingAmount ?? raw.remaining_amount ?? 0);
  const quoteAmount = Number(raw.quoteAmount ?? raw.quote_amount ?? 0);

  const isFullPayment =
    remaining === 0 ||
    (quoteAmount > 0 && paid >= quoteAmount);

  const isFullTenPercent =
    /full[\s_]*10/i.test(kind) ||
    kind.toUpperCase() === "BOOKING" ||
    (target > 0 && paid >= target);

if (isFullPayment || isFullTenPercent) return `Booking completed${withLead}${by}.`;
  return `Token received${fromLead}${by}.`;
}

function fmt(n: number | string | undefined): string | undefined {
  if (n == null || n === "") return undefined;
  const num = Number(n);
  if (Number.isNaN(num)) return undefined;
  return `₹${num.toLocaleString("en-IN")}`;
}

function mapRawBookingItem(raw: RawBookingItem, index: number): NotificationItem {
  // Use stable ID from backend
  const bookingId = String(raw.id ?? raw.bookingId ?? raw.booking_id ?? "");
  
  // Generate deterministic fallback ID using immutable fields instead of array index
  let id: string;
  if (bookingId) {
    id = `booking-${bookingId}`;
  } else {
    // Build deterministic ID from immutable fields: leadIdentifier + quoteId + bookingDate
    const leadId = (raw.leadIdentifier ?? raw.lead_identifier ?? raw.hubLeadId ?? "").trim();
    const quoteId = (raw.quoteId ?? "").trim();
    const bookingDate = (raw.bookingDate ?? raw.createdAt ?? raw.created_at ?? "").trim();
    
    const deterministic = [
      "booking",
      leadId,
      quoteId,
      bookingDate,
    ].filter(Boolean).join("-");
    
    // If we have enough immutable data, use it; otherwise fall back to index
    id = deterministic.length > "booking-".length
      ? deterministic
      : `booking-fallback-${index}`;
  }
  
  const assignedTo = (raw.assignedTo ?? raw.assigned_to ?? "").trim();
  const title = bookingTitle(raw, assignedTo || undefined);

  const parts: string[] = [];

  // Shared paid amount resolver — tries all known field names
  const resolvePaid = () =>
    Number(raw.cumulativeReceived ?? raw.cumulative_received ?? 0) ||
    Number(raw.amountReceived ?? raw.amount_received ?? 0) ||
    Number(raw.paidAmount ?? raw.paid_amount ?? 0) ||
    (Number(raw.quoteAmount ?? raw.tenPercentAmount ?? raw.ten_percent_amount ?? 0) -
      Number(raw.remainingAmount ?? raw.remaining_amount ?? 0));

  if (title.startsWith("Booking completed")) {
    const paid = resolvePaid() || Number(raw.tenPercentAmount ?? raw.ten_percent_amount ?? 0);
    const fmtPaid = fmt(paid);
    if (fmtPaid && paid > 0) parts.push(`Paid: ${fmtPaid}`);
  } else if (title.startsWith("Token received")) {
    // show kind, cumulative paid so far and what's remaining
    const kind = raw.paymentKind ?? raw.payment_kind ?? raw.paymentType ?? raw.payment_type;
    if (kind) parts.push(kind.replace(/_/g, " "));
    const paid = resolvePaid();
    const remaining = Number(raw.remainingAmount ?? raw.remaining_amount ?? 0);
    const fmtPaid = fmt(paid > 0 ? paid : undefined);
    const fmtRem = fmt(remaining);
    if (fmtPaid) parts.push(`Paid: ${fmtPaid}`);
    if (fmtRem && remaining > 0) parts.push(`Remaining: ${fmtRem}`);
  } else if (title.startsWith("Booking Cancellation") && raw.cancellationReason) {
    parts.push(`Reason: ${raw.cancellationReason}`);
  }

  const description = parts.length ? parts.join(" · ") : undefined;

  const timestamp =
    raw.createdAt ??
    raw.created_at ??
    raw.bookingDate ??
    raw.submittedAt ??
    raw.cancelledAt ??
    "";

  return {
    id,
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
  // Use stable ID from backend
  const leadIdentifier = (raw.leadIdentifier ?? raw.lead_identifier ?? "").trim();
  
  // Generate deterministic fallback ID using immutable fields instead of array index
  let leadId: string;
  if (leadIdentifier) {
    leadId = `lead-${leadIdentifier}`;
  } else {
    // Build deterministic ID from immutable fields: leadName + leadType + timestamp
    const leadName = (raw.leadName ?? raw.lead_name ?? "").trim();
    const leadType = (raw.leadType ?? raw.lead_type ?? "").trim();
    const timestamp = (raw.createdAt ?? raw.created_at ?? "").trim();
    
    const deterministic = [
      "lead",
      leadName,
      leadType,
      timestamp,
    ].filter(Boolean).join("-");
    
    // If we have enough immutable data, use it; otherwise fall back to index
    leadId = deterministic.length > "lead-".length
      ? deterministic
      : `lead-fallback-${index}`;
  }
  
  const leadName = raw.leadName ?? raw.lead_name ?? "";
  const leadType = raw.leadType ?? raw.lead_type ?? "";
  const assignedTo = raw.assignedTo ?? raw.assigned_to ?? "";
  const timestamp = raw.createdAt ?? raw.created_at ?? "";

  // Description: type · assigned — name already in title, leadIdentifier NOT shown to user
  const parts: string[] = [];
  if (leadType) parts.push(leadTypeLabel(leadType));
  if (assignedTo) parts.push(`Assigned to: ${assignedTo}`);

  return {
    id: leadId,
    title: leadName ? `New Lead - ${leadName}` : "New Lead",
    description: parts.length ? parts.join(" · ") : undefined,
    timestamp,
    read: false,
    tag: "Lead",
  };
}


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
  // Print the complete first item as-received from the backend so we can verify
  // exactly which fields (title, assigned_to, lead_name, etc.) the API returns.
  if (items.length > 0) {
    const sample = items[0] as Record<string, unknown>;
    console.log(
      `${LOG_PREFIX} [${tag}] ── FULL FIRST ITEM (raw API response) ──`,
      JSON.stringify(sample, null, 2),
    );
    // Also print the key diagnostic fields explicitly for quick scanning
    console.log(`${LOG_PREFIX} [${tag}] ── KEY FIELDS ──`, {
      meeting_id:      sample.meeting_id      ?? sample.id,
      lead_identifier: sample.lead_identifier ?? sample.leadIdentifier,
      title:           sample.title,
      lead_name:       sample.lead_name       ?? sample.leadName,
      assigned_to:     sample.assigned_to     ?? sample.assignedTo,
    });
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
  console.log(`${LOG_PREFIX}  [LEAD] fetching from Go notify server: ${url}`);

  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: authHeader }, cache: "no-store" });
  } catch (err) {
    console.error(`${LOG_PREFIX}  [LEAD] fetch failed:`, err instanceof Error ? err.message : err);
    return [];
  }

  console.log(`${LOG_PREFIX}  [LEAD] response status: ${res.status}`);

  if (!res.ok) {
    console.warn(`${LOG_PREFIX}  [LEAD] upstream ${res.status}`);
    return [];
  }

  let payload: unknown;
  try { payload = await res.json(); } catch {
    console.warn(`${LOG_PREFIX}  [LEAD] empty or invalid JSON response`);
    return [];
  }

  const items = extractLeadItems(payload);
  console.log(`${LOG_PREFIX}  [LEAD] extracted ${items.length} lead notification items`);

  // Log details of each lead notification
  if (items.length > 0) {
    console.log(`${LOG_PREFIX}  [LEAD] All lead notifications:`, items.map((item, i) => ({
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


export async function loadNotifications(
  token: string | null,
  role: string,
  username: string,
): Promise<NotificationItem[]> {
  console.log(`${LOG_PREFIX} ════════════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} loadNotifications START`);
  console.log(`${LOG_PREFIX} ════════════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} Parameters: role=${role}, username=${username}, hasToken=${!!token}`);

  if (!token) {
    console.log(`${LOG_PREFIX}  no token — skipping fetch`);
    return [];
  }

  const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;


  const loginUsername =
    (typeof window !== "undefined"
      ? window.localStorage.getItem(CRM_LOGIN_USERNAME_KEY)?.trim()
      : null) || username;

  console.log(`${LOG_PREFIX}  Login username: "${loginUsername}" (credential for Go backend matching)`);



  console.log(`${LOG_PREFIX}  Fetching from 6 endpoints in parallel...`);
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
  console.log(`${LOG_PREFIX}  All fetches completed in ${fetchDuration}ms`);

  // Each endpoint returns { tag, items } so we can re-associate after filtering
  type TaggedRaw = { tag: MeetingTag; items: RawMeetingItem[] };
  const tags: MeetingTag[] = ["SCHEDULED", "RESCHEDULED", "CANCELLATION", "SUCCESS"];
  const taggedBatches: TaggedRaw[] = rawResults.map((res, i) => ({
    tag: tags[i],
    items: res.status === "fulfilled" ? (res.value ?? []) : [],
  }));

  type TaggedItem = RawMeetingItem & { __notifyTag: MeetingTag };

  const allRaw: TaggedItem[] = taggedBatches.flatMap(({ tag, items }) =>
    items.map((item) => ({ ...item, __notifyTag: tag })),
  );

  console.log(`${LOG_PREFIX}  Raw items breakdown:`);
  console.log(`${LOG_PREFIX}   - Meetings (all tags): ${allRaw.length} items`);
  console.log(`${LOG_PREFIX}   - Bookings: ${rawBookings.length} items`);
  console.log(`${LOG_PREFIX}   - Leads: ${rawLeads.length} items`);
  console.log(`${LOG_PREFIX}   - TOTAL before RBAC: ${allRaw.length + rawBookings.length + rawLeads.length}`);
  console.log(`${LOG_PREFIX}  Applying RBAC filter to ${allRaw.length} meeting items...`);
  console.log(`${LOG_PREFIX}  role=${role}, username=${username}, loginUsername=${loginUsername}`);

  const normalizedRaw = allRaw.map((item) => ({
    ...item,
    // Unified key the filter reads from
    leadIdentifier: (item.leadIdentifier ?? item.lead_identifier ?? "").trim(),
   
    __assignedId:
      item.assignedToId ??
      item.assigned_to_id ??
      item.salesExecutiveId ??
      item.sales_executive_id ??
      null,
  }));

  // Log sample items for debugging — include assigned_to and lead_name to verify backend payload
  if (normalizedRaw.length > 0) {
    console.log(`${LOG_PREFIX}  Sample normalized raw items (first 3):`, normalizedRaw.slice(0, 3).map((item) => ({
      id: item.id,
      leadIdentifier: item.leadIdentifier,
      lead_name: item.lead_name,
      leadName: item.leadName,
      assigned_to: item.assigned_to,
      assignedTo: item.assignedTo,
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

  console.log(`${LOG_PREFIX}  RBAC filter completed in ${rbacDuration}ms`);
  console.log(`${LOG_PREFIX}  RBAC Result: ${allRaw.length} → ${filteredRaw.length} meeting items (${allRaw.length - filteredRaw.length} filtered out)`);

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

  console.log(`${LOG_PREFIX}  Applying RBAC filter to ${normalizedLeads.length} lead items...`);
  const rbacLeadsStart = Date.now();
  const filteredLeads = await applyNotificationRbacFilter(
    normalizedLeads,
    token,
    role,
    username,
  );
  const rbacLeadsDuration = Date.now() - rbacLeadsStart;
  console.log(`${LOG_PREFIX} Lead RBAC filter completed in ${rbacLeadsDuration}ms`);
  console.log(`${LOG_PREFIX}  Lead RBAC Result: ${normalizedLeads.length} → ${filteredLeads.length} lead items (${normalizedLeads.length - filteredLeads.length} filtered out)`);

  // ── Step 4c: Booking items → NotificationItem (no RBAC - all roles see all) ──
  const bookingNotifications = rawBookings.map((item, i) => mapRawBookingItem(item, i));
  const leadNotifications = filteredLeads.map((item, i) => mapRawLeadItem(item as RawLeadItem, i));

  all.push(...bookingNotifications, ...leadNotifications);
  console.log(
    `${LOG_PREFIX} Added booking: ${bookingNotifications.length}, leads: ${leadNotifications.length} (after RBAC)`,
  );

  // ── Step 5: Deduplicate by id (guard against same item from multiple sources)
  const seen = new Set<string>();
  const deduped = all.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  if (all.length !== deduped.length) {
    console.log(`${LOG_PREFIX}  Deduplicated: ${all.length} → ${deduped.length} (${all.length - deduped.length} duplicates removed)`);
  }

  // ── Step 6: Sort newest-first with proper handling of invalid timestamps ─────
  deduped.sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    
    // Place items with invalid timestamps at the end
    if (Number.isNaN(tA) && Number.isNaN(tB)) return 0;
    if (Number.isNaN(tA)) return 1;
    if (Number.isNaN(tB)) return -1;
    
    // Place items with empty timestamps at the end
    if (!a.timestamp && !b.timestamp) return 0;
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    
    return tB - tA;
  });

  console.log(`${LOG_PREFIX} ════════════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX}  loadNotifications COMPLETE`);
  console.log(`${LOG_PREFIX}  Final result: ${deduped.length} total notifications`);
  console.log(`${LOG_PREFIX}  Total time: ${Date.now() - (fetchStart - fetchDuration)}ms (fetch: ${fetchDuration}ms, rbac: ${rbacDuration}ms)`);
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
