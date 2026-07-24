import { NextRequest, NextResponse } from "next/server";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";
import { bookingTokenLeadCancellationRestoreUpstreamUrl } from "@/lib/booking-token-upstream";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> },
) {
  try {
    const { leadType, id } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }
    if (!/^\d+$/.test(id.trim())) {
      return NextResponse.json({ success: false, error: "Invalid leadId" }, { status: 400 });
    }

    const res = await fetch(bookingTokenLeadCancellationRestoreUpstreamUrl(leadType, id), {
      method: "POST",
      headers: {
        ...upstreamAuthHeaders(req),
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(res.status, payload, "Unable to restore booking.");
    }
    return new NextResponse(payload.text, {
      status: res.status,
      headers: { "Content-Type": payload.contentType },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to restore booking.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
