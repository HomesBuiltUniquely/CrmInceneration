/**
 * WhatsApp lead source — Hub contract (MSG91-only inbound):
 * - Inbound: MSG91 webhook → BFF `POST /api/crm/whatsapp-leads/inbound` → Hub `POST /v1/WhatsappLead`
 * - CRM UI lists: `GET /v1/leads/filter?leadType=whatsapplead` (never poll Hub customer API)
 * - Verify / details: `/v1/WhatsappLead/verify/{id}`, `/v1/WhatsappLead/details/{id}`
 */

import type { NextRequest } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import type { ApiLead, CrmLeadType, LeadSourceCounts, SpringPage } from "@/lib/leads-filter";
import { CRM_LEAD_TYPES, normalizeLeadSortFields } from "@/lib/leads-filter";
import { emptyLeadSourceCounts } from "@/lib/primary-source-leads";
import { LEAD_TYPE_TO_BASE } from "@/lib/crm-lead-endpoints";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { readLeadCreatedAtRaw } from "@/lib/lead-follow-up-insights";
import { normalizeLeadTypeKey } from "@/lib/primary-source-leads";
import { isHubNoResourceResponse } from "@/lib/hub-no-resource";
import type { CrmWorkspace } from "@/lib/crm-workspace";
import { filterLeadsForAdminWorkspacePool } from "@/lib/crm-workspace";

export const WHATSAPP_CRM_LEAD_TYPE: CrmLeadType = "whatsapplead";

export const WHATSAPP_FILTER_LEAD_TYPE_ALIASES = [
  "whatsapplead",
  "WhatsappLead",
  "WhatsAppLead",
] as const;

/** Probe order for paginated list when Hub filter returns empty. */
const WHATSAPP_DIRECT_LIST_PATHS = [
  LEAD_TYPE_TO_BASE.whatsapplead,
  "/v1/WhatsAppLead",
  "/v1/Whatsapplead",
] as const;

function isLocalHubOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(origin);
  }
}

export function whatsappHubUnavailableMessage(hubOrigin: string = BASE_URL): string {
  if (isLocalHubOrigin(hubOrigin)) {
    return (
      `WhatsApp API is not on your local Hub (${hubOrigin}). ` +
      `Set BASE_URL to production Hub or merge WhatsApp leads into your Spring branch.`
    );
  }
  return (
    `Could not load WhatsApp leads from ${hubOrigin}. ` +
    `Hub must expose GET /v1/leads/filter?leadType=whatsapplead or GET ${LEAD_TYPE_TO_BASE.whatsapplead} (paginated list). ` +
    `Ensure the migration branch is deployed and BASE_URL points at that Hub.`
  );
}

function parseListPayload(json: unknown): { content: ApiLead[]; totalPages: number } {
  if (Array.isArray(json)) {
    return { content: json as ApiLead[], totalPages: 1 };
  }
  if (!json || typeof json !== "object") {
    return { content: [], totalPages: 1 };
  }
  const rec = json as Record<string, unknown>;
  if (Array.isArray(rec.content)) {
    return {
      content: rec.content as ApiLead[],
      totalPages: Math.max(1, Number(rec.totalPages ?? 1)),
    };
  }
  const data =
    rec.data && typeof rec.data === "object" && !Array.isArray(rec.data)
      ? (rec.data as Record<string, unknown>)
      : null;
  if (data && Array.isArray(data.content)) {
    return {
      content: data.content as ApiLead[],
      totalPages: Math.max(1, Number(data.totalPages ?? 1)),
    };
  }
  if (Array.isArray(rec.items)) {
    return { content: rec.items as ApiLead[], totalPages: 1 };
  }
  return { content: [], totalPages: 1 };
}

function tagWhatsappLeads(leads: ApiLead[]): ApiLead[] {
  return leads.map((lead) =>
    normalizeLeadSortFields({
      ...lead,
      leadType: normalizeLeadTypeKey(lead.leadType ?? WHATSAPP_CRM_LEAD_TYPE),
    }),
  );
}

export type WhatsappFetchContext = {
  req?: NextRequest;
  headers?: HeadersInit;
  sort: string;
  search: string;
  effDates: { from: string; to: string };
  extraParams: Array<{ key: string; value: string }>;
  perType: number;
  maxPages: number;
  /** Scope WhatsApp counts to sales or presales assignee pool (admin Lead Types tiles). */
  workspace?: CrmWorkspace;
};

function buildWhatsappProxyQuery(ctx: WhatsappFetchContext): URLSearchParams {
  const qs = new URLSearchParams();
  qs.set("sort", ctx.sort);
  qs.set("size", String(ctx.perType));
  qs.set("maxPages", String(ctx.maxPages));
  if (ctx.search) qs.set("search", ctx.search);
  if (ctx.effDates.from) qs.set("dateFrom", ctx.effDates.from);
  if (ctx.effDates.to) qs.set("dateTo", ctx.effDates.to);
  for (const { key, value } of ctx.extraParams) {
    if (value) qs.set(key, value);
  }
  return qs;
}

