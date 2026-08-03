import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { LEAD_TYPE_TO_BASE } from "@/lib/crm-lead-endpoints";
import { readUpstreamPayload } from "@/lib/crm-proxy-error";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { fetchCrmUpstream, isUpstreamFetchTimeoutError } from "@/lib/crm-upstream-fetch";

/** Allow slow Hub AddLead responses in production (Vercel). */
export const maxDuration = 300;

/** BFF → Hub `POST /v1/AddLead` (plain-text cross-merge responses preserved). */
export async function POST(req: NextRequest) {
  const url = `${BASE_URL}${LEAD_TYPE_TO_BASE.addlead}`;
  const bodyText = await req.text();

  try {
    const res = await fetchCrmUpstream(url, {
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
  } catch (err) {
    console.error("[add-lead] upstream POST failed:", err);
    const timedOut = isUpstreamFetchTimeoutError(err);
    const userMessage = timedOut
      ? "Saving the lead is taking longer than usual (Hub may be slow). Please wait up to a few minutes and try again once."
      : "Could not reach the CRM server. Check your connection and try again.";
    return NextResponse.json(
      {
        success: false,
        userMessage,
        error: userMessage,
        debugMessage: err instanceof Error ? err.message : String(err),
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}
