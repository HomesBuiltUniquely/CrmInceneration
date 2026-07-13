import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

/**
 * Proxies Hub CRM Insights filter options (branches, managers, executives).
 * GET /v1/crm/insights/filter-options
 */
export async function GET(req: NextRequest) {
  try {
    const qs = req.nextUrl.searchParams.toString();
    const candidates = [
      `${BASE_URL}/v1/crm/insights/filter-options${qs ? `?${qs}` : ""}`,
      `${BASE_URL}/api/crm/insights/filter-options${qs ? `?${qs}` : ""}`,
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

    return proxyJsonError(
      lastStatus,
      lastPayload ?? { text: "", json: null, contentType: "application/json" },
      "Unable to load CRM insights filter options.",
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to load CRM insights filter options.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
