import { NextRequest, NextResponse } from "next/server";
import { activitiesUrl, isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

const BASE = process.env.NEXT_PUBLIC_CRM_API_BASE ?? "http://localhost:8081";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> }
) {
  const { leadType, id } = await ctx.params;
  if (!isCrmLeadType(leadType)) {
    return NextResponse.json({ error: "Invalid leadType" }, { status: 400 });
  }
  const url = `${BASE}${activitiesUrl(leadType, id)}`;
  const res = await fetch(url, { headers: upstreamAuthHeaders(req), cache: "no-store" });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
