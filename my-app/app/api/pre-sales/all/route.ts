import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

/** Proxy: GET /v1/PreSales/all — includes inactive executives for admin roles. */
export async function GET(req: NextRequest) {
  const url = `${BASE_URL}/v1/PreSales/all`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...upstreamAuthHeaders(req),
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
