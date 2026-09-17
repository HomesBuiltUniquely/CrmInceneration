import { NextRequest, NextResponse } from "next/server";
import { bookingTokenDealRecognitionUpstreamUrl } from "@/lib/booking-done-upstream";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

/** PATCH → Hub `/v1/booking-token/deals/{recordId}/recognition` */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ recordId: string }> },
) {
  try {
    const { recordId } = await ctx.params;
    if (!recordId?.trim()) {
      return NextResponse.json({ success: false, error: "Invalid recordId" }, { status: 400 });
    }

    const body = await req.text();
    const res = await fetch(bookingTokenDealRecognitionUpstreamUrl(recordId), {
      method: "PATCH",
      headers: {
        ...upstreamAuthHeaders(req),
        "Content-Type": req.headers.get("Content-Type") ?? "application/json",
      },
      body: body.length ? body : "{}",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(
        res.status,
        payload,
        "Unable to save token/booking recognition dates.",
      );
    }
    return new NextResponse(payload.text, {
      status: res.status,
      headers: { "Content-Type": payload.contentType },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to save token/booking recognition dates.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
