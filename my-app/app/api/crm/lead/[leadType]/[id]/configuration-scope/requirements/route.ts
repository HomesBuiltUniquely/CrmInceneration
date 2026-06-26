import { NextRequest, NextResponse } from "next/server";
import { configurationScopeUpstreamBase } from "@/lib/crm-configuration-scope-proxy";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

function requirementsUpstreamUrl(leadType: string, id: string): string {
  return `${configurationScopeUpstreamBase(leadType as Parameters<typeof configurationScopeUpstreamBase>[0], id)}/requirements`;
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
    const res = await fetch(requirementsUpstreamUrl(leadType, id), {
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(
        res.status,
        payload,
        "Unable to load requirement scope. Please try again.",
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
        error: "Unable to load requirement scope. Please try again.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> },
) {
  try {
    const { leadType, id } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }
    const body = await req.text();
    const res = await fetch(requirementsUpstreamUrl(leadType, id), {
      method: "PUT",
      headers: {
        ...upstreamAuthHeaders(req),
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(
        res.status,
        payload,
        "Unable to save requirement scope. Please try again.",
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
        error: "Unable to save requirement scope. Please try again.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
