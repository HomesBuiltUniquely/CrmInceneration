import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { adminRowMatchesAssigneeQuery } from "@/lib/admin-assignee-match";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

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
    const url = `${BASE_URL}/v1/leads/admin/sales${q ? `?${q}` : ""}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: upstreamAuthHeaders(req),
    });
    const text = await res.text();
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

  for (let page = 0; page < maxPages; page += 1) {
    const q = new URLSearchParams(params);
    q.set("page", String(page));
    q.set("size", String(batchSize));
    const url = `${BASE_URL}/v1/leads/admin/sales?${q.toString()}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: upstreamAuthHeaders(req),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
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

  const assignee = (params.get("assignee") ?? "").trim();
  const filteredRows = assignee
    ? rows.filter((row) => adminRowMatchesAssigneeQuery(row, assignee))
    : rows;

  filteredRows.sort((a, b) => rowUpdatedAtMs(b) - rowUpdatedAtMs(a));
  const start = requestedPage * requestedSize;
  const content = filteredRows.slice(start, start + requestedSize);
  return NextResponse.json({
    success: true,
    pool: "sales",
    content,
    totalElements: filteredRows.length,
    totalPages: Math.max(1, Math.ceil(filteredRows.length / requestedSize)),
    number: requestedPage,
    size: requestedSize,
  });
}
