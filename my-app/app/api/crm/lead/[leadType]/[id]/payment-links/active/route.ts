import { NextRequest, NextResponse } from "next/server";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { proxyPaymentLinkJson } from "@/lib/booking-payment-link-proxy";
import { leadPaymentLinksActiveUpstreamCandidates } from "@/lib/booking-payment-link-upstream";
import type { CrmLeadType } from "@/lib/leads-filter";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> },
) {
  try {
    const { leadType, id } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }
    return proxyPaymentLinkJson({
      req,
      method: "GET",
      urls: leadPaymentLinksActiveUpstreamCandidates(leadType as CrmLeadType, id),
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
