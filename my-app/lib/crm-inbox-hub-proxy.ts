import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";
import { resolveCrmAuthViewer } from "@/lib/crm-auth-viewer-server";

const LOG = "[CrmInboxProxy]";

export function crmInboxV2Enabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_CRM_INBOX_V2 === "1" ||
    process.env.CRM_INBOX_V2 === "1"
  );
}

function hubInboxUrl(path: string, req: NextRequest): string {
  const incoming = req.nextUrl.searchParams.toString();
  const q = new URLSearchParams(incoming);
  q.delete("user_id");
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return `${BASE_URL}${path}${suffix}`;
}

export async function proxyCrmInboxGet(
  req: NextRequest,
  path: string,
): Promise<NextResponse> {
  const viewer = await resolveCrmAuthViewer(req);
  if (!viewer) {
    return NextResponse.json(
      { success: false, userMessage: "Unauthorized", error: "unauthorized" },
      { status: 401 },
    );
  }
  const userId = Number(
    (viewer.user as { id?: number }).id ??
      (viewer.user as { userId?: number }).userId ??
      0,
  );
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json(
      { success: false, userMessage: "User id missing", error: "user_id" },
      { status: 401 },
    );
  }

  const url = hubInboxUrl(path, req);
  console.log(`${LOG} → GET ${url} (session user=${userId})`);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Hub inbox unreachable";
    return NextResponse.json(
      { success: false, userMessage: message, error: message },
      { status: 502 },
    );
  }

  if (!res.ok) {
    const payload = await readUpstreamPayload(res);
    return proxyJsonError(res.status, payload, "CRM inbox request failed.");
  }

  const data: unknown = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function proxyCrmInboxPost(
  req: NextRequest,
  path: string,
): Promise<NextResponse> {
  const viewer = await resolveCrmAuthViewer(req);
  if (!viewer) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = hubInboxUrl(path, req);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        ...Object.fromEntries(
          Object.entries(upstreamAuthHeaders(req)).filter(([, v]) => v != null),
        ),
        "Content-Type": "application/json",
      },
      body: req.method === "POST" ? await req.text().catch(() => "") : undefined,
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Hub inbox unreachable";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const text = await res.text().catch(() => "{}");
  let json: unknown = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return NextResponse.json(json, { status: res.status });
}