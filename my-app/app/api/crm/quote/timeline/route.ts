import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

export const maxDuration = 30;

function upstreamMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const row = payload as Record<string, unknown>;
  const message = row.message ?? row.error ?? row.userMessage;
  return typeof message === "string" && message.trim() ? message.trim() : fallback;
}

/** Proxies `GET /v1/quote/timeline?leadType=&leadId=`. */
export async function GET(req: NextRequest) {
  try {
    const leadId = (req.nextUrl.searchParams.get("leadId") ?? "").trim();
    const leadType = (req.nextUrl.searchParams.get("leadType") ?? "").trim();
    if (!leadId || !leadType) {
      return NextResponse.json(
        { success: false, error: "leadId and leadType are required." },
        { status: 400 },
      );
    }

    const url = new URL(`${BASE_URL}/v1/quote/timeline`);
    url.searchParams.set("leadId", leadId);
    url.searchParams.set("leadType", leadType);

    const res = await fetch(url, {
      headers: { ...upstreamAuthHeaders(req), Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    let payload: unknown = {};
    if (text.trim()) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = {};
      }
    }
    if (!res.ok) {
      const fallback =
        res.status === 401
          ? "Unauthorized"
          : res.status === 400
            ? "leadId and leadType are required."
            : "Could not load quote timeline.";
      return NextResponse.json(
        { success: false, error: upstreamMessage(payload, fallback) },
        { status: res.status },
      );
    }

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not load quote timeline." },
      { status: 500 },
    );
  }
}
