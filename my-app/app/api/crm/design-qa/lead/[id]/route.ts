import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

const BASE = process.env.NEXT_PUBLIC_CRM_API_BASE ?? "http://localhost:8081";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const url = `${BASE}/api/design-qa/lead/${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: upstreamAuthHeaders(_req), cache: "no-store" });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
