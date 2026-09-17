import { NextRequest, NextResponse } from "next/server";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import {
  BOOKING_DONE_NOT_DEPLOYED_MESSAGE,
  bookingDoneRecognitionUpstreamCandidates,
  isBookingDoneNotDeployedResponse,
} from "@/lib/booking-done-upstream";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";
import type { CrmLeadType } from "@/lib/leads-filter";

/**
 * PATCH → Hub `…/booking-done/recognition`
 * Optional old-lead token / 10% recognition date + amount backfill.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; leadId: string }> },
) {
  try {
    const { leadType, leadId } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }

    const body = await req.text();
    const headers: HeadersInit = {
      ...upstreamAuthHeaders(req),
      "Content-Type": req.headers.get("Content-Type") ?? "application/json",
    };

    let lastPayload: Awaited<ReturnType<typeof readUpstreamPayload>> | null = null;
    let lastStatus = 500;
    let lastUrl = "";

    for (const url of bookingDoneRecognitionUpstreamCandidates(
      leadType as CrmLeadType,
      leadId,
    )) {
      lastUrl = url;
      const res = await fetch(url, {
        method: "PATCH",
        headers,
        body: body.length ? body : "{}",
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

      if (!isBookingDoneNotDeployedResponse(payload.text)) {
        break;
      }
    }

    if (lastPayload && isBookingDoneNotDeployedResponse(lastPayload.text)) {
      return NextResponse.json(
        {
          success: false,
          userMessage: BOOKING_DONE_NOT_DEPLOYED_MESSAGE,
          error: BOOKING_DONE_NOT_DEPLOYED_MESSAGE,
          debugMessage: `Tried Hub URLs including ${lastUrl}. Upstream: ${lastPayload.text.slice(0, 400)}`,
        },
        { status: 503 },
      );
    }

    return proxyJsonError(
      lastStatus,
      lastPayload ?? { text: "", json: null, contentType: "application/json" },
      "Unable to save token/booking recognition dates.",
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to save token/booking recognition dates.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
