/**
 * Insights sales inventory — same Hub path as My Leads for Sales Manager:
 * my-leads ∪ team-leads → id-merge (leadId/id). Not mergeAll alone (undercounts team),
 * not admin heatmap (SM JWT often incomplete for journey parity).
 */

import { formatAssigneeAliasSetQuery } from "@/lib/admin-assignee-match";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import type { ApiLead, SpringPage } from "@/lib/leads-filter";

export type InsightsSalesRolePoolInput = {
  dateFrom?: string;
  dateTo?: string;
  /** Exact assignee aliases (\0-joined on wire). Empty = Hub JWT scope only (SM team). */
  assigneeAliasSet?: string[];
};

function extractContent(json: SpringPage<ApiLead> | Record<string, unknown>): ApiLead[] {
  const content = (json as SpringPage<ApiLead>).content;
  if (Array.isArray(content)) return content as ApiLead[];
  return [];
}

function leadStableIdentifier(lead: ApiLead): string {
  const row = lead as Record<string, unknown>;
  const fromFields = String(
    row.leadId ?? row.lead_identifier ?? row.leadIdentifier ?? row.uniqueId ?? "",
  )
    .trim()
    .toLowerCase();
  if (fromFields) return fromFields;
  if (lead.id !== undefined && lead.id !== null && String(lead.id).trim()) {
    return String(lead.id).trim();
  }
  return "";
}

/** Id-merge identical to My Leads SM combined path (`leadId` prefer, else `id`). */
export function mergeInsightsLeadsByStableId(leads: ApiLead[]): ApiLead[] {
  const byId = new Map<string, ApiLead>();
  let noIdSeq = 0;
  for (const lead of leads) {
    const id = leadStableIdentifier(lead);
    const key = id || `__noid_${noIdSeq++}`;
    if (byId.has(key)) continue;
    byId.set(key, lead);
  }
  return [...byId.values()];
}

async function fetchInsightsLeadsAllPages(
  baseParams: URLSearchParams,
  headers: HeadersInit,
): Promise<ApiLead[]> {
  const pageSize = 500;
  const all: ApiLead[] = [];
  let totalPages = 1;

  for (let page = 0; page < totalPages && page < 80; page += 1) {
    const qs = new URLSearchParams(baseParams);
    qs.set("page", String(page));
    qs.set("size", String(pageSize));

    const res = await fetch(`/api/crm/leads?${qs.toString()}`, {
      cache: "no-store",
      credentials: "include",
      headers,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      throw new Error(
        err.message || err.error || `Insights leads pool failed (HTTP ${res.status})`,
      );
    }
    const json = (await res.json()) as SpringPage<ApiLead>;
    const chunk = extractContent(json);
    all.push(...chunk);
    totalPages = Math.max(1, Number(json.totalPages ?? 1));
    if (chunk.length === 0) break;
    if (chunk.length < pageSize) break;
  }

  return all;
}

function buildBaseInsightsQs(input: InsightsSalesRolePoolInput): URLSearchParams {
  const qs = new URLSearchParams();
  qs.set("mergeAll", "1");
  qs.set("sort", "updatedAt,desc");
  qs.set("leadType", "all");
  qs.set("milestoneScope", "crm");
  qs.set("verificationStatus", "verified");
  if (input.dateFrom?.trim()) qs.set("dateFrom", input.dateFrom.trim());
  if (input.dateTo?.trim()) qs.set("dateTo", input.dateTo.trim());
  if (input.assigneeAliasSet && input.assigneeAliasSet.length > 0) {
    qs.set("assigneeAliasSet", formatAssigneeAliasSetQuery(input.assigneeAliasSet));
  }
  return qs;
}

/**
 * Paginate CRM mergeAll sales list (verified) for Insights.
 * Prefer {@link fetchInsightsSalesManagerMyTeamLeads} for SM → My Leads Total parity.
 */
export async function fetchInsightsSalesRoleMergeLeads(
  input: InsightsSalesRolePoolInput,
): Promise<ApiLead[]> {
  const headers = getCrmAuthHeaders();
  return fetchInsightsLeadsAllPages(buildBaseInsightsQs(input), headers);
}

/**
 * Sales Manager My Leads inventory: Hub `roleView=my` ∪ `roleView=team`, id-merge.
 * Same membership as Journey Phase Heatmap / Total Leads (do not name-refilter after).
 */
export async function fetchInsightsSalesManagerMyTeamLeads(
  input: InsightsSalesRolePoolInput = {},
): Promise<ApiLead[]> {
  const headers = getCrmAuthHeaders();
  const base = buildBaseInsightsQs(input);

  const qMy = new URLSearchParams(base);
  qMy.set("roleView", "my");
  const qTeam = new URLSearchParams(base);
  qTeam.set("roleView", "team");

  const [myRows, teamRows] = await Promise.all([
    fetchInsightsLeadsAllPages(qMy, headers),
    fetchInsightsLeadsAllPages(qTeam, headers),
  ]);

  return mergeInsightsLeadsByStableId([...myRows, ...teamRows]);
}

/** Same id-stable row count as CRM mergeAll `totalElements` (My Leads Total Leads for SM). */
export function countInsightsLeadRowsById(leads: ApiLead[]): number {
  return mergeInsightsLeadsByStableId(leads).length;
}
