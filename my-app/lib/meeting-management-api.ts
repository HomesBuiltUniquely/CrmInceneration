import {
  fetchDesignerAppointments,
  fetchDesignersForHubMeeting,
  fetchMyAppointments,
} from "@/lib/appointment-client";
import { CRM_LOGIN_USERNAME_KEY, CRM_ROLE_STORAGE_KEY } from "@/lib/auth/api";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { parseBudgetLabelToInr, resolveAnchorQuoteId } from "@/lib/insights-lead-investment";
import { crmLeadTypeToApiLabel } from "@/lib/crm-lead-type-label";
import { meetingTypeDisplay } from "@/lib/lead-detail-v2-display";
import { resolveQuoteAmount } from "@/lib/lead-quote-options";
import { CRM_LEAD_TYPES, readSalesStageFieldsFromLead, type ApiLead, type CrmLeadType } from "@/lib/leads-filter";
import { pipelineSubStageLabel } from "@/lib/milestone-substage-map";
import { isQuoteSentLead } from "@/lib/lead-milestone-insight-tiles";
import { extractQuoteSentFields } from "@/lib/quote-sent-info";
import { salesInsightCountLeads } from "@/lib/sales-admin-insight-tiles";
import {
  formatMeetingWhen,
  indiaWallUtcMs,
  meetingClockParts,
  meetingIso,
  meetingLevelLabel,
  meetingOffset,
  MEETING_TIME_ZONE,
  startOfMeetingBoardToday,
  sortMeetingsForList,
  type AvatarTone,
  type LocationTone,
  type MeetingBucket,
  type MeetingRecord,
  type MeetingStatus,
} from "@/lib/meeting-management-data";
import {
  extractProlanceQuoteTotalAmount,
  fetchProlanceQuoteShare,
} from "@/lib/prolance-quote-api";

const AVATAR_TONES: AvatarTone[] = ["blue", "green", "violet", "amber", "rose"];

type MeetingTypeCode = "SHOWROOM_VISIT" | "VIRTUAL_MEETING" | "SITE_VISIT";

function readString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function readNumber(row: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "—";
}

function meetingTypeCode(raw: string): MeetingTypeCode {
  const key = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (key.includes("VIRTUAL") || key.includes("GOOGLE") || key.includes("VIDEO") || key.includes("MEET")) {
    return "VIRTUAL_MEETING";
  }
  if (key.includes("SITE")) return "SITE_VISIT";
  return "SHOWROOM_VISIT";
}

function locationTone(code: MeetingTypeCode): LocationTone {
  if (code === "VIRTUAL_MEETING") return "green";
  if (code === "SITE_VISIT") return "violet";
  return "blue";
}

function parseWhen(raw: string): { date: string; startMin: number } | null {
  const text = raw.trim();
  if (!text) return null;
  const dateOnly = text.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnly) return { date: dateOnly[1], startMin: 11 * 60 };
  // No zone: Hub stores the India wall clock, e.g. 2026-10-22T14:00:00 is 2:00 PM.
  const naive = text.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?$/);
  if (naive) {
    return { date: naive[1], startMin: Number(naive[2]) * 60 + Number(naive[3]) };
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = meetingClockParts(parsed);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return { date: `${parts.year}-${month}-${day}`, startMin: parts.hour * 60 + parts.minute };
}

function customerFrom(row: Record<string, unknown>): string {
  const named = readString(row, "customerName", "clientName", "leadName", "name");
  if (named) return named;
  const description = readString(row, "description", "Description");
  const match = description.match(/Meeting with\s+(.+?)\s*-\s*Lead ID:/i);
  return match?.[1]?.trim() || "";
}

