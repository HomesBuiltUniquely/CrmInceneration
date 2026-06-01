import type { NextRequest } from "next/server";
import type { AdminLeadListEnvelope, AdminLeadsCountsResponse } from "@/lib/admin-leads-api";
import type { ApiLead, CrmLeadType, LeadSourceCounts, SpringPage } from "@/lib/leads-filter";
import { CRM_LEAD_TYPES, isCrmLeadVerified } from "@/lib/leads-filter";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

type MergeLeadsPage = SpringPage<ApiLead> & {
  sourceCounts?: LeadSourceCounts;
};

type AdminMergePool = "sales" | "presales";

function mergeQueryFromAdminParams(
  params: URLSearchParams,
  pool: AdminMergePool,
): URLSearchParams {
  const qs = new URLSearchParams(params);
  qs.set("mergeAll", "1");
  if (!qs.get("milestoneScope")) qs.set("milestoneScope", "crm");
  if (pool === "presales") qs.set("leadPool", "presales");
  else qs.delete("leadPool");
  qs.set("page", "0");
  qs.set("size", "50000");
  if (!qs.get("sort")) qs.set("sort", "updatedAt,desc");
  return qs;
}

async function fetchMergedLeadsPage(
  req: NextRequest,
  params: URLSearchParams,
  pool: AdminMergePool,
): Promise<MergeLeadsPage> {
  const origin = req.nextUrl.origin;
  const qs = mergeQueryFromAdminParams(params, pool);
  const res = await fetch(`${origin}/api/crm/leads?${qs.toString()}`, {
    cache: "no-store",
    headers: upstreamAuthHeaders(req),
  });
  const json = (await res.json().catch(() => ({}))) as MergeLeadsPage & { error?: string };
  if (!res.ok) {
    throw new Error(String(json.error ?? `Merged leads fallback failed (HTTP ${res.status})`));
  }
  return json;
}

function leadToAdminEnvelope(lead: ApiLead, assigneeRole: string): AdminLeadListEnvelope {
  const leadType = String(lead.leadType ?? "").trim().toLowerCase();
  return {
    leadType,
    type: leadType,
    assigneeRole,
    lead,
  };
}

export async function fetchAdminSalesPoolViaMergeFallback(
  req: NextRequest,
  params: URLSearchParams,
): Promise<{
  content: AdminLeadListEnvelope[];
  totalElements: number;
}> {
  const page = await fetchMergedLeadsPage(req, params, "sales");
  const leads = Array.isArray(page.content) ? page.content : [];
  return {
    content: leads.map((lead) => leadToAdminEnvelope(lead, "SALES")),
    totalElements: Number(page.totalElements ?? leads.length),
  };
}

export async function fetchAdminPresalesPoolViaMergeFallback(
  req: NextRequest,
  params: URLSearchParams,
): Promise<{
  content: AdminLeadListEnvelope[];
  totalElements: number;
}> {
  const page = await fetchMergedLeadsPage(req, params, "presales");
  const leads = Array.isArray(page.content) ? page.content : [];
  return {
    content: leads.map((lead) => leadToAdminEnvelope(lead, "PRESALES")),
    totalElements: Number(page.totalElements ?? leads.length),
  };
}

function countsFromMergedPage(
  page: MergeLeadsPage,
  pool: AdminMergePool,
): AdminLeadsCountsResponse {
  const leads = Array.isArray(page.content) ? page.content : [];
  const sourceCounts = page.sourceCounts;
  const byLeadType: Partial<Record<CrmLeadType, number>> = {};
  for (const t of CRM_LEAD_TYPES) {
    byLeadType[t] = Number(sourceCounts?.[t] ?? 0);
  }
  let verifiedCount = 0;
  for (const lead of leads) {
    if (isCrmLeadVerified(lead)) verifiedCount += 1;
  }
  return {
    success: true,
    pool,
    totalElements: Number(page.totalElements ?? leads.length),
    verifiedCount,
    unverifiedCount: Math.max(0, leads.length - verifiedCount),
    byLeadType,
  };
}

export async function fetchAdminSalesCountsViaMergeFallback(
  req: NextRequest,
  params: URLSearchParams,
): Promise<AdminLeadsCountsResponse> {
  const page = await fetchMergedLeadsPage(req, params, "sales");
  return countsFromMergedPage(page, "sales");
}

export async function fetchAdminPresalesCountsViaMergeFallback(
  req: NextRequest,
  params: URLSearchParams,
): Promise<AdminLeadsCountsResponse> {
  const page = await fetchMergedLeadsPage(req, params, "presales");
  return countsFromMergedPage(page, "presales");
}
