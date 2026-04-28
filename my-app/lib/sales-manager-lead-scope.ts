import type { ApiLead } from "@/lib/leads-filter";
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
