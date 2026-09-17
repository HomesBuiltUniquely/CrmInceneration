/**
 * Align Insights SM pool with Journey Phase Heatmap / My Leads:
 * my-leads ∪ team-leads → id-merge (leadId prefer) → stage via crmLeadTopLevelStage
 * (blank milestone → Fresh Lead). No phone collapse — matches My Leads Total 1:1.
 *
 * Do not name-refilter Hub my∪team membership (display-name teamSet drops Hub
 * usernames like Somashekar_V → phases undercount vs My Leads).
 */

import type { ApiLead } from "@/lib/leads-filter";
import { crmLeadTopLevelStage } from "@/lib/leads-filter";
import { assigneeAliasNorms, readLeadCreatedAtRaw } from "@/lib/lead-follow-up-insights";
import { hierarchyUserDisplayName } from "@/lib/hierarchy-user-display";
import {
  milestoneCountsFromLeads,
  normalizeMilestoneCountsToCanonical,
} from "@/lib/admin-leads-api";
import { mergeInsightsLeadsByStableId } from "@/lib/insights-sales-role-pool";

export function mergeLeadsByIdForInsights(leads: ApiLead[]): ApiLead[] {
  // Same stable key as My Leads SM combined / admin journey merge (leadId then id).
  return mergeInsightsLeadsByStableId(leads);
}

function isSelfLeadByUserId(lead: ApiLead, viewerUserId: number | null): boolean {
  if (viewerUserId == null || viewerUserId <= 0) return false;
  const r = lead as Record<string, unknown>;
  const assigneeObj =
    r.assignee && typeof r.assignee === "object" && !Array.isArray(r.assignee)
      ? (r.assignee as Record<string, unknown>)
      : null;
  const salesOwnerObj =
    r.salesOwner && typeof r.salesOwner === "object" && !Array.isArray(r.salesOwner)
      ? (r.salesOwner as Record<string, unknown>)
      : null;
  const idCandidates = [
    r.assigneeId,
    r.assignedToId,
    r.salesExecutiveId,
    r.salesOwnerId,
    r.userId,
    assigneeObj?.id,
    salesOwnerObj?.id,
  ];
  return idCandidates.some((v) => Number(v ?? 0) === Number(viewerUserId));
}

/**
 * Optional client scope (e.g. Insights executive filter).
 * Do **not** use this after Hub my∪team for the unfiltered SM view — that drops team rows.
 */
export function filterSalesManagerJourneyLeads(
  leads: ApiLead[],
  opts: {
    viewerUserId: number | null;
    /** Display / login aliases for the manager. */
    selfAliases: string[];
    /**
     * Team aliases — prefer full `collectHierarchyUserAssigneeAliases` set
     * (same as LeadsDataSection canView) so Lost Segment tiles match.
     */
    teamDisplayNames: string[];
  },
): ApiLead[] {
  const myAliases = new Set(
    opts.selfAliases.map((v) => v.trim().toLowerCase()).filter(Boolean),
  );
  const teamSet = new Set(
    opts.teamDisplayNames.map((v) => v.trim().toLowerCase()).filter(Boolean),
  );

  const isSelfLead = (lead: ApiLead) => {
    if (isSelfLeadByUserId(lead, opts.viewerUserId)) return true;
    const aliases = assigneeAliasNorms(lead);
    for (const me of myAliases) if (aliases.has(me)) return true;
    return false;
  };
  const isTeamLead = (lead: ApiLead) => {
    if (teamSet.size === 0) return false;
    const aliases = assigneeAliasNorms(lead);
    for (const alias of aliases) if (teamSet.has(alias)) return true;
    return false;
  };

  return leads.filter((lead) => isSelfLead(lead) || isTeamLead(lead));
}

/** Display names from hierarchy users (heatmap-style team roster). */
export function teamDisplayNamesFromUsers(
  users: Array<Record<string, unknown> | { fullName?: string; name?: string; username?: string }>,
): string[] {
  const out: string[] = [];
  for (const u of users) {
    const label = hierarchyUserDisplayName(u as { fullName?: string; name?: string; username?: string });
    if (label) out.push(label);
  }
  return out;
}

export function insightsSalesManagerMilestoneAndTotal(leads: ApiLead[]): {
  /** One row per lead id — Total Leads / journey phases (blank → Fresh Lead). */
  pool: ApiLead[];
  total: number;
  milestoneCounts: Record<string, number>;
} {
  const pool = mergeLeadsByIdForInsights(leads);
  const milestoneCounts = normalizeMilestoneCountsToCanonical(
    milestoneCountsFromLeads(pool, "sales"),
    "sales",
  );
  const stageSum = Object.values(milestoneCounts).reduce(
    (s, n) => s + (Number(n) || 0),
    0,
  );
  const total = stageSum > 0 ? stageSum : pool.length;
  return { pool, total, milestoneCounts };
}

/** Debug helper: stage breakdown using same top-level stage labels as heatmap cards. */
export function countStagesLikeHeatmap(leads: ApiLead[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const lead of leads) {
    const stage = crmLeadTopLevelStage(lead).trim() || "Fresh Lead";
    out[stage] = (out[stage] ?? 0) + 1;
  }
  return out;
}

/**
 * Apply Insights date window by lead **created** timestamp (same column as CRM “Lead created”).
 * Call after full My Leads inventory is loaded so:
 * - All time = exact My Leads total/phases
 * - This month / custom = subset of that inventory (consistent stages)
 */
export function filterApiLeadsByInsightsDateRange(
  leads: ApiLead[],
  range: { submittedFrom?: string; submittedTo?: string },
): ApiLead[] {
  const fromMs = range.submittedFrom ? Date.parse(range.submittedFrom) : NaN;
  const toMs = range.submittedTo ? Date.parse(range.submittedTo) : NaN;
  if (!Number.isFinite(fromMs) && !Number.isFinite(toMs)) return leads;

  return leads.filter((lead) => {
    const raw = readLeadCreatedAtRaw(lead);
    const t = raw ? Date.parse(raw) : NaN;
    if (!Number.isFinite(t)) return false;
    if (Number.isFinite(fromMs) && t < fromMs) return false;
    if (Number.isFinite(toMs) && t > toMs) return false;
    return true;
  });
}