function leadIdFrom(row: Record<string, unknown>): number | undefined {
  const direct = readNumber(row, "leadId", "LeadId", "lead_id");
  if (direct != null && direct > 0) return direct;
  const description = readString(row, "description", "Description");
  const match = description.match(/Lead ID:\s*(\d+)/i);
  const parsed = Number(match?.[1] ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function boardProgress(row: Record<string, unknown>): MeetingRecord["progress"] | undefined {
  const raw = readString(row, "meetingProgress", "meeting_progress", "progress")
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (
    raw === "SCHEDULED" ||
    raw === "IN_PROGRESS" ||
    raw === "MEETING_ABANDONED" ||
    raw === "MEETING_SUCCESSFUL"
  ) {
    return raw;
  }
  return undefined;
}

function boardMeetingStatus(row: Record<string, unknown>): "SCHEDULED" | "RESCHEDULED" | "CANCELLED" {
  const raw = readString(row, "meetingStatus", "meeting_status").toUpperCase();
  if (raw === "RESCHEDULED" || raw.includes("RESCHEDULE")) return "RESCHEDULED";
  if (raw === "CANCELLED" || raw.includes("CANCEL")) return "CANCELLED";
  return "SCHEDULED";
}

/** Clock only: before the slot, during it, or after it has ended. */
function slotProgress(date: string, startMin: number, endMin: number): MeetingStatus {
  const offset = meetingOffset(date);
  if (offset < 0) return "COMPLETED";
  if (offset > 0) return "SCHEDULED";
  const now = meetingClockParts(new Date());
  const nowMin = now.hour * 60 + now.minute;
  if (nowMin >= endMin) return "COMPLETED";
  if (nowMin >= startMin) return "IN PROGRESS";
  return "SCHEDULED";
}

function statusFrom(row: Record<string, unknown>, date: string, startMin: number, endMin: number): MeetingStatus {
  const raw = readString(row, "status", "appointmentStatus").toUpperCase();
  if (raw.includes("CANCEL")) return "CANCELLED";
  if (raw.includes("RESCHEDULE")) return "RESCHEDULED";
  if (readString(row, "rescheduleReason", "reschedule_reason")) return "RESCHEDULED";
  return slotProgress(date, startMin, endMin);
}

function bucketFor(status: MeetingStatus, offset: number): MeetingBucket {
  if (status === "CANCELLED") return "cancelled";
  if (status === "COMPLETED" || offset < 0) return "completed";
  if (offset === 0) return "today";
  return "upcoming";
}

function budgetRaw(lead: ApiLead): string {
  const row = lead as Record<string, unknown>;
  const dynamic = row.dynamicFields;
  const fromDynamic =
    dynamic && typeof dynamic === "object" && !Array.isArray(dynamic)
      ? readString(dynamic as Record<string, unknown>, "budget", "budgetRange", "estimatedBudget")
      : "";
  return readString(row, "budget", "budgetRange", "estimatedBudget", "leadBudget") || fromDynamic;
}

function leadName(lead: ApiLead): string {
  return readString(lead as Record<string, unknown>, "customerName", "name", "fullName");
}

function leadPhone(lead: ApiLead): string {
  return readString(lead as Record<string, unknown>, "phone", "phoneNumber", "mobile", "mobileNumber");
}

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>, concurrency: number): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const count = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(
    Array.from({ length: count }, async () => {
      while (index < items.length) {
        const current = index;
        index += 1;
        await worker(items[current]!);
      }
    }),
  );
}

async function loadAppointmentRows(): Promise<Record<string, unknown>[]> {
  const designers = await fetchDesignersForHubMeeting().catch(() => []);
  const batches = await Promise.all([
    fetchMyAppointments().catch(() => [] as unknown[]),
    ...designers.map((designer) => fetchDesignerAppointments(designer.name).catch(() => [] as unknown[])),
  ]);
  const byId = new Map<string, Record<string, unknown>>();
  let fallback = 0;
  for (const batch of batches) {
    for (const item of batch) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const id = readString(row, "id", "Id", "appointmentId") || `row-${fallback++}`;
      if (!byId.has(id)) byId.set(id, row);
    }
  }
  return [...byId.values()];
}

function quoteIdOf(lead: ApiLead): string {
  const anchored = resolveAnchorQuoteId(lead);
  if (anchored) return anchored;
  return readString(lead as Record<string, unknown>, "hubQuoteId", "quoteId");
}

/** Lead list the signed-in CRM session can read. Detail-by-id is not used here. */
async function loadLeadIndex(ids: Set<string>): Promise<Map<string, ApiLead>> {
  const map = new Map<string, ApiLead>();
  if (ids.size === 0) return map;
  const headers = getCrmAuthHeaders({ Accept: "application/json" });
  for (let page = 0; page < 20 && map.size < ids.size; page += 1) {
    const res = await fetch(`/api/crm/leads?mergeAll=1&page=${page}&size=500`, {
      cache: "no-store",
      credentials: "include",
      headers,
    });
    if (!res.ok) break;
    let json: { content?: ApiLead[]; totalPages?: number };
    try {
      json = (await res.json()) as { content?: ApiLead[]; totalPages?: number };
    } catch {
      break;
    }
    const content = Array.isArray(json.content) ? json.content : [];
    for (const lead of content) {
      const id = String(lead.id ?? "").trim();
      if (id && ids.has(id) && !map.has(id)) map.set(id, lead);
    }
    if (content.length === 0 || page + 1 >= Math.max(1, Number(json.totalPages ?? 1))) break;
  }
  return map;
}

