import { NextRequest, NextResponse } from "next/server";
import { proxyPaymentLinkJson } from "@/lib/booking-payment-link-proxy";
import { dealPaymentLinksActiveUpstreamCandidates } from "@/lib/booking-payment-link-upstream";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ recordId: string }> },
) {
  try {
    const { recordId } = await ctx.params;
    return proxyPaymentLinkJson({
      req,
      method: "GET",
      urls: dealPaymentLinksActiveUpstreamCandidates(recordId),
      fallbackMessage: "Unable to load payment link.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to load payment link.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
