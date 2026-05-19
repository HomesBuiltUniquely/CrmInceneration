import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadType: string; leadId: string }> },
) {
  const { leadType, leadId } = await params;
  const lt = leadType.trim().toLowerCase();
  const id = leadId.trim();
  if (!lt || !id) {
    return NextResponse.json(
      { success: false, message: "leadType and leadId are required" },
      { status: 400 },
    );
  }

  const res = await fetch(
    `${BASE_URL}/api/new-crm/closure-context/${encodeURIComponent(lt)}/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    },
  );
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
}
