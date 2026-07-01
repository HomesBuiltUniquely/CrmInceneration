import { NextRequest, NextResponse } from "next/server";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import {
  BOOKING_DONE_NOT_DEPLOYED_MESSAGE,
  bookingDoneUpstreamCandidates,
  isBookingDoneNotDeployedResponse,
} from "@/lib/booking-done-upstream";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";
import type { CrmLeadType } from "@/lib/leads-filter";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; leadId: string; recordId: string }> },
) {
  try {
    const { leadType, leadId, recordId } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }

    const incoming = await req.formData();
    const upstreamForm = new FormData();
    let fileCount = 0;
    for (const [key, value] of incoming.entries()) {
      if (key !== "files" || !(value instanceof Blob) || value.size === 0) continue;
      const name = value instanceof File ? value.name : `payment-proof-${fileCount + 1}`;
      upstreamForm.append("files", value, name);
      fileCount += 1;
    }

    if (fileCount === 0) {
      return NextResponse.json({ success: false, error: "Missing files" }, { status: 400 });
    }

    let lastPayload: Awaited<ReturnType<typeof readUpstreamPayload>> | null = null;
    let lastStatus = 500;
    let lastUrl = "";

    for (const url of bookingDoneUpstreamCandidates(
      leadType as CrmLeadType,
      leadId,
      recordId,
    )) {
      lastUrl = url;
      const res = await fetch(url, {
        method: "POST",
        headers: upstreamAuthHeaders(req),
        body: upstreamForm,
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
