import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

const BASE = (process.env.NEXT_PUBLIC_CRM_API_BASE ?? "http://localhost:8081").replace(/\/$/, "");

function buildUrl(req: NextRequest, path: string[]) {
  const joined = path.join("/");
  const q = req.nextUrl.searchParams.toString();
  return `${BASE}/api/admin/${joined}${q ? `?${q}` : ""}`;
}

async function proxy(req: NextRequest, path: string[], method: string) {
  const url = buildUrl(req, path);
  const headers = upstreamAuthHeaders(req);
  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  const body =
    method === "GET" || method === "DELETE"
      ? undefined
      : await req.text();

  const res = await fetch(url, {
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

export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path, "PUT");
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path, "DELETE");
}
