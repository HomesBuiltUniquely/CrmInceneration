import { NextRequest, NextResponse } from "next/server";
import { proxyPaymentLinkJson } from "@/lib/booking-payment-link-proxy";
import {
  paymentLinkActionUpstreamCandidates,
  type PaymentLinkAction,
} from "@/lib/booking-payment-link-upstream";

const ACTIONS = new Set<PaymentLinkAction>([
  "copy",
  "resend",
  "edit",
  "switch-offline",
  "cancel",
  "delete",
]);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string; action: string }> },
) {
  try {
    const { attemptId, action } = await ctx.params;
    if (!ACTIONS.has(action as PaymentLinkAction)) {
      return NextResponse.json({ success: false, error: "Unknown payment-link action." }, { status: 400 });
    }
    const body = await req.text();
    return proxyPaymentLinkJson({
      req,
      method: "POST",
      urls: paymentLinkActionUpstreamCandidates(attemptId, action as PaymentLinkAction),
      body,
      fallbackMessage: "Unable to update payment link.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to update payment link.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
