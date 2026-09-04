import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

/**
 * Hub lead-limits list can exceed 12s in production. Keep waiting so usage stats
 * can still arrive; the Admin UI already paints the user roster from a fast path.
 */
const UPSTREAM_TIMEOUT_MS = 90_000;

function buildUrl(req: NextRequest, path: string[]) {
  const joined = path.join("/");
  const q = req.nextUrl.searchParams.toString();
  return `${BASE_URL}/v1/lead-limits/${joined}${q ? `?${q}` : ""}`;
}

async function proxy(req: NextRequest, path: string[], method: string) {
  const headers = new Headers(upstreamAuthHeaders(req));
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const body =
    method === "GET" || method === "DELETE"
      ? undefined
      : await req.text();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(buildUrl(req, path), {
      method,
      headers,
      cache: "no-store",
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (e) {
    const aborted =
      (e instanceof DOMException && e.name === "AbortError") ||
      (e instanceof Error && e.name === "AbortError");
    if (aborted) {
      return NextResponse.json(
        {
          message: `Lead limits upstream timed out after ${Math.round(UPSTREAM_TIMEOUT_MS / 1000)}s`,
        },
        { status: 504 },
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path, "GET");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path, "POST");
}
