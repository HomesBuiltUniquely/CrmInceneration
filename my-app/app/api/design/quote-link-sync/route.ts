import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { isCrmLeadType, type CrmLeadType } from "@/lib/leads-filter";
import { leadUpdatePutPaths } from "@/lib/crm-lead-endpoints";
import { toCustomerQuoteLink } from "@/lib/crm-quote-links";

const EXTERNAL_LEAD_INGEST_API_KEY =
  process.env.EXTERNAL_LEAD_INGEST_API_KEY?.trim() ?? "";

function apiKeyOk(req: NextRequest): boolean {
  if (!EXTERNAL_LEAD_INGEST_API_KEY) return false;
  const provided =
    req.headers.get("x-external-api-key")?.trim() ||
    req.headers.get("x-api-key")?.trim() ||
    "";
  return provided === EXTERNAL_LEAD_INGEST_API_KEY;
}

function hubAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Activity-Performed-By": "Design Quote Sync",
  };
  const dev = process.env.CRM_DEV_BEARER_TOKEN?.trim();
  if (dev) {
    headers.Authorization = dev.startsWith("Bearer ") ? dev : `Bearer ${dev}`;
  }
  return headers;
}

function normalizeLeadType(raw: unknown): CrmLeadType | null {
  const text = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  const aliases: Record<string, CrmLeadType> = {
    addlead: "addlead",
    add: "addlead",
    formlead: "formlead",
    form: "formlead",
    walkinlead: "walkinlead",
    walkin: "walkinlead",
    whatsapplead: "whatsapplead",
    whatsapp: "whatsapplead",
    home1: "home1",
    glead: "home1",
    google: "home1",
    googlelead: "home1",
    metalead: "metalead",
    meta: "metalead",
    mlead: "metalead",
    websitelead: "websitelead",
    website: "websitelead",
    ivrlead: "ivrlead",
    ivr: "ivrlead",
  };
  const mapped = aliases[text] ?? (text as CrmLeadType);
  return isCrmLeadType(mapped) ? mapped : null;
}

/**
 * Design Module → CRM callback after "Share this to CRM".
 * Auth: x-external-api-key (same as EXTERNAL_LEAD_INGEST_API_KEY).
 * Uses CRM_DEV_BEARER_TOKEN to PUT Hub — Design does not need ERP_USERNAME/PASSWORD.
 */
export async function POST(req: NextRequest) {
  if (!apiKeyOk(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const crmLeadId = Number(body.crmLeadId ?? body.leadId ?? 0);
  const leadType = normalizeLeadType(body.leadType ?? body.crmLeadType);
  const quoteLink = toCustomerQuoteLink(
    String(body.quoteLink ?? body.customerQuoteUrl ?? body.customerLink ?? "").trim(),
  );
  const quoteId = String(body.quoteId ?? "").trim();

  if (!Number.isFinite(crmLeadId) || crmLeadId < 1) {
    return NextResponse.json({ ok: false, message: "crmLeadId is required" }, { status: 400 });
  }
  if (!leadType) {
    return NextResponse.json({ ok: false, message: "leadType is required" }, { status: 400 });
  }
  if (!quoteLink) {
    return NextResponse.json({ ok: false, message: "quoteLink is required" }, { status: 400 });
  }
  if (!process.env.CRM_DEV_BEARER_TOKEN?.trim()) {
    return NextResponse.json(
      { ok: false, message: "CRM_DEV_BEARER_TOKEN is not configured on CRM" },
      { status: 503 },
    );
  }

  const payload: Record<string, unknown> = {
    quoteLink,
    quoteURL: quoteLink,
    proposalLink: quoteLink,
  };
  if (quoteId) payload.quoteId = quoteId;

  const paths = leadUpdatePutPaths(leadType, crmLeadId);
  const headers = hubAuthHeaders();
  const hubBases = Array.from(
    new Set(
      [
        (process.env.NEXT_PUBLIC_API || "").trim().replace(/\/+$/, ""),
        (process.env.HUB_API_BASE_URL || "").trim().replace(/\/+$/, ""),
        BASE_URL,
      ].filter(Boolean),
    ),
  );
  let lastStatus = 500;
  let lastText = "";

  for (const hubBase of hubBases) {
    for (let i = 0; i < paths.length; i += 1) {
      const url = `${hubBase}${paths[i]}`;
      try {
        const res = await fetch(url, {
          method: "PUT",
          headers,
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        lastStatus = res.status;
        lastText = await res.text().catch(() => "");
        if (res.ok) {
          return NextResponse.json({
            ok: true,
            crmLeadId,
            leadType,
            quoteLink,
            path: paths[i],
            hubBase,
          });
        }
        if (i < paths.length - 1 && (res.status === 404 || res.status === 405)) continue;
        break;
      } catch (error) {
        lastText = error instanceof Error ? error.message : String(error);
        lastStatus = 502;
        break;
      }
    }
  }

  return NextResponse.json(
    {
      ok: false,
      message: "Failed to save quoteLink on Hub lead",
      status: lastStatus,
      detail: lastText.slice(0, 300),
    },
    { status: 502 },
  );
}
