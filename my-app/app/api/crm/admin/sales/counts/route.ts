import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { fetchAdminSalesCountsViaMergeFallback } from "@/lib/admin-pool-merge-fallback";
import { isHubNoResourceResponse } from "@/lib/hub-no-resource";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.toString();
  const url = `${BASE_URL}/v1/leads/admin/sales/counts${q ? `?${q}` : ""}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: upstreamAuthHeaders(req),
  });
  const text = await res.text();
  if (isHubNoResourceResponse(res.status, text)) {
    try {
      const fallback = await fetchAdminSalesCountsViaMergeFallback(req, req.nextUrl.searchParams);
      return NextResponse.json({ ...fallback, fallback: "mergeAll" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Admin sales counts fallback failed";
      return NextResponse.json({ success: false, error: message }, { status: 502 });
    }
  }
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
