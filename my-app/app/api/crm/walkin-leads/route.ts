import { NextRequest, NextResponse } from "next/server";
import {
  fetchWalkInLeadsForMerge,
  WALKIN_HUB_API_UNAVAILABLE,
  type WalkInFetchContext,
} from "@/lib/crm-walkin-leads";

function walkInContextFromRequest(req: NextRequest): WalkInFetchContext {
  const url = req.nextUrl;
  const extraKeys = [
    "milestoneStage",
    "milestoneStageCategory",
    "milestoneSubStage",
    "verificationStatus",
    "reinquiry",
    "assignee",
    "dateFrom",
    "dateTo",
  ] as const;

  return {
    req,
    sort: (url.searchParams.get("sort") ?? "updatedAt,desc").trim() || "updatedAt,desc",
    search: (url.searchParams.get("search") ?? "").trim(),
    effDates: {
      from: (url.searchParams.get("dateFrom") ?? "").trim(),
      to: (url.searchParams.get("dateTo") ?? "").trim(),
    },
    extraParams: extraKeys.map((key) => ({
      key,
      value: (url.searchParams.get(key) ?? "").trim(),
    })),
    perType: Math.min(500, Math.max(1, Number(url.searchParams.get("size") ?? 500))),
    maxPages: Math.min(20, Math.max(1, Number(url.searchParams.get("maxPages") ?? 10))),
  };
}

/** Server proxy for walk-in leads (browser cannot call Hub BASE_URL directly). */
export async function GET(req: NextRequest) {
  try {
    const ctx = walkInContextFromRequest(req);
    const { leads, accessDenied, apiUnavailable } = await fetchWalkInLeadsForMerge(ctx);
    return NextResponse.json({
      leads,
      accessDenied,
      apiUnavailable: apiUnavailable ?? false,
      message: apiUnavailable ? WALKIN_HUB_API_UNAVAILABLE : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Walk-in leads fetch failed";
    return NextResponse.json({ leads: [], accessDenied: false, error: message }, { status: 200 });
  }
}
