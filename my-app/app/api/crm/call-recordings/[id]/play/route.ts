import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

/** Proxies Hub `GET /v1/CallRecording/{id}/play` → `{ playUrl }`. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const recordingId = encodeURIComponent(id);
    const candidates = [
      `${BASE_URL}/v1/CallRecording/${recordingId}/play`,
      `${BASE_URL}/api/crm/call-recording/${recordingId}/play`,
    ];

    let lastPayload: Awaited<ReturnType<typeof readUpstreamPayload>> | null = null;
    let lastStatus = 502;

    for (const url of candidates) {
      const res = await fetch(url, {
        headers: { ...upstreamAuthHeaders(req), Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(25000),
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
      "Unable to load recording play URL.",
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to load recording play URL.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
