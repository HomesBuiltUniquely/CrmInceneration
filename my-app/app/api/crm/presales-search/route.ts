import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

const BASE = (process.env.NEXT_PUBLIC_CRM_API_BASE ?? "http://localhost:8081").replace(/\/$/, "");

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.toString();
  const url = `${BASE}/v1/leads/presales-search${q ? `?${q}` : ""}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: upstreamAuthHeaders(req),
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
