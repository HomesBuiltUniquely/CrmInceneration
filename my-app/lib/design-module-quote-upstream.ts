import { BASE_URL } from "@/lib/base-url";

const DEFAULT_DESIGN_API = "https://api.hubinterior.com";

function normalizeOrigin(value: string | undefined | null): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

/**
 * Origins to try for Design quote APIs (`/api/new-crm/quotes/...`).
 * Prefer DESIGN_MODULE_URL, then fall back to production Design/Hub so local
 * CRM still works when localhost Design is down.
 */
export function designModuleQuoteUpstreamBases(): string[] {
  const ordered = [
    normalizeOrigin(process.env.DESIGN_MODULE_URL),
    normalizeOrigin(process.env.NEXT_PUBLIC_API),
    DEFAULT_DESIGN_API,
    normalizeOrigin(BASE_URL),
  ].filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const origin of ordered) {
    const key = origin.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(origin);
  }
  return out;
}

export type QuoteUpstreamAttempt = {
  origin: string;
  status: number;
  text: string;
  contentType: string | null;
};

function isConnectionFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("network") ||
    msg.includes("socket")
  );
}

/**
 * GET quote path across Design/Hub bases. Prefers first successful JSON with a
 * quote link; otherwise last non-connection response.
 *
 * Tries both CRM-compatible and canonical Design Module paths.
 */
export async function fetchDesignModuleQuoteAcrossUpstreams(args: {
  /** Path relative to origin, e.g. `/api/new-crm/quotes/internal-link/by-lead/AL-xxx` */
  path: string;
  headers: HeadersInit;
  /** Extra alternate paths to try on each origin (same lead lookup). */
  alternatePaths?: string[];
}): Promise<QuoteUpstreamAttempt> {
  const primary = args.path.startsWith("/") ? args.path : `/${args.path}`;
  const paths = [
    primary,
    ...(args.alternatePaths ?? []).map((p) => (p.startsWith("/") ? p : `/${p}`)),
  ].filter((p, i, arr) => arr.indexOf(p) === i);

  let last: QuoteUpstreamAttempt | null = null;
  let lastConnectionError: unknown;

  for (const origin of designModuleQuoteUpstreamBases()) {
    for (const path of paths) {
      try {
        const res = await fetch(`${origin}${path}`, {
          method: "GET",
          headers: args.headers,
          cache: "no-store",
        });
        const text = await res.text();
        const attempt: QuoteUpstreamAttempt = {
          origin,
          status: res.status,
          text,
          contentType: res.headers.get("Content-Type"),
        };
        last = attempt;

        if (!res.ok) continue;

        try {
          const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : null;
          if (parsed && typeof parsed === "object") {
            const link =
              (typeof parsed.customerQuoteUrl === "string" && parsed.customerQuoteUrl.trim()) ||
              (typeof parsed.customerLink === "string" && parsed.customerLink.trim()) ||
              (typeof parsed.internalQuoteUrl === "string" && parsed.internalQuoteUrl.trim()) ||
              (typeof parsed.internalLink === "string" && parsed.internalLink.trim()) ||
              (typeof parsed.quoteLink === "string" && parsed.quoteLink.trim()) ||
              "";
            if (link) return attempt;
            if (parsed.ok === false) continue;
          }
        } catch {
          // non-JSON success — keep as candidate
        }
        return attempt;
      } catch (error) {
        if (isConnectionFailure(error)) {
          lastConnectionError = error;
          continue;
        }
        throw error;
      }
    }
  }

  if (last) return last;
  throw lastConnectionError instanceof Error
    ? lastConnectionError
    : new Error(
        "Unable to reach Design Module quote API. Check DESIGN_MODULE_URL (use https://api.hubinterior.com when local Design is not running).",
      );
}
