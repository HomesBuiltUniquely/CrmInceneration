import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";
import { bookingPaymentHistoryUpstreamUrl } from "@/lib/booking-payment-upstream";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ recordId: string }> },
) {
  try {
    const { recordId } = await ctx.params;
    const url = bookingPaymentHistoryUpstreamUrl(recordId);
    const res = await fetch(url, {
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(res.status, payload, "Unable to load payment history.");
    }
    return new NextResponse(payload.text, {
      status: res.status,
      headers: { "Content-Type": payload.contentType },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to load payment history.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
