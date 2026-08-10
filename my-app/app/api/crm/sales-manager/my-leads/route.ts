import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders, withActAsUserHeaders } from "@/lib/crm-proxy-auth";

export async function GET(req: NextRequest) {
  const params = new URLSearchParams(req.nextUrl.searchParams);
  const actAs = Number(
    (params.get("actAsUserId") ?? params.get("salesManagerId") ?? params.get("managerUserId") ?? "").trim(),
  );
  if (Number.isFinite(actAs) && actAs > 0) {
    if (!params.get("salesManagerId")) params.set("salesManagerId", String(actAs));
    if (!params.get("managerUserId")) params.set("managerUserId", String(actAs));
  }
  const q = params.toString();
  const url = `${BASE_URL}/v1/leads/sales-manager/my-leads${q ? `?${q}` : ""}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: withActAsUserHeaders(upstreamAuthHeaders(req), actAs),
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
