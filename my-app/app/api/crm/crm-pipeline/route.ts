import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

function buildUpstreamUrl(req: NextRequest): string[] {
  const q = req.nextUrl.searchParams.toString();
  const suffix = q ? `?${q}` : "";
  const role = (req.nextUrl.searchParams.get("role") ?? "").trim().toUpperCase();
  const pathStem =
    role === "PRESALES_EXECUTIVE" ? "presales-crm-pipeline" : "crm-pipeline";
  return [
    `${BASE_URL}/v1/Leads/${pathStem}${suffix}`,
    `${BASE_URL}/Leads/${pathStem}${suffix}`,
  ];
}

export async function GET(req: NextRequest) {
  const headers = new Headers(upstreamAuthHeaders(req));
  headers.set("Accept", "application/json");

  let lastStatus = 502;
  for (const url of buildUpstreamUrl(req)) {
    const res = await fetch(url, { method: "GET", headers, cache: "no-store" });
    lastStatus = res.status;
    if (res.ok) {
      const text = await res.text();
      return new NextResponse(text, {
        status: 200,
        headers: {
          "Content-Type": res.headers.get("Content-Type") ?? "application/json",
        },
      });
    }
  }

  return NextResponse.json(
    { entries: [], nested: [], message: `CRM pipeline failed: HTTP ${lastStatus}` },
    { status: lastStatus >= 400 ? lastStatus : 502 },
  );
}
