import { NextRequest, NextResponse } from "next/server";
import type { ApiLead, SpringPage } from "@/lib/leads-filter";
import { CRM_LEAD_TYPES } from "@/lib/leads-filter";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

const BASE = process.env.NEXT_PUBLIC_CRM_API_BASE ?? "http://localhost:8081";

function parseUpdatedAt(a: ApiLead): number {
  const u = a.updatedAt;
  if (!u) return 0;
  const t = Date.parse(u);
  return Number.isNaN(t) ? 0 : t;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mergeAll = url.searchParams.get("mergeAll") === "1";
  const page = url.searchParams.get("page") ?? "0";
  const size = url.searchParams.get("size") ?? "20";
  const sort = url.searchParams.get("sort") ?? "updatedAt,desc";

  if (!mergeAll) {
    const leadType = url.searchParams.get("leadType") ?? "formlead";
    const upstream = new URL(`${BASE}/v1/leads/filter`);
    upstream.searchParams.set("leadType", leadType);
    upstream.searchParams.set("milestoneScope", "crm");
    upstream.searchParams.set("page", page);
    upstream.searchParams.set("size", size);
    upstream.searchParams.set("sort", sort);

    const res = await fetch(upstream.toString(), { headers: upstreamAuthHeaders(req), cache: "no-store" });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  }

  const perType = Math.min(500, Math.max(100, Number.parseInt(size, 10) * 25 || 200));
  const fetches = CRM_LEAD_TYPES.map(async (leadType) => {
    const upstream = new URL(`${BASE}/v1/leads/filter`);
    upstream.searchParams.set("leadType", leadType);
    upstream.searchParams.set("milestoneScope", "crm");
    upstream.searchParams.set("page", "0");
    upstream.searchParams.set("size", String(perType));
    upstream.searchParams.set("sort", sort);
    try {
      const res = await fetch(upstream.toString(), { headers: upstreamAuthHeaders(req), cache: "no-store" });
      if (!res.ok) return [] as ApiLead[];
      const data = (await res.json()) as SpringPage<ApiLead>;
      return Array.isArray(data.content) ? data.content : [];
    } catch {
      return [] as ApiLead[];
    }
  });

  const chunks = await Promise.all(fetches);
  const byId = new Map<string, ApiLead>();
  for (let i = 0; i < chunks.length; i++) {
    const sourceType = CRM_LEAD_TYPES[i];
    for (const lead of chunks[i]) {
      const id = lead.id !== undefined && lead.id !== null ? String(lead.id) : "";
      if (!id) continue;
      if (!byId.has(id)) {
        byId.set(id, { ...lead, leadType: sourceType });
      }
    }
  }

  const merged = [...byId.values()].sort((a, b) => parseUpdatedAt(b) - parseUpdatedAt(a));

  const pageNum = Number.parseInt(page, 10) || 0;
  const pageSize = Number.parseInt(size, 10) || 20;
  const start = pageNum * pageSize;
  const slice = merged.slice(start, start + pageSize);
  const totalElements = merged.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));

  const body: SpringPage<ApiLead> = {
    content: slice,
    totalElements,
    totalPages,
    number: pageNum,
    size: pageSize,
  };

  return NextResponse.json(body);
}
