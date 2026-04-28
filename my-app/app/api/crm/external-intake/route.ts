import { NextRequest, NextResponse } from "next/server";

const EXTERNAL_INTAKE_URL =
  process.env.EXTERNAL_INTAKE_URL ??
  "http://api.hubinterior.com/api/leads/external-intake";
const EXTERNAL_LEAD_INGEST_API_KEY =
  process.env.EXTERNAL_LEAD_INGEST_API_KEY ?? "";

function maskValue(value: unknown): string {
  const str = String(value ?? "").trim();
  if (!str) return "";
  if (str.length <= 4) return "*".repeat(str.length);
  return `${"*".repeat(Math.max(0, str.length - 4))}${str.slice(-4)}`;
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  const requestId = `ext-intake-${Date.now().toString(36)}`;
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    parsed = null;
  }

  console.info("[external-intake] forwarding request", {
    requestId,
    externalLeadId: parsed?.externalLeadId ?? null,
    sourceProject: parsed?.sourceProject ?? null,
    contactNoMasked: maskValue(parsed?.contactNo),
    clientEmailMasked: maskValue(parsed?.clientEmail),
  });

  const res = await fetch(EXTERNAL_INTAKE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-external-api-key": EXTERNAL_LEAD_INGEST_API_KEY,
    },
    body: bodyText,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("[external-intake] upstream rejected request", {
      requestId,
      status: res.status,
      response: text,
      externalLeadId: parsed?.externalLeadId ?? null,
      sourceProject: parsed?.sourceProject ?? null,
    });
  } else {
    console.info("[external-intake] upstream accepted request", {
      requestId,
      status: res.status,
    });
  }
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
}
