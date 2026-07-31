import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { fetchDesignModuleQuoteAcrossUpstreams } from "@/lib/design-module-quote-upstream";

function buildProxyHeaders(req: NextRequest): HeadersInit {
  const upstream = upstreamAuthHeaders(req);
  const headers: Record<string, string> =
    upstream instanceof Headers
      ? Object.fromEntries(upstream.entries())
      : Array.isArray(upstream)
        ? Object.fromEntries(upstream)
        : { ...upstream };
  const apiKey = process.env.EXTERNAL_LEAD_INGEST_API_KEY?.trim();
  if (apiKey) {
    headers["x-external-api-key"] = apiKey;
  }
  return headers;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const id = leadId.trim();
  if (!id) {
    return NextResponse.json(
      { ok: false, message: "leadId is required" },
      { status: 400 },
    );
  }

  try {
    const attempt = await fetchDesignModuleQuoteAcrossUpstreams({
      path: `/api/new-crm/quotes/internal-link/by-lead/${encodeURIComponent(id)}`,
      alternatePaths: [`/api/crm/quotes/internal-link/${encodeURIComponent(id)}`],
      headers: buildProxyHeaders(req),
    });
    return new NextResponse(attempt.text, {
      status: attempt.status,
      headers: {
        "Content-Type": attempt.contentType ?? "application/json",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to reach Design Module quote API.";
    return NextResponse.json({ ok: false, message }, { status: 502 });
  }
}
