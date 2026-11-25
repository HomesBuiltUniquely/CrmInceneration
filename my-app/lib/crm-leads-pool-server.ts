import type { NextRequest } from "next/server";
import type { ApiLead } from "@/lib/leads-filter";
import { appendLeadPoolQuery, defaultLeadsVerificationStatus } from "@/lib/crm-workspace";
import {
  postProcessSalesExecutiveFollowUpPool,
  type SeFollowUpViewerContext,
} from "@/lib/sales-executive-followup-day-brief";

const MERGE_FETCH_TIMEOUT_MS = 12_000;

function forwardAuthHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) headers.set("Authorization", auth);
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("Cookie", cookie);
  headers.set("Accept", "application/json");
  return headers;
}

/**
 * Loads the SALES_EXECUTIVE insight pool via the existing BFF merge orchestrator
 * (same Hub JWT scope as `/Leads` tiles) and applies the client inbox pipeline server-side.
 */
export async function loadSalesExecutiveInsightPoolForRequest(
  req: NextRequest,
  viewer: SeFollowUpViewerContext,
): Promise<ApiLead[]> {
  const verificationStatus = defaultLeadsVerificationStatus(
    "sales",
    undefined,
    "SALES_EXECUTIVE",
  );
  const url = new URL("/api/crm/leads", req.nextUrl.origin);
  url.searchParams.set("mergeAll", "1");
  url.searchParams.set("leadType", "all");
  url.searchParams.set("milestoneScope", "crm");
  url.searchParams.set("page", "0");
  url.searchParams.set("size", "50000");
  url.searchParams.set("sort", "updatedAt,desc");
  if (verificationStatus) url.searchParams.set("verificationStatus", verificationStatus);
  appendLeadPoolQuery(url.searchParams, "sales");

  const res = await fetch(url.toString(), {
    headers: forwardAuthHeaders(req),
    cache: "no-store",
    signal: AbortSignal.timeout(MERGE_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Leads merge failed (${res.status})`);
  }
  const json = (await res.json()) as { content?: ApiLead[] };
  const content = Array.isArray(json.content) ? json.content : [];
  return postProcessSalesExecutiveFollowUpPool(content, viewer);
}