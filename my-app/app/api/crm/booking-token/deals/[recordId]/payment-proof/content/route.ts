import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { bookingPaymentProofContentUpstreamUrl } from "@/lib/booking-payment-upstream";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ recordId: string }> },
) {
  try {
    const { recordId } = await ctx.params;
    const proofId = req.nextUrl.searchParams.get("proofId")?.trim();
    if (!proofId) {
      return NextResponse.json({ success: false, error: "proofId is required." }, { status: 400 });
    }

    const url = bookingPaymentProofContentUpstreamUrl(recordId, proofId);
    const res = await fetch(url, {
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      return new NextResponse(text || "Unable to load payment proof.", { status: res.status });
    }
    const contentType = res.headers.get("Content-Type") ?? "application/octet-stream";
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to load payment proof.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
