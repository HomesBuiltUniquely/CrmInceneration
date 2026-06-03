import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { adminRowMatchesAssigneeQuery } from "@/lib/admin-assignee-match";
import { fetchAdminPresalesPoolViaMergeFallback } from "@/lib/admin-pool-merge-fallback";
import { isHubNoResourceResponse } from "@/lib/hub-no-resource";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import {
  flattenAdminListContent,
  type AdminLeadListEnvelope,
} from "@/lib/admin-leads-api";
import { pickPrimarySourceRows } from "@/lib/primary-source-leads";

function rowUpdatedAtMs(row: unknown): number {
  if (!row || typeof row !== "object") return 0;
  const rec = row as Record<string, unknown>;
  const lead =
    rec.lead && typeof rec.lead === "object" && !Array.isArray(rec.lead)
      ? (rec.lead as Record<string, unknown>)
      : null;
  const raw = String(lead?.updatedAt ?? lead?.updated_at ?? "").trim();
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? 0 : ms;
}

export async function GET(req: NextRequest) {
  const params = new URLSearchParams(req.nextUrl.searchParams);
  const sortKey = (params.get("sort") ?? "").trim().toLowerCase();
  const enforceUpdatedDesc = sortKey === "updatedat,desc";

  if (!enforceUpdatedDesc) {
    const q = params.toString();
    const url = `${BASE_URL}/v1/leads/admin/presales${q ? `?${q}` : ""}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: upstreamAuthHeaders(req),
    });
    const text = await res.text();
    if (isHubNoResourceResponse(res.status, text)) {
      try {
        const fallback = await fetchAdminPresalesPoolViaMergeFallback(req, params);
        return NextResponse.json({
          success: true,
          pool: "presales",
          fallback: "mergeAll",
          ...fallback,
          totalPages: 1,
          number: 0,
          size: fallback.content.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Admin presales fallback failed";
        return NextResponse.json({ success: false, error: message }, { status: 502 });
      }
    }
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  }

  const requestedPage = Math.max(0, Number.parseInt(params.get("page") ?? "0", 10) || 0);
  const requestedSize = Math.max(1, Number.parseInt(params.get("size") ?? "20", 10) || 20);
  const batchSize = Math.max(500, requestedSize);
  const rows: unknown[] = [];
  const maxPages = 80;
  let useMergeFallback = false;

  for (let page = 0; page < maxPages; page += 1) {
    const q = new URLSearchParams(params);
    q.set("page", String(page));
    q.set("size", String(batchSize));
    const url = `${BASE_URL}/v1/leads/admin/presales?${q.toString()}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: upstreamAuthHeaders(req),
    });
    const text = await res.text();
    if (isHubNoResourceResponse(res.status, text)) {
      useMergeFallback = true;
      break;
    }
    const json = (() => {
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        return {};
      }
    })();
    if (!res.ok) {
      return NextResponse.json(json, { status: res.status });
    }
    const chunk = Array.isArray(json.content) ? json.content : [];
    if (chunk.length === 0) break;
    rows.push(...chunk);
    const totalPages = Math.max(1, Number(json.totalPages ?? 1));
    if (page + 1 >= totalPages) break;
    if (chunk.length < batchSize) break;
  }

  if (useMergeFallback) {
    try {
      const fallback = await fetchAdminPresalesPoolViaMergeFallback(req, params);
      rows.push(...fallback.content);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Admin presales fallback failed";
      return NextResponse.json({ success: false, error: message }, { status: 502 });
    }
  }

  const assignee = (params.get("assignee") ?? "").trim();
  const filteredRows = assignee
    ? rows.filter((row) => adminRowMatchesAssigneeQuery(row, assignee))
    : rows;

  filteredRows.sort((a, b) => rowUpdatedAtMs(b) - rowUpdatedAtMs(a));
  const flatLeads = flattenAdminListContent(filteredRows as AdminLeadListEnvelope[]);
  const uniquePrimaryTotal = pickPrimarySourceRows(flatLeads).length;
  const start = requestedPage * requestedSize;
  const content = filteredRows.slice(start, start + requestedSize);
  return NextResponse.json({
    success: true,
    pool: "presales",
    content,
    totalElements: filteredRows.length,
    uniquePrimaryTotal,
    totalPages: Math.max(1, Math.ceil(filteredRows.length / requestedSize)),
    number: requestedPage,
    size: requestedSize,
  });
}
