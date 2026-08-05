/**
 * Team Performance Matrix — Achieved + Payoff.
 * Same load path as `/incentives` Team overview:
 *   fetchIncentiveBookingLeadsForExecutive per exec (or self booking list).
 * Date: Insights header date filter (All = all time).
 * Payoff: sum of 15-day slab payoffs in range (Incentives rules).
 */
import {
  resolveBookingDateRange,
  type BookingDateFilterState,
} from "@/lib/booking-token-date-filter";
import type { InsightsTeamMember } from "@/lib/crm-insights-api";
import {
  incentivePeriodKeyFromIso,
  type IncentivePeriodHalf,
} from "@/lib/incentive-period";
import {
  fetchIncentiveBookingLeads,
  fetchIncentiveBookingLeadsForExecutive,
  resolveIncentiveLeadsForPeriod,
  type IncentiveBookingLead,
} from "@/lib/incentives-booking-data";
import {
  computeIncentivePeriodNumbers,
  type IncentiveMemberRef,
} from "@/lib/incentives-profile";
import { monthKeysForInsightsDateFilter } from "@/lib/insights-revenue-forecast-target";
import {
  DEFAULT_MONTHLY_SALES_TARGET_INR,
  currentSalesTargetMonth,
} from "@/lib/sales-targets";
import { salesTargetsApi } from "@/lib/sales-targets-api";

export type TeamMemberIncentiveMetrics = {
  achievedIncentive: number;
  payoff: number;
};

type PeriodWindow = { monthKey: string; half: IncentivePeriodHalf };

/** Max parallel executive-leads fetches (same API as Incentives page). */
const EXEC_LEADS_CONCURRENCY = 4;

/**
 * Leads submitted inside Insights date window.
 * `all` = no date cut (all-time incentives history for matching).
 */
export function filterLeadsByInsightsDateFilter(
  leads: IncentiveBookingLead[],
  dateFilter: BookingDateFilterState,
): IncentiveBookingLead[] {
  if (dateFilter.preset === "all") return leads;
  const range = resolveBookingDateRange(dateFilter);
  const fromMs = range.submittedFrom ? Date.parse(range.submittedFrom) : NaN;
  const toMs = range.submittedTo ? Date.parse(range.submittedTo) : NaN;
  if (!Number.isFinite(fromMs) && !Number.isFinite(toMs)) return leads;

  return leads.filter((lead) => {
    const t = Date.parse(lead.submittedAt);
    if (!Number.isFinite(t)) return false;
    if (Number.isFinite(fromMs) && t < fromMs) return false;
    if (Number.isFinite(toMs) && t > toMs) return false;
    return true;
  });
}

function monthKeysFromLeads(leads: IncentiveBookingLead[]): string[] {
  const set = new Set<string>();
  for (const lead of leads) {
    const key = incentivePeriodKeyFromIso(lead.submittedAt);
    if (!key || key.length < 7) continue;
    set.add(key.slice(0, 7));
  }
  return [...set].sort();
}

/** 15-day windows that cover the Insights date filter. */
export function incentiveWindowsForDateFilter(
  dateFilter: BookingDateFilterState,
  sampleLeads: IncentiveBookingLead[] = [],
): PeriodWindow[] {
  let months: string[];
  if (dateFilter.preset === "all") {
    months = monthKeysFromLeads(sampleLeads);
    if (months.length === 0) months = [currentSalesTargetMonth()];
  } else {
    months = monthKeysForInsightsDateFilter(dateFilter);
    if (months.length === 0) months = [currentSalesTargetMonth()];
  }

  const windows: PeriodWindow[] = [];
  for (const monthKey of months) {
    windows.push({ monthKey, half: "H1" }, { monthKey, half: "H2" });
  }
  return windows;
}

export function formatTeamMatrixIncentiveScope(
  dateFilter: BookingDateFilterState,
): string {
  if (dateFilter.preset === "all") {
    return "All time · same engine as Incentives";
  }
  const months = monthKeysForInsightsDateFilter(dateFilter);
  if (months.length === 0) return "Selected date range · Incentives engine";
  if (months.length === 1) {
    return `${months[0]} · Insights date · Incentives engine`;
  }
  return `${months[0]} → ${months[months.length - 1]} · Insights date · Incentives`;
}

