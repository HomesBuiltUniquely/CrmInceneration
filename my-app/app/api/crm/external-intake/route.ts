import { NextRequest, NextResponse } from "next/server";

const EXTERNAL_INTAKE_URL =
  process.env.EXTERNAL_INTAKE_URL ??
  "http://api.hubinterior.com/api/leads/external-intake";
const EXTERNAL_LEAD_INGEST_API_KEY =
  process.env.EXTERNAL_LEAD_INGEST_API_KEY ?? "";

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
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
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
}
