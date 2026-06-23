import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { LEAD_TYPE_TO_BASE } from "@/lib/crm-lead-endpoints";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { readUpstreamPayload } from "@/lib/crm-proxy-error";

/** BFF → Hub `POST /v1/AddLead` (plain-text cross-merge responses preserved). */
export async function POST(req: NextRequest) {
  const url = `${BASE_URL}${LEAD_TYPE_TO_BASE.addlead}`;
  const bodyText = await req.text();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...upstreamAuthHeaders(req),
      "Content-Type": req.headers.get("Content-Type") ?? "application/json",
    },
    body: bodyText.length ? bodyText : "{}",
    cache: "no-store",
  });
  const payload = await readUpstreamPayload(res);
  return new NextResponse(payload.text, {
    status: res.status,
    headers: { "Content-Type": payload.contentType },
  });
}
