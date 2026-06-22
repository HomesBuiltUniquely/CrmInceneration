import { NextResponse } from "next/server";

const DESIGN_MODULE_URL = (
  process.env.DESIGN_MODULE_URL?.trim() || "http://localhost:3001"
).replace(/\/+$/, "");

const DESIGN_MODULE_API_KEY = process.env.DESIGN_MODULE_API_KEY || "";

export async function GET() {
  try {
    const headers: HeadersInit = {
      Accept: "application/json",
    };
    if (DESIGN_MODULE_API_KEY) {
      (headers as Record<string, string>)["x-api-key"] = DESIGN_MODULE_API_KEY;
    }

    const res = await fetch(`${DESIGN_MODULE_URL}/api/designers`, {
      headers,
      cache: "no-store",
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[CRM /api/crm/designers] fetch error:", err);
    return NextResponse.json(
      { message: "Could not load designers", error: err?.message },
      { status: 502 }
    );
  }
}
