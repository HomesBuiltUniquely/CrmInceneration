import { NextRequest, NextResponse } from "next/server";
import { configurationScopeUpstreamBase } from "@/lib/crm-configuration-scope-proxy";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string; referenceId: string }> },
) {
  try {
    const { leadType, id, referenceId } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }
    const url = `${configurationScopeUpstreamBase(leadType, id)}/references/${encodeURIComponent(referenceId)}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    if (!res.ok) {
      return proxyJsonError(
        res.status,
        payload,
        "Unable to delete reference file. Please try again.",
      );
    }
    return new NextResponse(payload.text, {
      status: res.status,
      headers: { "Content-Type": payload.contentType },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to delete reference file. Please try again.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