async function quotationTotals(leads: ApiLead[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  const ids = [...new Set(leads.map((lead) => quoteIdOf(lead)).filter(Boolean))];
  await runPool(
    ids,
    async (quoteId) => {
      try {
        const share = await fetchProlanceQuoteShare(quoteId);
        const amount = resolveQuoteAmount(extractProlanceQuoteTotalAmount(share));
        if (amount != null) totals.set(quoteId, Math.round(amount));
      } catch {
        totals.set(quoteId, 0);
      }
    },
    5,
  );
  return totals;
}

function leadTypeLabel(raw: string, fallback = ""): string {
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (CRM_LEAD_TYPES.includes(compact as CrmLeadType)) return crmLeadTypeToApiLabel(compact as CrmLeadType);
  if (raw.trim()) return raw.trim();
  const fallbackCompact = fallback.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (CRM_LEAD_TYPES.includes(fallbackCompact as CrmLeadType)) {
    return crmLeadTypeToApiLabel(fallbackCompact as CrmLeadType);
  }
  return "—";
}

function sourceCodeOf(raw: string): "CRM" | "DESIGN_MODULE" {
  return raw.trim().toUpperCase().includes("DESIGN") ? "DESIGN_MODULE" : "CRM";
}

function sourceLabel(code: "CRM" | "DESIGN_MODULE"): string {
  return code === "DESIGN_MODULE" ? "Design module" : "CRM";
}

function leadTypeCodeOf(raw: string, fallback = ""): string {
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (CRM_LEAD_TYPES.includes(compact as CrmLeadType)) return compact;
  const fallbackCompact = fallback.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (CRM_LEAD_TYPES.includes(fallbackCompact as CrmLeadType)) return fallbackCompact;
  return raw.trim();
}

function formatStamp(raw: string): string {
  if (!raw.trim()) return "—";
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return raw;
  return new Date(parsed).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: MEETING_TIME_ZONE,
  });
}

