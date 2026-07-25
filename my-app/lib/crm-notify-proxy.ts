import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import { proxyJsonError, readUpstreamPayload } from "@/lib/crm-proxy-error";

const LOG_PREFIX = "[NotifyProxy]";

/**
 * Base URL of the NotifyProject Go REST server.
 * Resolved from (in priority order):
 *   1. NOTIFY_API_URL  — set in .env.local or production env
 *   2. NEXT_PUBLIC_NOTIFY_API_URL — client-accessible variant
 *   3. "http://localhost:8083" — local dev fallback (set by next.config.ts)
 */
function notifyBaseUrl(): string {
  const url =
    process.env.NOTIFY_API_URL ??
    process.env.NEXT_PUBLIC_NOTIFY_API_URL ??
    "http://localhost:8083";
  console.log(`${LOG_PREFIX} notifyBaseUrl: url=${url}`);
  const cleanUrl = url.replace(/\/$/, "");
  console.log(`${LOG_PREFIX} notifyBaseUrl: returning ${cleanUrl}`);
  return cleanUrl;
}

/**
 * Proxy a GET request to the NotifyProject Go server.
 *
 * - Reads base URL from NOTIFY_API_URL (no localhost hardcoding).
 * - Forwards the Authorization header exactly as received.
 * - Passes through all query-string params from the incoming request.
 * - Returns upstream JSON unchanged on success.
 * - Returns a structured { success, userMessage, error } on any failure.
 *
 * @param req   The incoming Next.js request.
 * @param path  Upstream path, e.g. `/v1/meetings/scheduled`.
 *              Dynamic segments must already be URI-encoded by the caller.
 */
export async function proxyNotifyGet(
  req: NextRequest,
  path: string,
): Promise<NextResponse> {
  const base = notifyBaseUrl();

  // Forward query params from the CRM request to the Go server unchanged.
  const incomingSearch = req.nextUrl.searchParams.toString();
  const upstreamUrl = `${base}${path}${incomingSearch ? `?${incomingSearch}` : ""}`;

  console.log(`${LOG_PREFIX} → GET ${upstreamUrl}`);

  let res: Response;
  try {
    res = await fetch(upstreamUrl, {
      method: "GET",
      headers: upstreamAuthHeaders(req),
      cache: "no-store",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "NotifyProject server unreachable";
    console.error(`${LOG_PREFIX} fetch error for ${upstreamUrl}:`, message);
    return NextResponse.json(
      { success: false, userMessage: message, error: message },
      { status: 502 },
    );
  }

  console.log(`${LOG_PREFIX} ← ${res.status} ${upstreamUrl}`);

  if (!res.ok) {
    const payload = await readUpstreamPayload(res);
    console.warn(
      `${LOG_PREFIX} upstream error ${res.status} for ${upstreamUrl}:`,
      payload.text.slice(0, 200),
    );
    return proxyJsonError(
      res.status,
      payload,
      "Notification service request failed.",
    );
  }

  const data: unknown = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
