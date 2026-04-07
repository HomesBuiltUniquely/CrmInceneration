import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

const BASE = process.env.NEXT_PUBLIC_CRM_API_BASE ?? "http://localhost:8081";

/** Proxies filtered milestone counts, preferring `/v1/Leads` and falling back to `/Leads`. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.toString();
  const headers = upstreamAuthHeaders(req);
  const candidates = [
    `${BASE}/v1/Leads/crm-milestone-counts-filtered${q ? `?${q}` : ""}`,
    `${BASE}/Leads/crm-milestone-counts-filtered${q ? `?${q}` : ""}`,
  ];

  let last: Response | null = null;
  for (const url of candidates) {
    const res = await fetch(url, { cache: "no-store", headers });
    if (res.ok) {
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
      });
    }
    last = res;
  }

  const text = last ? await last.text() : JSON.stringify({ error: "No upstream response" });
  return new NextResponse(text, {
    status: last?.status ?? 502,
    headers: { "Content-Type": last?.headers.get("Content-Type") ?? "application/json" },
  });
}