function toRecord(
  row: Record<string, unknown>,
  index: number,
  leads: Map<string, ApiLead>,
  quotes: Map<string, number>,
): MeetingRecord | null {
  const when = parseWhen(
    readString(row, "startTime", "StartTime", "start_time", "meetingDate", "date"),
  );
  if (!when) return null;
  const end = parseWhen(readString(row, "endTime", "EndTime", "end_time"));
  const durationMin =
    end && end.date === when.date && end.startMin > when.startMin ? end.startMin - when.startMin : 90;
  const leadId = leadIdFrom(row);
  const lead = leadId != null ? leads.get(String(leadId)) : undefined;
  const rawType = readString(row, "meetingType", "MeetingType", "meeting_type");
  const code = rawType ? meetingTypeCode(rawType) : undefined;
  const typeLabel = rawType ? meetingTypeDisplay(code!) : "—";
  const customer = customerFrom(row) || leadName(lead ?? {}) || (leadId != null ? `Lead ${leadId}` : "Lead");
  const assignee = readString(row, "designerName", "DesignerName", "designer_name");
  const designerEmail = readString(row, "designerEmail", "designer_email");
  const salesName = readString(row, "salesUserName", "salesName", "sales_user_name", "createdByName");
  const assignedSalesName = readString(row, "assignedSalesName", "assigned_sales_name");
  const salesEmail = readString(row, "salesEmail", "salesUserEmail", "sales_user_email", "createdByEmail");
  const sourceCode = sourceCodeOf(readString(row, "source", "Source"));
  const appointmentSource = sourceLabel(sourceCode);
  const meetingLabel = readString(row, "meetingLabel", "meeting_label", "designMilestone", "design_milestone");
  const meetingLevel = meetingLevelLabel(meetingLabel, sourceCode);
  const scheduledAtRaw = readString(row, "createdAt", "CreatedAt", "created_at");
  const updatedAtRaw = readString(row, "updatedAt", "UpdatedAt", "updated_at", "rescheduledAt");
  const scheduledAtMs = Math.max(Date.parse(scheduledAtRaw) || 0, Date.parse(updatedAtRaw) || 0);
  const scheduledAt = formatStamp(scheduledAtRaw);
  const designerLabel = assignee || "Designer";
  const scheduledBy =
    sourceCode === "DESIGN_MODULE"
      ? `${designerLabel} scheduled this with ${customer}`
      : `${salesName || designerLabel} scheduled this in CRM for ${customer}`;
  const quoteSentFields = lead ? extractQuoteSentFields(lead as Record<string, unknown>) : null;
  const quoteSent = lead ? isQuoteSentLead(lead) : false;
  const quoteId = (lead ? quoteIdOf(lead) : "") || quoteSentFields?.quoteId || "";
  const quotation = quoteId ? quotes.get(quoteId) ?? 0 : 0;
  const budget = lead ? parseBudgetLabelToInr(budgetRaw(lead)) : 0;
  const valueSource = quoteSent && quotation > 0 ? "quotation" : budget > 0 ? "budget" : "";
  const value = quoteSent && quotation > 0 ? quotation : budget > 0 ? budget : quotation > 0 ? quotation : 0;
  const stageFields = lead ? readSalesStageFieldsFromLead(lead) : { milestoneStage: "", milestoneStageCategory: "", milestoneSubStage: "" };
  const milestoneSubStage = pipelineSubStageLabel(stageFields.milestoneSubStage);
  const milestoneBlob = `${stageFields.milestoneStage} ${stageFields.milestoneStageCategory}`.toLowerCase();
  const experienceOrDesign = milestoneBlob.includes("experience") || milestoneBlob.includes("design");
  const offset = meetingOffset(when.date);
  const endMin = when.startMin + durationMin;
  const timePassed = indiaWallUtcMs(when.date, endMin) < Date.now();
  const stillBooked = milestoneSubStage === "Meeting Scheduled" || milestoneSubStage.startsWith("Meeting Rescheduled");
  const needsOutcome = timePassed && stillBooked && experienceOrDesign;
  let status = statusFrom(row, when.date, when.startMin, endMin);
  if (milestoneSubStage === "Meeting Cancelled" || milestoneSubStage === "Meeting Cancelled/Paused") {
    status = "CANCELLED";
  }
  const appointmentId = readNumber(row, "id", "Id", "appointmentId");
  return {
    id: appointmentId ?? index + 1,
    order: index + 1,
    customer,
    initials: initialsOf(customer),
    avatarTone: AVATAR_TONES[index % AVATAR_TONES.length]!,
    intent: "WARM",
    quoteNo: quoteId,
    quoteCode: "",
    phone: lead ? leadPhone(lead) : "",
    customerEmail:
      readString(row, "customerEmail", "customer_email", "email") ||
      readString((lead ?? {}) as Record<string, unknown>, "email"),
    assignee: assignee || "Unassigned",
    assigneeRole: "",
    designerEmail,
    meetingType: typeLabel,
    meetingTypeCode: code,
    meetingLabel: meetingLabel || (sourceCode === "CRM" ? "quote_meeting" : ""),
    meetingLevel,
    whenLabel: formatMeetingWhen(offset, when.startMin),
    whenNote: "",
    bucket: bucketFor(status, offset),
    dayOffset: offset,
    location: typeLabel,
    locationTone: code ? locationTone(code) : "blue",
    status,
    value,
    budget,
    quoteValue: quotation > 0 ? quotation : 0,
    valueSource,
    date: when.date,
    startMin: when.startMin,
    durationMin,
    appointmentId,
    leadId,
    leadType: leadTypeLabel(
      readString(row, "leadType", "LeadType", "lead_type"),
      lead?.leadType || "",
    ),
    leadTypeCode: leadTypeCodeOf(readString(row, "leadType", "LeadType", "lead_type"), lead?.leadType || ""),
    appointmentSource,
    sourceCode,
    salesName,
    assignedSalesName,
    salesEmail,
    scheduledAt,
    scheduledAtMs: scheduledAtMs > 0 ? scheduledAtMs : undefined,
    scheduledBy,
    googleSyncStatus: readString(row, "googleSyncStatus", "googleSync", "syncStatus") || "—",
    googleSyncMessage: readString(row, "googleSyncMessage", "google_sync_message"),
    googleHtmlLink: readString(row, "googleHtmlLink", "google_html_link"),
    quoteSent,
    quoteSentAt: formatStamp(quoteSentFields?.quoteSentAt || quoteSentFields?.lastQuoteSentAt || ""),
    milestoneStage: stageFields.milestoneStage || stageFields.milestoneStageCategory || "—",
    milestoneSubStage: milestoneSubStage || "—",
    needsOutcome,
  };
}

