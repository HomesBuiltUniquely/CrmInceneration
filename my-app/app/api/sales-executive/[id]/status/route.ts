import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

/** Proxy: PUT /v1/SalesExecutive/{id}/status with raw boolean body. */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const url = `${BASE_URL}/v1/SalesExecutive/${encodeURIComponent(id)}/status`;
  const body = await req.text();
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...upstreamAuthHeaders(req),
      "Content-Type": req.headers.get("content-type") ?? "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
    body,
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