async function fetchWhatsappLeadsResolved(ctx: WhatsappFetchContext): Promise<ApiLead[]> {
  let leads: ApiLead[];
  if (ctx.req) {
    leads = (await fetchWhatsappLeadsForMerge(ctx)).leads;
  } else {
    const qs = buildWhatsappProxyQuery(ctx);
    const res = await fetch(`/api/crm/whatsapp-leads?${qs.toString()}`, {
      cache: "no-store",
      credentials: "include",
      headers: ctx.headers,
    });
    if (!res.ok) return [];
    const json = (await res.json().catch(() => ({}))) as { leads?: ApiLead[] };
    leads = Array.isArray(json.leads) ? json.leads : [];
  }
  if (ctx.workspace) {
    leads = filterLeadsForAdminWorkspacePool(leads, ctx.workspace);
  }
  return leads;
}

function resolveAuthHeaders(ctx: WhatsappFetchContext): HeadersInit {
  if (ctx.headers) return ctx.headers;
  if (ctx.req) return upstreamAuthHeaders(ctx.req);
  return {};
}

const WHATSAPP_DIRECT_LIST_QUERY_KEYS = new Set(["search"]);

/** Params forwarded to GET /v1/leads/filter (role + verification buckets). */
const WHATSAPP_FILTER_QUERY_KEYS = new Set([
  "search",
  "verificationStatus",
  "reinquiry",
  "milestoneStage",
  "milestoneStageCategory",
  "milestoneSubStage",
  "assignee",
  "dateFrom",
  "dateTo",
  "dateField",
  "presalesMilestoneStage",
  "presalesMilestoneCategory",
  "presalesMilestoneSubStage",
]);

function appendWhatsappQueryParams(
  upstream: URL,
  ctx: WhatsappFetchContext,
  pageNum: number,
  mode: "filter" | "direct" = "direct",
): void {
  upstream.searchParams.set("page", String(pageNum));
  upstream.searchParams.set("size", String(ctx.perType));
  upstream.searchParams.set("sort", ctx.sort);
  if (ctx.search) upstream.searchParams.set("search", ctx.search);
  const allowedKeys =
    mode === "filter" ? WHATSAPP_FILTER_QUERY_KEYS : WHATSAPP_DIRECT_LIST_QUERY_KEYS;
  for (const { key, value } of ctx.extraParams) {
    if (!value || !allowedKeys.has(key)) continue;
    upstream.searchParams.set(key, value);
  }
  if (mode === "filter") {
    if (ctx.effDates.from) upstream.searchParams.set("dateFrom", ctx.effDates.from);
    if (ctx.effDates.to) upstream.searchParams.set("dateTo", ctx.effDates.to);
  }
}

function shouldStopListPaging(
  pageNum: number,
  chunkLength: number,
  perType: number,
  totalPages: number,
): boolean {
  if (Number.isFinite(totalPages) && totalPages > 0) {
    return pageNum + 1 >= totalPages;
  }
  return chunkLength < perType;
}

async function fetchWhatsappFromFilterAlias(
  ctx: WhatsappFetchContext,
  filterLeadType: string,
): Promise<ApiLead[]> {
  const all: ApiLead[] = [];
  for (let pageNum = 0; pageNum < ctx.maxPages; pageNum += 1) {
    const upstream = new URL(`${BASE_URL}/v1/leads/filter`);
    upstream.searchParams.set("leadType", filterLeadType);
    upstream.searchParams.set("milestoneScope", "crm");
    appendWhatsappQueryParams(upstream, ctx, pageNum, "filter");
    const res = await fetch(upstream.toString(), {
      headers: resolveAuthHeaders(ctx),
      cache: "no-store",
    });
    if (!res.ok) break;
    const pageData = (await res.json()) as SpringPage<ApiLead>;
    const chunk = Array.isArray(pageData.content) ? pageData.content : [];
    if (chunk.length === 0) break;
    all.push(...chunk);
    const totalPages = Math.max(1, Number(pageData.totalPages ?? 1));
    if (shouldStopListPaging(pageNum, chunk.length, ctx.perType, totalPages)) break;
  }
  return tagWhatsappLeads(all);
}

