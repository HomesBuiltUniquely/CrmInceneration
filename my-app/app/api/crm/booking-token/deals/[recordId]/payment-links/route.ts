import { NextRequest, NextResponse } from "next/server";
import { proxyPaymentLinkJson } from "@/lib/booking-payment-link-proxy";
import { dealPaymentLinksUpstreamCandidates } from "@/lib/booking-payment-link-upstream";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ recordId: string }> },
) {
  try {
    const { recordId } = await ctx.params;
    const body = await req.text();
    return proxyPaymentLinkJson({
      req,
      method: "POST",
      urls: dealPaymentLinksUpstreamCandidates(recordId),
      body,
      fallbackMessage: "Unable to send payment link.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to send payment link.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
