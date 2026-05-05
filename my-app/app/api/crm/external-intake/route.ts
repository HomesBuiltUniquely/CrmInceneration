import { NextRequest, NextResponse } from "next/server";

const DEFAULT_EXTERNAL_INTAKE_URL =
  "https://api.hubinterior.com/api/leads/external-intake";
const EXTERNAL_INTAKE_URL = (() => {
  const configured = process.env.EXTERNAL_INTAKE_URL?.trim();
  if (!configured) return DEFAULT_EXTERNAL_INTAKE_URL;
  try {
    const url = new URL(configured);
    const normalizedPath = url.pathname.replace(/\/+$/, "");
    // Guard against misconfigured routes like /api/leads/{id}/...
    if (normalizedPath === "/api/leads/external-intake") return configured;
  } catch {
    // fall back to default
  }
  return DEFAULT_EXTERNAL_INTAKE_URL;
})();
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
    outboundUrl: EXTERNAL_INTAKE_URL,
    externalLeadId: parsed?.externalLeadId ?? null,
    sourceProject: parsed?.sourceProject ?? null,
    appointmentDate: parsed?.appointmentDate ?? null,
    hasAppointmentSlot: Boolean(
      typeof parsed?.appointmentSlot === "string" && parsed.appointmentSlot.trim(),
    ),
    scheduleTimezone: parsed?.scheduleTimezone ?? null,
    hasDesignerName: Boolean(
      typeof parsed?.designerName === "string" && parsed.designerName.trim(),
    ),
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
      outboundUrl: EXTERNAL_INTAKE_URL,
      status: res.status,
      response: text,
      externalLeadId: parsed?.externalLeadId ?? null,
      sourceProject: parsed?.sourceProject ?? null,
    });
  } else {
    console.info("[external-intake] upstream accepted request", {
      requestId,
      outboundUrl: EXTERNAL_INTAKE_URL,
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
