import { NextRequest, NextResponse } from "next/server";

const DESIGN_MODULE_BASE_URL = (
  process.env.DESIGN_MODULE_BASE_URL?.trim() || "http://localhost:3001"
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

  const url = `${DESIGN_MODULE_BASE_URL}/api/hub/crm-lead/upsert`;
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
      response: text,
    });
  }

  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
}
