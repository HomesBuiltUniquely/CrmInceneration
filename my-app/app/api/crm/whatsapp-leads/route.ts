import { NextRequest, NextResponse } from "next/server";
import {
  fetchWhatsappLeadsForMerge,
  whatsappHubUnavailableMessage,
  type WhatsappFetchContext,
} from "@/lib/crm-whatsapp-leads";

function whatsappContextFromRequest(req: NextRequest): WhatsappFetchContext {
  const url = req.nextUrl;
  const extraKeys = [
    "milestoneStage",
    "milestoneStageCategory",
    "milestoneSubStage",
    "presalesMilestoneStage",
    "presalesMilestoneStageCategory",
    "presalesMilestoneSubStage",
    "verificationStatus",
    "reinquiry",
    "assignee",
    "dateFrom",
    "dateTo",
    "dateField",
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

/** Server proxy for WhatsApp leads (browser cannot call Hub BASE_URL directly). */
export async function GET(req: NextRequest) {
  try {
    const ctx = whatsappContextFromRequest(req);
    const { leads, accessDenied, apiUnavailable } = await fetchWhatsappLeadsForMerge(ctx);
    return NextResponse.json({
      leads,
      accessDenied,
      apiUnavailable: apiUnavailable ?? false,
      message: apiUnavailable ? whatsappHubUnavailableMessage() : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "WhatsApp leads fetch failed";
    return NextResponse.json({ leads: [], accessDenied: false, error: message }, { status: 200 });
  }
}
