import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { activityUrl, isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> }
) {
  const { leadType, id } = await ctx.params;
  if (!isCrmLeadType(leadType)) {
    return NextResponse.json({ error: "Invalid leadType" }, { status: 400 });
  }
  const url = `${BASE_URL}${activityUrl(leadType, id)}`;
  const body = await req.text();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...upstreamAuthHeaders(req),
      "Content-Type": req.headers.get("Content-Type") ?? "application/json",
    },
    body,
    cache: "no-store",
  });
  const payload = await readUpstreamPayload(res);
  if (!res.ok) {
    return proxyJsonError(
      res.status,
      payload,
      "Unable to save note activity. Please try again.",
    );
  }
  return new NextResponse(payload.text, {
    status: res.status,
    headers: { "Content-Type": payload.contentType || "text/plain" },
  });
}
