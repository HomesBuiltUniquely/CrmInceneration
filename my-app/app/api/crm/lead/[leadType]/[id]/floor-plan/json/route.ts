import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";
import { crmLeadTypeToFloorPlanLeadType } from "@/lib/floor-plan";

export const maxDuration = 60;

function floorPlanJsonUpstreamUrl(leadType: string, id: string): string {
  const segment = crmLeadTypeToFloorPlanLeadType(
    leadType as Parameters<typeof crmLeadTypeToFloorPlanLeadType>[0],
  );
  return `${BASE_URL}/v1/leads/${segment}/${id}/floor-plan/json`;
}

/**
 * Preferred floor-plan upload through Vercel BFF.
 * Forwards JSON + base64 as-is — never converts to multipart (avoids Tomcat parse 400s).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> },
) {
  try {
    const { leadType, id } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }

    const contentType = (req.headers.get("content-type") ?? "").trim().toLowerCase();
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          success: false,
          error: "Floor plan JSON body is required.",
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
          error: "Floor plan file is required.",
          debugMessage: "Empty JSON body from client",
        },
        { status: 400 },
      );
    }

    const headers = new Headers(upstreamAuthHeaders(req));
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
    headers.delete("content-length");

    const res = await fetch(floorPlanJsonUpstreamUrl(leadType, id), {
      method: "POST",
      headers,
      body: bodyText,
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(
        res.status,
        payload,
        "Unable to upload floor plan. Please try again.",
      );
    }
    return new NextResponse(payload.text, {
      status: res.status,
      headers: { "Content-Type": payload.contentType },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to upload floor plan. Please try again.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
