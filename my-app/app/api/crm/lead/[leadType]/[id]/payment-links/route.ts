import { NextRequest, NextResponse } from "next/server";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { proxyPaymentLinkJson } from "@/lib/booking-payment-link-proxy";
import { leadPaymentLinksUpstreamCandidates } from "@/lib/booking-payment-link-upstream";
import type { CrmLeadType } from "@/lib/leads-filter";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> },
) {
  try {
    const { leadType, id } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }
    const body = await req.text();
    return proxyPaymentLinkJson({
      req,
      method: "POST",
      urls: leadPaymentLinksUpstreamCandidates(leadType as CrmLeadType, id),
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
