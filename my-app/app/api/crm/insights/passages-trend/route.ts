import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

/**
 * Proxies Hub Passages old-lead share monthly trend.
 * GET /v1/crm/insights/passages-trend
 */
export async function GET(req: NextRequest) {
  try {
    const qs = req.nextUrl.searchParams.toString();
    const suffix = qs ? `?${qs}` : "";
    const candidates = [
      `${BASE_URL}/v1/crm/insights/passages-trend${suffix}`,
      `${BASE_URL}/api/crm/insights/passages-trend${suffix}`,
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
          months: Number(req.nextUrl.searchParams.get("months") ?? 12),
          points: [],
        },
        { status: 200 },
      );
    }

    return proxyJsonError(
      lastStatus,
      lastPayload ?? { text: "", json: null, contentType: "application/json" },
      "Unable to load passages trend.",
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to load passages trend.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
