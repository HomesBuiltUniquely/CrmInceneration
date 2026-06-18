import { NextRequest, NextResponse } from "next/server";
import {
  externalLeadIngestApiKey,
  type FetchRecentCustomerPhonesOpts,
} from "@/lib/customer-phones-api";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import {
  normalizeInboundPhone,
  runWhatsappLeadIngest,
  runWhatsappLeadIngestFromCustomerPoll,
} from "@/lib/whatsapp-lead-ingest";

type IngestRequestBody = {
  phones?: unknown;
  limit?: number;
  since?: string;
  sinceId?: number;
  distinct?: boolean;
  /** After phones/recent, also try GET /api/customer/records/:id */
  useRecordId?: boolean;
};

function isWhatsappIngestAuthorized(req: NextRequest): boolean {
  const externalKey = externalLeadIngestApiKey();
  if (externalKey) {
    const provided = req.headers.get("x-external-api-key")?.trim();
    if (provided === externalKey) return true;
  }

  const secret = process.env.WHATSAPP_INGEST_SECRET?.trim();
  if (secret) {
    const provided =
      req.headers.get("x-whatsapp-ingest-secret")?.trim() ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (provided === secret) return true;
  }

  const auth = req.headers.get("authorization");
  const cookie = req.headers.get("cookie");
  if (auth || cookie) return true;
  return Boolean(process.env.CRM_DEV_BEARER_TOKEN?.trim());
}

function parseSinceId(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) ? Math.max(0, n) : undefined;
}

function pollOptsFromUrl(url: URL): FetchRecentCustomerPhonesOpts {
  const distinctRaw = (url.searchParams.get("distinct") ?? "").trim().toLowerCase();
  return {
    limit: Number(url.searchParams.get("limit") ?? 50),
    since: (url.searchParams.get("since") ?? "").trim() || undefined,
    sinceId: parseSinceId(url.searchParams.get("sinceId")),
    distinct: distinctRaw === "true" || distinctRaw === "1",
  };
}

function pollOptsFromBody(body: IngestRequestBody): FetchRecentCustomerPhonesOpts {
  return {
    limit: body.limit,
    since: typeof body.since === "string" ? body.since.trim() : undefined,
    sinceId:
      body.sinceId !== undefined && body.sinceId !== null
        ? Math.max(0, Math.floor(Number(body.sinceId)))
        : undefined,
    distinct: body.distinct === true,
  };
}

function useRecordIdFromRequest(url: URL, body?: IngestRequestBody): boolean {
  if (body?.useRecordId === true) return true;
  const q = (url.searchParams.get("useRecordId") ?? "").trim().toLowerCase();
  return q === "true" || q === "1";
}

async function handleIngest(req: NextRequest, body?: IngestRequestBody): Promise<NextResponse> {
  if (!isWhatsappIngestAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const crmHeaders = upstreamAuthHeaders(req);
  const url = new URL(req.url);
  const useRecordId = useRecordIdFromRequest(url, body);

  let phones: string[] = [];
  if (body && Array.isArray(body.phones)) {
    phones = body.phones.map((p) => normalizeInboundPhone(p)).filter(Boolean);
  }
  const phonesParam = (url.searchParams.get("phones") ?? "").trim();
  if (phones.length === 0 && phonesParam) {
    phones = phonesParam
      .split(/[,;\s]+/)
      .map((p) => normalizeInboundPhone(p))
      .filter(Boolean);
  }

  if (phones.length > 0) {
    try {
      const summary = await runWhatsappLeadIngest(phones, crmHeaders);
      return NextResponse.json(summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ingest failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const pollOpts = body ? pollOptsFromBody(body) : pollOptsFromUrl(url);

  try {
    const summary = await runWhatsappLeadIngestFromCustomerPoll(pollOpts, crmHeaders, {
      useRecordId,
    });
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Customer API call failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * Direct GET customer API → CRM (no webhook POST).
 *
 * - `?phones=9198...,9876...` — GET /api/customer?phone= each, then CRM
 * - Default — GET /api/customer/phones/recent, then GET /api/customer?phone= each
 */
export async function GET(req: NextRequest) {
  return handleIngest(req);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as IngestRequestBody;
  return handleIngest(req, body);
}
