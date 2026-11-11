import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import {
  fetchInsightsFilterOptions,
  type InsightsFilterOptions,
} from "@/lib/crm-insights-api";
import type {
  CallSummaryTotals,
  CallSyncHealth,
  HubCallEvent,
  HubCallRecording,
  RecordingCallLogsFilterOptions,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStr(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function asNum(...values: unknown[]): number {
  for (const value of values) {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

async function readJson(res: Response, fallback: string): Promise<Record<string, unknown>> {
  const text = await res.text();
  let json: Record<string, unknown> = {};
  if (text.trim()) {
    try {
      json = asRecord(JSON.parse(text));
    } catch {
      json = {};
    }
  }
  if (!res.ok || json.success === false) {
    const message =
      asStr(json.userMessage, json.error, json.message) ||
      `${fallback} (${res.status})`;
    throw new Error(message);
  }
  return json;
}

function buildRangeQuery(args: {
  from?: Date | null;
  to?: Date | null;
  page?: number;
  size?: number;
  userId?: number | null;
}): string {
  const qs = new URLSearchParams();
  if (args.from) qs.set("from", args.from.toISOString());
  if (args.to) qs.set("to", args.to.toISOString());
  if (args.page != null) qs.set("page", String(args.page));
  if (args.size != null) qs.set("size", String(args.size));
  if (args.userId != null && args.userId > 0) qs.set("userId", String(args.userId));
  return qs.toString();
}

function parseEvent(raw: unknown): HubCallEvent | null {
  const row = asRecord(raw);
  const eventId = asNum(row.eventId, row.id);
  if (!eventId) return null;
  return {
    eventId,
    userId: asNum(row.userId),
    leadType: asStr(row.leadType),
    leadId: asNum(row.leadId),
    outcome: asStr(row.outcome, "UNKNOWN").toUpperCase(),
    peerPhone: asStr(row.peerPhone, row.phone),
    durationSec: asNum(row.durationSec, row.duration),
    startedAt: asStr(row.startedAt) || null,
    recordingId: asNum(row.recordingId) || null,
    hasRecording: asBool(row.hasRecording) || asNum(row.recordingId) > 0,
    leadDisplayName: asStr(row.leadDisplayName, row.customerName, row.leadName),
    leadDisplayId: asStr(row.leadDisplayId, row.leadIdentifier),
    executiveName: asStr(row.executiveName, row.userName, row.fullName),
  };
}

function parseRecording(raw: unknown): HubCallRecording | null {
  const row = asRecord(raw);
  const recordingId = asNum(row.recordingId, row.id);
  if (!recordingId) return null;
  return {
    recordingId,
    leadType: asStr(row.leadType),
    leadId: asNum(row.leadId),
    userId: asNum(row.userId),
    direction: asStr(row.direction, "OUT"),
    peerPhone: asStr(row.peerPhone, row.phone),
    status: asStr(row.status, row.serverStatus),
    errorCode: asStr(row.errorCode),
    durationSec: asNum(row.durationSec, row.duration),
    startedAt: asStr(row.startedAt) || null,
    uploaded: asBool(row.uploaded) || asStr(row.status) === "uploaded",
    leadDisplayName: asStr(row.leadDisplayName, row.customerName, row.leadName),
    leadDisplayId: asStr(row.leadDisplayId, row.leadIdentifier),
    executiveName: asStr(row.executiveName, row.userName, row.fullName),
  };
}

export async function fetchCallEventsPage(args: {
  from?: Date | null;
  to?: Date | null;
  page?: number;
  size?: number;
  userId?: number | null;
}): Promise<{ items: HubCallEvent[]; totalElements: number; callSyncLastAt: string | null }> {
  const qs = buildRangeQuery({ ...args, page: args.page ?? 0, size: args.size ?? 300 });
  const res = await fetch(`/api/crm/call-events?${qs}`, {
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  const json = await readJson(res, "Could not load call events");
  const content = Array.isArray(json.content) ? json.content : [];
  return {
    items: content.map(parseEvent).filter((e): e is HubCallEvent => Boolean(e)),
    totalElements: asNum(json.totalElements, content.length),
    callSyncLastAt: asStr(json.callSyncLastAt) || null,
  };
}

export async function fetchAllCallEvents(args: {
  from?: Date | null;
  to?: Date | null;
  userId?: number | null;
  maxPages?: number;
}): Promise<{ items: HubCallEvent[]; callSyncLastAt: string | null }> {
  const maxPages = args.maxPages ?? 20;
  const pageSize = 300;
  const all: HubCallEvent[] = [];
  let callSyncLastAt: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const batch = await fetchCallEventsPage({
      from: args.from,
      to: args.to,
      userId: args.userId,
      page,
      size: pageSize,
    });
    if (!callSyncLastAt) callSyncLastAt = batch.callSyncLastAt;
    all.push(...batch.items);
    if (batch.items.length === 0 || all.length >= batch.totalElements || batch.items.length < pageSize) {
      break;
    }
  }
  return { items: all, callSyncLastAt };
}

export async function fetchCallSummary(args: {
  from?: Date | null;
  to?: Date | null;
  userId?: number | null;
}): Promise<CallSummaryTotals> {
  const qs = buildRangeQuery(args);
  const res = await fetch(`/api/crm/call-events/summary?${qs}`, {
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  const json = await readJson(res, "Could not load call summary");
  return {
    incoming: asNum(json.incoming),
    outgoing: asNum(json.outgoing),
    missed: asNum(json.missed),
    salesRejected: asNum(json.salesRejected),
    clientRejected: asNum(json.clientRejected),
    total: asNum(json.total),
    callSyncLastAt: asStr(json.callSyncLastAt) || null,
  };
}

export async function fetchCallSyncHealth(staleDays = 3): Promise<CallSyncHealth> {
  const res = await fetch(`/api/crm/call-events/sync-health?staleDays=${staleDays}`, {
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  const json = await readJson(res, "Could not load sync health");
  const executives = Array.isArray(json.executives) ? json.executives : [];
  return {
    staleDays: asNum(json.staleDays, staleDays),
    teamCallSyncLastAt: asStr(json.teamCallSyncLastAt) || null,
    executives: executives.map((row) => {
      const r = asRecord(row);
      return {
        userId: asNum(r.userId),
        executiveName: asStr(r.executiveName, r.name),
        role: asStr(r.role),
        health: asStr(r.health, "unknown"),
        callSyncLastAt: asStr(r.callSyncLastAt) || null,
      };
    }),
  };
}

export async function fetchCallRecordingsPage(args: {
  from?: Date | null;
  to?: Date | null;
  page?: number;
  size?: number;
}): Promise<{ items: HubCallRecording[]; totalElements: number }> {
  const qs = buildRangeQuery({ ...args, page: args.page ?? 0, size: args.size ?? 100 });
  const res = await fetch(`/api/crm/call-recordings?${qs}`, {
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  const json = await readJson(res, "Could not load recordings");
  const content = Array.isArray(json.content) ? json.content : [];
  return {
    items: content.map(parseRecording).filter((r): r is HubCallRecording => Boolean(r)),
    totalElements: asNum(json.totalElements, content.length),
  };
}

export async function fetchAllCallRecordings(args: {
  from?: Date | null;
  to?: Date | null;
  maxPages?: number;
}): Promise<HubCallRecording[]> {
  const maxPages = args.maxPages ?? 20;
  const pageSize = 100;
  const all: HubCallRecording[] = [];
  for (let page = 0; page < maxPages; page++) {
    const batch = await fetchCallRecordingsPage({
      from: args.from,
      to: args.to,
      page,
      size: pageSize,
    });
    all.push(...batch.items);
    if (batch.items.length === 0 || all.length >= batch.totalElements || batch.items.length < pageSize) {
      break;
    }
  }
  return all;
}

function contentList(json: Record<string, unknown>): unknown[] {
  if (Array.isArray(json.content)) return json.content;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json)) return json as unknown[];
  return [];
}

/** Lead detail Calls tab — Hub `GET /v1/CallEvent/by-lead`. */
export async function fetchCallEventsByLead(args: {
  leadType: string;
  leadId: number;
}): Promise<HubCallEvent[]> {
  const qs = new URLSearchParams({
    leadType: args.leadType,
    leadId: String(args.leadId),
  });
  const res = await fetch(`/api/crm/call-events/by-lead?${qs}`, {
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  const json = await readJson(res, "Could not load lead call events");
  return contentList(json)
    .map(parseEvent)
    .filter((e): e is HubCallEvent => Boolean(e));
}

/** Lead detail Recording tab — Hub `GET /v1/CallRecording/by-lead`. */
export async function fetchCallRecordingsByLead(args: {
  leadType: string;
  leadId: number;
}): Promise<HubCallRecording[]> {
  const qs = new URLSearchParams({
    leadType: args.leadType,
    leadId: String(args.leadId),
  });
  const res = await fetch(`/api/crm/call-recordings/by-lead?${qs}`, {
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  const json = await readJson(res, "Could not load lead recordings");
  return contentList(json)
    .map(parseRecording)
    .filter((r): r is HubCallRecording => Boolean(r));
}

/** Signed play URL for a Hub recording. */
export async function fetchRecordingPlayUrl(recordingId: number): Promise<string> {
  const res = await fetch(`/api/crm/call-recordings/${recordingId}/play`, {
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  const json = await readJson(res, "Could not load play URL");
  const url = asStr(json.playUrl, json.url);
  if (!url) throw new Error("Play URL missing");
  return url;
}

export async function loadRecordingCallLogsFilterOptions(
  branchId?: string,
): Promise<RecordingCallLogsFilterOptions> {
  let options: InsightsFilterOptions = {
    branches: [],
    salesManagers: [],
    salesExecutives: [],
  };
  try {
    options = await fetchInsightsFilterOptions(branchId);
  } catch {
    // hierarchy optional for SE / PE who cannot load insights options
  }

  const managers = options.salesManagers ?? [];
  const nestedExecs = managers.flatMap((m) =>
    (m.executives ?? []).map((e) => ({
      ...e,
      managerId: e.managerId ?? m.id,
      managerName: m.name,
    })),
  );
  const executives =
    nestedExecs.length > 0
      ? nestedExecs
      : (options.salesExecutives ?? []).map((e) => ({
          ...e,
          managerName: undefined as string | undefined,
        }));

  return {
    branches: (options.branches ?? []).map((b) => ({
      value: b.id || b.name,
      label: b.name || b.id,
    })),
    salesAdmins: [],
    salesManagers: managers.map((m) => ({
      value: m.name,
      label: m.name,
      userId: m.id,
    })),
    salesExecutives: executives.map((e) => ({
      value: e.name,
      label: e.name,
      userId: e.id,
      managerId: e.managerId ?? null,
      managerName: "managerName" in e ? e.managerName : undefined,
    })),
    presalesManagers: [],
    presalesExecutives: executives
      .filter((e) => (e.role || "").toUpperCase().includes("PRESALES"))
      .map((e) => ({ value: e.name, label: e.name, userId: e.id })),
    assignees: executives.map((e) => ({
      value: e.name,
      label: e.name,
      userId: e.id,
    })),
  };
}
