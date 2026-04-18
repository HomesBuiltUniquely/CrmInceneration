import { NextRequest, NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";
import { upstreamAuthHeaders } from "@/lib/crm-proxy-auth";
import type { ApiLead, SpringPage } from "@/lib/leads-filter";

type CountsRow = { key: string; count: number };
type CountsResponse = {
  totalCrmLeads?: number;
  countsByMilestoneStage?: CountsRow[];
  countsByMilestoneStageCategory?: CountsRow[];
  countsByMilestoneSubStage?: CountsRow[];
};

type SubStatusResp = {
  mappings?: Array<{ stage: string; stageCategory: string; subStageName: string }>;
};

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function isClosedWonCategory(label: string): boolean {
  const value = norm(label);
  if (value.includes("not won") || value.includes("lost")) return false;
  return value.includes("closed won") || value.includes("booking done") || value === "won";
}

function isMeetingScheduledName(label: string): boolean {
  const value = norm(label);
  return value.includes("meeting") && (value.includes("schedule") || value.includes("scheduled"));
}

function isWonClosedLead(lead: ApiLead): boolean {
  const milestoneStage = norm(String(lead.stage?.milestoneStage ?? ""));
  const legacyStage = norm(String(lead.stage?.stage ?? ""));
  const category = norm(String(lead.stage?.milestoneStageCategory ?? ""));
  const subStage = norm(String(lead.stage?.milestoneSubStage ?? ""));
  const legacySubStage = norm(String(lead.stage?.substage?.substage ?? ""));
  const isClosedStage =
    milestoneStage === "closed" ||
    milestoneStage === "close" ||
    milestoneStage.includes("clos") ||
    legacyStage === "closed" ||
    legacyStage === "close" ||
    legacyStage.includes("clos");
  if (!isClosedStage) return false;
  if (category.includes("not won") || category.includes("lost")) return false;
  if (subStage.includes("not won") || subStage.includes("lost")) return false;
  if (legacySubStage.includes("not won") || legacySubStage.includes("lost")) return false;
  return (
    category.includes("won") ||
    category.includes("booking done") ||
    category.includes("token done") ||
    subStage.includes("won") ||
    subStage.includes("booking done") ||
    subStage.includes("token done") ||
    legacySubStage.includes("won") ||
    legacySubStage.includes("booking done") ||
    legacySubStage.includes("token done")
  );
}

function parseBudgetInInr(raw: unknown, assumeLakhsWhenUnitMissing = false): number {
  if (raw === null || raw === undefined) return 0;
  const text = String(raw).trim().toLowerCase();
  if (!text) return 0;
  const normalized = text.replace(/,/g, "").replace(/inr|rs\.?|rupees?/g, "").trim();
  const match = normalized.match(/-?\d+(\.\d+)?/);
  if (!match) return 0;
  const value = Number(match[0]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (/(cr|crore)/.test(normalized)) return value * 10_000_000;
  if (/(l|lac|lakh)/.test(normalized)) return value * 100_000;
  if (/(k|thousand)/.test(normalized)) return value * 1_000;
  if (/(m|million)/.test(normalized)) return value * 1_000_000;
  if (assumeLakhsWhenUnitMissing && value <= 1000) return value * 100_000;
  return value;
}

function leadBudgetInInr(lead: ApiLead): number {
  const dynamic =
    lead.dynamicFields && typeof lead.dynamicFields === "object" && !Array.isArray(lead.dynamicFields)
      ? (lead.dynamicFields as Record<string, unknown>)
      : {};
  return parseBudgetInInr(
    lead.budget ??
      (lead as Record<string, unknown>).estimatedBudget ??
      dynamic.budget ??
      dynamic.estimatedBudget ??
      dynamic.customerBudget,
    true,
  );
}

function buildLeadsQuery(search: URLSearchParams, assignee?: string): URLSearchParams {
  const q = new URLSearchParams();
  q.set("mergeAll", "1");
  q.set("page", "0");
  q.set("size", "1000");
  q.set("sort", "updatedAt,desc");
  q.set("leadType", "all");
  const assigneeValue = (assignee ?? search.get("assignee") ?? "").trim();
  if (assigneeValue) q.set("assignee", assigneeValue);
  for (const key of ["dateFrom", "dateTo", "milestoneStage", "milestoneStageCategory", "milestoneSubStage"] as const) {
    const value = (search.get(key) ?? "").trim();
    if (value) q.set(key, value);
  }
  return q;
}

async function resolveLeads(req: NextRequest): Promise<ApiLead[]> {
  const search = new URLSearchParams(req.nextUrl.searchParams);
  const assignees = [...new Set((search.get("assignees") ?? "").split(",").map((v) => v.trim()).filter(Boolean))];
  const queries = assignees.length > 0 ? assignees.map((a) => buildLeadsQuery(search, a)) : [buildLeadsQuery(search)];
  const leadById = new Map<string, ApiLead>();
  for (const query of queries) {
    const res = await fetch(`${req.nextUrl.origin}/api/crm/leads?${query.toString()}`, {
      cache: "no-store",
      headers: {
        cookie: req.headers.get("cookie") ?? "",
      },
    });
    if (!res.ok) continue;
    const json = (await res.json()) as SpringPage<ApiLead>;
    for (const lead of json.content ?? []) {
      const id = String(lead.id ?? "").trim();
      if (!id || leadById.has(id)) continue;
      leadById.set(id, lead);
    }
  }
  return [...leadById.values()];
}

async function resolveSubStatusMappings(req: NextRequest) {
  const url = `${req.nextUrl.origin}/api/milestone-count?resource=sub-status`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [] as Array<{ stage: string; stageCategory: string; subStageName: string }>;
  const json = (await res.json()) as SubStatusResp;
  return json.mappings ?? [];
}

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

function sumRows(rows: CountsRow[] | undefined): number {
  return (rows ?? []).reduce((sum, row) => sum + Number(row.count ?? 0), 0);
}

function mergeCountRows(groups: Array<CountsRow[] | undefined>): CountsRow[] {
  const map = new Map<string, number>();
  for (const rows of groups) {
    for (const row of rows ?? []) {
      map.set(row.key, (map.get(row.key) ?? 0) + Number(row.count ?? 0));
    }
  }
  return [...map.entries()].map(([key, count]) => ({ key, count }));
}

async function resolveCounts(req: NextRequest): Promise<CountsResponse> {
  const headers = upstreamAuthHeaders(req);
  const search = new URLSearchParams(req.nextUrl.searchParams);
  const assigneesParam = (search.get("assignees") ?? "").trim();

  if (!assigneesParam) {
    const direct = await fetchUpstreamCounts(search.toString(), headers);
    if (!direct.ok) throw new Error(`Counts HTTP ${direct.status}`);
    return (await direct.json()) as CountsResponse;
  }

  const assignees = [...new Set(assigneesParam.split(",").map((v) => v.trim()).filter(Boolean))];
  search.delete("assignees");
  search.delete("assignee");

  if (assignees.length === 0) {
    const direct = await fetchUpstreamCounts(search.toString(), headers);
    if (!direct.ok) throw new Error(`Counts HTTP ${direct.status}`);
    return (await direct.json()) as CountsResponse;
  }

  const responses = await Promise.all(
    assignees.map(async (assignee) => {
      const q = new URLSearchParams(search);
      q.set("assignee", assignee);
      const res = await fetchUpstreamCounts(q.toString(), headers);
      if (!res.ok) return null;
      return (await res.json()) as CountsResponse;
    }),
  );
  const ok = responses.filter((r): r is CountsResponse => Boolean(r));
  if (ok.length === 0) throw new Error("Failed to aggregate counts");

  return {
    totalCrmLeads: ok.reduce((sum, item) => sum + Number(item.totalCrmLeads ?? 0), 0),
    countsByMilestoneStage: mergeCountRows(ok.map((item) => item.countsByMilestoneStage)),
    countsByMilestoneStageCategory: mergeCountRows(ok.map((item) => item.countsByMilestoneStageCategory)),
    countsByMilestoneSubStage: mergeCountRows(ok.map((item) => item.countsByMilestoneSubStage)),
  };
}

export async function GET(req: NextRequest) {
  try {
    const [counts, mappings, leads] = await Promise.all([resolveCounts(req), resolveSubStatusMappings(req), resolveLeads(req)]);
    const totalLeads =
      Number(counts.totalCrmLeads ?? 0) || sumRows(counts.countsByMilestoneStage);
    const closedStageLeads = (counts.countsByMilestoneStage ?? [])
      .filter((row) => norm(row.key) === "closed")
      .reduce((sum, row) => sum + Number(row.count ?? 0), 0);
    const closedCategoryLeads = (counts.countsByMilestoneStageCategory ?? [])
      .filter((row) => isClosedWonCategory(row.key))
      .reduce((sum, row) => sum + Number(row.count ?? 0), 0);
    const closedLeads = closedStageLeads > 0 ? closedStageLeads : closedCategoryLeads;
    const overallConversion = totalLeads > 0 ? (closedLeads / totalLeads) * 100 : 0;
    const bySubStage = new Map(
      (counts.countsByMilestoneSubStage ?? []).map((row) => [norm(row.key), Number(row.count ?? 0)]),
    );
    const meetingScheduledSubStages = mappings
      .filter((m) => norm(m.stage) === "connection" && isMeetingScheduledName(m.subStageName))
      .map((m) => norm(m.subStageName));
    const meetingScheduledLeads =
      meetingScheduledSubStages.length > 0
        ? meetingScheduledSubStages.reduce((sum, key) => sum + (bySubStage.get(key) ?? 0), 0)
        : (counts.countsByMilestoneSubStage ?? [])
            .filter((row) => isMeetingScheduledName(row.key))
            .reduce((sum, row) => sum + Number(row.count ?? 0), 0);
    const leadToMeeting = totalLeads > 0 ? (meetingScheduledLeads / totalLeads) * 100 : 0;
    const totalPipelineValueInr = leads
      .filter((lead) => isWonClosedLead(lead))
      .reduce((sum, lead) => sum + leadBudgetInInr(lead), 0);

    return NextResponse.json({
      totalLeads,
      closedLeads,
      overallConversion,
      meetingScheduledLeads,
      leadToMeeting,
      totalPipelineValueInr,
      formula: "closedLeads / totalLeads * 100",
      leadToMeetingFormula: "meetingScheduledLeads / totalLeads * 100",
    });
  } catch (error) {
    return NextResponse.json(
      {
        totalLeads: 0,
        closedLeads: 0,
        overallConversion: 0,
        meetingScheduledLeads: 0,
        leadToMeeting: 0,
        totalPipelineValueInr: 0,
        formula: "closedLeads / totalLeads * 100",
        leadToMeetingFormula: "meetingScheduledLeads / totalLeads * 100",
        error: error instanceof Error ? error.message : "Failed to calculate dashboard metrics",
      },
      { status: 502 },
    );
  }
}
