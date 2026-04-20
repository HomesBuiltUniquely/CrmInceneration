import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

/** Proxy: GET /v1/SalesExecutive/all — JWT-scoped list (Sales Manager sees only their team). */
export async function GET(req: NextRequest) {
  const candidates = [`${BASE_URL}/v1/SalesExecutive/all`, `${BASE_URL}/SalesExecutive/all`];
  let last: Response | null = null;
  for (const url of candidates) {
    const res = await fetch(url, { headers: upstreamAuthHeaders(req), cache: "no-store" });
    if (res.ok) {
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
      });
    }
    last = res;
  }
  const text = last ? await last.text() : "";
  return new NextResponse(text || JSON.stringify({ error: "Upstream failed" }), {
    status: last?.status ?? 502,
    headers: { "Content-Type": "application/json" },
  });
}
