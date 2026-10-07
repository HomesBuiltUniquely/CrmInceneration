import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import {
  hubCreatePathForLeadType,
  isCreatableLeadType,
} from "@/lib/create-lead-sources";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { readUpstreamPayload } from "@/lib/crm-proxy-error";

/**
 * Unified create → Hub `POST {LEAD_TYPE_TO_BASE[leadType]}`.
 * Query: `?leadType=quikrlead` (required).
 * Meta (`mlead`): Hub allows Super Admin manual create; others get 410 upstream.
 */
export async function POST(req: NextRequest) {
  const leadType = (req.nextUrl.searchParams.get("leadType") ?? "").trim().toLowerCase();
  if (!leadType) {
    return NextResponse.json(
      { message: "leadType query param is required (e.g. addlead, quikrlead, glead, mlead)." },
      { status: 400 },
    );
  }
  if (!isCreatableLeadType(leadType)) {
    return NextResponse.json(
      {
        message:
          "Invalid leadType for create. Use one of: formlead, glead, mlead, addlead, quikrlead, ivrlead, websitelead, walkinlead, whatsapplead",
      },
      { status: 400 },
    );
  }

  const url = `${BASE_URL}${hubCreatePathForLeadType(leadType)}`;
  const bodyText = await req.text();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...upstreamAuthHeaders(req),
      "Content-Type": req.headers.get("Content-Type") ?? "application/json",
    },
    body: bodyText.length ? bodyText : "{}",
  });
  const payload = await readUpstreamPayload(res);
  return new NextResponse(payload.text, {
    status: res.status,
    headers: { "Content-Type": payload.contentType },
  });
}
