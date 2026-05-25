import { NextRequest } from "next/server";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { proxyFloorPlanStream } from "@/lib/crm-floor-plan-proxy";
import { NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ leadType: string; id: string }> },
) {
  try {
    const { leadType, id } = await ctx.params;
    if (!isCrmLeadType(leadType)) {
      return NextResponse.json({ success: false, error: "Invalid leadType" }, { status: 400 });
    }
    return proxyFloorPlanStream(req, leadType, id, "content");
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to load floor plan. Please try again.",
        debugMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
