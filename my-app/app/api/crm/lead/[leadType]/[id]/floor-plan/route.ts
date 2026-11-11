import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { crmLeadTypeToFloorPlanLeadType } from "@/lib/floor-plan";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

function floorPlanUpstreamUrl(leadType: string, id: string): string {
  const segment = crmLeadTypeToFloorPlanLeadType(
    leadType as Parameters<typeof crmLeadTypeToFloorPlanLeadType>[0],
  );
  return `${BASE_URL}/v1/leads/${segment}/${id}/floor-plan`;
}

/**
 * Forward the browser multipart bytes as-is.
 * Re-parsing into a new FormData on Vercel/Node often drops or renames the file
 * part, and CRM then returns 400 "Floor plan file is required."
 */
function upstreamMultipartHeaders(req: NextRequest, contentType: string): Headers {
  const headers = new Headers(upstreamAuthHeaders(req));
  headers.set("Content-Type", contentType);
  headers.delete("content-length");
  return headers;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> },
) {
  try {
    const { leadType, id } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }
    const res = await fetch(floorPlanUpstreamUrl(leadType, id), {
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(
        res.status,
        payload,
        "Unable to load floor plan. Please try again.",
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
        error: "Unable to load floor plan. Please try again.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> },
) {
  try {
    const { leadType, id } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }

    const contentType = (req.headers.get("content-type") ?? "").trim();
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json(
        {
          success: false,
          error: "Floor plan file is required.",
          debugMessage: `Expected multipart/form-data, got: ${contentType || "(none)"}`,
        },
        { status: 400 },
      );
    }

    const body = await req.arrayBuffer();
    if (body.byteLength === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Floor plan file is required.",
          debugMessage: "Empty multipart body from client",
        },
        { status: 400 },
      );
    }

    const res = await fetch(floorPlanUpstreamUrl(leadType, id), {
      method: "POST",
      headers: upstreamMultipartHeaders(req, contentType),
      body,
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

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> },
) {
  try {
    const { leadType, id } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }
    const upstreamUrl = new URL(floorPlanUpstreamUrl(leadType, id));
    const index = req.nextUrl.searchParams.get("index");
    if (index != null && index.trim() !== "") upstreamUrl.searchParams.set("index", index.trim());
    const res = await fetch(upstreamUrl, {
      method: "DELETE",
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(
        res.status,
        payload,
        "Unable to remove floor plan. Please try again.",
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
        error: "Unable to remove floor plan. Please try again.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
