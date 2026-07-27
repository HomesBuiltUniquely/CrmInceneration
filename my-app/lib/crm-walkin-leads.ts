/**
 * Walk-in lead source — Hub contract on migration branch:
 * POST /v1/WalkinLead, GET /v1/WalkinLead/{id} (not /v1/WalkIn or /v1/WalkInLead).
 */

import type { NextRequest } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import type { ApiLead, CrmLeadType, LeadSourceCounts, SpringPage } from "@/lib/leads-filter";
import { CRM_LEAD_TYPES } from "@/lib/leads-filter";
import { emptyLeadSourceCounts } from "@/lib/primary-source-leads";
import { LEAD_TYPE_TO_BASE } from "@/lib/crm-lead-endpoints";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import {
  readLeadCreatedAtRaw,
  readLeadDateRawForCrmDateField,
} from "@/lib/lead-follow-up-insights";
import { normalizeLeadTypeKey } from "@/lib/primary-source-leads";
import { isHubNoResourceResponse } from "@/lib/hub-no-resource";
import type { CrmWorkspace } from "@/lib/crm-workspace";
import { filterLeadsForAdminWorkspacePool } from "@/lib/crm-workspace";
import {
  parseCrmDateField,
  rawInInclusiveDateRange,
} from "@/lib/crm-date-field-filter";

export const WALKIN_CRM_LEAD_TYPE: CrmLeadType = "walkinlead";

/** Hub `/v1/leads/filter` leadType values once walk-in is merged into filter. */
export const WALKIN_FILTER_LEAD_TYPE_ALIASES = ["walkinlead", "WalkinLead"] as const;

/** Canonical list base — do not probe /v1/WalkIn or /v1/WalkInLead (404 on current branch). */
const WALKIN_DIRECT_BASE_PATH = LEAD_TYPE_TO_BASE.walkinlead;

function isLocalHubOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(origin);
  }
}

/** Shown when Hub returns 404/no-resource for /v1/WalkinLead (usually wrong BASE_URL). */
export function walkInHubUnavailableMessage(hubOrigin: string = BASE_URL): string {
  if (isLocalHubOrigin(hubOrigin)) {
    return (
      `Walk-in API is not on your local Hub (${hubOrigin}). ` +
      `Production has it at https://hows.hubinterior.com — set BASE_URL=https://hows.hubinterior.com in .env.local and restart npm run dev, ` +
      `or merge walk-in into your local Spring branch.`
    );
  }
  return (
    `Could not load walk-in leads from ${hubOrigin}. ` +
    `Check BASE_URL, log in (crm_token), and that GET /v1/WalkinLead is reachable.`
  );
}

/** @deprecated Use walkInHubUnavailableMessage() — kept for existing imports. */
export const WALKIN_HUB_API_UNAVAILABLE = walkInHubUnavailableMessage();

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

function tagWalkInLeads(leads: ApiLead[]): ApiLead[] {
  return leads.map((lead) => ({
    ...lead,
    leadType: normalizeLeadTypeKey(lead.leadType ?? WALKIN_CRM_LEAD_TYPE),
  }));
}

export type WalkInFetchContext = {
  req?: NextRequest;
  headers?: HeadersInit;
  sort: string;
  search: string;
  effDates: { from: string; to: string };
  extraParams: Array<{ key: string; value: string }>;
  perType: number;
  maxPages: number;
  /** Scope walk-in counts to sales or presales assignee pool (admin Lead Types tiles). */
  workspace?: CrmWorkspace;
};

