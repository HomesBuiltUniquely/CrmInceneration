import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

function targetUrl(req: NextRequest, path: string[] | undefined): string {
  const suffix = path?.length ? `/${path.join("/")}` : "";
  const url = new URL(`${BASE_URL}/api/google-calendar${suffix}`);
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
  method: "GET" | "POST"
): Promise<NextResponse> {
  const { path } = await ctx.params;
  const url = targetUrl(req, path);
  const headers: HeadersInit = { ...upstreamAuthHeaders(req), Accept: "application/json" };
  let body: BodyInit | undefined;
  if (method === "POST") {
    const ct = req.headers.get("Content-Type");
    if (ct) (headers as Record<string, string>)["Content-Type"] = ct;
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