function buildBoard(
  rows: Record<string, unknown>[],
  leads: Map<string, ApiLead>,
  quotes: Map<string, number>,
): MeetingRecord[] {
  return rows
    .map((row, index) => toRecord(row, index, leads, quotes))
    .filter((row): row is MeetingRecord => row !== null);
}

function cancelledLeadRecord(lead: ApiLead, index: number, quotes: Map<string, number>): MeetingRecord | null {
  const whenRaw = readString(lead as Record<string, unknown>, "meetingDate", "meeting_date");
  const when = parseWhen(whenRaw) ?? { date: meetingIso(startOfMeetingBoardToday()), startMin: 11 * 60 };
  const record = toRecord(
    {
      customerName: leadName(lead),
      leadId: lead.id,
      leadType: lead.leadType,
      meetingDate: whenRaw || when.date,
      startTime: whenRaw,
      description: "Meeting cancelled",
      status: "CANCELLED",
    },
    index,
    new Map([[String(lead.id ?? ""), lead]]),
    quotes,
  );
  if (!record) return null;
  return { ...record, id: Number(lead.id) || index + 1, appointmentId: undefined, status: "CANCELLED" };
}

/** One board built from appointments plus lead milestone, quote-sent, and cancelled leads. */
export function assembleMeetingBoard(
  appointments: Record<string, unknown>[],
  leads: Map<string, ApiLead>,
  quotes: Map<string, number>,
  cancelledLeads: ApiLead[] = [],
): MeetingRecord[] {
  const meetings = buildBoard(appointments, leads, quotes);
  const seen = new Set(meetings.map((row) => (row.leadId != null ? String(row.leadId) : "")));
  const extras = cancelledLeads
    .filter((lead) => {
      const id = String(lead.id ?? "").trim();
      return id && !meetings.some((row) => String(row.leadId ?? "") === id && row.status === "CANCELLED");
    })
    .map((lead, index) => cancelledLeadRecord(lead, index, quotes))
    .filter((row): row is MeetingRecord => row !== null && !seen.has(String(row.leadId ?? "")));
  return sortMeetingsForList([...meetings, ...extras]).map((row, index) => ({ ...row, order: index + 1 }));
}

/**
 * Same leads as the Sales Admin Quote Sent tile (primary-source rows, won and lost).
 * A lead that already has a meeting keeps that meeting. The rest still appear as a row.
 */
export function quoteSentLeadRows(
  leads: ApiLead[],
  meetings: MeetingRecord[],
  quotes: Map<string, number>,
): MeetingRecord[] {
  const pool = salesInsightCountLeads(leads).filter((lead) => isQuoteSentLead(lead));
  const latest = new Map<string, MeetingRecord>();
  for (const row of meetings) {
    const id = row.leadId == null ? "" : String(row.leadId);
    if (!id) continue;
    const prev = latest.get(id);
    if (!prev || row.date > prev.date || (row.date === prev.date && row.startMin >= prev.startMin)) {
      latest.set(id, row);
    }
  }
  const rows: MeetingRecord[] = [];
  pool.forEach((lead, index) => {
    const id = String(lead.id ?? "").trim();
    if (!id) return;
    const existing = latest.get(id);
    if (existing) {
      rows.push({ ...existing, quoteSent: true });
      return;
    }
    const stamp = extractQuoteSentFields(lead as Record<string, unknown>);
    const when = stamp.lastQuoteSentAt || stamp.quoteSentAt || "";
    const created = toRecord(
      {
        customerName: leadName(lead),
        leadId: lead.id,
        leadType: lead.leadType,
        startTime: when || meetingIso(startOfMeetingBoardToday()),
        description: "Quote sent",
      },
      index,
      new Map([[id, lead]]),
      quotes,
    );
    if (created) {
      const sub = created.milestoneSubStage;
      const status =
        sub === "Meeting Successful"
          ? "COMPLETED"
          : sub === "Meeting Scheduled"
            ? "SCHEDULED"
            : sub.startsWith("Meeting Rescheduled")
              ? "RESCHEDULED"
              : sub === "Meeting Cancelled" || sub === "Meeting Cancelled/Paused"
                ? "CANCELLED"
                : created.status;
      rows.push({ ...created, quoteSent: true, appointmentId: undefined, status });
    }
  });
  return sortMeetingsForList(rows).map((row, index) => ({ ...row, order: index + 1 }));
}