function resolveMonthlyTarget(
  userId: number,
  monthKey: string,
  targetsByMonth: Map<string, Map<number, number>>,
): number {
  const v = targetsByMonth.get(monthKey)?.get(userId);
  if (v != null && v > 0) return v;
  return DEFAULT_MONTHLY_SALES_TARGET_INR;
}

/**
 * Achieved + Payoff = Incentives rules over Insights date window.
 * For each 15-day half in range: weighted revenue + slab payoff, then sum.
 */
export function computeTeamMatrixIncentiveMetrics(options: {
  team: InsightsTeamMember[];
  leadsByUserId: Map<number, IncentiveBookingLead[]>;
  dateFilter: BookingDateFilterState;
  targetsByMonth: Map<string, Map<number, number>>;
}): Map<number, TeamMemberIncentiveMetrics> {
  const byUserId = new Map<number, TeamMemberIncentiveMetrics>();

  const sample: IncentiveBookingLead[] = [];
  for (const leads of options.leadsByUserId.values()) {
    sample.push(...filterLeadsByInsightsDateFilter(leads, options.dateFilter));
  }
  const windows = incentiveWindowsForDateFilter(options.dateFilter, sample);

  for (const row of options.team) {
    const id = Number(row.userId);
    if (!Number.isFinite(id) || id <= 0) continue;
    // Only compute after that exec's incentives fetch finished (key present).
    if (!options.leadsByUserId.has(id)) continue;

    const historyLeads = options.leadsByUserId.get(id) ?? [];
    const scopedLeads = filterLeadsByInsightsDateFilter(
      historyLeads,
      options.dateFilter,
    );

    let achievedSum = 0;
    let payoffSum = 0;

    // Prefer windows from this exec's own history if global sample empty
    const personWindows =
      windows.length > 0
        ? windows
        : incentiveWindowsForDateFilter(options.dateFilter, scopedLeads);

    for (const win of personWindows) {
      const member: IncentiveMemberRef = {
        id,
        name: row.name || `User ${id}`,
        role: row.role || "SALES_EXECUTIVE",
        monthlyTargetInr: resolveMonthlyTarget(
          id,
          win.monthKey,
          options.targetsByMonth,
        ),
      };
      const periodLeads = resolveIncentiveLeadsForPeriod(
        scopedLeads,
        win.monthKey,
        win.half,
      );
      if (periodLeads.length === 0) continue;

      const n = computeIncentivePeriodNumbers(member, {
        bookingLeads: periodLeads,
        allBookingLeads: historyLeads,
        periodHalf: win.half,
      });
      achievedSum += n.revenueAchievedInr;
      payoffSum += n.incentiveEarnedInr;
    }

    byUserId.set(id, {
      achievedIncentive: achievedSum,
      payoff: payoffSum,
    });
  }

  return byUserId;
}

async function loadTargetsForMonths(
  monthKeys: string[],
): Promise<Map<string, Map<number, number>>> {
  const unique = [...new Set(monthKeys.filter(Boolean))];
  const out = new Map<string, Map<number, number>>();
  if (unique.length === 0) {
    unique.push(currentSalesTargetMonth());
  }
  await Promise.all(
    unique.map(async (monthKey) => {
      try {
        const rows = await salesTargetsApi.listUsers(monthKey);
        const m = new Map<number, number>();
        for (const row of rows) {
          m.set(
            row.userId,
            row.monthlyTargetInr || DEFAULT_MONTHLY_SALES_TARGET_INR,
          );
        }
        out.set(monthKey, m);
      } catch {
        out.set(monthKey, new Map());
      }
    }),
  );
  return out;
}

