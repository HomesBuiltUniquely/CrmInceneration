import type { BookingDateFilterState } from "@/lib/booking-token-date-filter";
import { resolveBookingDateRange } from "@/lib/booking-token-date-filter";
import type { InsightsFilterOptions } from "@/lib/crm-insights-api";
import { currentSalesTargetMonth, type SalesTargetUserRow } from "@/lib/sales-targets";
import { salesTargetsApi } from "@/lib/sales-targets-api";

type SalesPeopleSelection =
  | { kind: "all" }
  | { kind: "manager"; id: number }
  | { kind: "executive"; id: number; managerId?: number | null };

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Calendar months covered by the Insights date filter (for summing monthly incentive targets). */
export function monthKeysForInsightsDateFilter(filter: BookingDateFilterState): string[] {
  if (filter.preset === "all") {
    return [currentSalesTargetMonth()];
  }

  const range = resolveBookingDateRange(filter);
  const fromMs = range.submittedFrom ? Date.parse(range.submittedFrom) : NaN;
  const toMs = range.submittedTo ? Date.parse(range.submittedTo) : NaN;

  if (!Number.isFinite(fromMs) && !Number.isFinite(toMs)) {
    return [currentSalesTargetMonth()];
  }

  const start = Number.isFinite(fromMs)
    ? new Date(fromMs)
    : new Date(toMs);
  const end = Number.isFinite(toMs)
    ? new Date(toMs)
    : new Date(fromMs);

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  const keys: string[] = [];

  while (cursor <= last) {
    keys.push(monthKeyFromDate(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return keys.length > 0 ? keys : [currentSalesTargetMonth()];
}

function resolveScopedExecutiveIds(
  salesPeople: SalesPeopleSelection,
  filterOptions: InsightsFilterOptions,
): Set<number> | null {
  if (salesPeople.kind === "executive") {
    return new Set([salesPeople.id]);
  }
  if (salesPeople.kind === "manager") {
    const manager = filterOptions.salesManagers.find((m) => m.id === salesPeople.id);
    const ids = new Set<number>();
    for (const exec of manager?.executives ?? []) {
      ids.add(exec.id);
    }
    if (ids.size === 0) {
      for (const exec of filterOptions.salesExecutives) {
        if (exec.managerId === salesPeople.id) ids.add(exec.id);
      }
    }
    return ids.size > 0 ? ids : null;
  }
  return null;
}

function userMatchesBranch(
  user: SalesTargetUserRow,
  branchId: string,
  filterOptions: InsightsFilterOptions,
): boolean {
  const branch = branchId.trim();
  if (!branch || branch === "all") return true;
  const selected = filterOptions.branches.find((b) => String(b.id) === branch);
  if (!selected) return true;
  const userBranch = norm(user.branch ?? "");
  if (!userBranch) return true;
  const target = norm(selected.name);
  return userBranch.includes(target) || target.includes(userBranch);
}

function filterTargetUsers(
  users: SalesTargetUserRow[],
  args: {
    branchId: string;
    filterOptions: InsightsFilterOptions;
    salesPeople: SalesPeopleSelection;
  },
): SalesTargetUserRow[] {
  const scopedIds = resolveScopedExecutiveIds(args.salesPeople, args.filterOptions);
  return users.filter((user) => {
    if (scopedIds && !scopedIds.has(user.userId)) return false;
    return userMatchesBranch(user, args.branchId, args.filterOptions);
  });
}

function sumMonthlyTargets(users: SalesTargetUserRow[]): number {
  return users.reduce((sum, user) => sum + Math.max(0, user.monthlyTargetInr), 0);
}

/**
 * Revenue Forecast TARGET = sum of incentive monthly targets (`sales-targets` API)
 * for each month in the Insights date filter, scoped by branch / salesperson filters.
 */
export async function fetchInsightsRevenueForecastTarget(args: {
  dateFilter: BookingDateFilterState;
  branchId: string;
  salesPeople: SalesPeopleSelection;
  filterOptions: InsightsFilterOptions;
}): Promise<number> {
  const months = monthKeysForInsightsDateFilter(args.dateFilter);
  let total = 0;

  for (const month of months) {
    const users = await salesTargetsApi.listUsers(month);
    const scoped = filterTargetUsers(users, {
      branchId: args.branchId,
      filterOptions: args.filterOptions,
      salesPeople: args.salesPeople,
    });
    total += sumMonthlyTargets(scoped);
  }

  return total;
}