export type MeetingProgress = "SCHEDULED" | "IN_PROGRESS" | "MEETING_ABANDONED" | "MEETING_SUCCESSFUL";

export type MeetingBoardQuery = {
  from?: string;
  to?: string;
  designerNames?: string[];
  salesNames?: string[];
  branches?: string[];
  progress?: MeetingProgress[];
  page?: number;
  pageSize?: number;
};

export type MeetingBoardPayload = {
  meetings: MeetingRecord[];
  quoteSentMeetings: MeetingRecord[];
  total: number;
  page: number;
  pageSize: number;
};

function readFlag(row: Record<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) continue;
    const value = row[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
    if (typeof value === "string") {
      const text = value.trim().toLowerCase();
      if (text === "true" || text === "yes" || text === "1") return true;
      if (text === "false" || text === "no" || text === "0") return false;
    }
  }
  return undefined;
}

function wholeRupees(row: Record<string, unknown>, ...keys: string[]): number {
  const amount = readNumber(row, ...keys);
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount);
}

function asRecordList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

function mapBoardRow(row: Record<string, unknown>, index: number, quoteLead: boolean): MeetingRecord | null {
  const startRaw = readString(row, "startTime", "StartTime", "start_time");
  const sentRaw = readString(row, "quoteSentAt", "quote_sent_at");
  const when = parseWhen(startRaw) ?? (quoteLead ? parseWhen(sentRaw) : null);
  if (!when && !quoteLead) return null;
  const date = when?.date ?? "";
  const startMin = when?.startMin ?? 0;
  const end = parseWhen(readString(row, "endTime", "EndTime", "end_time"));
  const hasSlotEnd = Boolean(end && when && end.date === when.date && end.startMin > when.startMin);
  const durationMin = hasSlotEnd && end && when ? end.startMin - when.startMin : 90;
  const leadId = leadIdFrom(row);
  const rawType = readString(row, "meetingType", "MeetingType", "meeting_type");
  const code = rawType ? meetingTypeCode(rawType) : undefined;
  const typeLabel = rawType && code ? meetingTypeDisplay(code) : quoteLead ? "—" : "—";
  const customer = customerFrom(row) || (leadId != null ? `Lead ${leadId}` : "Lead");
  const assignee = readString(row, "designerName", "DesignerName", "designer_name");
  const salesName = readString(row, "salesName", "salesUserName", "sales_name");
  const assignedSalesName = readString(row, "assignedSalesName", "assigned_sales_name");
  const sourceRaw = readString(row, "source", "Source");
  const sourceCode = sourceRaw ? sourceCodeOf(sourceRaw) : "CRM";
  const meetingLabel = readString(row, "meetingLabel", "meeting_label");
  const createdAtRaw = readString(row, "createdAt", "CreatedAt", "created_at");
  const updatedAtRaw = readString(row, "updatedAt", "UpdatedAt", "updated_at");
  const scheduledAtMs = Math.max(Date.parse(updatedAtRaw) || 0, Date.parse(createdAtRaw) || 0, Date.parse(sentRaw) || 0);
  const quoteId = readString(row, "quoteId", "quote_id");
  const quoteAmount = wholeRupees(row, "quoteAmount", "quote_amount");
  const budget = wholeRupees(row, "budget");
  const quoteGenerated = readFlag(row, "quoteGenerated", "quote_generated") === true;
  const quoteFollow = readFlag(row, "quoteFollow", "quote_follow") === true;
  const quoteLink = quoteGenerated ? readString(row, "quoteLink", "quote_link") : "";
  const quoteSent = quoteFollow || readFlag(row, "quoteSent", "quote_sent") === true || quoteLead;
  const flaggedSuccessful = quoteLead ? undefined : readFlag(row, "meetingSuccessful", "meeting_successful");
  const meetingSuccessfulAt = readString(row, "meetingSuccessfulAt", "meeting_successful_at");
  const apiProgress = boardProgress(row);
  const meetingSuccessful = quoteLead
    ? undefined
    : apiProgress
      ? apiProgress === "MEETING_SUCCESSFUL"
      : flaggedSuccessful;
  const quoteDelayed = readFlag(row, "quoteDelayed", "quote_delayed") === true;
  const meetingStatus = quoteLead ? undefined : boardMeetingStatus(row);
  const cancelledAtRaw = meetingStatus === "CANCELLED" ? readString(row, "cancelledAt", "cancelled_at") : "";
  const offset = date ? meetingOffset(date) : 0;
  const endMin = startMin + durationMin;
  const nowMs = Date.now();
  const meetingStarted = Boolean(date && !quoteLead && indiaWallUtcMs(date, startMin) <= nowMs);
  const slotEnded = Boolean(date && !quoteLead && hasSlotEnd && indiaWallUtcMs(date, endMin) < nowMs);
  let status: MeetingStatus = "SCHEDULED";
  if (!quoteLead && when) status = slotProgress(date, startMin, endMin);
  const progress = quoteLead
    ? undefined
    : apiProgress
      ?? (meetingStatus === "CANCELLED"
        ? "SCHEDULED"
        : meetingSuccessful === true
          ? "MEETING_SUCCESSFUL"
          : !meetingStarted
            ? "SCHEDULED"
            : slotEnded
              ? "MEETING_ABANDONED"
              : "IN_PROGRESS");
  const needsOutcome =
    !quoteLead && meetingStatus !== "CANCELLED" && progress === "MEETING_ABANDONED";
  const appointmentId = readNumber(row, "appointmentId", "id", "Id");
  const value = quoteAmount > 0 ? quoteAmount : budget;
  return {
    id: appointmentId ?? leadId ?? index + 1,
    order: index + 1,
    customer,
    initials: initialsOf(customer),
    avatarTone: AVATAR_TONES[index % AVATAR_TONES.length]!,
    intent: "WARM",
    quoteNo: quoteId,
    quoteCode: "",
    phone: readString(row, "phone", "phoneNumber", "mobile"),
    customerEmail: readString(row, "email", "customerEmail", "customer_email"),
    assignee: assignee || "Unassigned",
    assigneeRole: "",
    designerEmail: readString(row, "designerEmail", "designer_email"),
    meetingType: typeLabel,
    meetingTypeCode: code,
    meetingLabel: meetingLabel || (sourceCode === "CRM" && !quoteLead ? "quote_meeting" : ""),
    meetingLevel: quoteLead && !meetingLabel ? "—" : meetingLevelLabel(meetingLabel, sourceCode),
    whenLabel: when ? formatMeetingWhen(offset, startMin) : "—",
    whenNote: "",
    bucket: bucketFor(status, offset),
    dayOffset: offset,
    location: typeLabel,
    locationTone: code ? locationTone(code) : "blue",
    status,
    progress,
    meetingStatus,
    cancelledAt: cancelledAtRaw ? formatStamp(cancelledAtRaw) : undefined,
    value,
    budget,
    quoteValue: quoteAmount,
    valueSource: quoteAmount > 0 ? "quotation" : budget > 0 ? "budget" : "",
    date,
    startMin,
    durationMin: when ? durationMin : undefined,
    appointmentId: quoteLead ? undefined : appointmentId,
    leadId,
    leadType: leadTypeLabel(readString(row, "leadType", "LeadType", "lead_type")),
    leadTypeCode: leadTypeCodeOf(readString(row, "leadType", "LeadType", "lead_type")),
    appointmentSource: sourceRaw ? sourceLabel(sourceCode) : quoteLead ? "—" : "CRM",
    sourceCode,
    salesName,
    assignedSalesName,
    salesEmail: readString(row, "salesEmail", "sales_email"),
    branch: readString(row, "branch", "designerBranch", "designer_branch", "salesBranch", "sales_branch", "experienceCenter", "experience_center", "ec") || undefined,
    scheduledAt: formatStamp(createdAtRaw || sentRaw),
    scheduledAtMs: scheduledAtMs > 0 ? scheduledAtMs : undefined,
    scheduledBy: salesName
      ? `${salesName} scheduled this in CRM for ${customer}`
      : assignee
        ? `${assignee} scheduled this with ${customer}`
        : "—",
    quoteSent,
    quoteGenerated,
    quoteLink,
    quoteFollow,
    quoteSentAt: formatStamp(sentRaw),
    meetingSuccessful,
    meetingSuccessfulAt: meetingSuccessfulAt || undefined,
    quoteDelayed,
    needsOutcome,
  };
}

