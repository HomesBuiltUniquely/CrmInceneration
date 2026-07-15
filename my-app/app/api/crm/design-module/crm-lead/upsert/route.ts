import { NextRequest, NextResponse } from "next/server";

const DESIGN_MODULE_URL = (
  process.env.DESIGN_MODULE_URL?.trim() ||
  process.env.NEXT_PUBLIC_API?.trim() ||
  "https://api.hubinterior.com"
).replace(/\/+$/, "");
const HUB_SYNC_API_KEY =
  process.env.HUB_SYNC_API_KEY?.trim() ||
  process.env.EXTERNAL_LEAD_INGEST_API_KEY?.trim() ||
  "hi";

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    parsed = null;
  }

  const url = `${DESIGN_MODULE_URL}/api/hub/crm-lead/upsert`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": HUB_SYNC_API_KEY,
      },
      body: bodyText,
      cache: "no-store",
    });
    const text = await res.text();

    if (!res.ok) {
      console.warn("[design-module/crm-lead/upsert] upstream rejected", {
        url,
        status: res.status,
        leadType: parsed?.leadType ?? null,
        leadId: parsed?.leadId ?? null,
        leadIdentifier: parsed?.leadIdentifier ?? parsed?.externalLeadId ?? null,
        response: text.slice(0, 500),
      });
    }

    return new NextResponse(text || JSON.stringify({ success: res.ok }), {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[design-module/crm-lead/upsert] unreachable", { url, message });
    return NextResponse.json(
      {
        success: false,
        error: `Design Module unreachable at ${DESIGN_MODULE_URL}. Set DESIGN_MODULE_URL or start the Design Module service.`,
        debugMessage: message,
      },
      { status: 503 },
    );
  }
}
