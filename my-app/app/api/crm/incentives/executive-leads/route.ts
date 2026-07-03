import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { filterLeadsByAssigneeScope, parseAssigneeAliasSetQuery } from "@/lib/admin-assignee-match";
import { fetchAdminSalesPoolViaMergeFallback } from "@/lib/admin-pool-merge-fallback";
import type { BookingTokenDeal } from "@/lib/booking-done-api";
import { flattenAdminListContent } from "@/lib/admin-leads-api";
import {
  filterIncentiveLeadsForExecutiveMember,
  mapBookingDealsToIncentiveLeads,
  type IncentiveBookingLead,
} from "@/lib/incentives-booking-data";
import { assigneeScopeForExecutive, normalizeIncentiveLeadKey } from "@/lib/incentives-lead-assignee";
import type { IncentiveMemberRef } from "@/lib/incentives-profile";
import type { ApiLead } from "@/lib/leads-filter";
import { readLeadSalesExecutiveIds } from "@/lib/leads-filter";
import { isHubNoResourceResponse } from "@/lib/hub-no-resource";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

function leadPoolKey(lead: ApiLead): string | null {
  const id = Number(lead.id ?? 0);
  if (!id) return null;
  const type = String(lead.leadType ?? "").trim().toLowerCase();
  if (!type) return null;
  return normalizeIncentiveLeadKey(type, id);
}

async function fetchHubBookingDeals(req: NextRequest): Promise<BookingTokenDeal[]> {
  const deals: BookingTokenDeal[] = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    const url = `${BASE_URL}/v1/booking-token/deals?page=${page}&size=500`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: upstreamAuthHeaders(req),
    });
    if (!res.ok) break;
    const json = (await res.json().catch(() => ({}))) as {
      deals?: BookingTokenDeal[];
      totalPages?: number;
    };
    const chunk = Array.isArray(json.deals) ? json.deals : [];
    deals.push(...chunk);
    totalPages = Math.max(1, Number(json.totalPages ?? 1));
    page += 1;
    if (chunk.length === 0) break;
  }

  return deals;
}

async function fetchCrmLeadKeysForExecutive(
  req: NextRequest,
  member: IncentiveMemberRef,
): Promise<Set<string>> {
  const scope = assigneeScopeForExecutive(member);
  const keys = new Set<string>();

  const params = new URLSearchParams();
  params.set("page", "0");
  params.set("size", "5000");
  if (scope.length > 0) {
    params.set(
      "assigneeAliasSet",
      scope
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .join("\0"),
    );
  }

  const hubUrl = `${BASE_URL}/v1/leads/admin/sales?${params.toString()}`;
  const hubRes = await fetch(hubUrl, {
    cache: "no-store",
    headers: upstreamAuthHeaders(req),
  });
  const hubText = await hubRes.text();

  let poolRows: ApiLead[] = [];
  if (hubRes.ok) {
    try {
      const json = JSON.parse(hubText) as { content?: unknown[] };
      poolRows = flattenAdminListContent(json.content as Parameters<typeof flattenAdminListContent>[0]);
    } catch {
      poolRows = [];
    }
  } else if (isHubNoResourceResponse(hubRes.status, hubText)) {
    try {
      const fallback = await fetchAdminSalesPoolViaMergeFallback(req, params);
      poolRows = flattenAdminListContent(fallback.content);
    } catch {
      poolRows = [];
    }
  }

  if (scope.length > 0 && poolRows.length > 0) {
    poolRows = filterLeadsByAssigneeScope(poolRows, scope);
  }

  for (const lead of poolRows) {
    const key = leadPoolKey(lead);
    if (key) keys.add(key);
  }

  if (keys.size === 0) {
    try {
      const fallback = await fetchAdminSalesPoolViaMergeFallback(req, new URLSearchParams());
      const allRows = flattenAdminListContent(fallback.content);
      for (const lead of allRows) {
        if (!readLeadSalesExecutiveIds(lead).includes(member.id)) continue;
        const key = leadPoolKey(lead);
        if (key) keys.add(key);
      }
    } catch {
      /* keep empty */
    }
  }

  return keys;
}

export async function GET(req: NextRequest) {
  try {
    const executiveId = Number(req.nextUrl.searchParams.get("executiveId") ?? 0);
    if (!executiveId) {
      return NextResponse.json({ success: false, error: "executiveId is required." }, { status: 400 });
    }

    const assigneeScope = parseAssigneeAliasSetQuery(req.nextUrl.searchParams.get("assigneeScope"));
    const member: IncentiveMemberRef = {
      id: executiveId,
      name: assigneeScope[0] ?? `User ${executiveId}`,
      role: "SALES_EXECUTIVE",
      assigneeAliases: assigneeScope.length > 0 ? assigneeScope : undefined,
    };

    const [deals, crmKeys] = await Promise.all([
      fetchHubBookingDeals(req),
      fetchCrmLeadKeysForExecutive(req, member),
    ]);

    const allLeads = mapBookingDealsToIncentiveLeads(deals);
    const leads: IncentiveBookingLead[] = filterIncentiveLeadsForExecutiveMember(
      allLeads,
      member,
      crmKeys,
    );

    return NextResponse.json({
      success: true,
      executiveId,
      crmLeadKeyCount: crmKeys.size,
      leads,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to load incentive booking leads for executive.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
