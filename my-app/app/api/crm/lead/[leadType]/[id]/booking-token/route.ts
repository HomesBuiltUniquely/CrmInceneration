import { NextRequest, NextResponse } from "next/server";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { crmLeadTypeToFloorPlanLeadType } from "@/lib/floor-plan";
import type { CrmLeadType } from "@/lib/leads-filter";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

function bookingTokenDeleteUpstreamCandidates(leadType: CrmLeadType, leadId: string): string[] {
  const type = encodeURIComponent(leadType);
  const id = encodeURIComponent(leadId);
  const short = encodeURIComponent(crmLeadTypeToFloorPlanLeadType(leadType));
  return [
    ...new Set([
      `${BASE_URL}/v1/leads/${type}/${id}/booking-token`,
      `${BASE_URL}/api/crm/lead/${type}/${id}/booking-token`,
      `${BASE_URL}/v1/leads/${short}/${id}/booking-token`,
    ]),
  ];
}

export async function DELETE(
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

    const paths = bookingTokenDeleteUpstreamCandidates(leadType as CrmLeadType, id);
    let lastPayload: Awaited<ReturnType<typeof readUpstreamPayload>> | null = null;
    let lastStatus = 500;

    for (let i = 0; i < paths.length; i += 1) {
      const res = await fetch(paths[i], {
        method: "DELETE",
        headers: upstreamAuthHeaders(req),
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
      if (i < paths.length - 1 && (res.status === 404 || res.status === 405)) {
        continue;
      }
      break;
    }

    return proxyJsonError(
      lastStatus,
      lastPayload!,
      "Unable to delete booking & token records for this lead.",
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to delete booking & token records for this lead.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
