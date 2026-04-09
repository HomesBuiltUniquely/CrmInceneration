import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

const BASE = (process.env.NEXT_PUBLIC_CRM_API_BASE ?? "http://localhost:8081").replace(/\/$/, "");

function buildUrl(req: NextRequest, path: string[]) {
  const joined = path.join("/");
  const q = req.nextUrl.searchParams.toString();
  return `${BASE}/v1/assignment/${joined}${q ? `?${q}` : ""}`;
}

async function proxy(req: NextRequest, path: string[], method: string) {
  const headers = new Headers(upstreamAuthHeaders(req));
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const body =
    method === "GET" || method === "DELETE"
      ? undefined
      : await req.text();

  const res = await fetch(buildUrl(req, path), {
    method,
    headers,
    cache: "no-store",
    body,
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path, "GET");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path, "POST");
}
