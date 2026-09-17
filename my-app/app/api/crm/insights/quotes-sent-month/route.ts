import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

/**
 * Hub: quotes sent in the date window by quoteSentAt (not lead createdAt).
 *
 * GET /v1/crm/insights/quotes-sent-month
 * Query: dateFrom, dateTo, dateRange, branchId, salesManagerId, salesExecutiveId
 */
export async function GET(req: NextRequest) {
  try {
    const qs = req.nextUrl.searchParams.toString();
    const suffix = qs ? `?${qs}` : "";
    const candidates = [
      `${BASE_URL}/v1/crm/insights/quotes-sent-month${suffix}`,
      `${BASE_URL}/api/crm/insights/quotes-sent-month${suffix}`,
    ];

    let lastPayload: Awaited<ReturnType<typeof readUpstreamPayload>> | null = null;
    let lastStatus = 502;

    for (const url of candidates) {
      const res = await fetch(url, {
        headers: upstreamAuthHeaders(req),
        cache: "no-store",
      });
      const payload = await readUpstreamPayload(res);
      if (res.ok) {
        return new NextResponse(payload.text, {
          status: res.status,
          headers: { "Content-Type": payload.contentType },
        });
      }
      lastPayload = payload;
      lastStatus = res.status;
      if (res.status !== 404) break;
    }

    if (lastStatus === 404) {
      return NextResponse.json(
        {
          success: true,
          hubImplemented: false,
          filterField: "quoteSentAt",
          quotesSentCount: 0,
          quotationValueInr: 0,
          periodStart: req.nextUrl.searchParams.get("dateFrom"),
          periodEnd: req.nextUrl.searchParams.get("dateTo"),
        },
        { status: 200 },
      );
    }

    return proxyJsonError(
      lastStatus,
      lastPayload ?? { text: "", json: null, contentType: "application/json" },
      "Unable to load quotes-sent-month insights.",
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to load quotes-sent-month insights.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
