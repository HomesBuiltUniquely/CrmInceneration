import { NextRequest, NextResponse } from "next/server";
import { upstreamAuthHeaderRecord } from "@/lib/crm-proxy-auth";
import { buildProxyErrorBody, readUpstreamPayload } from "@/lib/crm-proxy-error";

function isMissingUpstream(status: number, text: string): boolean {
  return (
    status === 404 ||
    status === 405 ||
    text.includes("NoResourceFoundException") ||
    text.includes("No static resource")
  );
}

/** Forward Hub JSON and keep extra fields such as `useOfflineFallback`. */
export async function proxyPaymentLinkJson(args: {
  req: NextRequest;
  method: "GET" | "POST";
  urls: string[];
  body?: string;
  fallbackMessage: string;
}): Promise<NextResponse> {
  const { req, method, urls, fallbackMessage } = args;
  const headers: HeadersInit = {
    ...upstreamAuthHeaderRecord(req),
    ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
  };
  const body = method === "POST" ? args.body || "{}" : undefined;

  let lastPayload: Awaited<ReturnType<typeof readUpstreamPayload>> | null = null;
  let lastStatus = 500;

  for (let i = 0; i < urls.length; i += 1) {
    const res = await fetch(urls[i], {
      method,
      headers,
      body,
      cache: "no-store",
    });
    const payload = await readUpstreamPayload(res);
    lastPayload = payload;
    lastStatus = res.status;
    if (res.ok) {
      return new NextResponse(payload.text || "{}", {
        status: res.status,
        headers: { "Content-Type": payload.contentType || "application/json" },
      });
    }
    if (i < urls.length - 1 && isMissingUpstream(res.status, payload.text)) {
      continue;
    }
    break;
  }

  const payload = lastPayload ?? { text: "", json: null, contentType: "application/json" };
  const errorBody = buildProxyErrorBody({ payload, fallbackMessage });
  return NextResponse.json(
    {
      ...(payload.json ?? {}),
      ...errorBody,
    },
    { status: lastStatus },
  );
}
