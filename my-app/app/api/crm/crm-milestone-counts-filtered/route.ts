import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";

type CountsRow = { key: string; count: number };
type CountsResponse = {
  totalCrmLeads?: number;
  countsByMilestoneStage?: CountsRow[];
  countsByMilestoneStageCategory?: CountsRow[];
  countsByMilestoneSubStage?: CountsRow[];
  appliedFilters?: Record<string, unknown>;
};

async function fetchUpstreamCounts(queryString: string, headers: HeadersInit): Promise<Response> {
  const candidates = [
    `${BASE_URL}/v1/Leads/crm-milestone-counts-filtered${queryString ? `?${queryString}` : ""}`,
    `${BASE_URL}/Leads/crm-milestone-counts-filtered${queryString ? `?${queryString}` : ""}`,
  ];

  let last: Response | null = null;
  for (const url of candidates) {
    const res = await fetch(url, { cache: "no-store", headers });
    if (res.ok) return res;
    last = res;
  }
  if (last) return last;
  return new Response(JSON.stringify({ error: "No upstream response" }), {
    status: 502,
    headers: { "Content-Type": "application/json" },
  });
}

function sumByKey(chunks: Array<CountsRow[] | undefined>): CountsRow[] {
  const map = new Map<string, number>();
  for (const rows of chunks) {
    for (const row of rows ?? []) {
      map.set(row.key, (map.get(row.key) ?? 0) + (row.count ?? 0));
    }
  }
  return [...map.entries()].map(([key, count]) => ({ key, count }));
}

/** Proxies filtered milestone counts, preferring `/v1/Leads` and falling back to `/Leads`. */
export async function GET(req: NextRequest) {
  const headers = upstreamAuthHeaders(req);
  const search = new URLSearchParams(req.nextUrl.searchParams);
  const assigneesParam = (search.get("assignees") ?? "").trim();

  if (!assigneesParam) {
    const direct = await fetchUpstreamCounts(search.toString(), headers);
    const text = await direct.text();
    return new NextResponse(text, {
      status: direct.status,
      headers: { "Content-Type": direct.headers.get("Content-Type") ?? "application/json" },
    });
  }

  const assignees = [...new Set(assigneesParam.split(",").map((v) => v.trim()).filter(Boolean))];
  search.delete("assignees");
  search.delete("assignee");

  if (assignees.length === 0) {
    const direct = await fetchUpstreamCounts(search.toString(), headers);
    const text = await direct.text();
    return new NextResponse(text, {
      status: direct.status,
      headers: { "Content-Type": direct.headers.get("Content-Type") ?? "application/json" },
    });
  }

  const responses = await Promise.all(
    assignees.map(async (assignee) => {
      const q = new URLSearchParams(search);
      q.set("assignee", assignee);
      const res = await fetchUpstreamCounts(q.toString(), headers);
      if (!res.ok) return null;
      return (await res.json()) as CountsResponse;
    })
  );

  const ok = responses.filter((r): r is CountsResponse => Boolean(r));
  if (ok.length === 0) {
    return NextResponse.json(
      { error: "Failed to aggregate counts for assignees" },
      { status: 502 }
    );
  }

  const merged: CountsResponse = {
    totalCrmLeads: ok.reduce((sum, r) => sum + (r.totalCrmLeads ?? 0), 0),
    countsByMilestoneStage: sumByKey(ok.map((r) => r.countsByMilestoneStage)),
    countsByMilestoneStageCategory: sumByKey(ok.map((r) => r.countsByMilestoneStageCategory)),
    countsByMilestoneSubStage: sumByKey(ok.map((r) => r.countsByMilestoneSubStage)),
    appliedFilters: { ...(ok[0]?.appliedFilters ?? {}), assignees },
  };

  return NextResponse.json(merged);
}
