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

function readLeadAssigneeName(lead: ApiLead): string {
  const row = lead as Record<string, unknown>;
  return String(
    row.assignee ??
      row.assigneeName ??
      row.salesExecutive ??
      row.salesExecutiveName ??
      row.assignedTo ??
      "",
  )
    .trim()
    .toLowerCase();
}

/**
 * Branch filter (Hub intent: assignee User.branch).
 * Match lead branch when present; else match assignee to roster users on that branch.
 * Unknown lead branch + no roster match → exclude (do not include all).
 */
function leadMatchesBranchFilter(
  lead: ApiLead,
  branchId: string,
  filterOptions: InsightsFilterOptions,
): boolean {
  const branch = branchId.trim();
  if (!branch || branch === "all") return true;

  const selected = filterOptions.branches.find((b) => String(b.id) === branch);
  if (!selected) return true;

  const targetName = selected.name.trim().toLowerCase().replace(/\s+/g, " ");
  const targetCode = String(selected.id).trim().toLowerCase();
  const leadBranch = readLeadBranchNorm(lead);

  if (leadBranch) {
    return (
      leadBranch.includes(targetName) ||
      targetName.includes(leadBranch) ||
      leadBranch === targetCode ||
      leadBranch.includes(targetCode)
    );
  }

  const assignee = readLeadAssigneeName(lead);
  if (!assignee) return false;

  const people = [
    ...filterOptions.salesManagers,
    ...filterOptions.salesExecutives,
    ...filterOptions.salesManagers.flatMap((m) => m.executives ?? []),
  ];
  for (const p of people) {
    const name = (p.name || "").trim().toLowerCase();
    if (!name) continue;
    if (name !== assignee && !name.includes(assignee) && !assignee.includes(name)) {
      continue;
    }
    const pBranch = String(p.branchId ?? "")
      .trim()
      .toLowerCase();
    if (!pBranch) continue;
    if (pBranch === targetCode || pBranch === targetName) return true;
  }
  return false;
}

function uniqueAliases(raw: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const s of raw) {
    const t = String(s ?? "").trim();
    if (t) out.add(t);
  }
  return [...out];
}

export type InsightsAssigneeResolveOpts = {
  /**
   * Sales Manager "All" fallback when roster not loaded:
   * scrape filter-options (prefer nested team of one manager).
   */
  forceTeamWhenAll?: boolean;
  /**
   * Preferred SM / scoped-team full alias list (display + username + email local-part),
   * matching My Leads `canViewLeadByRole` / hierarchy fetch.
   */
  teamAliasesWhenAll?: string[];
  /** Expand executive / manager picks by full hierarchy aliases. */
  aliasesByUserId?: ReadonlyMap<number, string[]>;
};

/**
 * Assignee name tokens for FE scoping (pool + deals).
 * Prefer roster-backed aliases so Insights totals match My Leads for SM / exec filters.
 */
export function resolveInsightsAssigneeAliases(
  salesPeople: SalesPeopleSelection,
  filterOptions: InsightsFilterOptions,
  opts?: InsightsAssigneeResolveOpts,
): string[] {
  if (salesPeople.kind === "all") {
    if (opts?.teamAliasesWhenAll && opts.teamAliasesWhenAll.length > 0) {
      return uniqueAliases(opts.teamAliasesWhenAll);
    }
    if (!opts?.forceTeamWhenAll) return [];
    // Fallback: one nested manager team, else flat executives only (never invent org-wide).
    const aliases = new Set<string>();
    if (filterOptions.salesManagers.length === 1) {
      const m = filterOptions.salesManagers[0];
      if (m.name?.trim()) aliases.add(m.name.trim());
      for (const e of m.executives ?? []) {
        if (e.name?.trim()) aliases.add(e.name.trim());
      }
    } else {
      for (const m of filterOptions.salesManagers) {
        for (const e of m.executives ?? []) {
          if (e.name?.trim()) aliases.add(e.name.trim());
        }
      }
    }
    for (const e of filterOptions.salesExecutives) {
      if (e.name?.trim()) aliases.add(e.name.trim());
    }
    return uniqueAliases(aliases);
  }

  if (salesPeople.kind === "executive") {
    const fromRoster = opts?.aliasesByUserId?.get(salesPeople.id);
    if (fromRoster && fromRoster.length > 0) return uniqueAliases(fromRoster);
    const exec =
      filterOptions.salesExecutives.find((e) => e.id === salesPeople.id) ??
      filterOptions.salesManagers
        .flatMap((m) => m.executives ?? [])
        .find((e) => e.id === salesPeople.id);
    const name = exec?.name?.trim();
    return name ? [name] : [];
  }

  const fromRoster = opts?.aliasesByUserId?.get(salesPeople.id);
  const manager = filterOptions.salesManagers.find((m) => m.id === salesPeople.id);
  if (!manager) {
    return fromRoster && fromRoster.length > 0 ? uniqueAliases(fromRoster) : [];
  }
  const aliases = new Set<string>();
  for (const exec of manager.executives ?? []) {
    const execAliases = opts?.aliasesByUserId?.get(exec.id);
    if (execAliases && execAliases.length > 0) {
      for (const a of execAliases) aliases.add(a);
    } else if (exec.name?.trim()) {
      aliases.add(exec.name.trim());
    }
  }
  // Product: manager-filter KPIs = executives under manager only (not manager's own leads).
  if (aliases.size === 0 && manager.name?.trim()) {
    aliases.add(manager.name.trim());
  }
  return uniqueAliases(aliases);
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

/** Same branch/assignee scope without phone-unique collapse (matches My Leads merge row totals). */
export function filterInsightsScopeLeadsKeepRows(
  leads: ApiLead[],
  args: {
    branchId: string;
    filterOptions: InsightsFilterOptions;
  },
): ApiLead[] {
  return leads.filter((lead) => leadMatchesBranchFilter(lead, args.branchId, args.filterOptions));
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
  return tiles.quoteSent;
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
