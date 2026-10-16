import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { resolveAnchorQuoteId } from "@/lib/insights-lead-investment";
import { detailsUrl } from "@/lib/crm-lead-endpoints";
import { CRM_LEAD_TYPES, readSalesStageFieldsFromLead, type ApiLead, type CrmLeadType } from "@/lib/leads-filter";
import { assembleMeetingBoard, quoteSentLeadRows } from "@/lib/meeting-management-api";
import { pipelineSubStageLabel } from "@/lib/milestone-substage-map";

export const maxDuration = 120;

const DESIGN_MODULE_URL = (
  process.env.DESIGN_MODULE_URL?.trim() || "https://api.hubinterior.com"
).replace(/\/+$/, "");

function asRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  for (const key of ["content", "appointments", "data"]) {
    if (Array.isArray(record[key])) return asRows(record[key]);
  }
  return [];
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return [];
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return [];
  }
}

function quoteIdOf(lead: ApiLead): string {
  const anchored = resolveAnchorQuoteId(lead);
  if (anchored) return anchored;
  const row = lead as Record<string, unknown>;
  const raw = row.hubQuoteId ?? row.quoteId;
  return raw == null ? "" : String(raw).trim();
}

function isCancelledSubstage(lead: ApiLead): boolean {
  const sub = pipelineSubStageLabel(readSalesStageFieldsFromLead(lead).milestoneSubStage);
  return sub === "Meeting Cancelled" || sub === "Meeting Cancelled/Paused";
}

function normalizeLeadType(raw: string): CrmLeadType | "" {
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (CRM_LEAD_TYPES as readonly string[]).includes(compact) ? (compact as CrmLeadType) : "";
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

async function fetchAppointments(req: NextRequest): Promise<Record<string, unknown>[]> {
  const headers = { ...upstreamAuthHeaders(req), Accept: "application/json" };
  const [appointmentPayload, designerPayload] = await Promise.all([
    fetch(`${BASE_URL}/v1/Appointment`, { headers, cache: "no-store", signal: AbortSignal.timeout(12000) })
      .then(readJson)
      .catch(() => []),
    fetch(`${DESIGN_MODULE_URL}/api/designers`, { cache: "no-store", signal: AbortSignal.timeout(8000) })
      .then(readJson)
      .catch(() => []),
  ]);
  const mine = asRows(appointmentPayload);
  const designers = Array.isArray(designerPayload)
    ? designerPayload
    : designerPayload && typeof designerPayload === "object" && Array.isArray((designerPayload as { designers?: unknown }).designers)
      ? ((designerPayload as { designers: unknown[] }).designers ?? [])
      : [];
  const covered = new Set(
    mine
      .map((row) => String(row.designerName ?? row.DesignerName ?? row.designer_name ?? "").trim().toLowerCase())
      .filter(Boolean),
  );
  const names = designers
    .map((row) => (row && typeof row === "object" ? String((row as { name?: string }).name ?? "").trim() : ""))
    .filter((name) => name && !covered.has(name.toLowerCase()));
  const extra: Record<string, unknown>[][] = [];
  await runPool(
    names,
    async (name) => {
      try {
        const payload = await fetch(
          `${BASE_URL}/v1/Appointment/designer/${encodeURIComponent(name)}`,
          { headers, cache: "no-store", signal: AbortSignal.timeout(8000) },
        ).then(readJson);
        extra.push(asRows(payload));
      } catch {
        extra.push([]);
      }
    },
    8,
  );
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of [...mine, ...extra.flat()]) {
    const id = String(row.id ?? row.appointmentId ?? "");
    if (!id) continue;
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, row);
      continue;
    }
    const merged = { ...prev };
    for (const [key, value] of Object.entries(row)) {
      const current = merged[key];
      if ((current == null || current === "") && value != null && value !== "") merged[key] = value;
    }
    byId.set(id, merged);
  }
  return [...byId.values()];
}

function leadKey(leadType: string, leadId: string): string {
  return `${leadType}:${leadId}`;
}

async function fetchNeededLeads(
  req: NextRequest,
  appointments: Record<string, unknown>[],
): Promise<ApiLead[]> {
  const wanted = new Map<string, { leadType: CrmLeadType; id: string }>();
  for (const row of appointments) {
    const rawId = row.leadId ?? row.LeadId ?? row.lead_id;
    const id = rawId == null ? "" : String(rawId).trim();
    if (!id || id === "0") continue;
    const leadType = normalizeLeadType(String(row.leadType ?? row.LeadType ?? row.lead_type ?? ""));
    if (!leadType) continue;
    wanted.set(leadKey(leadType, id), { leadType, id });
  }
  const leads: ApiLead[] = [];
  const headers = upstreamAuthHeaders(req);
  await runPool(
    [...wanted.values()],
    async ({ leadType, id }) => {
      try {
        const res = await fetch(`${BASE_URL}${detailsUrl(leadType, id)}`, {
          headers,
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;
        const payload = (await res.json()) as unknown;
        const row =
          payload && typeof payload === "object" && !Array.isArray(payload)
            ? ((payload as { data?: unknown; lead?: unknown }).data &&
              typeof (payload as { data?: unknown }).data === "object"
                ? (payload as { data: ApiLead }).data
                : (payload as { lead?: unknown }).lead && typeof (payload as { lead?: unknown }).lead === "object"
                  ? (payload as { lead: ApiLead }).lead
                  : (payload as ApiLead))
            : null;
        if (!row) return;
        leads.push({ ...row, id: row.id ?? id, leadType: row.leadType || leadType });
      } catch {
        /* A missing lead still leaves the appointment on the board. */
      }
    },
    10,
  );
  return leads;
}

function quoteAmountFromLead(lead: ApiLead): number {
  const row = lead as Record<string, unknown>;
  for (const key of ["quoteAmount", "quotedAmount", "quotationAmount", "finalQuoteAmount", "dealValue"]) {
    const raw = row[key];
    const parsed = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/[^\d.]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }
  return 0;
}

export async function GET(req: NextRequest) {
  try {
    const appointments = await fetchAppointments(req);
    const leads = await fetchNeededLeads(req, appointments);
    const leadsById = new Map<string, ApiLead>();
    const cancelled: ApiLead[] = [];
    const quotes = new Map<string, number>();
    for (const lead of leads) {
      const id = String(lead.id ?? "").trim();
      if (id && !leadsById.has(id)) leadsById.set(id, lead);
      if (isCancelledSubstage(lead)) cancelled.push(lead);
      const quoteId = quoteIdOf(lead);
      const amount = quoteAmountFromLead(lead);
      if (quoteId && amount > 0 && !quotes.has(quoteId)) quotes.set(quoteId, amount);
    }
    const meetings = assembleMeetingBoard(appointments, leadsById, quotes, cancelled);
    const quoteSentMeetings = quoteSentLeadRows(leads, meetings, quotes);
    const summary = {
      total: meetings.length,
      quoteSent: quoteSentMeetings.length,
      meetingsDone: meetings.filter((row) => row.milestoneSubStage === "Meeting Successful").length,
      meetingsCancelled: meetings.filter((row) => row.status === "CANCELLED").length,
      stillScheduled: meetings.filter((row) => row.needsOutcome).length,
    };
    return NextResponse.json({ meetings, quoteSentMeetings, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load meeting management.";
    return NextResponse.json({ meetings: [], error: message }, { status: 500 });
  }
}
