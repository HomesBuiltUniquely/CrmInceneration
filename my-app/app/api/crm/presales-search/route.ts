import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.toString();
  const url = `${BASE_URL}/v1/leads/presales-search${q ? `?${q}` : ""}`;
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
