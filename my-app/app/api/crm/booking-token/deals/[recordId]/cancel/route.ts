import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";
import { bookingTokenCancelUpstreamUrl } from "@/lib/booking-token-upstream";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ recordId: string }> },
) {
  try {
    const { recordId } = await ctx.params;
    const body = await req.text();
    const res = await fetch(bookingTokenCancelUpstreamUrl(recordId), {
      method: "POST",
      headers: {
        ...upstreamAuthHeaders(req),
        "Content-Type": "application/json",
      },
      body: body || "{}",
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(res.status, payload, "Unable to cancel booking deal.");
    }
    return new NextResponse(payload.text, {
      status: res.status,
      headers: { "Content-Type": payload.contentType },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to cancel booking deal.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
