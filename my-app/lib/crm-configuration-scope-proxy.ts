import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import type { CrmLeadType } from "@/lib/leads-filter";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

export function configurationScopeUpstreamBase(
  leadType: CrmLeadType,
  id: string,
): string {
  return `${BASE_URL}/v1/leads/${leadType}/${id}/configuration-scope`;
}

export async function proxyConfigurationScopeReferenceContent(
  req: NextRequest,
  leadType: CrmLeadType,
  id: string,
  referenceId: string,
): Promise<NextResponse> {
  const url = `${configurationScopeUpstreamBase(leadType, id)}/references/${encodeURIComponent(referenceId)}/content`;
  const res = await fetch(url, {
    headers: upstreamAuthHeaders(req),
    cache: "no-store",
  });
  if (!res.ok) {
    const payload = await readUpstreamPayload(res);
    return proxyJsonError(
      res.status,
      payload,
      "Unable to load reference file. Please try again.",
    );
  }

  const bytes = await res.arrayBuffer();
  const contentType =
    res.headers.get("Content-Type")?.split(";")[0]?.trim() ||
    "application/octet-stream";
  const disposition =
    res.headers.get("Content-Disposition")?.trim() ||
    'inline; filename="reference"';

  return new NextResponse(bytes, {
    status: res.status,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=120",
    },
  });
}
