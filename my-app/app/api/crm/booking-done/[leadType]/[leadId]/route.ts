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

async function proxyBookingDoneToHub(
  req: NextRequest,
  leadType: CrmLeadType,
  leadId: string,
  method: "GET" | "POST",
  body?: string,
) {
  const headers: HeadersInit = {
    ...upstreamAuthHeaders(req),
    ...(method === "POST"
      ? { "Content-Type": req.headers.get("Content-Type") ?? "application/json" }
      : {}),
  };

  let lastPayload: Awaited<ReturnType<typeof readUpstreamPayload>> | null = null;
  let lastStatus = 500;
  let lastUrl = "";

  for (const url of bookingDoneUpstreamCandidates(leadType, leadId)) {
    lastUrl = url;
    const res = await fetch(url, {
      method,
      headers,
      body: method === "POST" ? body : undefined,
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
    method === "GET" ? "Unable to load booking records." : "Unable to submit Booking Done record.",
  );
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; leadId: string }> },
) {
  try {
    const { leadType, leadId } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }
    return proxyBookingDoneToHub(req, leadType, leadId, "GET");
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to load booking records.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; leadId: string }> },
) {
  try {
    const { leadType, leadId } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }
    const body = await req.text();
    return proxyBookingDoneToHub(req, leadType, leadId, "POST", body);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to submit Booking Done record.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
