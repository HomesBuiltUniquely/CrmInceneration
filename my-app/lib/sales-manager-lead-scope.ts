import type { ApiLead } from "@/lib/leads-filter";
import {
  crmLeadAssigneeAliasNorms,
  crmLeadAssigneeLabel,
  readLeadSalesExecutiveIds,
} from "@/lib/leads-filter";
import { assigneeAliasNorms } from "@/lib/lead-follow-up-insights";

/**
 * Drop merged `/filter` rows whose assignee is not this manager nor a listed team executive.
 * When the team roster is still loading (empty), scope to the manager only — do not pass through the full org-wide merge.
 * When we cannot resolve the manager display name yet, leave the list unchanged (avoid a blank UI flash).
 */
export function narrowSalesManagerLeadsIfTeamKnown(
  leads: ApiLead[],
  managerDisplayName: string,
  teamExecutiveNames: string[],
): ApiLead[] {
  const me = managerDisplayName.trim().toLowerCase();
  const teamNorms = new Set(
    teamExecutiveNames.map((s) => s.trim().toLowerCase()).filter(Boolean),
  );

  if (teamNorms.size > 0) {
    return leads.filter((lead) => {
      const aliases = assigneeAliasNorms(lead);
      if (me && aliases.has(me)) return true;
      for (const a of aliases) {
        if (teamNorms.has(a)) return true;
      }
      return false;
    });
  }

  if (me) {
    return leads.filter((lead) => assigneeAliasNorms(lead).has(me));
  }

  return leads;
}

/** Row counts for Lead Types tiles: assigned to manager vs assigned to team executives only. */
export function countSalesManagerMineVsTeam(
  leads: ApiLead[],
  managerDisplayName: string,
  teamExecutiveNames: string[],
): { managerMine: number; teamLeads: number } {
  const me = managerDisplayName.trim().toLowerCase();
  const teamNorms = new Set(
    teamExecutiveNames.map((s) => s.trim().toLowerCase()).filter(Boolean),
  );

  let managerMine = 0;
  let teamLeads = 0;

  for (const lead of leads) {
    const aliases = assigneeAliasNorms(lead);
    if (aliases.has(me)) {
      managerMine += 1;
      continue;
    }
    if (teamNorms.size === 0) continue;
    for (const a of aliases) {
      if (teamNorms.has(a)) {
        teamLeads += 1;
        break;
      }
    }
  }

  return { managerMine, teamLeads };
}

export type SalesManagerBucketScope = {
  managerUserId: number;
  managerAliases: string[];
  /** Sales executives under this manager (hierarchy user ids). */
  teamUserIds: number[];
  /** Exact assignee name/alias strings for this manager's SEs. */
  teamAliases: string[];
  /**
   * SEs that report to a different manager — hard-exclude so Hub my∪team
   * cannot leak another bucket (e.g. Razi's leads into Kulwanth).
   */
  foreignSeUserIds?: number[];
  foreignSeAliases?: string[];
  /** Other sales managers' display aliases — exclude their assigned leads. */
  foreignManagerAliases?: string[];
};

function normAliasSet(values: string[] | undefined): Set<string> {
  return new Set(
    (values ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
}

/**
 * True when a lead belongs in this Sales Manager's CRM bucket.
 * Prefer userId matches; exact aliases next; never keep known foreign SE/SM assignees.
 * Blank-assignee rows stay (SM unassigned Fresh inbox from Hub my-leads).
 */
export function leadInSalesManagerBucket(
  lead: ApiLead,
  scope: SalesManagerBucketScope,
): boolean {
  const leadIds = readLeadSalesExecutiveIds(lead);
  const aliases = crmLeadAssigneeAliasNorms(lead);
  const managerId = Number(scope.managerUserId ?? 0);
  const teamIds = new Set(
    (scope.teamUserIds ?? []).filter((id) => Number.isFinite(id) && id > 0),
  );
  const meAliases = normAliasSet(scope.managerAliases);
  const teamAliases = normAliasSet(scope.teamAliases);
  const foreignSeIds = new Set(
    (scope.foreignSeUserIds ?? []).filter((id) => Number.isFinite(id) && id > 0),
  );
  const foreignSeAliases = normAliasSet(scope.foreignSeAliases);
  const foreignManagerAliases = normAliasSet(scope.foreignManagerAliases);

  if (managerId > 0 && leadIds.some((id) => id === managerId)) return true;
  if (leadIds.some((id) => teamIds.has(id))) return true;

  for (const a of aliases) {
    if (meAliases.has(a) || teamAliases.has(a)) return true;
  }

  if (leadIds.some((id) => foreignSeIds.has(id))) return false;
  for (const a of aliases) {
    if (foreignSeAliases.has(a) || foreignManagerAliases.has(a)) return false;
  }

  // Blank assignee — Hub my-leads Fresh inbox for this SM.
  if (leadIds.length === 0 && aliases.size === 0 && !crmLeadAssigneeLabel(lead).trim()) {
    return true;
  }

  // Named/id assignee outside this manager's roster — do not show in this bucket.
  if (leadIds.length > 0 || aliases.size > 0 || crmLeadAssigneeLabel(lead).trim()) {
    return false;
  }

  return true;
}

export function filterLeadsToSalesManagerBucket(
  leads: ApiLead[],
  scope: SalesManagerBucketScope | null | undefined,
): ApiLead[] {
  if (!scope) return leads;
  const hasRoster =
    (scope.teamUserIds?.length ?? 0) > 0 ||
    (scope.teamAliases?.length ?? 0) > 0 ||
    (scope.managerAliases?.length ?? 0) > 0 ||
    Number(scope.managerUserId ?? 0) > 0;
  // Roster still loading — leave Hub inventory unchanged (avoid empty flash).
  if (!hasRoster) return leads;
  return leads.filter((lead) => leadInSalesManagerBucket(lead, scope));
}
