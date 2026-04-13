import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

const BASE = process.env.NEXT_PUBLIC_CRM_API_BASE ?? "http://localhost:8081";

function targetUrl(req: NextRequest, segments: string[] | undefined): string {
  const suffix = segments?.length ? `/${segments.join("/")}` : "";
  const url = new URL(`${BASE}/v1/Appointment${suffix}`);
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
  method: string
): Promise<NextResponse> {
  const { path } = await ctx.params;
  const url = targetUrl(req, path);
  const headers: HeadersInit = {
    ...upstreamAuthHeaders(req),
    Accept: "application/json",
  };
  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD" && method !== "DELETE") {
    const ct = req.headers.get("Content-Type");
    if (ct) {
      (headers as Record<string, string>)["Content-Type"] = ct;
    } else {
      (headers as Record<string, string>)["Content-Type"] = "application/json";
    }
    body = await req.text();
  }
  const res = await fetch(url, { method, headers, body, cache: "no-store" });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

export function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx, "GET");
}

export function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx, "POST");
}

export function PUT(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx, "PUT");
}

export function DELETE(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(req, ctx, "DELETE");
}