function buildWalkInProxyQuery(ctx: WalkInFetchContext): URLSearchParams {
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

/** Use Next proxy in browser; Hub direct only when `req` is present (API routes). */
async function fetchWalkInLeadsResolved(ctx: WalkInFetchContext): Promise<ApiLead[]> {
  let leads: ApiLead[];
  if (ctx.req) {
    leads = (await fetchWalkInLeadsForMerge(ctx)).leads;
  } else {
    const qs = buildWalkInProxyQuery(ctx);
    const res = await fetch(`/api/crm/walkin-leads?${qs.toString()}`, {
      cache: "no-store",
      credentials: "include",
      headers: ctx.headers,
    });
    if (!res.ok) return [];
    const json = (await res.json().catch(() => ({}))) as {
      leads?: ApiLead[];
    };
    leads = Array.isArray(json.leads) ? json.leads : [];
  }
  if (ctx.workspace) {
    leads = filterLeadsForAdminWorkspacePool(leads, ctx.workspace);
  }
  return leads;
}

function resolveAuthHeaders(ctx: WalkInFetchContext): HeadersInit {
  if (ctx.headers) return ctx.headers;
  if (ctx.req) return upstreamAuthHeaders(ctx.req);
  return {};
}

/** Direct WalkinLead list: only search. Filter endpoint also gets CRM date/milestone keys. */
const WALKIN_DIRECT_LIST_QUERY_KEYS = new Set(["search"]);
const WALKIN_FILTER_QUERY_KEYS = new Set([
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
]);

function appendWalkInQueryParams(
  upstream: URL,
  ctx: WalkInFetchContext,
  pageNum: number,
  mode: "filter" | "direct" = "direct",
): void {
  upstream.searchParams.set("page", String(pageNum));
  upstream.searchParams.set("size", String(ctx.perType));
  upstream.searchParams.set("sort", ctx.sort);
  if (ctx.search) upstream.searchParams.set("search", ctx.search);
  const allowedKeys =
    mode === "filter" ? WALKIN_FILTER_QUERY_KEYS : WALKIN_DIRECT_LIST_QUERY_KEYS;
  for (const { key, value } of ctx.extraParams) {
    if (!value || !allowedKeys.has(key)) continue;
    upstream.searchParams.set(key, value);
  }
  if (mode === "filter") {
    if (ctx.effDates.from) upstream.searchParams.set("dateFrom", ctx.effDates.from);
    if (ctx.effDates.to) upstream.searchParams.set("dateTo", ctx.effDates.to);
  }
}

async function fetchWalkInFromFilterAlias(
  ctx: WalkInFetchContext,
  filterLeadType: string,
): Promise<ApiLead[]> {
  const all: ApiLead[] = [];
  for (let pageNum = 0; pageNum < ctx.maxPages; pageNum += 1) {
    const upstream = new URL(`${BASE_URL}/v1/leads/filter`);
    upstream.searchParams.set("leadType", filterLeadType);
    upstream.searchParams.set("milestoneScope", "crm");
    appendWalkInQueryParams(upstream, ctx, pageNum, "filter");
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
    if (pageNum + 1 >= totalPages) break;
    if (chunk.length < ctx.perType) break;
  }
  return tagWalkInLeads(all);
}

async function fetchWalkInFromDirectList(
  ctx: WalkInFetchContext,
): Promise<{ leads: ApiLead[]; apiUnavailable: boolean }> {
  const all: ApiLead[] = [];
  let gotOk = false;
  for (let pageNum = 0; pageNum < ctx.maxPages; pageNum += 1) {
    const upstream = new URL(`${BASE_URL}${WALKIN_DIRECT_BASE_PATH}`);
    appendWalkInQueryParams(upstream, ctx, pageNum, "direct");
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
    if (pageNum + 1 >= totalPages) break;
    if (content.length < ctx.perType) break;
  }
  if (gotOk) {
    return { leads: tagWalkInLeads(all), apiUnavailable: false };
  }
  return { leads: [], apiUnavailable: false };
}

function leadInCreatedDateRange(lead: ApiLead, from: string, to: string): boolean {
  if (!from && !to) return true;
  const raw = readLeadCreatedAtRaw(lead) || String(lead.updatedAt ?? "").trim();
  return rawInInclusiveDateRange(raw, from, to);
}

function dateFieldFromExtraParams(
  extraParams: Array<{ key: string; value: string }>,
): string {
  return extraParams.find((p) => p.key === "dateField")?.value ?? "";
}

/** Hub WalkinLead list is not CRM-date-filtered — enforce toolbar bounds locally. */
function filterWalkInLeadsByDateRange(
  leads: ApiLead[],
  ctx: WalkInFetchContext,
): ApiLead[] {
  const from = ctx.effDates.from;
  const to = ctx.effDates.to;
  if (!from && !to) return leads;
  const field = parseCrmDateField(dateFieldFromExtraParams(ctx.extraParams));
  return leads.filter((lead) => {
    const raw = readLeadDateRawForCrmDateField(lead, field);
    return rawInInclusiveDateRange(raw, from, to);
  });
}

export async function fetchWalkInLeadsForMerge(ctx: WalkInFetchContext): Promise<{
  leads: ApiLead[];
  accessDenied: boolean;
  apiUnavailable?: boolean;
}> {
  const direct = await fetchWalkInFromDirectList(ctx);
  if (direct.leads.length > 0) {
    return {
      leads: filterWalkInLeadsByDateRange(direct.leads, ctx),
      accessDenied: false,
    };
  }
  if (direct.apiUnavailable) {
    return { leads: [], accessDenied: false, apiUnavailable: true };
  }

  for (const alias of WALKIN_FILTER_LEAD_TYPE_ALIASES) {
    const fromFilter = await fetchWalkInFromFilterAlias(ctx, alias);
    if (fromFilter.length > 0) {
      return {
        leads: filterWalkInLeadsByDateRange(fromFilter, ctx),
        accessDenied: false,
      };
    }
  }

  return { leads: [], accessDenied: false };
}

export function isWalkInLeadTypeKey(raw: string): boolean {
  return normalizeLeadTypeKey(raw) === WALKIN_CRM_LEAD_TYPE;
}

export function countIncludesWalkInType(leadType: string): boolean {
  const norm = String(leadType ?? "").trim().toLowerCase();
  return CRM_LEAD_TYPES.includes(norm as CrmLeadType) || isWalkInLeadTypeKey(norm);
}

/** Hub admin pool often omits walk-in until byLeadType includes it — merge from filter/direct API. */
export function mergeWalkInCountIntoSourceCounts(
  counts: LeadSourceCounts,
  walkinCount: number,
): LeadSourceCounts {
  if (walkinCount <= 0) return counts;
  const next = { ...counts };
  const prevWalkin = Number(next.walkinlead ?? 0);
  if (walkinCount <= prevWalkin) return counts;
  next.walkinlead = walkinCount;
  next.all = Number(next.all ?? 0) + (walkinCount - prevWalkin);
  return next;
}

export async function augmentLeadSourceCountsWithWalkIn(
  counts: LeadSourceCounts,
  ctx: Omit<WalkInFetchContext, "perType" | "maxPages"> & {
    perType?: number;
    maxPages?: number;
  },
): Promise<LeadSourceCounts> {
  try {
    const leads = await fetchWalkInLeadsResolved({
      ...ctx,
      perType: ctx.perType ?? 100,
      maxPages: ctx.maxPages ?? 10,
    });
    // Hub WalkinLead list is not CRM-date-filtered; toolbar month must not zero counts.
    return mergeWalkInCountIntoSourceCounts(counts, leads.length);
  } catch {
    return counts;
  }
}

export function computeWalkInSourceCountsFromLeads(
  leads: ApiLead[],
  effDates: { from: string; to: string },
): LeadSourceCounts {
  const counts = emptyLeadSourceCounts();
  for (const lead of leads) {
    if (!leadInCreatedDateRange(lead, effDates.from, effDates.to)) continue;
    counts.walkinlead += 1;
    counts.all += 1;
  }
  return counts;
}
