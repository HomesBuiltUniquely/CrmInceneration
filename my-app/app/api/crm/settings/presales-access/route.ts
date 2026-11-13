import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

const UPSTREAM = `${BASE_URL}/api/crm/settings/presales-access`;

/** Proxies Hub `GET /api/crm/settings/presales-access` (Super Admin). */
export async function GET(req: NextRequest) {
  try {
    const res = await fetch(UPSTREAM, {
      method: "GET",
      headers: {
        ...upstreamAuthHeaders(req),
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(
        res.status,
        payload,
        "Unable to load Presales access setting.",
      );
    }
    return new NextResponse(payload.text, {
      status: res.status,
      headers: { "Content-Type": payload.contentType },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load Presales access setting.";
    return NextResponse.json({ success: false, message }, { status: 502 });
  }
}

/** Proxies Hub `PUT /api/crm/settings/presales-access` (Super Admin). */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.text();
    const res = await fetch(UPSTREAM, {
      method: "PUT",
      headers: {
        ...upstreamAuthHeaders(req),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(
        res.status,
        payload,
        "Unable to update Presales access setting.",
      );
    }
    return new NextResponse(payload.text, {
      status: res.status,
      headers: { "Content-Type": payload.contentType },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update Presales access setting.";
    return NextResponse.json({ success: false, message }, { status: 502 });
  }
}
