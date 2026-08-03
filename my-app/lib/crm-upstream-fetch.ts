import { Agent, fetch as undiciFetch } from "undici";

/** Hub AddLead often takes 60–120s+; default Node fetch times out around 30s. */
const CRM_UPSTREAM_AGENT = new Agent({
  connectTimeout: 60_000,
  headersTimeout: 300_000,
  bodyTimeout: 300_000,
});

export function isUpstreamFetchTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = (err as Error & { cause?: unknown }).cause;
  if (cause && typeof cause === "object" && "code" in cause) {
    const code = String((cause as { code?: unknown }).code ?? "");
    if (code === "UND_ERR_HEADERS_TIMEOUT" || code === "UND_ERR_BODY_TIMEOUT") {
      return true;
    }
  }
  return err.message.includes("Headers Timeout") || err.message.includes("fetch failed");
}

/** Proxy fetch to Hub with extended timeouts (Node default fetch is too short for AddLead). */
export async function fetchCrmUpstream(
  url: string,
  init?: Parameters<typeof undiciFetch>[1],
): Promise<Response> {
  return undiciFetch(url, {
    ...init,
    dispatcher: CRM_UPSTREAM_AGENT,
  }) as unknown as Promise<Response>;
}
