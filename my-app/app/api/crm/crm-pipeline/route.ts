import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { PRESALES_PIPELINE_STAGE_ORDER } from "@/lib/presales-milestone";

/** Hub contract: one path `crm-pipeline` + `role` query (see docs/PRESALES_CRM_PIPELINE_BACKEND_HANDOFF.md). */
function buildUpstreamUrl(req: NextRequest): string[] {
  const q = req.nextUrl.searchParams.toString();
  const suffix = q ? `?${q}` : "";
  return [
    `${BASE_URL}/v1/Leads/crm-pipeline${suffix}`,
    `${BASE_URL}/Leads/crm-pipeline${suffix}`,
  ];
}

function isPresalesPipelineRole(role: string): boolean {
  const r = role.trim().toUpperCase();
  return r === "PRESALES_EXECUTIVE" || r === "PRE_SALES" || r === "PRESALES_MANAGER";
}

/** Lets SUPER_ADMIN dashboard render when Hub RBAC blocks presales pipeline read. */
function presalesPipelineFallbackJson() {
  return {
    entries: [] as Array<{ stage: string; stageCategory: string; subStageName: string }>,
    nested: PRESALES_PIPELINE_STAGE_ORDER.map((stage) => ({
      stage,
      categories: [] as Array<{ stageCategory: string; subStages: string[] }>,
    })),
    fallback: true,
    message:
      "Presales pipeline catalog unavailable for this token; using default stage shells.",
  };
}

export async function GET(req: NextRequest) {
  const headers = new Headers(upstreamAuthHeaders(req));
  headers.set("Accept", "application/json");
  const roleParam = (req.nextUrl.searchParams.get("role") ?? "").trim().toUpperCase();

  let lastStatus = 502;
  let lastBody = "";
  for (const url of buildUpstreamUrl(req)) {
    const res = await fetch(url, { method: "GET", headers, cache: "no-store" });
    lastStatus = res.status;
    lastBody = await res.text();
    if (res.ok) {
      return new NextResponse(lastBody, {
        status: 200,
        headers: {
          "Content-Type": res.headers.get("Content-Type") ?? "application/json",
        },
      });
    }
  }

  if (
    (lastStatus === 403 || lastStatus === 404) &&
    isPresalesPipelineRole(roleParam)
  ) {
    return NextResponse.json(presalesPipelineFallbackJson(), { status: 200 });
  }

  return NextResponse.json(
    {
      entries: [],
      nested: [],
      message: `CRM pipeline failed: HTTP ${lastStatus}`,
      upstream: lastBody.slice(0, 500),
    },
    { status: lastStatus >= 400 ? lastStatus : 502 },
  );
}