function toMemberRef(row: InsightsTeamMember): IncentiveMemberRef | null {
  const id = Number(row.userId);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    name: (row.name || `User ${id}`).trim(),
    role: row.role || "SALES_EXECUTIVE",
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run(): Promise<void> {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await worker(items[i]!);
    }
  }

  const agents = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: agents }, () => run()));
  return results;
}

export type LoadTeamIncentiveProgress = {
  leadsByUserId: Map<number, IncentiveBookingLead[]>;
  targetsByMonth: Map<string, Map<number, number>>;
  done: boolean;
};

/**
 * Load deals the same way as Incentives Team overview.
 * Streams each exec as it finishes so Achieved/Payoff fill in progressively.
 */
export async function loadTeamMatrixIncentiveBase(options: {
  team: InsightsTeamMember[];
  dateFilter: BookingDateFilterState;
  canPickTeam: boolean;
  viewerUserId?: number | null;
  onProgress?: (state: LoadTeamIncentiveProgress) => void;
}): Promise<{
  leadsByUserId: Map<number, IncentiveBookingLead[]>;
  targetsByMonth: Map<string, Map<number, number>>;
}> {
  const leadsByUserId = new Map<number, IncentiveBookingLead[]>();
  const empty = {
    leadsByUserId,
    targetsByMonth: new Map<string, Map<number, number>>(),
  };

  if (options.team.length === 0) return empty;

  const members = options.team
    .map(toMemberRef)
    .filter((m): m is IncentiveMemberRef => m !== null);

  const seedMonths =
    options.dateFilter.preset === "all"
      ? [currentSalesTargetMonth()]
      : monthKeysForInsightsDateFilter(options.dateFilter);

  let targetsByMonth = await loadTargetsForMonths(
    seedMonths.length > 0 ? seedMonths : [currentSalesTargetMonth()],
  );

  if (!options.canPickTeam) {
    const selfLeads = await fetchIncentiveBookingLeads().catch(
      () => [] as IncentiveBookingLead[],
    );
    if (options.viewerUserId != null && options.viewerUserId > 0) {
      leadsByUserId.set(options.viewerUserId, selfLeads);
    } else if (members[0]) {
      // Single-row SE matrix: attach deals to the only hub row when local userId lagging
      leadsByUserId.set(members[0].id, selfLeads);
    }
    if (options.dateFilter.preset === "all" && selfLeads.length > 0) {
      const extra = await loadTargetsForMonths(monthKeysFromLeads(selfLeads));
      for (const [k, v] of extra) targetsByMonth.set(k, v);
    }
    options.onProgress?.({
      leadsByUserId: new Map(leadsByUserId),
      targetsByMonth,
      done: true,
    });
    return { leadsByUserId, targetsByMonth };
  }

  // Exact Incentives path: per-executive executive-leads API
  await mapPool(members, EXEC_LEADS_CONCURRENCY, async (member) => {
    try {
      const leads = await fetchIncentiveBookingLeadsForExecutive(member);
      leadsByUserId.set(member.id, Array.isArray(leads) ? leads : []);
    } catch {
      leadsByUserId.set(member.id, []);
    }
    options.onProgress?.({
      leadsByUserId: new Map(leadsByUserId),
      targetsByMonth,
      done: false,
    });
  });

  if (options.dateFilter.preset === "all") {
    const all: IncentiveBookingLead[] = [];
    for (const l of leadsByUserId.values()) all.push(...l);
    const months = monthKeysFromLeads(all);
    if (months.length > 0) {
      const extra = await loadTargetsForMonths(months);
      for (const [k, v] of extra) targetsByMonth.set(k, v);
    }
  } else {
    // ensure every month in range has targets
    const needed = monthKeysForInsightsDateFilter(options.dateFilter);
    const missing = needed.filter((m) => !targetsByMonth.has(m));
    if (missing.length > 0) {
      const extra = await loadTargetsForMonths(missing);
      for (const [k, v] of extra) targetsByMonth.set(k, v);
    }
  }

  options.onProgress?.({
    leadsByUserId: new Map(leadsByUserId),
    targetsByMonth,
    done: true,
  });

  return { leadsByUserId, targetsByMonth };
}