/** Map `GET /v1/meetings/board` into the meeting table. */
export function recordsFromMeetingsBoard(
  meetings: unknown,
  quoteSentLeads: unknown,
): MeetingBoardPayload {
  const mapRow = (row: Record<string, unknown>, index: number, quoteLead: boolean): MeetingRecord | null => {
    try {
      return mapBoardRow(row, index, quoteLead);
    } catch (error) {
      console.error("[meetings/board] skipped a row", error instanceof Error ? error.message : error);
      return null;
    }
  };
  const meetingRows = asRecordList(meetings)
    .map((row, index) => mapRow(row, index, false))
    .filter((row): row is MeetingRecord => row !== null);
  const quoteRows = asRecordList(quoteSentLeads)
    .map((row, index) => mapRow(row, index, true))
    .filter((row): row is MeetingRecord => row !== null);
  return {
    meetings: sortMeetingsForList(meetingRows).map((row, index) => ({ ...row, order: index + 1 })),
    quoteSentMeetings: sortMeetingsForList(quoteRows).map((row, index) => ({ ...row, order: index + 1 })),
    total: meetingRows.length,
    page: 1,
    pageSize: meetingRows.length,
  };
}

/** The meeting page calls this one route. Joins and filters happen on the server. */
export async function loadMeetingBoard(query: MeetingBoardQuery = {}): Promise<MeetingBoardPayload> {
  const params = new URLSearchParams();
  if (typeof window !== "undefined") {
    const role = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY)?.trim() ?? "";
    const username = window.localStorage.getItem(CRM_LOGIN_USERNAME_KEY)?.trim() ?? "";
    if (role) params.set("role", role);
    if (username) params.set("username", username);
  }
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  for (const name of query.designerNames ?? []) params.append("designerName", name);
  for (const name of query.salesNames ?? []) params.append("salesName", name);
  for (const branch of query.branches ?? []) params.append("branch", branch);
  for (const progress of query.progress ?? []) params.append("progress", progress);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const search = params.toString();
  const res = await fetch(`/api/crm/meeting-management${search ? `?${search}` : ""}`, {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    meetings?: MeetingRecord[];
    quoteSentMeetings?: MeetingRecord[];
    total?: number;
    page?: number;
    pageSize?: number;
    error?: string;
  };
  if (!res.ok) throw new Error(json.error || "Could not load meetings.");
  const meetings = Array.isArray(json.meetings) ? json.meetings : [];
  return {
    meetings,
    quoteSentMeetings: Array.isArray(json.quoteSentMeetings) ? json.quoteSentMeetings : [],
    total: typeof json.total === "number" ? json.total : meetings.length,
    page: typeof json.page === "number" ? json.page : query.page ?? 1,
    pageSize: typeof json.pageSize === "number" ? json.pageSize : query.pageSize ?? meetings.length,
  };
}

