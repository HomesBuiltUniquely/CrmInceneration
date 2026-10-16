import {
  fetchDesignerAppointments,
  fetchDesignersForHubMeeting,
  fetchMyAppointments,
} from "@/lib/appointment-client";
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
  meetingIso,
  meetingLevelLabel,
  meetingOffset,
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
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return { date: meetingIso(parsed), startMin: parsed.getHours() * 60 + parsed.getMinutes() };
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

function statusFrom(row: Record<string, unknown>, date: string, startMin: number, endMin: number): MeetingStatus {
  const raw = readString(row, "status", "appointmentStatus", "meetingStatus").toUpperCase();
  if (raw.includes("CANCEL")) return "CANCELLED";
  if (raw.includes("RESCHEDULE")) return "RESCHEDULED";
  if (readString(row, "rescheduleReason", "reschedule_reason")) return "RESCHEDULED";
  const offset = meetingOffset(date);
  if (offset < 0) return "COMPLETED";
  if (offset > 0) return "SCHEDULED";
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin >= endMin) return "COMPLETED";
  if (nowMin >= startMin) return "IN PROGRESS";
  return "SCHEDULED";
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
  return new Date(parsed).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
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
  const endAt = new Date(when.date + "T00:00:00");
  endAt.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
  const timePassed = endAt.getTime() < Date.now();
  const stillBooked = milestoneSubStage === "Meeting Scheduled" || milestoneSubStage === "Meeting Rescheduled";
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
  const when = parseWhen(whenRaw) ?? { date: meetingIso(new Date()), startMin: 11 * 60 };
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
        startTime: when || meetingIso(new Date()),
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
            : sub === "Meeting Rescheduled"
              ? "RESCHEDULED"
              : sub === "Meeting Cancelled" || sub === "Meeting Cancelled/Paused"
                ? "CANCELLED"
                : created.status;
      rows.push({ ...created, quoteSent: true, appointmentId: undefined, status });
    }
  });
  return sortMeetingsForList(rows).map((row, index) => ({ ...row, order: index + 1 }));
}

export type MeetingBoardPayload = {
  meetings: MeetingRecord[];
  quoteSentMeetings: MeetingRecord[];
};

/** The meeting page calls this one route. Joins happen on the server. */
export async function loadMeetingBoard(): Promise<MeetingBoardPayload> {
  const res = await fetch("/api/crm/meeting-management", {
    cache: "no-store",
    credentials: "include",
    headers: getCrmAuthHeaders({ Accept: "application/json" }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    meetings?: MeetingRecord[];
    quoteSentMeetings?: MeetingRecord[];
    error?: string;
  };
  if (!res.ok) throw new Error(json.error || "Could not load meetings.");
  return {
    meetings: Array.isArray(json.meetings) ? json.meetings : [],
    quoteSentMeetings: Array.isArray(json.quoteSentMeetings) ? json.quoteSentMeetings : [],
  };
}
