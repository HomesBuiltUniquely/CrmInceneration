import { NextResponse } from "next/server";

const DESIGN_MODULE_URL = (
  process.env.DESIGN_MODULE_URL?.trim() || "http://localhost:3001"
).replace(/\/+$/, "");

export async function GET() {
  const targetUrl = `${DESIGN_MODULE_URL}/api/designers`;
  console.log(`[CRM /api/crm/designers] → fetching from: ${targetUrl}`);

  try {
    const res = await fetch(targetUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const text = await res.text();
    console.log(`[CRM /api/crm/designers] ← status: ${res.status}, body: ${text.slice(0, 200)}`);

    // Always return 200 with whatever Design Module sends (it returns { designers: [] } on error)
    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    // Network error — Design Module not running
    console.error(`[CRM /api/crm/designers] Design Module unreachable (${DESIGN_MODULE_URL}):`, err?.message);
    return NextResponse.json({ designers: [] }, { status: 200 });
  }
}