export type MeetingActivityAction = "SCHEDULED" | "RESCHEDULED" | "CANCELLED";

export type MeetingActivity = {
  activityId: number;
  action: MeetingActivityAction | string;
  actionLabel: string;
  performedBy: string;
  performedByName: string;
  performedById?: number;
  performedAt: string;
  meetingAt: string;
  previousMeetingAt: string;
  designerName: string;
  previousDesignerName: string;
  meetingType: string;
  customerName: string;
  details: string;
};

function activityText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Newest-first meeting rows: scheduled, rescheduled, cancelled. */
export async function loadMeetingActivityHistory(leadId: number, leadType: string): Promise<MeetingActivity[]> {
  const params = new URLSearchParams({
    leadId: String(leadId),
    leadType: leadType.trim(),
  });
  const res = await fetch(`/api/crm/meeting-management/activity-history?${params}`, {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    activities?: unknown[];
    error?: string;
  };
  if (!res.ok) throw new Error(json.error || "Could not load activity history.");
  const rows = Array.isArray(json.activities) ? json.activities : [];
  return rows
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      activityId: Number(row.activityId) || 0,
      action: activityText(row.action).toUpperCase() || "SCHEDULED",
      actionLabel: activityText(row.actionLabel),
      performedBy: activityText(row.performedBy),
      performedByName: activityText(row.performedByName),
      performedById: Number.isFinite(Number(row.performedById)) ? Number(row.performedById) : undefined,
      performedAt: activityText(row.performedAt),
      meetingAt: activityText(row.meetingAt),
      previousMeetingAt: activityText(row.previousMeetingAt),
      designerName: activityText(row.designerName),
      previousDesignerName: activityText(row.previousDesignerName),
      meetingType: activityText(row.meetingType),
      customerName: activityText(row.customerName),
      details: activityText(row.details),
    }));
}
