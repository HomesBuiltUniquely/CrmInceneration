import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { resolveAnchorQuoteId } from "@/lib/insights-lead-investment";
import { readSalesStageFieldsFromLead, type ApiLead } from "@/lib/leads-filter";
import { isQuoteSentLead } from "@/lib/lead-milestone-insight-tiles";
import { assembleMeetingBoard, quoteSentLeadRows } from "@/lib/meeting-management-api";
import { salesInsightCountLeads } from "@/lib/sales-admin-insight-tiles";
import { pipelineSubStageLabel } from "@/lib/milestone-substage-map";
import {
  extractProlanceQuoteTotalAmount,
  type ProlanceQuoteShareResponse,
} from "@/lib/prolance-quote-api";
import { resolveQuoteAmount } from "@/lib/lead-quote-options";

export const maxDuration = 120;

const DESIGN_MODULE_URL = (
  process.env.DESIGN_MODULE_URL?.trim() || "https://api.hubinterior.com"
).replace(/\/+$/, "");

const QUOTE_API = (
  process.env.NEXT_PUBLIC_API?.trim() || "https://api.hubinterior.com"
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

async function fetchAppointments(req: NextRequest): Promise<Record<string, unknown>[]> {
  const headers = { ...upstreamAuthHeaders(req), Accept: "application/json" };
  const batches = await Promise.all([
    fetch(`${BASE_URL}/v1/Appointment`, { headers, cache: "no-store" }).then(readJson).catch(() => []),
    fetch(`${DESIGN_MODULE_URL}/api/designers`, { cache: "no-store" })
      .then(readJson)
      .catch(() => []),
  ]);
  const mine = asRows(batches[0]);
  const designerPayload = batches[1];
  const designers = Array.isArray(designerPayload)
    ? designerPayload
    : designerPayload && typeof designerPayload === "object" && Array.isArray((designerPayload as { designers?: unknown }).designers)
      ? ((designerPayload as { designers: unknown[] }).designers ?? [])
      : [];
  const names = designers
    .map((row) => (row && typeof row === "object" ? String((row as { name?: string }).name ?? "").trim() : ""))
    .filter(Boolean);
  const byDesigner = await Promise.all(
    names.map((name) =>
      fetch(`${BASE_URL}/v1/Appointment/designer/${encodeURIComponent(name)}`, { headers, cache: "no-store" })
        .then(readJson)
        .then(asRows)
        .catch(() => [] as Record<string, unknown>[]),
    ),
  );
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of [...mine, ...byDesigner.flat()]) {
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

async function fetchLeads(req: NextRequest): Promise<ApiLead[]> {
  const headers = new Headers({ Accept: "application/json" });
  const authorization = req.headers.get("authorization");
  const cookie = req.headers.get("cookie");
  if (authorization) headers.set("authorization", authorization);
  if (cookie) headers.set("cookie", cookie);
  const leads: ApiLead[] = [];
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(`/api/crm/leads?mergeAll=1&page=${page}&size=500`, req.nextUrl.origin);
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) break;
    const json = (await res.json()) as { content?: ApiLead[]; totalPages?: number };
    const content = Array.isArray(json.content) ? json.content : [];
    leads.push(...content);
    if (content.length === 0 || page + 1 >= Math.max(1, Number(json.totalPages ?? 1))) break;
  }
  return leads;
}

async function fetchQuoteTotals(ids: string[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  let index = 0;
  async function worker() {
    while (index < ids.length) {
      const current = index;
      index += 1;
      const quoteId = ids[current];
      if (!quoteId) continue;
      try {
        const res = await fetch(
          `${QUOTE_API}/api/prolance-test/quotes/share/${encodeURIComponent(quoteId)}`,
          { cache: "no-store" },
        );
        const text = await res.text();
        const parsed = text ? (JSON.parse(text) as ProlanceQuoteShareResponse) : {};
        const amount = resolveQuoteAmount(extractProlanceQuoteTotalAmount(parsed.data ?? parsed));
        if (amount != null) totals.set(quoteId, Math.round(amount));
      } catch {
        totals.set(quoteId, 0);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, Math.max(1, ids.length)) }, () => worker()));
  return totals;
}

export async function GET(req: NextRequest) {
  try {
    const [appointments, leads] = await Promise.all([
      fetchAppointments(req),
      fetchLeads(req),
    ]);
    const leadsById = new Map<string, ApiLead>();
    const cancelled: ApiLead[] = [];
    for (const lead of leads) {
      const id = String(lead.id ?? "").trim();
      if (id && !leadsById.has(id)) leadsById.set(id, lead);
      if (isCancelledSubstage(lead)) cancelled.push(lead);
    }
    const neededLeadIds = new Set<string>();
    for (const row of appointments) {
      const raw = row.leadId ?? row.LeadId ?? row.lead_id;
      const id = raw == null ? "" : String(raw).trim();
      if (id && id !== "0") neededLeadIds.add(id);
    }
    for (const lead of cancelled) {
      const id = String(lead.id ?? "").trim();
      if (id) neededLeadIds.add(id);
    }
    for (const lead of salesInsightCountLeads(leads).filter((row) => isQuoteSentLead(row))) {
      const id = String(lead.id ?? "").trim();
      if (!id) continue;
      neededLeadIds.add(id);
      if (!leadsById.has(id)) leadsById.set(id, lead);
    }
    const quoteIds = [...neededLeadIds]
      .map((id) => leadsById.get(id))
      .filter((lead): lead is ApiLead => lead != null)
      .map(quoteIdOf)
      .filter(Boolean);
    const quotes = await fetchQuoteTotals(quoteIds);
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
