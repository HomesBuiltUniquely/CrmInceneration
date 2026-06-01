import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import type { AdminLeadsCountsResponse } from "@/lib/admin-leads-api";
import { fetchAdminPresalesPoolViaMergeFallback } from "@/lib/admin-pool-merge-fallback";
import type { ApiLead, CrmLeadType } from "@/lib/leads-filter";
import { CRM_LEAD_TYPES, isCrmLeadVerified } from "@/lib/leads-filter";
import { normalizeLeadTypeKey } from "@/lib/primary-source-leads";
import { isHubNoResourceResponse } from "@/lib/hub-no-resource";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

function presalesCountsFromPool(
  totalElements: number,
  content: Array<{ lead?: ApiLead }>,
): AdminLeadsCountsResponse {
  const byLeadType: Partial<Record<CrmLeadType, number>> = {};
  for (const t of CRM_LEAD_TYPES) byLeadType[t] = 0;
  let verifiedCount = 0;
  for (const row of content) {
    const lead = row.lead;
    if (!lead) continue;
    if (isCrmLeadVerified(lead)) verifiedCount += 1;
    const lt = normalizeLeadTypeKey(lead.leadType);
    if (CRM_LEAD_TYPES.includes(lt)) byLeadType[lt] = (byLeadType[lt] ?? 0) + 1;
  }
  const leadRows = content.filter((r) => r.lead).length;
  return {
    success: true,
    pool: "presales",
    totalElements: Math.max(totalElements, leadRows),
    verifiedCount,
    unverifiedCount: Math.max(0, leadRows - verifiedCount),
    byLeadType,
  };
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.toString();
  const url = `${BASE_URL}/v1/leads/admin/presales/counts${q ? `?${q}` : ""}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: upstreamAuthHeaders(req),
  });
  const text = await res.text();
  if (isHubNoResourceResponse(res.status, text)) {
    try {
      const pool = await fetchAdminPresalesPoolViaMergeFallback(req, req.nextUrl.searchParams);
      const fallback = presalesCountsFromPool(pool.totalElements, pool.content);
      return NextResponse.json({ ...fallback, fallback: "mergeAll" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Admin presales counts fallback failed";
      return NextResponse.json({ success: false, error: message }, { status: 502 });
    }
  }
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
