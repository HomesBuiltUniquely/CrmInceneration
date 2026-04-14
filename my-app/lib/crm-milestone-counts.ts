/** Response shape from `GET /Leads/crm-milestone-counts` and `.../crm-milestone-counts-filtered`. */

export type CrmMilestoneCountsRow = { key: string; count: number };

export type CrmMilestoneCountsApiResponse = {
  totalCrmLeads?: number;
  countsByMilestoneStage?: CrmMilestoneCountsRow[];
  countsByMilestoneStageCategory?: CrmMilestoneCountsRow[];
  countsByMilestoneSubStage?: CrmMilestoneCountsRow[];
  appliedFilters?: Record<string, unknown>;
};

export function countForMilestoneStageKey(
  rows: CrmMilestoneCountsRow[] | undefined,
  stageKey: string
): number {
  const n = stageKey.trim().toLowerCase();
  const hit = rows?.find((r) => r.key.trim().toLowerCase() === n);
  return hit?.count ?? 0;
}
