import { normalizeRole } from "@/lib/auth/api";
import { getLeadTypeFilterOptions } from "@/lib/crm-role-access";
import {
  canUsePresalesHierarchyFilters,
  isAdminRole,
  isPresalesRole,
} from "@/lib/roleUtils";
import type {
  SummaryDuration,
  SummaryHubFilters,
  SummaryPeriod,
} from "./types";

export const PERIOD_OPTIONS: { value: SummaryPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "last3Days", label: "Last 3 days" },
  { value: "last7Days", label: "Last 7 days" },
  { value: "last1Month", label: "Last 1 month" },
  { value: "last3Months", label: "Last 3 months" },
  { value: "all", label: "All periods" },
];

export const DURATION_OPTIONS: { value: SummaryDuration; label: string }[] = [
  { value: "any", label: "Any duration" },
  { value: "under1Min", label: "Under 1 min" },
  { value: "twoToThreeMin", label: "2–3 min" },
  { value: "fiveToTenMin", label: "5–10 min" },
  { value: "tenToFifteenMin", label: "10–15 min" },
];

export const REINQUIRY_OPTIONS = [
  { value: "", label: "All" },
  { value: "true", label: "Reinquiry only" },
  { value: "false", label: "Non-reinquiry only" },
];

/** Role-based hub filter visibility — mirrors mobile `LeadFilterVisibility` + branch rule. */
export type HubFilterVisibility = {
  branch: boolean;
  salesAdmin: boolean;
  salesManager: boolean;
  salesExecutive: boolean;
  assignee: boolean;
  presalesManager: boolean;
  presalesExecutive: boolean;
  reinquiry: boolean;
  leadType: boolean;
  sort: boolean;
};

export function hubFilterVisibilityForRole(
  role: string,
  workspace: "sales" | "presales" = "sales",
): HubFilterVisibility {
  const r = normalizeRole(role);
  const isPresales = workspace === "presales" || isPresalesRole(r);
  const isSalesWorkspace = !isPresales;
  const isSalesExec = r === "SALES_EXECUTIVE";
  const isSalesMgr = r === "SALES_MANAGER";
  const isAdmin = isAdminRole(r);
  const isSalesAdmin = r === "SALES_ADMIN";
  const isPresalesFlow = isPresalesRole(r);
  const showPresalesHierarchy =
    isPresales && canUsePresalesHierarchyFilters(r);

  return {
    branch: isAdmin || isSalesAdmin,
    salesAdmin: isSalesWorkspace && isAdmin,
    salesManager:
      isSalesWorkspace && !isSalesMgr && !isSalesExec && !isPresalesFlow,
    salesExecutive:
      (isSalesWorkspace && !isSalesExec && !isPresalesFlow) ||
      r === "PRESALES_MANAGER",
    assignee:
      isSalesWorkspace && !isSalesMgr && !isSalesExec && !isPresalesFlow,
    presalesManager: showPresalesHierarchy,
    presalesExecutive: showPresalesHierarchy || r === "PRESALES_MANAGER",
    reinquiry: isPresales,
    leadType: true,
    sort: true,
  };
}

export function leadTypeOptionsForRole(role: string) {
  return getLeadTypeFilterOptions(role)
    .filter((o) => o.value !== "all")
    .map((o) => ({ value: String(o.value), label: o.label }));
}

export function sortOptionsForRole(role: string) {
  const r = normalizeRole(role);
  const showMeeting =
    !isPresalesRole(r) &&
    r !== "SALES_EXECUTIVE" &&
    r !== "PRESALES_EXECUTIVE";
  const options = [
    { value: "updatedAt,desc", label: "Updated: Newest" },
    { value: "updatedAt,asc", label: "Updated: Oldest" },
    { value: "createdAt,desc", label: "Created: Newest" },
    { value: "createdAt,asc", label: "Created: Oldest" },
    { value: "followUpDate,asc", label: "Follow-up: Soonest" },
    { value: "followUpDate,desc", label: "Follow-up: Latest" },
  ];
  if (showMeeting) {
    options.push(
      { value: "meetingDate,asc", label: "Meeting: Soonest" },
      { value: "meetingDate,desc", label: "Meeting: Latest" },
    );
  }
  return options;
}

export function hubActiveFilterCount(hub: SummaryHubFilters): number {
  let n = 0;
  if (hub.branch) n++;
  if (hub.salesAdmin) n++;
  if (hub.salesManager) n++;
  if (hub.salesExecutive) n++;
  if (hub.presalesManager) n++;
  if (hub.presalesExecutive) n++;
  if (hub.assignee) n++;
  if (hub.reinquiry) n++;
  return n;
}

export function resolvePeriodRange(
  period: SummaryPeriod,
  now = new Date(),
): { from: Date | null; to: Date | null } {
  if (period === "all") return { from: null, to: null };

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case "today":
      break;
    case "last3Days":
      start.setDate(start.getDate() - 2);
      break;
    case "last7Days":
      start.setDate(start.getDate() - 6);
      break;
    case "last1Month":
      start.setMonth(start.getMonth() - 1);
      break;
    case "last3Months":
      start.setMonth(start.getMonth() - 3);
      break;
  }
  return { from: start, to: end };
}

export function resolveDurationRange(
  duration: SummaryDuration,
): { minSec: number; maxSec: number } | null {
  switch (duration) {
    case "under1Min":
      return { minSec: 0, maxSec: 59 };
    case "twoToThreeMin":
      return { minSec: 120, maxSec: 180 };
    case "fiveToTenMin":
      return { minSec: 300, maxSec: 600 };
    case "tenToFifteenMin":
      return { minSec: 600, maxSec: 900 };
    default:
      return null;
  }
}

export function canViewCallSyncHealth(role: string): boolean {
  const r = normalizeRole(role);
  return (
    isAdminRole(r) ||
    r === "SALES_ADMIN" ||
    r === "SALES_MANAGER" ||
    r === "PRESALES_MANAGER"
  );
}

/** Mobile `canSeePerExecutiveSummary` — same gate as sync health. */
export function canSeePerExecutiveSummary(role: string): boolean {
  return canViewCallSyncHealth(role);
}
