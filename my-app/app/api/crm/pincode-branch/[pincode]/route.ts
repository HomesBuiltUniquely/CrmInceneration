import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

/** Proxies `GET /v1/SalesExecutive/pincode/{pincode}/branch` (plain text branch). */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ pincode: string }> },
) {
  const { pincode } = await ctx.params;
  const encoded = encodeURIComponent(pincode.trim());
  const urls = [
    `${BASE_URL}/v1/SalesExecutive/pincode/${encoded}/branch`,
    `${BASE_URL}/SalesExecutive/pincode/${encoded}/branch`,
  ];
  let last: Response | null = null;
  for (const url of urls) {
    const res = await fetch(url, { cache: "no-store", headers: upstreamAuthHeaders(req) });
    if (res.ok) {
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: { "Content-Type": res.headers.get("Content-Type") ?? "text/plain" },
      });
    }
    last = res;
  }
  // Backend may return some fallback like DEFAULT for unknown pincodes.
  // In this proxy we treat failures as "no suggestion" and surface empty text
  // so the UI does not show or persist a synthetic DEFAULT branch value.
  const text = last ? await last.text() : "";
  return new NextResponse(text, {
    status: last?.status ?? 502,
    headers: { "Content-Type": "text/plain" },
  });
}
