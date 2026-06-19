import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { verifyUrl } from "@/lib/crm-lead-endpoints";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

/** Guide-aligned alias → Hub `POST /v1/WhatsappLead/verify/{id}`. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const url = `${BASE_URL}${verifyUrl("whatsapplead", id)}`;
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
  if (!res.ok) {
    return proxyJsonError(
      res.status,
      payload,
      "Unable to verify WhatsApp lead right now. Please try again.",
    );
  }
  return new NextResponse(payload.text, {
    status: res.status,
    headers: { "Content-Type": payload.contentType },
  });
}
