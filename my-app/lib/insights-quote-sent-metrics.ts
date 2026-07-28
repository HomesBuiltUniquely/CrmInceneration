import type { ApiLead } from "@/lib/leads-filter";
import {
  computeMilestoneTileCounts,
  isQuoteSentLead,
  leadMatchesSalesInsightScope,
  type MilestoneTileCounts,
} from "@/lib/lead-milestone-insight-tiles";
import { isLostPathLead } from "@/lib/lead-lost-segment";
import {
  salesAdminPoolInsightOpts,
  salesInsightCountLeads,
} from "@/lib/sales-admin-insight-tiles";
import type { InsightCountOpts } from "@/lib/lead-follow-up-insights";
import type { InsightsFilterOptions } from "@/lib/crm-insights-api";
import {
  fetchLeadTotalInvestmentAmount,
  stableLeadKey,
} from "@/lib/insights-lead-investment";

export type QuoteSentWonMetrics = {
  count: number;
  totalValue: number;
};

type SalesPeopleSelection =
  | { kind: "all" }
  | { kind: "manager"; id: number }
  | { kind: "executive"; id: number; managerId?: number | null };

function readLeadBranchNorm(lead: ApiLead): string {
  const row = lead as Record<string, unknown>;
  const df = row.dynamicFields;
  const fromDf =
    df && typeof df === "object" && !Array.isArray(df)
      ? String(
          (df as Record<string, unknown>).branch ??
            (df as Record<string, unknown>).branchName ??
            (df as Record<string, unknown>).experienceCenter ??
            "",
        ).trim()
      : "";
  const raw = String(
    row.branch ??
      row.branchName ??
      row.experienceCenter ??
      row.experience_center ??
      fromDf ??
      "",
  ).trim();
  return raw.toLowerCase().replace(/\s+/g, " ");
}

function leadMatchesBranchFilter(lead: ApiLead, branchId: string, filterOptions: InsightsFilterOptions): boolean {
  const branch = branchId.trim();
  if (!branch || branch === "all") return true;
  const selected = filterOptions.branches.find((b) => String(b.id) === branch);
  if (!selected) return true;
  const leadBranch = readLeadBranchNorm(lead);
  if (!leadBranch) return true;
  const target = selected.name.trim().toLowerCase().replace(/\s+/g, " ");
  return leadBranch.includes(target) || target.includes(leadBranch);
}

export function resolveInsightsAssigneeAliases(
  salesPeople: SalesPeopleSelection,
  filterOptions: InsightsFilterOptions,
): string[] {
  if (salesPeople.kind === "all") return [];

  if (salesPeople.kind === "executive") {
    const exec =
      filterOptions.salesExecutives.find((e) => e.id === salesPeople.id) ??
      filterOptions.salesManagers
        .flatMap((m) => m.executives ?? [])
        .find((e) => e.id === salesPeople.id);
    const name = exec?.name?.trim();
    return name ? [name] : [];
  }

  const manager = filterOptions.salesManagers.find((m) => m.id === salesPeople.id);
  if (!manager) return [];
  const aliases = new Set<string>();
  if (manager.name?.trim()) aliases.add(manager.name.trim());
  for (const exec of manager.executives ?? []) {
    if (exec.name?.trim()) aliases.add(exec.name.trim());
  }
  return [...aliases];
}

export function buildInsightsQuoteSentCountOpts(
  dateFrom?: string,
  dateTo?: string,
): InsightCountOpts {
  return salesAdminPoolInsightOpts("", [], dateFrom, dateTo);
}

export function filterInsightsQuoteSentScopeLeads(
  leads: ApiLead[],
  args: {
    branchId: string;
    filterOptions: InsightsFilterOptions;
  },
): ApiLead[] {
  const pool = salesInsightCountLeads(leads);
  return pool.filter((lead) => leadMatchesBranchFilter(lead, args.branchId, args.filterOptions));
}

export function computeQuoteSentTileCounts(
  leads: ApiLead[],
  opts: InsightCountOpts,
): MilestoneTileCounts {
  return computeMilestoneTileCounts(leads, opts);
}

/** Active quote-sent leads only — excludes lost-path leads. */
export function listQuoteSentWonLeads(leads: ApiLead[], opts: InsightCountOpts): ApiLead[] {
  return leads.filter((lead) => {
    if (!leadMatchesSalesInsightScope(lead, opts)) return false;
    if (!isQuoteSentLead(lead)) return false;
    return !isLostPathLead(lead);
  });
}

export function computeQuoteSentWonCount(leads: ApiLead[], opts: InsightCountOpts): number {
  const tiles = computeMilestoneTileCounts(leads, opts);
  return Math.max(0, tiles.quoteSent - tiles.lostQuoteSent);
}

/** Sum of current-quote Total Investment Range for won quote-sent leads. */
export async function computeQuoteSentWonTotalValue(
  leads: ApiLead[],
  opts: InsightCountOpts,
  investments?: Map<string, number>,
): Promise<number> {
  const wonLeads = listQuoteSentWonLeads(leads, opts);
  if (investments) {
    return wonLeads.reduce((sum, lead) => sum + (investments.get(stableLeadKey(lead)) ?? 0), 0);
  }
  let total = 0;
  for (const lead of wonLeads) {
    total += await fetchLeadTotalInvestmentAmount(lead);
  }
  return total;
}

export async function loadQuoteSentWonMetrics(args: {
  leads: ApiLead[];
  dateFrom?: string;
  dateTo?: string;
}): Promise<QuoteSentWonMetrics> {
  const opts = buildInsightsQuoteSentCountOpts(args.dateFrom, args.dateTo);
  const count = computeQuoteSentWonCount(args.leads, opts);
  const totalValue = await computeQuoteSentWonTotalValue(args.leads, opts);
  return { count, totalValue };
}
