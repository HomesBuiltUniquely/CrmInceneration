import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { LEAD_TYPE_TO_BASE } from "@/lib/crm-lead-endpoints";
import { readUpstreamPayload } from "@/lib/crm-proxy-error";

const EXTERNAL_LEAD_INGEST_API_KEY =
  process.env.EXTERNAL_LEAD_INGEST_API_KEY?.trim() ?? "";

function isInboundAuthorized(req: NextRequest): boolean {
  if (!EXTERNAL_LEAD_INGEST_API_KEY) return false;
  const provided =
    req.headers.get("x-external-api-key")?.trim() ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return provided === EXTERNAL_LEAD_INGEST_API_KEY;
}

/**
 * MSG91 / Meet webhook → Hub `POST /v1/WhatsappLead`.
 * CRM UI must not call this from the browser — server middleware only.
 */
export async function POST(req: NextRequest) {
  if (!isInboundAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyText = await req.text();
  const url = `${BASE_URL}${LEAD_TYPE_TO_BASE.whatsapplead}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": req.headers.get("Content-Type") ?? "application/json",
      "x-external-api-key": EXTERNAL_LEAD_INGEST_API_KEY,
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
