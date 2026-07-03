import { NextRequest, NextResponse } from "next/server";
import { bookingPaymentHistoryEntryUpstreamUrl } from "@/lib/booking-payment-upstream";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

async function resolvePaymentHistoryId(req: NextRequest): Promise<string | NextResponse> {
  const paymentHistoryId = req.nextUrl.searchParams.get("paymentHistoryId")?.trim();
  if (!paymentHistoryId) {
    return NextResponse.json(
      { success: false, error: "paymentHistoryId is required." },
      { status: 400 },
    );
  }
  return paymentHistoryId;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ recordId: string }> },
) {
  try {
    const { recordId } = await ctx.params;
    const paymentHistoryId = await resolvePaymentHistoryId(req);
    if (paymentHistoryId instanceof NextResponse) {
      return paymentHistoryId;
    }

    const url = bookingPaymentHistoryEntryUpstreamUrl(recordId, paymentHistoryId);
    const res = await fetch(url, {
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(res.status, payload, "Unable to load payment entry.");
    }
    return new NextResponse(payload.text, {
      status: res.status,
      headers: { "Content-Type": payload.contentType },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to load payment entry.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ recordId: string }> },
) {
  try {
    const { recordId } = await ctx.params;
    const paymentHistoryId = await resolvePaymentHistoryId(req);
    if (paymentHistoryId instanceof NextResponse) {
      return paymentHistoryId;
    }

    const url = bookingPaymentHistoryEntryUpstreamUrl(recordId, paymentHistoryId);
    const res = await fetch(url, {
      method: "DELETE",
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(res.status, payload, "Unable to remove payment.");
    }
    return new NextResponse(payload.text, {
      status: res.status,
      headers: { "Content-Type": payload.contentType },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to remove payment.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
