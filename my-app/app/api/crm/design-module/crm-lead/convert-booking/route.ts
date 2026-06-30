import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { syncConvertBookingToDesignModule } from "@/lib/design-module-hub-sync";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { recordId?: string };
    const recordId = String(body.recordId ?? "").trim();
    if (!recordId) {
      return NextResponse.json({ message: "recordId is required" }, { status: 400 });
    }

    const result = await syncConvertBookingToDesignModule(
      recordId,
      upstreamAuthHeaders(req),
      req.nextUrl.origin,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync convert booking to Design Module";
    console.warn("[design-module/crm-lead/convert-booking]", message);
    return NextResponse.json({ message }, { status: 502 });
  }
}
