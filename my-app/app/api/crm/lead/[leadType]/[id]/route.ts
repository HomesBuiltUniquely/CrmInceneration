import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { detailsUrl, isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> }
) {
  try {
    const { leadType, id } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ error: "Invalid leadType" }, { status: 400 });
    }
    const url = `${BASE_URL}${detailsUrl(leadType, id)}`;
    const res = await fetch(url, {
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(
        res.status,
        payload,
        "Unable to load lead details. Please try again.",
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
        userMessage: "Unable to load lead details. Please try again.",
        error: "Unable to load lead details. Please try again.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> }
) {
  try {
    const { leadType, id } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ error: "Invalid leadType" }, { status: 400 });
    }
    const url = `${BASE_URL}${detailsUrl(leadType, id)}`;
    const body = await req.text();
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        ...upstreamAuthHeaders(req),
        "Content-Type": req.headers.get("Content-Type") ?? "application/json",
      },
      body,
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      if (payload.text.trim()) {
        return new NextResponse(payload.text, {
          status: res.status,
          headers: { "Content-Type": payload.contentType },
        });
      }
      return proxyJsonError(
        res.status,
        payload,
        "Unable to save lead details. Please try again.",
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
        userMessage: "Unable to save lead details. Please try again.",
        error: "Unable to save lead details. Please try again.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> }
) {
  try {
    const { leadType, id } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ error: "Invalid leadType" }, { status: 400 });
    }
    const url = `${BASE_URL}${detailsUrl(leadType, id)}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(
        res.status,
        payload,
        "Unable to delete lead right now. Please try again.",
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
        userMessage: "Unable to delete lead right now. Please try again.",
        error: "Unable to delete lead right now. Please try again.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
