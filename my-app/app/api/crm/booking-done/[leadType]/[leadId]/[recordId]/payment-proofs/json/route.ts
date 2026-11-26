import { NextRequest, NextResponse } from "next/server";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import {
  BOOKING_DONE_NOT_DEPLOYED_MESSAGE,
  bookingDonePaymentProofsJsonUpstreamCandidates,
  isBookingDoneNotDeployedResponse,
} from "@/lib/booking-done-upstream";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";
import type { CrmLeadType } from "@/lib/leads-filter";

export const maxDuration = 60;

/**
 * Preferred initial booking-done payment-proof upload through Vercel BFF.
 * Forwards JSON + base64 as-is — never converts to multipart (avoids Tomcat parse 400s).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; leadId: string; recordId: string }> },
) {
  try {
    const { leadType, leadId, recordId } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }

    const contentType = (req.headers.get("content-type") ?? "").trim().toLowerCase();
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment proof JSON body is required.",
          debugMessage: `Expected application/json, got: ${contentType || "(none)"}`,
        },
        { status: 400 },
      );
    }

    const bodyText = await req.text();
    if (!bodyText.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing files",
          debugMessage: "Empty JSON body from client",
        },
        { status: 400 },
      );
    }

    const headers = new Headers(upstreamAuthHeaders(req));
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
    headers.delete("content-length");

    let lastPayload: Awaited<ReturnType<typeof readUpstreamPayload>> | null = null;
    let lastStatus = 500;
    let lastUrl = "";

    for (const url of bookingDonePaymentProofsJsonUpstreamCandidates(
      leadType as CrmLeadType,
      leadId,
      recordId,
    )) {
      lastUrl = url;
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: bodyText,
        cache: "no-store",
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

      if (!isBookingDoneNotDeployedResponse(payload.text) && res.status !== 404 && res.status !== 405) {
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
      "Unable to upload payment proofs.",
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to upload payment proofs.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
