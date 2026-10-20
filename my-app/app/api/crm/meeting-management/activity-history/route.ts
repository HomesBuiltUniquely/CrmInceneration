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

    const url = new URL(`${BASE_URL}/v1/meetings/activity-history`);
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
      const fallback = res.status === 401 ? "Unauthorized" : res.status === 400 ? "leadId and leadType are required." : "Could not load activity history.";
      return NextResponse.json(
        { success: false, error: upstreamMessage(payload, fallback) },
        { status: res.status },
      );
    }

    const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    return NextResponse.json({
      leadId: body.leadId ?? Number(leadId),
      leadType: typeof body.leadType === "string" ? body.leadType : leadType,
      activities: Array.isArray(body.activities) ? body.activities : [],
    });
  } catch {
    return NextResponse.json({ success: false, error: "Could not load activity history." }, { status: 500 });
  }
}
