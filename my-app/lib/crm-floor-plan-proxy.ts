import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { crmLeadTypeToFloorPlanLeadType } from "@/lib/floor-plan";
import type { CrmLeadType } from "@/lib/leads-filter";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

const SEGMENT_TO_CRM: Record<string, CrmLeadType> = {
  glead: "glead",
  mlead: "mlead",
  website: "websitelead",
  form: "formlead",
  add: "addlead",
  walkin: "walkinlead",
};

export function crmFloorPlanContentProxyPath(leadType: CrmLeadType, id: string): string {
  return `/api/crm/lead/${leadType}/${id}/floor-plan/content`;
}

export function crmFloorPlanOpenProxyPath(leadType: CrmLeadType, id: string): string {
  return `/api/crm/lead/${leadType}/${id}/floor-plan/open`;
}

/** Map backend `/v1/leads/{segment}/{id}/floor-plan/...` → Next CRM proxy path. */
export function backendFloorPlanPathToProxy(
  path: string,
  fallbackLeadType: CrmLeadType,
  fallbackId: string,
): string | null {
  const t = path.trim();
  if (!t) return null;
  if (t.startsWith("/api/crm/")) return t;

  const match = t.match(/\/v1\/leads\/([^/]+)\/(\d+)\/floor-plan\/(content|open)\/?$/i);
  if (match) {
    const crmLt = SEGMENT_TO_CRM[match[1]!.toLowerCase()] ?? fallbackLeadType;
    return `/api/crm/lead/${crmLt}/${match[2]}/floor-plan/${match[3]!.toLowerCase()}`;
  }

  if (t.endsWith("/content")) return crmFloorPlanContentProxyPath(fallbackLeadType, fallbackId);
  if (t.endsWith("/open")) return crmFloorPlanOpenProxyPath(fallbackLeadType, fallbackId);
  return null;
}

function upstreamStreamUrl(leadType: string, id: string, suffix: "content" | "open"): string {
  const segment = crmLeadTypeToFloorPlanLeadType(
    leadType as Parameters<typeof crmLeadTypeToFloorPlanLeadType>[0],
  );
  return `${BASE_URL}/v1/leads/${segment}/${id}/floor-plan/${suffix}`;
}

export async function proxyFloorPlanStream(
  req: NextRequest,
  leadType: string,
  id: string,
  suffix: "content" | "open",
): Promise<NextResponse> {
  const res = await fetch(upstreamStreamUrl(leadType, id, suffix), {
    headers: upstreamAuthHeaders(req),
    cache: "no-store",
  });
  if (!res.ok) {
    const payload = await readUpstreamPayload(res);
    const errText = (
      (typeof payload.json?.error === "string" && payload.json.error) ||
      (typeof payload.json?.userMessage === "string" && payload.json.userMessage) ||
      payload.text ||
      ""
    ).toLowerCase();
    const status =
      res.status === 404 || errText.includes("key does not exist") || errText.includes("nosuchkey")
        ? 404
        : res.status;
    return proxyJsonError(
      status,
      payload,
      suffix === "open"
        ? "Unable to open floor plan. Please try again."
        : "Unable to load floor plan. Please try again.",
    );
  }

  const bytes = await res.arrayBuffer();
  const contentType =
    res.headers.get("Content-Type")?.split(";")[0]?.trim() || "application/octet-stream";
  const disposition =
    res.headers.get("Content-Disposition")?.trim() ||
    'inline; filename="floor-plan"';

  return new NextResponse(bytes, {
    status: res.status,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=120",
    },
  });
}
