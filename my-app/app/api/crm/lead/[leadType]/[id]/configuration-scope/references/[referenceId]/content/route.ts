import { NextRequest, NextResponse } from "next/server";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { proxyConfigurationScopeReferenceContent } from "@/lib/crm-configuration-scope-proxy";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string; referenceId: string }> },
) {
  try {
    const { leadType, id, referenceId } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }
    return proxyConfigurationScopeReferenceContent(req, leadType, id, referenceId);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to load reference file. Please try again.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
