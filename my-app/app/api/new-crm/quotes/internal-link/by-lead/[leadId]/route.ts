import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

const EXTERNAL_API_BASE = (
  process.env.NEXT_PUBLIC_API?.trim() || "https://api.hubinterior.com"
).replace(/\/+$/, "");

function buildProxyHeaders(req: NextRequest): HeadersInit {
  const upstream = upstreamAuthHeaders(req);
  const headers: Record<string, string> =
    upstream instanceof Headers
      ? Object.fromEntries(upstream.entries())
      : Array.isArray(upstream)
        ? Object.fromEntries(upstream)
        : { ...upstream };
  const apiKey = "hi";
  if (apiKey) {
    headers["x-external-api-key"] = apiKey;
  }
  return headers;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const id = leadId.trim();
  if (!id) {
    return NextResponse.json(
      { ok: false, message: "leadId is required" },
      { status: 400 },
    );
  }

  const res = await fetch(
    `${EXTERNAL_API_BASE}/api/new-crm/quotes/internal-link/by-lead/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: buildProxyHeaders(req),
      cache: "no-store",
    },
  );
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
}
