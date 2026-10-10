import { NextRequest, NextResponse } from "next/server";
import { bookingDealQuoteUpstreamCandidates } from "@/lib/booking-payment-upstream";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

/** PATCH → Hub `/v1/booking-token/deals/{recordId}/quote` (optional standalone rebind). */
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
    const headers = {
      ...upstreamAuthHeaders(req),
      "Content-Type": req.headers.get("Content-Type") ?? "application/json",
    };
    let lastPayload: Awaited<ReturnType<typeof readUpstreamPayload>> = {
      text: "",
      json: null,
      contentType: "application/json",
    };
    let lastStatus = 502;

    for (const url of bookingDealQuoteUpstreamCandidates(recordId)) {
      const res = await fetch(url, {
        method: "PATCH",
        headers,
        body: body.length ? body : "{}",
        cache: "no-store",
      });
      const payload = await readUpstreamPayload(res);
      lastPayload = payload;
      lastStatus = res.status;
      if (res.ok) {
        return new NextResponse(payload.text, {
          status: res.status,
          headers: { "Content-Type": payload.contentType },
        });
      }
      // Try next candidate on 404; surface other Hub errors immediately.
      if (res.status !== 404) {
        return proxyJsonError(res.status, payload, "Unable to update quote on this deal.");
      }
    }

    return proxyJsonError(lastStatus, lastPayload, "Unable to update quote on this deal.");
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to update quote on this deal.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
