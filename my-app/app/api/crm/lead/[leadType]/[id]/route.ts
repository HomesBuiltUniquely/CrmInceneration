import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { detailsUrl, isCrmLeadType, leadDeletePaths, leadUpdatePutPaths } from "@/lib/crm-lead-endpoints";
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
    const body = await req.text();
    const putHeaders = {
      ...upstreamAuthHeaders(req),
      "Content-Type": req.headers.get("Content-Type") ?? "application/json",
    };
    const paths = leadUpdatePutPaths(leadType, id);
    let lastPayload: Awaited<ReturnType<typeof readUpstreamPayload>> | null = null;
    let lastStatus = 500;

    for (let i = 0; i < paths.length; i += 1) {
      const url = `${BASE_URL}${paths[i]}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: putHeaders,
        body,
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
      // Only try alternate Hub paths when primary is missing (404/405).
      if (i < paths.length - 1 && (res.status === 404 || res.status === 405)) {
        continue;
      }
      break;
    }

    const payload = lastPayload!;
    if (payload.text.trim()) {
      return new NextResponse(payload.text, {
        status: lastStatus,
        headers: { "Content-Type": payload.contentType },
      });
    }
    return proxyJsonError(
      lastStatus,
      payload,
      "Unable to save lead details. Please try again.",
    );
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
    const paths = leadDeletePaths(leadType, id);
    let lastPayload: Awaited<ReturnType<typeof readUpstreamPayload>> | null = null;
    let lastStatus = 500;

    for (let i = 0; i < paths.length; i += 1) {
      const url = `${BASE_URL}${paths[i]}`;
      const res = await fetch(url, {
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
      "Unable to delete lead right now. Please try again.",
    );
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