async function fetchWhatsappFromDirectListAtPath(
  ctx: WhatsappFetchContext,
  basePath: string,
): Promise<{ leads: ApiLead[]; apiUnavailable: boolean }> {
  const all: ApiLead[] = [];
  let gotOk = false;
  for (let pageNum = 0; pageNum < ctx.maxPages; pageNum += 1) {
    const upstream = new URL(`${BASE_URL}${basePath}`);
    appendWhatsappQueryParams(upstream, ctx, pageNum, "direct");
    const res = await fetch(upstream.toString(), {
      headers: resolveAuthHeaders(ctx),
      cache: "no-store",
    });
    const text = await res.text();
    if (isHubNoResourceResponse(res.status, text)) {
      return { leads: [], apiUnavailable: true };
    }
    if (!res.ok) break;
    gotOk = true;
    const json = (() => {
      try {
        return JSON.parse(text);
      } catch {
        return {};
      }
    })();
    const { content, totalPages } = parseListPayload(json);
    if (content.length === 0) break;
    all.push(...content);
    if (shouldStopListPaging(pageNum, content.length, ctx.perType, totalPages)) break;
  }
  if (gotOk) {
    return { leads: tagWhatsappLeads(all), apiUnavailable: false };
  }
  return { leads: [], apiUnavailable: false };
}

async function fetchWhatsappFromDirectList(
  ctx: WhatsappFetchContext,
): Promise<{ leads: ApiLead[]; apiUnavailable: boolean }> {
  let sawNoResource = false;
  for (const basePath of WHATSAPP_DIRECT_LIST_PATHS) {
    const result = await fetchWhatsappFromDirectListAtPath(ctx, basePath);
    if (result.leads.length > 0) return result;
    if (result.apiUnavailable) {
      sawNoResource = true;
      continue;
    }
    // Endpoint exists but returned no rows — stop probing alternate paths.
    return result;
  }
  return { leads: [], apiUnavailable: sawNoResource };
}

export async function fetchWhatsappLeadsForMerge(ctx: WhatsappFetchContext): Promise<{
  leads: ApiLead[];
  accessDenied: boolean;
  apiUnavailable?: boolean;
}> {
  for (const alias of WHATSAPP_FILTER_LEAD_TYPE_ALIASES) {
    const fromFilter = await fetchWhatsappFromFilterAlias(ctx, alias);
    if (fromFilter.length > 0) {
      return { leads: fromFilter, accessDenied: false };
    }
  }

  const direct = await fetchWhatsappFromDirectList(ctx);
  if (direct.leads.length > 0) {
    return { leads: direct.leads, accessDenied: false };
  }

  return {
    leads: [],
    accessDenied: false,
    ...(direct.apiUnavailable ? { apiUnavailable: true } : {}),
  };
}

export function isWhatsappLeadTypeKey(raw: string): boolean {
  return normalizeLeadTypeKey(raw) === WHATSAPP_CRM_LEAD_TYPE;
}

export function mergeWhatsappCountIntoSourceCounts(
  counts: LeadSourceCounts,
  whatsappCount: number,
): LeadSourceCounts {
  if (whatsappCount <= 0) return counts;
  const next = { ...counts };
  const prev = Number(next.whatsapplead ?? 0);
  if (whatsappCount <= prev) return counts;
  next.whatsapplead = whatsappCount;
  next.all = Number(next.all ?? 0) + (whatsappCount - prev);
  return next;
}

export async function augmentLeadSourceCountsWithWhatsapp(
  counts: LeadSourceCounts,
  ctx: Omit<WhatsappFetchContext, "perType" | "maxPages"> & {
    perType?: number;
    maxPages?: number;
  },
): Promise<LeadSourceCounts> {
  try {
    const leads = await fetchWhatsappLeadsResolved({
      ...ctx,
      perType: ctx.perType ?? 100,
      maxPages: ctx.maxPages ?? 10,
    });
    return mergeWhatsappCountIntoSourceCounts(counts, leads.length);
  } catch {
    return counts;
  }
}

function leadInCreatedDateRange(lead: ApiLead, from: string, to: string): boolean {
  if (!from && !to) return true;
  const raw = readLeadCreatedAtRaw(lead) || String(lead.updatedAt ?? "").trim();
  if (!raw) return false;
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return false;
  const dayMs = 24 * 60 * 60 * 1000;
  if (from) {
    const fromTs = Date.parse(`${from}T00:00:00`);
    if (!Number.isNaN(fromTs) && ts < fromTs) return false;
  }
  if (to) {
    const toTs = Date.parse(`${to}T00:00:00`) + dayMs - 1;
    if (!Number.isNaN(toTs) && ts > toTs) return false;
  }
  return true;
}

export function computeWhatsappSourceCountsFromLeads(
  leads: ApiLead[],
  effDates: { from: string; to: string },
): LeadSourceCounts {
  const counts = emptyLeadSourceCounts();
  for (const lead of leads) {
    if (!leadInCreatedDateRange(lead, effDates.from, effDates.to)) continue;
    counts.whatsapplead += 1;
    counts.all += 1;
  }
  return counts;
}
