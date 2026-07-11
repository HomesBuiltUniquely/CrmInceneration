import { assigneeScopeForExecutive } from "@/lib/incentives-lead-assignee";
import type { IncentiveMemberRef } from "@/lib/incentives-profile";
import type { IncentivesRoster } from "@/lib/incentives-roster";
import { normalizeRole } from "@/lib/auth/api";

export type BookingDealFilterDraft = {
  salesManagerId: number | null;
  salesExecutiveId: number | null;
  pendingCancellationsOnly: boolean;
};

export type BookingDealFilterState = BookingDealFilterDraft & {
  salesManagerName: string;
  salesExecutiveName: string;
  /** Assignee name tokens for client-side team scoping */
  teamAssigneeScopes: string[];
};

export const DEFAULT_BOOKING_DEAL_FILTERS: BookingDealFilterState = {
  salesManagerId: null,
  salesExecutiveId: null,
  salesManagerName: "",
  salesExecutiveName: "",
  teamAssigneeScopes: [],
  pendingCancellationsOnly: false,
};

export function isBookingDealFilterActive(filter: BookingDealFilterState): boolean {
  return (
    filter.salesManagerId != null ||
    filter.salesExecutiveId != null ||
    filter.pendingCancellationsOnly
  );
}

export function bookingDealFilterSummary(filter: BookingDealFilterState): string {
  const parts: string[] = [];
  if (filter.salesExecutiveName) {
    parts.push(filter.salesExecutiveName);
  } else if (filter.salesManagerName) {
    parts.push(`Team: ${filter.salesManagerName}`);
  }
  if (filter.pendingCancellationsOnly) {
    parts.push("Pending cancel");
  }
  return parts.length > 0 ? parts.join(" · ") : "All deals";
}

export type BookingDealFilterQueryParams = {
  assignee?: string;
  cancellationStatus?: string;
};

export function bookingDealFilterQueryParams(
  filter: BookingDealFilterState,
): BookingDealFilterQueryParams {
  const params: BookingDealFilterQueryParams = {};
  if (filter.salesExecutiveName.trim()) {
    params.assignee = filter.salesExecutiveName.trim();
  }
  if (filter.pendingCancellationsOnly) {
    params.cancellationStatus = "PENDING";
  }
  return params;
}

function uniqueScopes(scopes: string[]): string[] {
  return [...new Set(scopes.map((s) => s.trim()).filter(Boolean))];
}

function teamExecutivesForManager(
  roster: IncentivesRoster,
  managerId: number | null,
): IncentiveMemberRef[] {
  if (!managerId) return [];
  return roster.executives.filter((exec) => exec.managerId === managerId);
}

function scopesForExecutives(executives: IncentiveMemberRef[]): string[] {
  return uniqueScopes(executives.flatMap((exec) => assigneeScopeForExecutive(exec)));
}

export function executivesForManager(
  roster: IncentivesRoster,
  managerId: number | null,
): IncentiveMemberRef[] {
  if (!managerId) return [];
  return teamExecutivesForManager(roster, managerId).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/** Turn UI draft + roster into applied filter (names + assignee scopes). */
export function buildAppliedBookingDealFilters(
  draft: BookingDealFilterDraft,
  roster: IncentivesRoster,
  viewerRole: string,
): BookingDealFilterState {
  const role = normalizeRole(viewerRole);
  const isSalesManager = role === "SALES_MANAGER" || role === "MANAGER";

  const executive = draft.salesExecutiveId
    ? roster.executives.find((e) => e.id === draft.salesExecutiveId) ?? null
    : null;

  const managerId = isSalesManager ? roster.viewer.id || null : draft.salesManagerId;

  const shouldScopeTeam =
    executive != null ||
    (isSalesManager && managerId != null && draft.salesExecutiveId == null) ||
    (!isSalesManager && draft.salesManagerId != null);

  if (!shouldScopeTeam) {
    return {
      ...DEFAULT_BOOKING_DEAL_FILTERS,
      pendingCancellationsOnly: draft.pendingCancellationsOnly,
    };
  }

  const manager =
    roster.managers.find((m) => m.id === managerId) ??
    (managerId === roster.viewer.id
      ? ({
          id: roster.viewer.id,
          name: roster.viewer.name,
          role: roster.viewer.role,
        } as IncentiveMemberRef)
      : null);

  let teamAssigneeScopes: string[] = [];
  let salesExecutiveName = "";

  if (executive) {
    teamAssigneeScopes = assigneeScopeForExecutive(executive);
    salesExecutiveName = executive.name;
  } else if (managerId) {
    teamAssigneeScopes = scopesForExecutives(teamExecutivesForManager(roster, managerId));
  }

  return {
    salesManagerId: managerId,
    salesExecutiveId: executive?.id ?? null,
    salesManagerName: manager?.name ?? "",
    salesExecutiveName,
    teamAssigneeScopes,
    pendingCancellationsOnly: draft.pendingCancellationsOnly,
  };
}

export function dealAssignMatchesScope(assign: string, scopes: string[]): boolean {
  const scopeSet = new Set(scopes.map((s) => s.trim().toLowerCase()).filter(Boolean));
  if (scopeSet.size === 0) return true;
  const assignNorm = assign.trim().toLowerCase();
  if (!assignNorm || assignNorm === "—") return false;
  if (scopeSet.has(assignNorm)) return true;
  for (const token of scopeSet) {
    if (assignNorm.includes(token) || token.includes(assignNorm)) return true;
  }
  return false;
}

export function filterDealRowsByAssigneeScope(
  rows: import("@/app/Components/BookingToken/types").DealRow[],
  scopes: string[],
): import("@/app/Components/BookingToken/types").DealRow[] {
  if (scopes.length === 0) return rows;
  return rows.filter((row) => dealAssignMatchesScope(row.assign, scopes));
}
