import type { ApiLead } from "@/lib/leads-filter";
import { normalizeLeadSortFields } from "@/lib/leads-filter";
import {
  computeFollowUpInsightCounts,
  normalizeInsightCountOpts,
  type InsightCountOpts,
} from "@/lib/lead-follow-up-insights";
import { computeMilestoneTileCounts } from "@/lib/lead-milestone-insight-tiles";
import { computeLostSegmentCounts } from "@/lib/lead-lost-segment";
import { normalizeRole } from "@/lib/auth/api";
import { pickPrimarySourceRows } from "@/lib/primary-source-leads";
import { isAdminRole } from "@/lib/roleUtils";

/**
 * One row per customer phone for insight tiles (matches heatmap / hierarchy table totals).
 * Raw assignee-pool rows can inflate counts when the same customer has multiple lead ids.
 * Also flattens Hub `quoteSentInfo` aliases for Quote Sent tile counts.
 */
export function salesInsightCountLeads(leads: ApiLead[]): ApiLead[] {
  return pickPrimarySourceRows(leads.map((lead) => normalizeLeadSortFields(lead)));
}

/** Roles on Hub admin pool that show sales insight tiles (follow-up, overdue, lost segment). */
export function roleUsesAdminPoolInsightTiles(roleKey: string): boolean {
  const r = normalizeRole(roleKey);
  return r === "SALES_ADMIN" || isAdminRole(r);
}

/** Full sales-pool scope for follow-up / overdue / meeting insight tiles. */
export function salesAdminPoolInsightOpts(
  currentUserName: string,
  managerTeamNames: string[],
  dateFrom?: string,
  dateTo?: string,
): InsightCountOpts {
  return {
    viewerRole: "SALES_MANAGER",
    currentUserName,
    managerTeamNames,
    leadView: "default",
    dateFrom,
    dateTo,
  };
}

export function mergeSalesPoolInsightCounts(
  base: Record<string, number>,
  leads: ApiLead[],
  opts: InsightCountOpts,
): Record<string, number> {
  const normalized = normalizeInsightCountOpts(opts);
  const insightPool = salesInsightCountLeads(leads);
  return {
    ...base,
    ...computeFollowUpInsightCounts(insightPool, normalized),
    ...computeMilestoneTileCounts(insightPool, normalized),
    ...computeLostSegmentCounts(insightPool, normalized),
  };
}
