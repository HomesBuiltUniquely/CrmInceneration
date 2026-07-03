"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { ApiLead, CrmLeadType, LeadRowModel, LeadSourceCounts, SpringPage } from "@/lib/leads-filter";
import { CRM_LEAD_TYPES } from "@/lib/leads-filter";
import {
  asCrmLeadType,
  crmLeadAssigneeLabel,
  crmLeadTopLevelStage,
  isCrmLeadVerified,
  mapApiLeadToRow,
  parseLeadSortTimestamp,
} from "@/lib/leads-filter";
import {
  collectHierarchyUserAssigneeAliases,
  hierarchyUserDisplayName,
  normalizeLegacyHierarchyUser,
  resolveAssigneeScopeForDisplayName,
  resolveHierarchyUserByDisplayName,
} from "@/lib/hierarchy-user-display";
import { fetchCrmPipeline } from "@/lib/crm-pipeline";
import {
  applyStoredPresalesMilestoneToApiLead,
} from "@/lib/lead-presales-milestone-store";
import {
  computeLeadTypeCountsFromRows,
  pickMilestoneRepresentativeRows,
  pickPrimarySourceRows,
} from "@/lib/primary-source-leads";
import {
  adminByLeadTypeToSourceCounts,
  fetchAllAdminLeads,
  fetchAdminLeadsHeatmapData,
  fetchAdminLeadsMilestoneFiltered,
  fetchAdminLeadsPage,
  milestoneCountsFromLeads,
  presalesSummaryMetricsFromLeads,
  salesJourneySummaryFromMilestoneCounts,
  usesAdminLeadsApi,
  usesAdminSalesPoolForAssigneeScope,
} from "@/lib/admin-leads-api";
import {
  pickLeadTypeCountsFromHeatmap,
  buildCrossPoolHeatmapFilterInput,
  type CrossPoolLeadTypeCounts,
} from "@/lib/lead-type-tile-pool";
import {
  appendLeadPoolQuery,
  appendWorkspaceMilestoneFilterQuery,
  defaultVerificationForLeadTypeFilter,
  isDedicatedFilterLeadType,
  leadMatchesWorkspaceMilestoneFilter,
  pipelineRoleForWorkspace,
  type CrmWorkspace,
} from "@/lib/crm-workspace";
import { canUsePresalesHierarchyFilters, crmPipelineRoleParam } from "@/lib/roleUtils";
import { nestedStageForSelection } from "@/lib/milestone-filter-tree";
import type { CrmNestedStage } from "@/types/crm-pipeline";
import { getCrmAuthHeaders, readStoredCrmToken } from "@/lib/crm-client-auth";
import { assignmentApi } from "@/lib/assignment-api";
import {
  assigneeRoleFromLead,
  isPresalesAssigneeRole,
  requiresReassignReason,
  validateReassignReason,
} from "@/lib/assignment-reassign";
import { adminPanelApi } from "@/lib/admin-panel-api";
import {
  canLoadAllUsers,
  CRM_ROLE_STORAGE_KEY,
  fetchSalesExecutivesForManager,
  getAuthApiBaseUrl,
  normalizeRole,
} from "@/lib/auth/api";
import { isPresalesRole } from "@/lib/crm-role-access";
import { shouldPresalesExecutiveSeeLeadInCrmPool } from "@/lib/presales-lead-visibility";
import { trustPresalesUpstreamLeadScope } from "@/lib/presales-leads-pool";
import LeadsTable from "./LeadsTable";
import LeadsToolbar from "./LeadsToolbar";
import { useGlobalNotifier } from "../Shared/GlobalNotifier";
import {
  assigneeAliasNorms,
  computeFollowUpInsightCounts,
  filterLeadsForInsightMode,
  isFirstCallDelayedLead,
  normalizeInsightCountOpts,
  type InsightTableMode,
} from "@/lib/lead-follow-up-insights";
import {
  computeAutoFollowUpDateToPersist,
  persistAutoFollowUpDatesForLeads,
} from "@/lib/lead-follow-up-persist";
import { computeLostSegmentCounts, isLostPathLead, shouldShowLostPathLeadsInTable } from "@/lib/lead-lost-segment";
import { isExecutiveAssigneeRole, includeInactiveExecutivesInHierarchyFilters, isUserActive } from "@/lib/user-active";
import {
  mergeSalesPoolInsightCounts,
  roleUsesAdminPoolInsightTiles,
  salesAdminPoolInsightOpts,
  salesInsightCountLeads,
} from "@/lib/sales-admin-insight-tiles";
import {
  countSalesManagerMineVsTeam,
  narrowSalesManagerLeadsIfTeamKnown,
} from "@/lib/sales-manager-lead-scope";
import { computeMilestoneTileCounts } from "@/lib/lead-milestone-insight-tiles";
import {
  filterLeadsByAssigneeScope,
  formatAssigneeAliasSetQuery,
} from "@/lib/admin-assignee-match";
import { leadAssignedToPresalesExecNameSet } from "@/lib/presales-heatmap-helpers";
import {
  setEffectiveNewCrmStartDate,
} from "@/lib/new-crm-cutoff";
import { appendCrmDateFilters, type CrmDateFieldSelection } from "@/lib/crm-date-field-filter";

type Props = {
  search: string;
  leadType: string;
  sort: string;
  assignee: string;
  dateFrom: string;
  dateTo: string;
  dateField: CrmDateFieldSelection;
  milestoneStage: string;
  milestoneStageCategory: string;
  milestoneSubStage: string;
  reinquiry: string;
  leadView?: "default" | "my" | "team" | "combined";
  currentUserName?: string;
  currentUserAliases?: string[];
  currentUserId?: number;
  managerTeamNamesFromHeader?: string[];
  /** From layout; avoids empty-role first paint so filter badge does not count forced exec assignee. */
  authRole?: string;
  /** Optional CRM filter; forwarded to `/api/crm/leads` as `verificationStatus`. */
  verificationStatus?: string;
  /** Resolved server-side to calendar month (`crmMonthWindow=current`) — do not set toolbar dates. */
  crmMonthWindow?: string;
  /** Clear parent presales tab when toolbar reset runs (optional). */
  onPresalesSummaryClear?: () => void;
  /** Presales manager “Team verified” tab — list only executives under the manager, not the manager’s own leads. */
  presalesTeamExecutivesOnly?: boolean;
  presalesTeamExecDisplayNames?: string[];
  onLeadTypeChange: (next: string) => void;
  onSortChange: (next: string) => void;
  onAssigneeChange: (next: string) => void;
  onDateFromChange: (next: string) => void;
  onDateToChange: (next: string) => void;
  onDateFieldChange: (next: CrmDateFieldSelection) => void;
  onMilestoneStageChange: (next: string) => void;
  onMilestoneStageCategoryChange: (next: string) => void;
  onMilestoneSubStageChange: (next: string) => void;
  onReinquiryChange: (next: string) => void;
  /** Keeps Journey Phase Heatmap assignee filter aligned with toolbar (Sales Exec, etc.). */
  onHeatmapAssigneeSync?: (effectiveAssignee: string) => void;
  /** Manager filters resolve to a team scope instead of a single assignee. */
  onHeatmapAssigneeScopeSync?: (assignees: string[]) => void;
  /** Fast Lead / Opportunity totals for the heatmap summary cards. */
  onHeatmapSummarySync?: (summary: { lead: number; opportunity: number } | null) => void;
  /** Admin pool milestone breakdown for heatmap (avoids duplicate /counts calls). */
  onAdminMilestoneCountsSync?: (
    counts: Record<string, number> | undefined,
    workspace: CrmWorkspace,
  ) => void;
  /** Presales admin Total / Verified cards (from shared /counts). */
  onAdminPresalesSummarySync?: (metrics: {
    totalMonth: number;
    verifiedMonth: number;
    teamVerifiedMonth: number;
  }) => void;
  /** Keeps heatmap phase counts aligned with the active insight filter (e.g. Team Leads). */
  onInsightTableModeChange?: (mode: InsightTableMode) => void;
  /** Super-admin `/presales-leads`: restrict merged list + counts to these assignee display names (PM + PE). */
  superAdminPresalesAssigneeNames?: string[];
  /** Resets search and all header filters (passed up to Header). */
  onResetAll?: () => void;
  /** Route workspace: sales `/Leads` vs presales `/presales-leads`. */
  leadsWorkspace?: CrmWorkspace;
};

type SubStatusResp = {
  mappings?: Array<{ stage: string; stageCategory: string; subStageName: string }>;
};
type HierarchyUser = {
  id: number;
  fullName?: string;
  name?: string;
  username?: string;
  managerId?: number | null;
  role?: string;
  active?: boolean;
};

type AssigneeUser = {
  userId: number;
  name: string;
  role: string;
};

import {
  buildLeadsListCacheKey,
  clearLeadsScrollRestoreFlag,
  getLeadsScrollRoot,
  getPersistedLeadsScrollY,
  mergeLeadsViewPersistedState,
  readLeadsListCache,
  readLeadsViewPersistedState,
  scheduleLeadsListScrollRestore,
  shouldRestoreLeadsListScroll,
  writeLeadsListCache,
  type LeadsViewPersistedState,
} from "@/lib/leads-view-persist";

function isHierarchyAdminRole(role?: string): boolean {
  return includeInactiveExecutivesInHierarchyFilters(role);
}

async function fetchMergedSalesExecutivesForFilters(
  authHeaders: HeadersInit,
  includeInactive = false,
): Promise<HierarchyUser[]> {
  const authBase = getAuthApiBaseUrl();
  const [byRoleRes, legacyRes] = await Promise.all([
    fetch(`${authBase}/api/auth/users-by-role?role=${encodeURIComponent("SALES_EXECUTIVE")}`, {
      cache: "no-store",
      headers: authHeaders,
      credentials: "include",
    }),
    fetch(`/api/sales-executive/all`, {
      cache: "no-store",
      credentials: "include",
      headers: getCrmAuthHeaders({ Accept: "application/json" }),
    }),
  ]);

  const byRoleRows: HierarchyUser[] = [];
  if (byRoleRes.ok) {
    const j = (await byRoleRes.json().catch(() => [])) as unknown;
    byRoleRows.push(...(Array.isArray(j) ? (j as HierarchyUser[]) : []));
  }

  const legacyRows: HierarchyUser[] = [];
  if (legacyRes.ok) {
    const j = (await legacyRes.json().catch(() => [])) as unknown;
    const raw = Array.isArray(j)
      ? j
      : j && typeof j === "object" && Array.isArray((j as { data?: unknown }).data)
        ? ((j as { data: unknown[] }).data ?? [])
        : [];
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      legacyRows.push(normalizeLegacyHierarchyUser(row as Record<string, unknown>));
    }
  }

  const byId = new Map<number, HierarchyUser>();
  for (const row of [...byRoleRows, ...legacyRows]) {
    const id = Number(row.id ?? 0);
    if (id <= 0) continue;
    const prev = byId.get(id);
    byId.set(id, {
      ...prev,
      ...row,
      id,
      fullName: hierarchyUserDisplayName(row) || prev?.fullName,
      name: row.name ?? prev?.name,
      username: row.username ?? prev?.username,
    });
  }
  const merged = [...byId.values()].filter((u) => Number(u.id ?? 0) > 0);
  return includeInactive ? merged : merged.filter((u) => isUserActive(u));
}

function getAllowedRoleQueries(role?: string): string[] {
  switch (normalizeRole(role ?? "")) {
    case "SUPER_ADMIN":
    case "ADMIN":
    case "SALES_ADMIN":
      return [
        "SALES_ADMIN",
        "SALES_MANAGER",
        "SALES_EXECUTIVE",
        "PRESALES_MANAGER",
        "PRESALES_EXECUTIVE",
        "PRE_SALES",
      ];
    case "SALES_MANAGER":
      return ["SALES_EXECUTIVE", "PRESALES_MANAGER"];
    case "PRESALES_MANAGER":
      return ["PRESALES_EXECUTIVE"];
    case "PRESALES_EXECUTIVE":
    case "PRE_SALES":
    default:
      return [];
  }
}

function mapRowToAssigneeUser(
  row: Record<string, unknown>,
  roleOverride?: string,
): AssigneeUser | null {
  const role = normalizeRole(roleOverride ?? String(row.role ?? ""));
  if (isExecutiveAssigneeRole(role) && !isUserActive(row as { active?: boolean; isActive?: boolean })) {
    return null;
  }
  const userId = Number(row.id ?? row.userId ?? 0);
  if (userId <= 0) return null;
  const name = String(row.fullName ?? row.name ?? row.username ?? `User ${userId}`).trim();
  return {
    userId,
    name: name || `User ${userId}`,
    role,
  };
}

function dedupeAssigneeUsers(users: AssigneeUser[]): AssigneeUser[] {
  return [...new Map(users.map((u) => [u.userId, u])).values()];
}

async function fetchAssigneesByRoleQuery(role: string): Promise<AssigneeUser[]> {
  const res = await fetch(
    `${getAuthApiBaseUrl()}/api/auth/users-by-role?role=${encodeURIComponent(role)}`,
    { headers: getCrmAuthHeaders(), credentials: "include", cache: "no-store" },
  );
  if (!res.ok) return [];
  const data = (await res.json().catch(() => [])) as unknown;
  if (!Array.isArray(data)) return [];
  return dedupeAssigneeUsers(
    data
      .map((row) => mapRowToAssigneeUser(row as Record<string, unknown>, role))
      .filter((u): u is AssigneeUser => Boolean(u)),
  );
}

async function fetchManagerSalesExecutivesForAssign(
  managerUserId: number,
): Promise<AssigneeUser[]> {
  const fromRole = await fetchAssigneesByRoleQuery("SALES_EXECUTIVE");
  if (fromRole.length > 0) return fromRole;

  const merged: AssigneeUser[] = [];
  const token = readStoredCrmToken();
  if (token) {
    const fromManagerApi = await fetchSalesExecutivesForManager(token);
    for (const row of fromManagerApi) {
      const user = mapRowToAssigneeUser(row, "SALES_EXECUTIVE");
      if (user) merged.push(user);
    }
  }

  if (managerUserId > 0) {
    try {
      const legacyRes = await fetch(`/api/sales-executive/all`, {
        cache: "no-store",
        credentials: "include",
        headers: getCrmAuthHeaders({ Accept: "application/json" }),
      });
      if (legacyRes.ok) {
        const j = (await legacyRes.json().catch(() => [])) as unknown;
        const raw = Array.isArray(j)
          ? j
          : j && typeof j === "object" && Array.isArray((j as { data?: unknown }).data)
            ? ((j as { data: unknown[] }).data ?? [])
            : [];
        for (const row of raw) {
          if (!row || typeof row !== "object") continue;
          const rec = row as Record<string, unknown>;
          if (Number(rec.managerId ?? 0) !== Number(managerUserId)) continue;
          const user = mapRowToAssigneeUser(
            normalizeLegacyHierarchyUser(rec) as unknown as Record<string, unknown>,
            "SALES_EXECUTIVE",
          );
          if (user) merged.push(user);
        }
      }
    } catch {
      // Legacy roster is optional.
    }
  }

  return dedupeAssigneeUsers(merged);
}

type AssignmentMode = "AUTO" | "MANUAL";
type RowAssignLead = {
  id: string;
  name: string;
  leadType: string;
  currentAssignee: string;
  verified: boolean;
  currentAssigneeRole: string;
};

const EMPTY_ASSIGNEE_SCOPE: string[] = [];

function normText(value: string): string {
  return value.trim().toLowerCase();
}

function looseNameToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function namesLooselyEqual(left: string, right: string): boolean {
  const a = looseNameToken(left);
  const b = looseNameToken(right);
  if (!a || !b) return false;
  if (a === b) return true;
  // Handles common variant like "kulwant" vs "kulwanth".
  return a === `${b}h` || b === `${a}h`;
}

function resolveHierarchyUsersForFilter<T extends HierarchyUser>(
  displayName: string,
  users: T[],
): T[] {
  const exact = resolveHierarchyUserByDisplayName(displayName, users);
  if (exact.length > 0) return exact;
  return users.filter((u) =>
    collectHierarchyUserAssigneeAliases(u).some((alias) =>
      namesLooselyEqual(alias, displayName),
    ),
  );
}

function buildHierarchyScopedAssignees(args: {
  workspace: CrmWorkspace;
  salesManagerFilter: string;
  salesExecFilter: string;
  presalesManagerFilter: string;
  presalesExecFilter: string;
  salesManagers: HierarchyUser[];
  salesExecs: HierarchyUser[];
  presalesManagers: HierarchyUser[];
  presalesExecs: HierarchyUser[];
}): string[] {
  if (args.salesExecFilter.trim() || args.presalesExecFilter.trim()) return [];
  const salesManagerName = args.salesManagerFilter.trim();
  const presalesManagerName = args.presalesManagerFilter.trim();
  if (!salesManagerName && !presalesManagerName) return [];

  let salesExecUnderManager: HierarchyUser[] = [];
  let presalesMgrUnderManager: HierarchyUser[] = [];
  let presalesExecUnderManager: HierarchyUser[] = [];
  const managerNames: string[] = [];

  if (salesManagerName) {
    const selectedManagers = resolveHierarchyUsersForFilter(
      salesManagerName,
      args.salesManagers,
    ).filter((u) => Number(u.id ?? 0) > 0);
    if (selectedManagers.length > 0) {
      const managerIds = new Set(selectedManagers.map((u) => Number(u.id)));
      for (const manager of selectedManagers) {
        managerNames.push(...collectHierarchyUserAssigneeAliases(manager));
      }
      salesExecUnderManager = args.salesExecs.filter(
        (u) => managerIds.has(Number(u.managerId ?? 0)),
      );
      if (args.workspace === "presales") {
        presalesMgrUnderManager = args.presalesManagers.filter(
          (u) => managerIds.has(Number(u.managerId ?? 0)),
        );
        const presalesMgrIds = new Set(
          presalesMgrUnderManager.map((u) => Number(u.id)).filter((id) => id > 0),
        );
        presalesExecUnderManager = args.presalesExecs.filter((u) => {
          const mid = Number(u.managerId ?? 0);
          return mid > 0 && presalesMgrIds.has(mid);
        });
      }
    }
  } else if (presalesManagerName) {
    const selectedPresalesManagers = resolveHierarchyUsersForFilter(
      presalesManagerName,
      args.presalesManagers,
    ).filter((u) => Number(u.id ?? 0) > 0);
    if (selectedPresalesManagers.length > 0) {
      const presalesManagerIds = new Set(
        selectedPresalesManagers.map((u) => Number(u.id)),
      );
      for (const manager of selectedPresalesManagers) {
        managerNames.push(...collectHierarchyUserAssigneeAliases(manager));
      }
      presalesExecUnderManager = args.presalesExecs.filter(
        (u) => presalesManagerIds.has(Number(u.managerId ?? 0)),
      );
    }
  }

  return Array.from(
    new Set(
      [
        ...managerNames,
        ...salesExecUnderManager.flatMap((u) => collectHierarchyUserAssigneeAliases(u)),
        ...presalesMgrUnderManager.flatMap((u) => collectHierarchyUserAssigneeAliases(u)),
        ...presalesExecUnderManager.flatMap((u) =>
          collectHierarchyUserAssigneeAliases(u),
        ),
      ].filter(Boolean),
    ),
  );
}

const LEAD_SUMMARY_STAGES = new Set(["fresh lead", "discovery", "connection"]);
const OPPORTUNITY_SUMMARY_STAGES = new Set(["experience & design", "decision", "closed"]);

function leadStableIdentifier(lead: ApiLead): string {
  const row = lead as Record<string, unknown>;
  const fromFields = String(
    row.leadId ?? row.lead_identifier ?? row.leadIdentifier ?? row.uniqueId ?? "",
  ).trim();
  if (fromFields) return fromFields.toLowerCase();
  if (lead.id !== undefined && lead.id !== null) return String(lead.id);
  return "";
}

function dedupeAdminPoolLeads(leads: ApiLead[]): ApiLead[] {
  const byId = new Map<string, ApiLead>();
  let noIdSeq = 0;
  for (const lead of leads) {
    const leadIdentifier = leadStableIdentifier(lead);
    const key = leadIdentifier || `__noid_${noIdSeq++}`;
    if (!byId.has(key)) byId.set(key, lead);
  }
  return [...byId.values()];
}

function computeJourneySummaryCounts(leads: ApiLead[]): { lead: number; opportunity: number } {
  let lead = 0;
  let opportunity = 0;
  for (const item of leads) {
    const stage = crmLeadTopLevelStage(item).trim().toLowerCase();
    if (LEAD_SUMMARY_STAGES.has(stage)) {
      lead += 1;
      continue;
    }
    if (OPPORTUNITY_SUMMARY_STAGES.has(stage)) {
      opportunity += 1;
    }
  }
  return { lead, opportunity };
}

function appendAssigneeFilterQuery(
  qs: URLSearchParams,
  assignee: string,
  assigneeAliasSet?: string[],
) {
  if (assigneeAliasSet && assigneeAliasSet.length > 0) {
    qs.set("assigneeAliasSet", formatAssigneeAliasSetQuery(assigneeAliasSet));
  } else if (assignee.trim()) {
    qs.set("assignee", assignee.trim());
  }
}

async function fetchMergedPage(
  page: number,
  size: number,
  leadType: string,
  sort: string,
  search: string,
  assignee: string,
  dateFrom: string,
  dateTo: string,
  dateField: CrmDateFieldSelection,
  milestoneStage: string,
  milestoneStageCategory: string,
  milestoneSubStage: string,
  reinquiry: string,
  leadView: "default" | "my" | "team" | "combined" = "default",
  verificationStatus = "",
  crmMonthWindow = "",
  leadsWorkspace: CrmWorkspace = "sales",
  viewerRole = "",
  assigneeAliasSet?: string[],
): Promise<SpringPage<ApiLead>> {
  const normalizedLeadType = leadType.trim().toLowerCase();
  const normalizedViewerRole = normalizeRole(viewerRole);
  const usesRoleEndpoint = leadView === "my" || leadView === "team";
  const explicitVerification = verificationStatus.trim();
  const resolvedVerification =
    normalizedLeadType === "verified"
      ? "verified"
      : explicitVerification ||
        defaultVerificationForLeadTypeFilter(
          normalizedLeadType,
          leadsWorkspace,
          verificationStatus,
          viewerRole,
        );

  /** Walk-in / WhatsApp live on dedicated Hub resources — always use merge filter route. */
  if (isDedicatedFilterLeadType(normalizedLeadType)) {
    const qs = new URLSearchParams();
    qs.set("mergeAll", "1");
    qs.set("leadType", normalizedLeadType);
    qs.set("milestoneScope", "crm");
    qs.set("page", String(page));
    qs.set("size", String(size));
    qs.set("sort", sort);
    if (search.trim()) qs.set("search", search.trim());
    appendAssigneeFilterQuery(qs, assignee, assigneeAliasSet);
    appendCrmDateFilters(qs, { dateFrom, dateTo, dateField, crmMonthWindow });
    appendWorkspaceMilestoneFilterQuery(
      qs,
      leadsWorkspace,
      milestoneStage,
      milestoneStageCategory,
      milestoneSubStage,
    );
    if (reinquiry.trim()) qs.set("reinquiry", reinquiry.trim());
    if (resolvedVerification) qs.set("verificationStatus", resolvedVerification);
    appendLeadPoolQuery(qs, leadsWorkspace);
    const res = await fetch(`/api/crm/leads?${qs.toString()}`, {
      cache: "no-store",
      credentials: "include",
      headers: getCrmAuthHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401) throw new Error("Session expired. Please login again.");
      if (res.status === 403) throw new Error("You don't have access to this lead view.");
      throw new Error(text || `HTTP ${res.status}`);
    }
    const pageJson = (await res.json()) as SpringPage<ApiLead>;
    return {
      ...pageJson,
      content: Array.isArray(pageJson.content) ? pageJson.content : [],
      apiUnavailable: pageJson.apiUnavailable,
      message: pageJson.message,
    };
  }

  if (
    (normalizedViewerRole === "SALES_MANAGER" || normalizedViewerRole === "MANAGER") &&
    leadView === "combined"
  ) {
    const fetchRoleViewAllPages = async (roleView: "my" | "team"): Promise<ApiLead[]> => {
      const pageSize = 500;
      const all: ApiLead[] = [];
      let totalPages = 1;
      for (let pageNum = 0; pageNum < totalPages; pageNum += 1) {
        const qs = new URLSearchParams();
        qs.set("mergeAll", "1");
        qs.set("page", String(pageNum));
        qs.set("size", String(pageSize));
        qs.set("sort", sort);
        qs.set("leadType", normalizedLeadType === "verified" ? "all" : normalizedLeadType || "all");
        qs.set("milestoneScope", "crm");
        qs.set("roleView", roleView);
        if (search.trim()) qs.set("search", search.trim());
        appendAssigneeFilterQuery(qs, assignee, assigneeAliasSet);
        appendCrmDateFilters(qs, { dateFrom, dateTo, dateField, crmMonthWindow });
        appendWorkspaceMilestoneFilterQuery(
          qs,
          leadsWorkspace,
          milestoneStage,
          milestoneStageCategory,
          milestoneSubStage,
        );
        if (reinquiry.trim()) qs.set("reinquiry", reinquiry.trim());
        if (resolvedVerification) qs.set("verificationStatus", resolvedVerification);
        appendLeadPoolQuery(qs, leadsWorkspace);
        const res = await fetch(`/api/crm/leads?${qs.toString()}`, {
          cache: "no-store",
          credentials: "include",
          headers: getCrmAuthHeaders(),
        });
        if (!res.ok) {
          const text = await res.text();
          if (res.status === 401) throw new Error("Session expired. Please login again.");
          if (res.status === 403) throw new Error("You don't have access to this lead view.");
          throw new Error(text || `HTTP ${res.status}`);
        }
        const pageJson = (await res.json()) as SpringPage<ApiLead>;
        const chunk = Array.isArray(pageJson.content) ? pageJson.content : [];
        all.push(...chunk);
        totalPages = Math.max(1, Number(pageJson.totalPages ?? 1));
        if (chunk.length < pageSize) break;
      }
      return all;
    };

    const [myRows, teamRows] = await Promise.all([
      fetchRoleViewAllPages("my"),
      fetchRoleViewAllPages("team"),
    ]);
    const byId = new Map<string, ApiLead>();
    let noIdSeq = 0;
    for (const row of [...myRows, ...teamRows]) {
      const leadIdentifier = leadStableIdentifier(row);
      const key = leadIdentifier || `__noid_${noIdSeq++}`;
      if (!byId.has(key)) byId.set(key, row);
    }
    const merged = [...byId.values()].sort(
      (a, b) => parseLeadSortTimestamp(b) - parseLeadSortTimestamp(a),
    );
    const countBasis = leadsWorkspace === "sales" ? pickPrimarySourceRows(merged) : merged;
    const start = Math.max(0, page * size);
    const pageRows = countBasis.slice(start, start + size);
    return {
      content: pageRows,
      totalElements: countBasis.length,
      uniquePrimaryTotal: countBasis.length,
      totalRowCount: merged.length,
      totalPages: Math.max(1, Math.ceil(countBasis.length / Math.max(1, size))),
      number: page,
      size,
      sourceCounts: computeLeadTypeCountsFromRows(countBasis),
      summaryTotals: computeJourneySummaryCounts(countBasis),
    };
  }

  const managerAssigneePoolScope = usesAdminSalesPoolForAssigneeScope(
    viewerRole,
    leadsWorkspace,
    assigneeAliasSet?.length ?? 0,
  );
  if (
    (usesAdminLeadsApi(viewerRole) || managerAssigneePoolScope) &&
    !usesRoleEndpoint &&
    !isDedicatedFilterLeadType(normalizedLeadType)
  ) {
    const superAdminGlobalSearchAcrossPools =
      normalizeRole(viewerRole) === "SUPER_ADMIN" &&
      search.trim().length > 0;
    if (superAdminGlobalSearchAcrossPools) {
      const primaryWorkspace: CrmWorkspace = leadsWorkspace === "presales" ? "presales" : "sales";
      const secondaryWorkspace: CrmWorkspace =
        primaryWorkspace === "sales" ? "presales" : "sales";
      const poolSearchInput = (workspace: CrmWorkspace) => ({
        search,
        assignee: "",
        sort,
        dateFrom,
        dateTo,
        dateField,
        crmMonthWindow,
        verificationStatus:
          workspace === "presales" ? "" : resolvedVerification,
        reinquiry,
        milestoneStage: "",
        milestoneStageCategory: "",
        milestoneSubStage: "",
        leadType: normalizedLeadType === "verified" ? "all" : normalizedLeadType,
      });
      const [primaryAll, secondaryAll] = await Promise.all([
        fetchAllAdminLeads(
          { ...poolSearchInput(primaryWorkspace), workspace: primaryWorkspace },
          getCrmAuthHeaders(),
        ),
        fetchAllAdminLeads(
          { ...poolSearchInput(secondaryWorkspace), workspace: secondaryWorkspace },
          getCrmAuthHeaders(),
        ),
      ]);
      const primarySorted = [...(primaryAll.leads ?? [])].sort(
        (a, b) => parseLeadSortTimestamp(b) - parseLeadSortTimestamp(a),
      );
      const secondarySorted = [...(secondaryAll.leads ?? [])].sort(
        (a, b) => parseLeadSortTimestamp(b) - parseLeadSortTimestamp(a),
      );

      const primaryPoolLeads = dedupeAdminPoolLeads(primarySorted);
      const secondaryPoolLeads = dedupeAdminPoolLeads(secondarySorted);
      const deduped = new Map<string, ApiLead>();
      let noIdSeq = 0;
      for (const lead of [...primarySorted, ...secondarySorted]) {
        const leadIdentifier = leadStableIdentifier(lead);
        const key = leadIdentifier || `__noid_${noIdSeq++}`;
        if (!deduped.has(key)) deduped.set(key, lead);
      }
      const merged = [...deduped.values()];
      const primaryMerged = pickPrimarySourceRows(merged);
      const salesPoolTotal =
        primaryWorkspace === "sales" ? primaryPoolLeads.length : secondaryPoolLeads.length;
      const presalesPoolTotal =
        primaryWorkspace === "presales" ? primaryPoolLeads.length : secondaryPoolLeads.length;
      const start = Math.max(0, page * size);
      const pageRows = merged.slice(start, start + size);
      return {
        content: pageRows,
        totalElements: merged.length,
        uniquePrimaryTotal: primaryMerged.length,
        totalRowCount: merged.length,
        totalPages: Math.max(1, Math.ceil(merged.length / Math.max(1, size))),
        number: page,
        size,
        sourceCounts: computeLeadTypeCountsFromRows(merged),
        salesSearchTotal: salesPoolTotal,
        presalesSearchTotal: presalesPoolTotal,
      };
    }
    const pageJson = await fetchAdminLeadsPage(
      {
        workspace: leadsWorkspace,
        page,
        size,
        sort,
        search,
        assignee: assigneeAliasSet?.[0]?.trim() || assignee,
        assigneeAliasSet,
        dateFrom,
        dateTo,
        dateField,
        crmMonthWindow,
        verificationStatus: resolvedVerification,
        reinquiry,
        milestoneStage,
        milestoneStageCategory,
        milestoneSubStage,
        leadType: normalizedLeadType === "verified" ? "all" : normalizedLeadType,
      },
      getCrmAuthHeaders(),
    );
    return pageJson;
  }

  const qs = new URLSearchParams();
  const shouldMerge =
    usesRoleEndpoint || leadView === "combined" || normalizedLeadType === "all" || normalizedLeadType === "verified";
  const effectiveDateFrom = dateFrom.trim() || null;
  const effectiveDateTo = dateTo.trim() || null;
  const isNewCrmGlobalSearchMode = search.trim().length > 0;
  qs.set("mergeAll", shouldMerge ? "1" : "0");
  qs.set("page", usesRoleEndpoint ? "0" : String(page));
  qs.set("size", usesRoleEndpoint ? "500" : String(size));
  qs.set("sort", sort);
  qs.set("leadType", normalizedLeadType === "verified" ? "all" : normalizedLeadType || "all");
  qs.set("milestoneScope", "crm");
  if (isNewCrmGlobalSearchMode) qs.set("newCrmGlobalSearch", "true");
  if (search.trim()) qs.set("search", search.trim());
  appendAssigneeFilterQuery(qs, assignee, assigneeAliasSet);
  appendCrmDateFilters(qs, {
    dateFrom: effectiveDateFrom,
    dateTo: effectiveDateTo,
    dateField,
    crmMonthWindow,
  });
  appendWorkspaceMilestoneFilterQuery(
    qs,
    leadsWorkspace,
    milestoneStage,
    milestoneStageCategory,
    milestoneSubStage,
  );
  if (reinquiry.trim()) qs.set("reinquiry", reinquiry.trim());
  if (resolvedVerification) qs.set("verificationStatus", resolvedVerification);
  if (usesRoleEndpoint) qs.set("roleView", leadView);
  appendLeadPoolQuery(qs, leadsWorkspace);

  const res = await fetch(
    `/api/crm/leads?${qs.toString()}`,
    { cache: "no-store", credentials: "include", headers: getCrmAuthHeaders() }
  );
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) {
      throw new Error("Session expired. Please login again.");
    }
    if (res.status === 403) {
      throw new Error("You don't have access to this lead view.");
    }
    throw new Error(text || `HTTP ${res.status}`);
  }
  const pageJson = (await res.json()) as SpringPage<ApiLead>;
  return {
    ...pageJson,
    content: Array.isArray(pageJson.content) ? pageJson.content : [],
  };
}

async function fetchFilterOptions(
  leadView: "default" | "my" | "team" | "combined" = "default",
  viewerRole = "",
): Promise<{
  assignees: string[];
  stages: string[];
  categories: string[];
  subStages: string[];
}> {
  const leadsQs = new URLSearchParams({
    mergeAll: "1",
    milestoneScope: "crm",
    page: "0",
    size: "250",
    sort: "updatedAt,desc",
  });
  setEffectiveNewCrmStartDate(leadsQs, "");
  if (leadView === "my" || leadView === "team") {
    leadsQs.set("roleView", leadView);
  }
  // "combined" uses merged filter without roleView (same as default)
  const pipelineRole = crmPipelineRoleParam(normalizeRole(viewerRole));
  const subStatusQs = new URLSearchParams({ resource: "sub-status" });
  if (pipelineRole) subStatusQs.set("role", pipelineRole);

  const [leadsRes, subRes] = await Promise.all([
    fetch(`/api/crm/leads?${leadsQs.toString()}`, {
      cache: "no-store",
      credentials: "include",
      headers: getCrmAuthHeaders(),
    }),
    fetch(`/api/milestone-count?${subStatusQs.toString()}`, {
      cache: "no-store",
      credentials: "include",
      headers: getCrmAuthHeaders(),
    }),
  ]);

  const assignees = new Set<string>();
  if (leadsRes.ok) {
    const leads = (await leadsRes.json()) as SpringPage<ApiLead>;
    for (const lead of leads.content ?? []) {
      const t = crmLeadAssigneeLabel(lead);
      if (t) assignees.add(t);
    }
  }

  const stages = new Set<string>();
  const categories = new Set<string>();
  const subStages = new Set<string>();
  if (subRes.ok) {
    const data = (await subRes.json()) as SubStatusResp;
    for (const m of data.mappings ?? []) {
      const s = (m.stage ?? "").trim();
      const c = (m.stageCategory ?? "").trim();
      const sub = (m.subStageName ?? "").trim();
      if (s) stages.add(s);
      if (c) categories.add(c);
      if (sub) subStages.add(sub);
    }
  }

  return {
    assignees: [...assignees].sort((a, b) => a.localeCompare(b)),
    stages: [...stages].sort((a, b) => a.localeCompare(b)),
    categories: [...categories].sort((a, b) => a.localeCompare(b)),
    subStages: [...subStages].sort((a, b) => a.localeCompare(b)),
  };
}

function toAssignmentLeadType(leadType: string): string {
  if (leadType === "formlead") return "Form Lead";
  if (leadType === "glead") return "G Lead";
  if (leadType === "mlead") return "M Lead";
  if (leadType === "addlead") return "Add Lead";
  if (leadType === "websitelead") return "Website Lead";
  if (leadType === "walkinlead") return "Walk-in Lead";
  if (leadType === "whatsapplead") return "WhatsApp";
  return "Form Lead";
}

function groupRowsByLeadType(rows: LeadRowModel[]): Map<string, LeadRowModel[]> {
  const grouped = new Map<string, LeadRowModel[]>();
  for (const row of rows) {
    const list = grouped.get(row.leadType) ?? [];
    list.push(row);
    grouped.set(row.leadType, list);
  }
  return grouped;
}

function mergeBulkAssignPreviewResults(
  results: Array<Record<string, unknown>>,
): Record<string, unknown> {
  const byUser = new Map<string, Record<string, unknown>>();
  let allSuccess = true;
  let firstErrorMessage = "";

  for (const res of results) {
    if (res.success === false) {
      allSuccess = false;
      if (!firstErrorMessage && typeof res.message === "string") {
        firstErrorMessage = res.message;
      }
    }
    const distribution = Array.isArray(res.distribution) ? res.distribution : [];
    for (const item of distribution as Array<Record<string, unknown>>) {
      const key = String(item.userId ?? item.assigneeName ?? byUser.size);
      const prev = byUser.get(key);
      if (prev) {
        prev.leadCount = Number(prev.leadCount ?? 0) + Number(item.leadCount ?? 0);
      } else {
        byUser.set(key, { ...item });
      }
    }
  }

  return {
    success: allSuccess,
    message: firstErrorMessage || undefined,
    distribution: [...byUser.values()],
  };
}

function toAdminBulkDeletePath(leadType: string): string {
  if (leadType === "formlead") return "bulk-delete-formleads";
  if (leadType === "glead") return "bulk-delete-gleads";
  if (leadType === "mlead") return "bulk-delete-mleads";
  if (leadType === "addlead") return "bulk-delete-addleads";
  if (leadType === "walkinlead") return "bulk-delete-walkinleads";
  if (leadType === "whatsapplead") return "bulk-delete-whatsappleads";
  return "bulk-delete-websiteleads";
}

function toAdminDeleteAllPath(leadType: string): string {
  if (leadType === "formlead") return "delete-all-formleads";
  if (leadType === "glead") return "delete-all-gleads";
  if (leadType === "mlead") return "delete-all-mleads";
  if (leadType === "addlead") return "delete-all-addleads";
  if (leadType === "walkinlead") return "delete-all-walkinleads";
  if (leadType === "whatsapplead") return "delete-all-whatsappleads";
  return "delete-all-websiteleads";
}

function formatRoleForDeleteNotice(role: string): string {
  const normalized = normalizeRole(role);
  if (normalized === "SUPER_ADMIN") return "SuperAdmin";
  if (normalized === "SALES_ADMIN") return "SalesAdmin";
  if (!normalized) return "User";
  return normalized
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function deleteNoticeText(role: string, scope = "Delete All"): string {
  const actor = formatRoleForDeleteNotice(role);
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${scope} done by ${actor} at ${time}`;
}

async function deleteLeadRowsByType(leadType: string, ids: number[]) {
  const res = await fetch(`/api/admin/${toAdminBulkDeletePath(leadType)}`, {
    method: "DELETE",
    credentials: "include",
    headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ids }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok && body.success !== false) {
    return body;
  }
  // Fallback for unstable bulk-delete backend endpoints (observed on addlead in production):
  // retry selected IDs one-by-one through the proven lead DELETE route.
  if (ids.length > 0) {
    const failedIds: number[] = [];
    await Promise.all(
      ids.map(async (id) => {
        const single = await fetch(`/api/crm/lead/${leadType}/${id}`, {
          method: "DELETE",
          credentials: "include",
          headers: getCrmAuthHeaders(),
          cache: "no-store",
        });
        if (!single.ok) failedIds.push(id);
      }),
    );
    if (failedIds.length === 0) {
      return {
        success: true,
        message:
          "Bulk delete endpoint failed; deleted selected leads using safe fallback.",
      } as Record<string, unknown>;
    }
    throw new Error(
      `Delete failed for lead IDs: ${failedIds.join(", ")}.`,
    );
  }
  throw new Error(typeof body.message === "string" ? body.message : "Delete failed");
}

export default function LeadsDataSection({
  search,
  leadType,
  sort,
  assignee,
  dateFrom,
  dateTo,
  dateField,
  milestoneStage,
  milestoneStageCategory,
  milestoneSubStage,
  reinquiry,
  leadView = "default",
  currentUserName = "",
  currentUserAliases = [],
  currentUserId = 0,
  managerTeamNamesFromHeader = [],
  authRole: authRoleProp,
  verificationStatus: verificationStatusFromHeader = "",
  crmMonthWindow: crmMonthWindowProp = "",
  leadsWorkspace = "sales",
  onPresalesSummaryClear,
  presalesTeamExecutivesOnly = false,
  presalesTeamExecDisplayNames = [],
  onLeadTypeChange,
  onSortChange,
  onAssigneeChange,
  onDateFromChange,
  onDateToChange,
  onDateFieldChange,
  onMilestoneStageChange,
  onMilestoneStageCategoryChange,
  onMilestoneSubStageChange,
  onReinquiryChange,
  onHeatmapAssigneeSync,
  onHeatmapAssigneeScopeSync,
  onHeatmapSummarySync,
  onAdminMilestoneCountsSync,
  onAdminPresalesSummarySync,
  onInsightTableModeChange,
  superAdminPresalesAssigneeNames,
  onResetAll,
}: Props) {
  const persistedView = readLeadsViewPersistedState();
  const [page, setPage] = useState(
    Number.isFinite(Number(persistedView.page)) ? Math.max(0, Number(persistedView.page)) : 0,
  );
  const [size, setSize] = useState(
    Number.isFinite(Number(persistedView.size)) && Number(persistedView.size) > 0
      ? Number(persistedView.size)
      : 20,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SpringPage<ApiLead> | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [stageOrder, setStageOrder] = useState<string[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [assigneeOptions, setAssigneeOptions] = useState<string[]>([]);
  const [pipelineNested, setPipelineNested] = useState<CrmNestedStage[]>([]);
  const [leadTypeCounts, setLeadTypeCounts] = useState<Record<string, number>>({});
  const [leadTypeCountsPrimary, setLeadTypeCountsPrimary] = useState<LeadSourceCounts | null>(
    null,
  );
  const [leadTypeCountsAllRows, setLeadTypeCountsAllRows] = useState<LeadSourceCounts | null>(
    null,
  );
  const [visibleFilteredTotal, setVisibleFilteredTotal] = useState<number | null>(null);
  const [adminPoolDisplayTotals, setAdminPoolDisplayTotals] = useState<{
    uniquePrimary: number;
    totalRows: number;
  } | null>(null);
  const [superAdminSearchPoolTotals, setSuperAdminSearchPoolTotals] = useState<{
    sales: number;
    presales: number;
  } | null>(null);
  const [crossPoolLeadTypeCounts, setCrossPoolLeadTypeCounts] =
    useState<CrossPoolLeadTypeCounts | null>(null);
  /** Admin + milestone toolbar filter: full pool scanned client-side (RDS `milestone_stage`). */
  const [adminMilestoneTableLeads, setAdminMilestoneTableLeads] = useState<ApiLead[] | null>(
    null,
  );
  const [insightTableMode, setInsightTableMode] = useState<InsightTableMode>(() => {
    const mode = persistedView.insightTableMode;
    return (mode as InsightTableMode | null | undefined) ?? null;
  });
  const onHeatmapSummarySyncRef = useRef(onHeatmapSummarySync);
  onHeatmapSummarySyncRef.current = onHeatmapSummarySync;
  const onAdminMilestoneCountsSyncRef = useRef(onAdminMilestoneCountsSync);
  onAdminMilestoneCountsSyncRef.current = onAdminMilestoneCountsSync;
  const onAdminPresalesSummarySyncRef = useRef(onAdminPresalesSummarySync);
  onAdminPresalesSummarySyncRef.current = onAdminPresalesSummarySync;
  const lastHeatmapSummaryKeyRef = useRef("");
  const lastAssigneeScopeKeyRef = useRef("");
  const lastAdminMilestoneCountsKeyRef = useRef("");

  useEffect(() => {
    onInsightTableModeChange?.(insightTableMode);
  }, [insightTableMode, onInsightTableModeChange]);
  const [viewerRole, setViewerRole] = useState(() =>
    typeof window === "undefined"
      ? ""
      : normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? ""),
  );
  const [salesAdminFilter, setSalesAdminFilter] = useState(
    persistedView.salesAdminFilter ?? "",
  );
  const [salesManagerFilter, setSalesManagerFilter] = useState(
    persistedView.salesManagerFilter ?? "",
  );
  const [salesExecFilter, setSalesExecFilter] = useState(
    persistedView.salesExecFilter ?? "",
  );
  const [presalesManagerFilter, setPresalesManagerFilter] = useState(
    persistedView.presalesManagerFilter ?? "",
  );
  const [presalesExecFilter, setPresalesExecFilter] = useState(
    persistedView.presalesExecFilter ?? "",
  );
  const [salesAdmins, setSalesAdmins] = useState<HierarchyUser[]>([]);
  const [salesManagers, setSalesManagers] = useState<HierarchyUser[]>([]);
  const [salesExecs, setSalesExecs] = useState<HierarchyUser[]>([]);
  const [presalesManagers, setPresalesManagers] = useState<HierarchyUser[]>([]);
  const [presalesExecs, setPresalesExecs] = useState<HierarchyUser[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [assigneeUsers, setAssigneeUsers] = useState<AssigneeUser[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("AUTO");
  const [assigneeRoleFilter, setAssigneeRoleFilter] = useState<string>("ALL");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([]);
  const [manualPercentages, setManualPercentages] = useState<Record<number, number>>({});
  const [previewResult, setPreviewResult] = useState<Record<string, unknown> | null>(null);
  const [assignmentError, setAssignmentError] = useState<string>("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [deleteModalType, setDeleteModalType] = useState<"row" | "selected" | "all" | null>(null);
  const [deleteRowCandidate, setDeleteRowCandidate] = useState<LeadRowModel | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isExecuteLoading, setIsExecuteLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentRole, setCurrentRole] = useState(() =>
    typeof window === "undefined"
      ? ""
      : normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? ""),
  );
  const [rowAssignModalOpen, setRowAssignModalOpen] = useState(false);
  const [rowAssignLead, setRowAssignLead] = useState<RowAssignLead | null>(null);
  const [rowAssignUsers, setRowAssignUsers] = useState<AssigneeUser[]>([]);
  const [rowAssignUserId, setRowAssignUserId] = useState<number | null>(null);
  const [rowAssignLoadingUsers, setRowAssignLoadingUsers] = useState(false);
  const [rowAssignSubmitting, setRowAssignSubmitting] = useState(false);
  const [rowAssignError, setRowAssignError] = useState("");
  const [rowReassignReason, setRowReassignReason] = useState("");
  const [bulkReassignReason, setBulkReassignReason] = useState("");
  const { notifySuccess, notifyError, notifyInfo } = useGlobalNotifier();
  const [managerTeamNames, setManagerTeamNames] = useState<string[]>([]);
  const [relativeTime, setRelativeTime] = useState<string>("Never");
  const [isMinimized, setIsMinimized] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const isFirstMountRef = useRef(true);

  const formatRelativeTime = useCallback((date: Date | null): string => {
    if (!date) return "Never";
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 5) return "just now";
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes === 1) return "1 minute ago";
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours === 1) return "1 hour ago";
    if (diffInHours < 24) return `${diffInHours} hours ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return "Yesterday";
    return `${diffInDays} days ago`;
  }, []);

  useEffect(() => {
    const update = () => setRelativeTime(formatRelativeTime(lastRefreshTime));
    update();
    const timer = setInterval(update, 10000); 
    
    const activityTimer = setInterval(() => {
      if (!isMinimized && Date.now() - lastActivityRef.current > 5000) {
        setIsMinimized(true);
      }
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(activityTimer);
    };
  }, [lastRefreshTime, formatRelativeTime, isMinimized]);

  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (isMinimized) setIsMinimized(false);
  }, [isMinimized]);

  const handleResetAll = useCallback(() => {
    setPage(0);
    setSize(20);
    setInsightTableMode(null);
    setSalesAdminFilter("");
    setSalesManagerFilter("");
    setSalesExecFilter("");
    setPresalesManagerFilter("");
    setPresalesExecFilter("");
    onResetAll?.();
  }, [onResetAll]);

  useEffect(() => {
    if (leadsWorkspace === "sales") {
      if (presalesManagerFilter) setPresalesManagerFilter("");
      if (presalesExecFilter) setPresalesExecFilter("");
      if (reinquiry) onReinquiryChange("");
      return;
    }
    if (salesAdminFilter) setSalesAdminFilter("");
    if (salesManagerFilter) setSalesManagerFilter("");
    if (salesExecFilter) setSalesExecFilter("");
    if (assignee) onAssigneeChange("");
  }, [
    leadsWorkspace,
    presalesManagerFilter,
    presalesExecFilter,
    reinquiry,
    salesAdminFilter,
    salesManagerFilter,
    salesExecFilter,
    assignee,
    onAssigneeChange,
    onReinquiryChange,
  ]);

  const loadAssignableUsers = useCallback(async () => {
    const roleKey = normalizeRole(currentRole);
    try {
      if (canLoadAllUsers(roleKey)) {
        const rows = await adminPanelApi.listAllUsers();
        const eligibleRoles = new Set([
          "SALES_EXECUTIVE",
          "SALES_MANAGER",
          "PRESALES_MANAGER",
          "PRESALES_EXECUTIVE",
        ]);
        const mapped = dedupeAssigneeUsers(
          rows
            .filter((row) => {
              const role = normalizeRole(String(row.role ?? ""));
              if (!eligibleRoles.has(role)) return false;
              if (isExecutiveAssigneeRole(role)) {
                return isUserActive(row as { active?: boolean; isActive?: boolean });
              }
              return true;
            })
            .map((row) =>
              mapRowToAssigneeUser(row as Record<string, unknown>, String(row.role ?? "")),
            )
            .filter((u): u is AssigneeUser => Boolean(u)),
        );
        setAssigneeUsers(mapped);
        return mapped;
      }

      if (roleKey === "SALES_ADMIN" || roleKey === "ADMIN") {
        const roles = [
          "SALES_EXECUTIVE",
          "SALES_MANAGER",
          "PRESALES_MANAGER",
          "PRESALES_EXECUTIVE",
        ];
        const mapped = dedupeAssigneeUsers(
          (await Promise.all(roles.map((r) => fetchAssigneesByRoleQuery(r)))).flat(),
        );
        setAssigneeUsers(mapped);
        return mapped;
      }

      if (roleKey === "SALES_MANAGER" || roleKey === "MANAGER") {
        const mapped = await fetchManagerSalesExecutivesForAssign(currentUserId);
        setAssigneeUsers(mapped);
        return mapped;
      }

      if (roleKey === "PRESALES_MANAGER") {
        let mapped = await fetchAssigneesByRoleQuery("PRESALES_EXECUTIVE");
        if (mapped.length === 0) {
          mapped = await fetchAssigneesByRoleQuery("PRE_SALES");
        }
        setAssigneeUsers(mapped);
        return mapped;
      }

      setAssigneeUsers([]);
      return [];
    } catch {
      setAssigneeUsers([]);
      return [];
    }
  }, [currentRole, currentUserId]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const role = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
    setViewerRole(normalizeRole(role));
  }, []);

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    setPage(0);
  }, [
    assignee,
    dateFrom,
    dateTo,
    leadType,
    milestoneStage,
    milestoneStageCategory,
    milestoneSubStage,
    sort,
    debouncedSearch,
    verificationStatusFromHeader,
    crmMonthWindowProp,
    presalesTeamExecutivesOnly,
  ]);

  useEffect(() => {
    setPage(0);
  }, [size]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCurrentRole(normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (currentRole !== "SALES_MANAGER" || !currentUserId) {
      setManagerTeamNames([]);
      return;
    }
    const token = readStoredCrmToken();
    if (!token) {
      setManagerTeamNames([]);
      return;
    }
    void (async () => {
      try {
        const [users, legacyRes] = await Promise.all([
          fetchSalesExecutivesForManager(token),
          fetch(`/api/sales-executive/all`, {
            cache: "no-store",
            credentials: "include",
            headers: getCrmAuthHeaders({ Accept: "application/json" }),
          }),
        ]);
        if (cancelled) return;
        const names = new Set<string>();
        for (const u of users) {
          const n = hierarchyUserDisplayName(u as HierarchyUser);
          if (n) names.add(n);
        }
        if (legacyRes.ok) {
          const j = (await legacyRes.json().catch(() => [])) as unknown;
          const raw = Array.isArray(j)
            ? j
            : j && typeof j === "object" && Array.isArray((j as { data?: unknown }).data)
              ? ((j as { data: unknown[] }).data ?? [])
              : [];
          for (const row of raw) {
            if (!row || typeof row !== "object") continue;
            const rec = row as Record<string, unknown>;
            if (Number(rec.managerId ?? 0) !== Number(currentUserId)) continue;
            const n = hierarchyUserDisplayName(normalizeLegacyHierarchyUser(rec));
            if (n) names.add(n);
          }
        }
        setManagerTeamNames([...names]);
      } catch {
        if (!cancelled) setManagerTeamNames([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentRole, currentUserId]);


  useEffect(() => {
    if (currentRole === "SALES_MANAGER" || currentRole === "MANAGER") {
      setAssigneeRoleFilter("SALES_EXECUTIVE");
    } else if (currentRole === "PRESALES_MANAGER") {
      setAssigneeRoleFilter("PRESALES_EXECUTIVE");
    } else if (
      currentRole === "SUPER_ADMIN" ||
      currentRole === "ADMIN" ||
      currentRole === "SALES_ADMIN"
    ) {
      setAssigneeRoleFilter("ALL");
    }
  }, [currentRole]);

  useEffect(() => {
    let cancelled = false;
    void loadAssignableUsers()
      .then(() => {
        if (cancelled) return;
      })
      .catch(() => {
        if (!cancelled) setAssigneeUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAssignableUsers]);

  const clearSelection = useCallback(() => {
    setSelectedRowIds([]);
    setShowAssignModal(false);
    setDeleteModalType(null);
    setDeleteRowCandidate(null);
    setDeleteConfirmText("");
    setSelectedAssigneeIds([]);
    setManualPercentages({});
    setPreviewResult(null);
    setAssignmentError("");
    setRowAssignModalOpen(false);
    setRowAssignLead(null);
    setRowAssignUserId(null);
    setRowAssignError("");
    setRowReassignReason("");
    setBulkReassignReason("");
  }, []);

  const loadRowAssignUsers = useCallback(async () => {
    setRowAssignLoadingUsers(true);
    setRowAssignError("");
    try {
      const roleKey = normalizeRole(currentRole);
      if (roleKey === "SALES_MANAGER" || roleKey === "MANAGER") {
        const scoped = await fetchManagerSalesExecutivesForAssign(currentUserId);
        setRowAssignUsers(scoped);
        if (rowAssignUserId && !scoped.some((u) => u.userId === rowAssignUserId)) {
          setRowAssignUserId(null);
          setRowAssignError("Selected assignee is inactive now. Please choose another active user.");
        }
        return;
      }
      if (roleKey === "PRESALES_MANAGER") {
        let scoped = await fetchAssigneesByRoleQuery("PRESALES_EXECUTIVE");
        if (scoped.length === 0) scoped = await fetchAssigneesByRoleQuery("PRE_SALES");
        setRowAssignUsers(scoped);
        if (rowAssignUserId && !scoped.some((u) => u.userId === rowAssignUserId)) {
          setRowAssignUserId(null);
          setRowAssignError("Selected assignee is inactive now. Please choose another active user.");
        }
        return;
      }

      const roles = ["SALES_EXECUTIVE", "PRESALES_MANAGER", "PRESALES_EXECUTIVE", "PRE_SALES"];
      const responses = await Promise.all(
        roles.map((role) =>
          fetch(`${getAuthApiBaseUrl()}/api/auth/users-by-role?role=${encodeURIComponent(role)}`, {
            headers: getCrmAuthHeaders(),
            credentials: "include",
            cache: "no-store",
          }).then(async (res) => {
            if (!res.ok) return [];
            const data = (await res.json().catch(() => [])) as unknown;
            return Array.isArray(data) ? data : [];
          })
        )
      );
      const merged = responses.flat();
      const mapped = merged
        .map((row) => {
          const item = row as Record<string, unknown>;
          const active =
            item.active === undefined && item.isActive === undefined
              ? true
              : Boolean(item.active ?? item.isActive);
          return {
            userId: Number(item.id ?? 0),
            name: String(item.fullName ?? item.name ?? item.username ?? `User ${item.id}`),
            role: normalizeRole(item.role),
            active,
          };
        })
        .filter((row) => row.userId > 0 && row.active);
      const unique = Array.from(new Map(mapped.map((u) => [u.userId, u])).values());
      setRowAssignUsers(unique.map(({ userId, name, role }) => ({ userId, name, role })));
      if (rowAssignUserId && !unique.some((u) => u.userId === rowAssignUserId)) {
        setRowAssignUserId(null);
        setRowAssignError("Selected assignee is inactive now. Please choose another active user.");
      }
    } catch {
      setRowAssignUsers([]);
      setRowAssignError("Failed to load assignee list.");
    } finally {
      setRowAssignLoadingUsers(false);
    }
  }, [currentRole, currentUserId, rowAssignUserId]);

  useEffect(() => {
    const onStatusChanged = () => {
      void loadAssignableUsers().catch(() => setAssigneeUsers([]));
      if (rowAssignModalOpen) {
        void loadRowAssignUsers();
      }
    };
    window.addEventListener("crm:sales-executive-status-changed", onStatusChanged as EventListener);
    return () => {
      window.removeEventListener("crm:sales-executive-status-changed", onStatusChanged as EventListener);
    };
  }, [loadAssignableUsers, loadRowAssignUsers, rowAssignModalOpen]);

  useEffect(() => {
    clearSelection();
  }, [clearSelection, leadType, page, size, debouncedSearch, assignee, dateFrom, dateTo, dateField, milestoneStage, milestoneStageCategory, milestoneSubStage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (rowAssignModalOpen) {
        setRowAssignModalOpen(false);
        setRowAssignLead(null);
      }
      if (showAssignModal) {
        setShowAssignModal(false);
      }
      if (deleteModalType) {
        setDeleteModalType(null);
        setDeleteRowCandidate(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteModalType, rowAssignModalOpen, showAssignModal]);

  useEffect(() => {
    let cancelled = false;
    const auth = getCrmAuthHeaders();
    const authBase = getAuthApiBaseUrl();
    const rolesToFetch = getAllowedRoleQueries(currentRole);
    if (rolesToFetch.length === 0) {
      setSalesAdmins([]);
      setSalesManagers([]);
      setSalesExecs([]);
      setPresalesManagers([]);
      setPresalesExecs([]);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      try {
        const pairs = await Promise.all(
          rolesToFetch.map(async (roleName) => {
            try {
              const res = await fetch(
                `${authBase}/api/auth/users-by-role?role=${encodeURIComponent(roleName)}`,
                { cache: "no-store", headers: auth, credentials: "include" },
              );
              if (res.status === 403) {
                console.warn(`[RBAC] users-by-role 403 role=${roleName}, viewerRole=${currentRole}`);
                return [roleName, [] as HierarchyUser[]] as const;
              }
              if (!res.ok) {
                console.warn(`[RBAC] users-by-role failed role=${roleName}, status=${res.status}`);
                return [roleName, [] as HierarchyUser[]] as const;
              }
              const j = (await res.json().catch(() => [])) as unknown;
              const rows = Array.isArray(j) ? (j as HierarchyUser[]) : [];
              return [roleName, rows] as const;
            } catch (err) {
              console.warn(`[RBAC] users-by-role request failed role=${roleName}`, err);
              return [roleName, [] as HierarchyUser[]] as const;
            }
          }),
        );
        if (cancelled) return;

        let mergedSalesExecs: HierarchyUser[] = [];
        const includeInactiveExecs = includeInactiveExecutivesInHierarchyFilters(currentRole);
        if (isHierarchyAdminRole(currentRole)) {
          mergedSalesExecs = await fetchMergedSalesExecutivesForFilters(
            auth,
            includeInactiveExecs,
          );
        }

        const byRole = new Map<string, HierarchyUser[]>(pairs);
        const saJ = byRole.get("SALES_ADMIN") ?? [];
        const smJ = byRole.get("SALES_MANAGER") ?? [];
        const seJ = byRole.get("SALES_EXECUTIVE") ?? [];
        const pmJ = byRole.get("PRESALES_MANAGER") ?? [];
        const peJ = byRole.get("PRESALES_EXECUTIVE") ?? [];
        const preJ = byRole.get("PRE_SALES") ?? [];

        const salesExecList =
          mergedSalesExecs.length > 0
            ? mergedSalesExecs
            : seJ;

        setSalesAdmins(saJ.filter((u) => isUserActive(u)));
        setSalesManagers(smJ);
        setSalesExecs(
          includeInactiveExecs
            ? salesExecList.filter((u) => Number(u.id ?? 0) > 0)
            : salesExecList.filter((u) => Number(u.id ?? 0) > 0 && isUserActive(u)),
        );
        setPresalesManagers(pmJ);
        const mergedPresalesExecs = [...peJ, ...preJ];
        const dedupedPresalesExecs = Array.from(
          new Map(mergedPresalesExecs.map((u) => [u.id, u])).values(),
        );
        setPresalesExecs(
          includeInactiveExecs
            ? dedupedPresalesExecs
            : dedupedPresalesExecs.filter((u) => isUserActive(u)),
        );
      } catch {
        if (cancelled) return;
        setSalesAdmins([]);
        setSalesManagers([]);
        setSalesExecs([]);
        setPresalesManagers([]);
        setPresalesExecs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentRole]);

  useEffect(() => {
    let cancelled = false;
    if (currentRole !== "PRESALES_MANAGER") return;
    const auth = getCrmAuthHeaders();
    const authBase = getAuthApiBaseUrl();
    void fetch(`${authBase}/api/auth/users-by-role?role=PRESALES_EXECUTIVE`, {
      cache: "no-store",
      headers: auth,
      credentials: "include",
    })
      .then(async (pe) => {
        const parse = async (r: Response): Promise<HierarchyUser[]> => {
          if (!r.ok) return [];
          const j = (await r.json().catch(() => [])) as unknown;
          return Array.isArray(j) ? (j as HierarchyUser[]) : [];
        };
        const peJ = await parse(pe);
        let rows = peJ;
        if (rows.length === 0) {
          // Backend may block PRE_SALES role query for manager; try admin fallbacks.
          const [adminPe, adminPre, preSalesRes] = await Promise.all([
            fetch("/api/admin/users-by-role?role=PRESALES_EXECUTIVE", {
              cache: "no-store",
              headers: auth,
              credentials: "include",
            }).catch(() => null),
            fetch("/api/admin/users-by-role?role=PRE_SALES", {
              cache: "no-store",
              headers: auth,
              credentials: "include",
            }).catch(() => null),
            fetch("/api/admin/pre-sales", {
              cache: "no-store",
              headers: auth,
              credentials: "include",
            }).catch(() => null),
          ]);
          const adminRows = [
            ...(adminPe ? await parse(adminPe) : []),
            ...(adminPre ? await parse(adminPre) : []),
            ...(preSalesRes ? await parse(preSalesRes) : []),
          ];
          rows = adminRows;
        }
        if (cancelled) return;
        const mergedPresalesExecs = rows.filter((u) => {
          if (u.active === false) return false;
          if (normalizeRole(String(u.role ?? "")) !== "PRESALES_EXECUTIVE") return false;
          if (currentUserId > 0) return Number(u.managerId ?? 0) === Number(currentUserId);
          return true;
        });
        const dedupedPresalesExecs = Array.from(
          new Map(mergedPresalesExecs.map((u) => [u.id, u])).values(),
        );
        setPresalesExecs(dedupedPresalesExecs);
      })
      .catch(() => {
        if (cancelled) return;
        setPresalesExecs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentRole, currentUserId]);

  const userName = hierarchyUserDisplayName;
  const meNorm = (currentUserName ?? "").trim().toLowerCase();
  const meAliasSet = useMemo(
    () =>
      new Set(
        [meNorm, ...currentUserAliases.map((v) => v.trim().toLowerCase())].filter(Boolean)
      ),
    [currentUserAliases, meNorm]
  );
  const leadAssignedToSelfById = useCallback((lead: ApiLead): boolean => {
    if (!Number.isFinite(currentUserId) || currentUserId <= 0) return false;
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
    return idCandidates.some((v) => Number(v ?? 0) === Number(currentUserId));
  }, [currentUserId]);
  const leadAssignedToSelf = useCallback((lead: ApiLead): boolean => {
    if (leadAssignedToSelfById(lead)) return true;
    if (meAliasSet.size === 0) return false;
    const aliases = assigneeAliasNorms(lead);
    for (const meAlias of meAliasSet) {
      if (aliases.has(meAlias)) return true;
    }
    return false;
  }, [leadAssignedToSelfById, meAliasSet]);
  const canViewLeadByRole = useCallback(
    (lead: ApiLead, roleRaw: string) => {
      const roleKey = normalizeRole(roleRaw);
      if (roleKey === "SUPER_ADMIN" || roleKey === "ADMIN" || roleKey === "SALES_ADMIN") return true;

      const leadAliases = assigneeAliasNorms(lead);
      const isSelf = leadAssignedToSelf(lead);

      if (roleKey === "SALES_EXECUTIVE") {
        return isSelf;
      }

      if (roleKey === "PRESALES_EXECUTIVE" || roleKey === "PRE_SALES") {
        return shouldPresalesExecutiveSeeLeadInCrmPool(lead, {
          currentUserId,
          verificationStatusFilter: verificationStatusFromHeader,
          isSelfLead: leadAssignedToSelf,
        });
      }

      if (roleKey === "SALES_MANAGER" || roleKey === "MANAGER") {
        const scopedTeam =
          managerTeamNamesFromHeader.length > 0 ? managerTeamNamesFromHeader : managerTeamNames;
        const teamSet = new Set(scopedTeam.map((n) => n.trim().toLowerCase()).filter(Boolean));
        // Include all known aliases for manager-owned sales execs to match lead assignee variants.
        if (currentUserId > 0) {
          for (const exec of salesExecs) {
            if (Number(exec.managerId ?? 0) !== Number(currentUserId)) continue;
            for (const alias of collectHierarchyUserAssigneeAliases(exec)) {
              const n = alias.trim().toLowerCase();
              if (n) teamSet.add(n);
            }
          }
        }
        if (teamSet.size === 0) return isSelf;
        for (const alias of leadAliases) {
          if (teamSet.has(alias)) return true;
        }
        return isSelf;
      }

      if (roleKey === "PRESALES_MANAGER") {
        const teamFromHeader = presalesTeamExecDisplayNames
          .map((n) => n.trim().toLowerCase())
          .filter(Boolean);
        const teamFromHierarchy = presalesExecs
          .filter((u) => Number(u.managerId ?? 0) === Number(currentUserId))
          .map((u) => userName(u).trim().toLowerCase())
          .filter(Boolean);
        const presalesTeamSet = new Set([...teamFromHeader, ...teamFromHierarchy]);
        if (presalesTeamSet.size === 0) return isSelf;
        for (const alias of leadAliases) {
          if (presalesTeamSet.has(alias)) return true;
        }
        return isSelf;
      }

      return false;
    },
    [
      managerTeamNames,
      managerTeamNamesFromHeader,
      presalesExecs,
      presalesTeamExecDisplayNames,
      salesExecs,
      currentUserId,
      verificationStatusFromHeader,
      leadAssignedToSelf,
    ]
  );
  const clientScopeRoleKey = normalizeRole(authRoleProp ?? currentRole);
  const showPresalesHierarchyFilters = canUsePresalesHierarchyFilters(clientScopeRoleKey);
  const effectivePresalesManagerFilter = showPresalesHierarchyFilters ? presalesManagerFilter : "";
  const effectivePresalesExecFilter = showPresalesHierarchyFilters ? presalesExecFilter : "";

  useEffect(() => {
    if (showPresalesHierarchyFilters) return;
    if (presalesManagerFilter) setPresalesManagerFilter("");
    if (presalesExecFilter) setPresalesExecFilter("");
  }, [showPresalesHierarchyFilters, presalesManagerFilter, presalesExecFilter]);
  const managerTeamRoster =
    managerTeamNamesFromHeader.length > 0 ? managerTeamNamesFromHeader : managerTeamNames;
  const salesExecOptionsResolved = useMemo(() => {
    const fromHierarchy = salesExecs.map(userName).filter(Boolean);
    const fromAssigneeUsers = assigneeUsers
      .filter((u) => u.role === "SALES_EXECUTIVE")
      .map((u) => u.name.trim())
      .filter(Boolean);
    const fromUsers =
      fromHierarchy.length > 0
        ? fromHierarchy
        : fromAssigneeUsers.length > 0
          ? fromAssigneeUsers
          : [];

    const isSalesManagerScope =
      clientScopeRoleKey === "SALES_MANAGER" || clientScopeRoleKey === "MANAGER";
    const isAdminScope = isHierarchyAdminRole(clientScopeRoleKey);

    if (isSalesManagerScope || isAdminScope) {
      return Array.from(
        new Set([
          ...fromUsers,
          ...(isSalesManagerScope ? managerTeamRoster : []),
          ...(isAdminScope ? assigneeOptions : []),
        ]),
      ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    }

    if (fromUsers.length > 0) return fromUsers;
    if (fromAssigneeUsers.length > 0) return fromAssigneeUsers;
    return assigneeOptions;
  }, [salesExecs, assigneeUsers, managerTeamRoster, clientScopeRoleKey, assigneeOptions]);
  const requiresClientScopedDataset =
    clientScopeRoleKey === "SALES_MANAGER" ||
    clientScopeRoleKey === "MANAGER" ||
    clientScopeRoleKey === "SALES_EXECUTIVE" ||
    clientScopeRoleKey === "PRESALES_MANAGER" ||
    clientScopeRoleKey === "PRESALES_EXECUTIVE" ||
    clientScopeRoleKey === "PRE_SALES";
  const isGlobalSearchActive = debouncedSearch.trim().length > 0;
  const superAdminGlobalSearchActive =
    clientScopeRoleKey === "SUPER_ADMIN" && isGlobalSearchActive;
  const superAdminPresalesPoolSet = useMemo(
    () =>
      new Set(
        (superAdminPresalesAssigneeNames ?? [])
          .map((n) => n.trim().toLowerCase())
          .filter(Boolean),
      ),
    [superAdminPresalesAssigneeNames],
  );
  /** Hub `presales-search` scopes presales; client assignee-name filter dropped wrong rows. */
  const superAdminPresalesPoolActive = false;
  const leadViewKey: "default" | "my" | "team" | "combined" =
    leadView === "my" || leadView === "team" || leadView === "combined" ? leadView : "default";
  const filterOptionsView =
    leadView === "my" || leadView === "team" ? leadView : "default";
  const insightLeadView: "default" | "my" | "team" =
    leadView === "my" || leadView === "team" ? leadView : "default";
  const effectiveAssignee =
    salesExecFilter ||
    effectivePresalesExecFilter ||
    salesManagerFilter ||
    effectivePresalesManagerFilter ||
    salesAdminFilter ||
    assignee;
  const hierarchyScopedAssignees = useMemo(
    () =>
      buildHierarchyScopedAssignees({
        workspace: leadsWorkspace,
        salesManagerFilter,
        salesExecFilter,
        presalesManagerFilter: effectivePresalesManagerFilter,
        presalesExecFilter: effectivePresalesExecFilter,
        salesManagers,
        salesExecs,
        presalesManagers,
        presalesExecs,
      }),
    [
      leadsWorkspace,
      salesManagerFilter,
      salesExecFilter,
      effectivePresalesManagerFilter,
      effectivePresalesExecFilter,
      salesManagers,
      salesExecs,
      presalesManagers,
      presalesExecs,
    ],
  );
  const singleExecScopedAssignees = useMemo(() => {
    if (hierarchyScopedAssignees.length > 0) return [];
    if (salesExecFilter.trim()) {
      return resolveAssigneeScopeForDisplayName(salesExecFilter, salesExecs);
    }
    if (effectivePresalesExecFilter.trim()) {
      return resolveAssigneeScopeForDisplayName(effectivePresalesExecFilter, presalesExecs);
    }
    return [];
  }, [
    hierarchyScopedAssignees,
    salesExecFilter,
    effectivePresalesExecFilter,
    salesExecs,
    presalesExecs,
  ]);
  const effectiveAssigneeScope = useMemo(
    () =>
      hierarchyScopedAssignees.length > 0
        ? hierarchyScopedAssignees
        : singleExecScopedAssignees.length > 0
          ? singleExecScopedAssignees
            : EMPTY_ASSIGNEE_SCOPE,
    [hierarchyScopedAssignees, singleExecScopedAssignees],
  );
  const effectiveAssigneeScopeKey = effectiveAssigneeScope.join("\0");
  const activeAssigneeScope = useMemo(() => {
    if (effectiveAssigneeScope.length > 0) return effectiveAssigneeScope;
    const fallbacks: string[] = [];
    if (salesExecFilter.trim()) fallbacks.push(salesExecFilter.trim());
    if (effectivePresalesExecFilter.trim()) fallbacks.push(effectivePresalesExecFilter.trim());
    if (salesManagerFilter.trim()) fallbacks.push(salesManagerFilter.trim());
    if (effectivePresalesManagerFilter.trim()) fallbacks.push(effectivePresalesManagerFilter.trim());
    if (salesAdminFilter.trim()) fallbacks.push(salesAdminFilter.trim());
    if (assignee.trim()) fallbacks.push(assignee.trim());
    return fallbacks;
  }, [
    effectiveAssigneeScope,
    salesExecFilter,
    effectivePresalesExecFilter,
    salesManagerFilter,
    effectivePresalesManagerFilter,
    salesAdminFilter,
    assignee,
  ]);
  const activeAssigneeScopeKey = activeAssigneeScope.join("\0");
  const salesHierarchyFilterActive =
    leadsWorkspace === "sales" &&
    usesAdminLeadsApi(clientScopeRoleKey) &&
    Boolean(
      salesManagerFilter.trim() ||
        salesExecFilter.trim() ||
        salesAdminFilter.trim() ||
        assignee.trim(),
    );

  useEffect(() => {
    onHeatmapAssigneeSync?.(effectiveAssignee);
  }, [effectiveAssignee, onHeatmapAssigneeSync]);

  useEffect(() => {
    if (lastAssigneeScopeKeyRef.current === effectiveAssigneeScopeKey) return;
    lastAssigneeScopeKeyRef.current = effectiveAssigneeScopeKey;
    onHeatmapAssigneeScopeSync?.(effectiveAssigneeScope);
  }, [effectiveAssigneeScope, effectiveAssigneeScopeKey, onHeatmapAssigneeScopeSync]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: LeadsViewPersistedState = {
      page,
      size,
      salesAdminFilter,
      salesManagerFilter,
      salesExecFilter,
      presalesManagerFilter,
      presalesExecFilter,
      insightTableMode,
    };
    mergeLeadsViewPersistedState(payload);
  }, [
    page,
    size,
    salesAdminFilter,
    salesManagerFilter,
    salesExecFilter,
    presalesManagerFilter,
    presalesExecFilter,
    insightTableMode,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let timer = 0;
    let root: HTMLElement | null = null;

    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const el = getLeadsScrollRoot();
        const scrollY = el && el.scrollHeight > el.clientHeight + 1 ? el.scrollTop : window.scrollY;
        mergeLeadsViewPersistedState({ scrollY });
      }, 120);
    };

    const bind = () => {
      root = getLeadsScrollRoot();
      if (!root) return false;
      root.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      return true;
    };

    let retryTimer = 0;
    if (!bind()) {
      retryTimer = window.setTimeout(() => bind(), 0);
    }

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(retryTimer);
      root?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useLayoutEffect(() => {
    if (!shouldRestoreLeadsListScroll()) return;
    const scrollY = getPersistedLeadsScrollY();
    if (scrollY !== null) scheduleLeadsListScrollRestore(scrollY);
  }, []);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || !shouldRestoreLeadsListScroll()) return;
      const scrollY = getPersistedLeadsScrollY();
      if (scrollY !== null) scheduleLeadsListScrollRestore(scrollY);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const pipelineRole = pipelineRoleForWorkspace(leadsWorkspace);
    void (async () => {
      try {
        const [o, p] = await Promise.all([
          fetchFilterOptions(filterOptionsView, authRoleProp ?? currentRole),
          fetchCrmPipeline({ nested: true, role: pipelineRole }),
        ]);
        if (cancelled) return;
        setAssigneeOptions(o.assignees);
        setPipelineNested(p.nested ?? []);
        setStageOrder(p.nested?.map((n) => n.stage.trim()).filter(Boolean) ?? []);
      } catch {
        if (cancelled) return;
        setAssigneeOptions([]);
        setPipelineNested([]);
        setStageOrder([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authRoleProp, currentRole, filterOptionsView, leadsWorkspace]);

  useEffect(() => {
    if (pipelineNested.length === 0) return;
    if (leadsWorkspace === "presales") {
      if (!milestoneStage.trim()) {
        if (milestoneStageCategory.trim()) onMilestoneStageCategoryChange("");
        if (milestoneSubStage.trim()) onMilestoneSubStageChange("");
      }
      return;
    }
    if (!milestoneStage.trim()) {
      if (milestoneStageCategory.trim()) onMilestoneStageCategoryChange("");
      if (milestoneSubStage.trim()) onMilestoneSubStageChange("");
      return;
    }
    const node = nestedStageForSelection(pipelineNested, milestoneStage);
    if (!node) {
      onMilestoneStageChange("");
      onMilestoneStageCategoryChange("");
      onMilestoneSubStageChange("");
      return;
    }
    const catList = node.categories.map((c) => c.stageCategory.trim());
    const catOk =
      Boolean(milestoneStageCategory.trim()) &&
      catList.includes(milestoneStageCategory.trim());
    if (!catOk) {
      if (milestoneStageCategory.trim() || milestoneSubStage.trim()) {
        onMilestoneStageCategoryChange("");
        onMilestoneSubStageChange("");
      }
      return;
    }
    const cat = node.categories.find(
      (c) => c.stageCategory.trim() === milestoneStageCategory.trim(),
    );
    const subList = (cat?.subStages ?? []).map((s) => s.trim());
    const subOk =
      !milestoneSubStage.trim() || subList.includes(milestoneSubStage.trim());
    if (!subOk) onMilestoneSubStageChange("");
  }, [
    pipelineNested,
    milestoneStage,
    milestoneStageCategory,
    milestoneSubStage,
    onMilestoneStageChange,
    onMilestoneStageCategoryChange,
    onMilestoneSubStageChange,
    leadsWorkspace,
  ]);

  const fetchScopedMergedPage = useCallback(
    async (
      targetPage: number,
      targetSize: number,
      targetLeadType: string,
      targetSort: string,
    ): Promise<SpringPage<ApiLead>> => {
      const bffAssigneeAliasSet =
        effectiveAssigneeScope.length > 0 ? effectiveAssigneeScope : undefined;
      /** Many alias strings for one exec/manager — one fetch + client exact match, not N parallel fetches. */
      const useUnifiedAssigneeScopeFetch = effectiveAssigneeScope.length > 0;
      const applyAssigneeScopeFilter = (leads: ApiLead[]) =>
        activeAssigneeScope.length > 0
          ? filterLeadsByAssigneeScope(leads, activeAssigneeScope)
          : leads;
      const fetchAllPagesForAssignee = async (assigneeName: string): Promise<ApiLead[]> => {
        const queryAssignee = superAdminGlobalSearchActive ? "" : assigneeName;
        const firstPage = await fetchMergedPage(
          0,
          500,
          targetLeadType,
          targetSort,
          debouncedSearch,
          queryAssignee,
          dateFrom,
          dateTo,
          dateField,
          milestoneStage,
          milestoneStageCategory,
          milestoneSubStage,
          reinquiry,
          leadViewKey,
          verificationStatusFromHeader,
          crmMonthWindowProp,
          leadsWorkspace,
          clientScopeRoleKey,
          bffAssigneeAliasSet,
        );
        const allLeads = Array.isArray(firstPage.content) ? [...firstPage.content] : [];
        const totalPages = Math.max(1, Number(firstPage.totalPages ?? 1));
        if (totalPages <= 1) return applyAssigneeScopeFilter(allLeads);

        const remainingPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, idx) =>
            fetchMergedPage(
              idx + 1,
              500,
              targetLeadType,
              targetSort,
              debouncedSearch,
              queryAssignee,
              dateFrom,
              dateTo,
              dateField,
              milestoneStage,
              milestoneStageCategory,
              milestoneSubStage,
              reinquiry,
              leadViewKey,
              verificationStatusFromHeader,
              crmMonthWindowProp,
              leadsWorkspace,
              clientScopeRoleKey,
              bffAssigneeAliasSet,
            ),
          ),
        );

        for (const page of remainingPages) {
          allLeads.push(...(Array.isArray(page.content) ? page.content : []));
        }
        return applyAssigneeScopeFilter(allLeads);
      };
      const assigneeFetchSeed =
        effectiveAssigneeScope[0] ?? activeAssigneeScope[0] ?? effectiveAssignee;
      const buildVisiblePage = (allLeads: ApiLead[]): SpringPage<ApiLead> => {
        const trustPresalesScope =
          trustPresalesUpstreamLeadScope(clientScopeRoleKey) ||
          (leadsWorkspace === "presales" &&
            (clientScopeRoleKey === "SUPER_ADMIN" || clientScopeRoleKey === "ADMIN"));
        const skipClientRoleFilter =
          useUnifiedAssigneeScopeFetch ||
          trustPresalesScope ||
          !requiresClientScopedDataset ||
          isGlobalSearchActive;
        let roleScopedLeads = skipClientRoleFilter
          ? allLeads
          : allLeads.filter((lead) => canViewLeadByRole(lead, clientScopeRoleKey));
        if (superAdminPresalesPoolActive) {
          roleScopedLeads = roleScopedLeads.filter((lead) =>
            leadAssignedToPresalesExecNameSet(lead, superAdminPresalesPoolSet),
          );
        }
        const visibleMerged = roleScopedLeads.sort(
          (a, b) => parseLeadSortTimestamp(b) - parseLeadSortTimestamp(a),
        );
        const scopedIdRows =
          leadsWorkspace === "sales"
            ? dedupeAdminPoolLeads(visibleMerged as ApiLead[])
            : visibleMerged;
        const primaryRows = pickPrimarySourceRows(scopedIdRows);
        const countBasis = scopedIdRows;
        const start = targetPage * targetSize;
        return {
          content: visibleMerged.slice(start, start + targetSize),
          totalElements: countBasis.length,
          uniquePrimaryTotal: primaryRows.length,
          totalRowCount: visibleMerged.length,
          totalPages: Math.max(1, Math.ceil(countBasis.length / Math.max(1, targetSize))),
          number: targetPage,
          size: targetSize,
          sourceCounts: computeLeadTypeCountsFromRows(countBasis),
          summaryTotals: computeJourneySummaryCounts(countBasis),
        };
      };
      const requiresFullyVisiblePage =
        activeAssigneeScope.length > 1 ||
        salesHierarchyFilterActive ||
        (requiresClientScopedDataset && (isGlobalSearchActive || targetSize >= 500)) ||
        superAdminPresalesPoolActive;

      if (activeAssigneeScope.length <= 1 || useUnifiedAssigneeScopeFetch) {
        if (!requiresFullyVisiblePage) {
          const pageJson = await fetchMergedPage(
            targetPage,
            targetSize,
            targetLeadType,
            targetSort,
            debouncedSearch,
            assigneeFetchSeed,
            dateFrom,
            dateTo,
            dateField,
            milestoneStage,
            milestoneStageCategory,
            milestoneSubStage,
            reinquiry,
            leadViewKey,
            verificationStatusFromHeader,
            crmMonthWindowProp,
            leadsWorkspace,
            clientScopeRoleKey,
            bffAssigneeAliasSet,
          );
          if (activeAssigneeScope.length === 0) return pageJson;
          const scopedContent = filterLeadsByAssigneeScope(
            Array.isArray(pageJson.content) ? pageJson.content : [],
            activeAssigneeScope,
          );
          const scopedIdRows =
            leadsWorkspace === "sales"
              ? dedupeAdminPoolLeads(scopedContent as ApiLead[])
              : scopedContent;
          const primaryRows = pickPrimarySourceRows(scopedIdRows);
          const countBasis = scopedIdRows;
          const start = targetPage * targetSize;
          return {
            ...pageJson,
            content: countBasis.slice(start, start + targetSize),
            totalElements: countBasis.length,
            uniquePrimaryTotal: primaryRows.length,
            totalRowCount: scopedContent.length,
            totalPages: Math.max(1, Math.ceil(countBasis.length / Math.max(1, targetSize))),
            number: targetPage,
            size: targetSize,
            sourceCounts: computeLeadTypeCountsFromRows(countBasis),
            summaryTotals: computeJourneySummaryCounts(countBasis),
          };
        }
        const allLeads = await fetchAllPagesForAssignee(assigneeFetchSeed);
        return buildVisiblePage(allLeads);
      }
      const chunks = await Promise.all(
        activeAssigneeScope.map((assigneeName) => fetchAllPagesForAssignee(assigneeName)),
      );
      const mergedScopeRows = dedupeAdminPoolLeads(chunks.flat() as ApiLead[]);
      return buildVisiblePage(mergedScopeRows);
    },
    [
      authRoleProp,
      canViewLeadByRole,
      clientScopeRoleKey,
      currentRole,
      requiresClientScopedDataset,
      isGlobalSearchActive,
      superAdminGlobalSearchActive,
      activeAssigneeScope,
      activeAssigneeScopeKey,
      effectiveAssigneeScope,
      salesHierarchyFilterActive,
      superAdminPresalesPoolActive,
      superAdminPresalesPoolSet,
      debouncedSearch,
      effectiveAssignee,
      dateFrom,
      dateTo,
      dateField,
      milestoneStage,
      milestoneStageCategory,
      milestoneSubStage,
      reinquiry,
      leadViewKey,
      verificationStatusFromHeader,
      crmMonthWindowProp,
      leadsWorkspace,
    ],
  );

  const fetchAllScopedMergedLeads = useCallback(
    async (targetLeadType: string, targetSort: string): Promise<ApiLead[]> => {
      const bffAssigneeAliasSet =
        effectiveAssigneeScope.length > 0 ? effectiveAssigneeScope : undefined;
      const useUnifiedAssigneeScopeFetch = effectiveAssigneeScope.length > 0;
      const applyAssigneeScopeFilter = (leads: ApiLead[]) =>
        activeAssigneeScope.length > 0
          ? filterLeadsByAssigneeScope(leads, activeAssigneeScope)
          : leads;
      const applySuperAdminPool = (list: ApiLead[]) =>
        superAdminPresalesPoolActive
          ? list.filter((lead) =>
              leadAssignedToPresalesExecNameSet(lead, superAdminPresalesPoolSet),
            )
          : list;
      const assigneeFetchSeed =
        effectiveAssigneeScope[0] ?? activeAssigneeScope[0] ?? effectiveAssignee;
      const fetchAllPagesForAssignee = async (assigneeName: string): Promise<ApiLead[]> => {
        const queryAssignee = superAdminGlobalSearchActive ? "" : assigneeName;
        const firstPage = await fetchMergedPage(
          0,
          500,
          targetLeadType,
          targetSort,
          debouncedSearch,
          queryAssignee,
          dateFrom,
          dateTo,
          dateField,
          milestoneStage,
          milestoneStageCategory,
          milestoneSubStage,
          reinquiry,
          leadViewKey,
          verificationStatusFromHeader,
          crmMonthWindowProp,
          leadsWorkspace,
          clientScopeRoleKey,
          bffAssigneeAliasSet,
        );
        const allLeads = Array.isArray(firstPage.content) ? [...firstPage.content] : [];
        const totalPages = Math.max(1, Number(firstPage.totalPages ?? 1));
        if (totalPages <= 1) return applyAssigneeScopeFilter(allLeads);

        const remainingPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, idx) =>
            fetchMergedPage(
              idx + 1,
              500,
              targetLeadType,
              targetSort,
              debouncedSearch,
              queryAssignee,
              dateFrom,
              dateTo,
              dateField,
              milestoneStage,
              milestoneStageCategory,
              milestoneSubStage,
              reinquiry,
              leadViewKey,
              verificationStatusFromHeader,
              crmMonthWindowProp,
              leadsWorkspace,
              clientScopeRoleKey,
              bffAssigneeAliasSet,
            ),
          ),
        );

        for (const page of remainingPages) {
          allLeads.push(...(Array.isArray(page.content) ? page.content : []));
        }
        return applyAssigneeScopeFilter(allLeads);
      };
      if (superAdminGlobalSearchActive) {
        return applySuperAdminPool(await fetchAllPagesForAssignee(""));
      }

      if (activeAssigneeScope.length <= 1 || useUnifiedAssigneeScopeFetch) {
        return applySuperAdminPool(await fetchAllPagesForAssignee(assigneeFetchSeed));
      }

      const chunks = await Promise.all(
        activeAssigneeScope.map((assigneeName) => fetchAllPagesForAssignee(assigneeName)),
      );
      const mergedScopeRows = dedupeAdminPoolLeads(chunks.flat() as ApiLead[]);
      return applySuperAdminPool(
        mergedScopeRows.sort(
          (a: ApiLead, b: ApiLead) => parseLeadSortTimestamp(b) - parseLeadSortTimestamp(a),
        ),
      );
    },
    [
      authRoleProp,
      crmMonthWindowProp,
      currentRole,
      dateFrom,
      dateTo,
      debouncedSearch,
      effectiveAssignee,
      activeAssigneeScope,
      effectiveAssigneeScope,
      leadViewKey,
      milestoneStage,
      milestoneStageCategory,
      milestoneSubStage,
      reinquiry,
      verificationStatusFromHeader,
      superAdminPresalesPoolActive,
      superAdminPresalesPoolSet,
      leadsWorkspace,
      superAdminGlobalSearchActive,
    ],
  );

  useEffect(() => {
    const roleKey = normalizeRole(authRoleProp ?? currentRole);
    if (!usesAdminLeadsApi(roleKey)) {
      setAdminPoolDisplayTotals(null);
      return;
    }
    if (roleKey !== "SUPER_ADMIN" && roleKey !== "SALES_ADMIN") {
      setAdminPoolDisplayTotals(null);
    }

    let cancelled = false;
    void (async () => {
      try {
        const summaryLeadType =
          leadType.trim().toLowerCase() === "verified"
            ? "all"
            : leadType.trim().toLowerCase() || "all";
        const salesScopedAssigneeFilterActive =
          leadsWorkspace === "sales" && salesHierarchyFilterActive;
        if (salesScopedAssigneeFilterActive) {
          const scopedRows = await fetchAllScopedMergedLeads(summaryLeadType, "updatedAt,desc");
          if (cancelled) return;
          const scopedPrimary = pickPrimarySourceRows(scopedRows);
          const baseCounts = computeLeadTypeCountsFromRows(scopedPrimary);
          const verifiedCount = scopedPrimary.filter((lead) => isCrmLeadVerified(lead)).length;
          const summaryTotals = computeJourneySummaryCounts(scopedPrimary);
          const milestoneMap = milestoneCountsFromLeads(scopedPrimary, "sales");
          setLeadTypeCountsPrimary(baseCounts);
          setLeadTypeCountsAllRows(baseCounts);
          const adminInsightOpts = salesAdminPoolInsightOpts(
            currentUserName ?? "",
            activeAssigneeScope.length > 0
              ? activeAssigneeScope
              : managerTeamNamesFromHeader.length > 0
                ? managerTeamNamesFromHeader
                : managerTeamNames,
            dateFrom,
            dateTo,
          );
          const insightPool =
            activeAssigneeScope.length > 0
              ? filterLeadsByAssigneeScope(scopedPrimary, activeAssigneeScope)
              : scopedPrimary;
          const countsWithInsights = roleUsesAdminPoolInsightTiles(roleKey)
            ? mergeSalesPoolInsightCounts(baseCounts, insightPool, adminInsightOpts)
            : { ...baseCounts };
          setLeadTypeCounts({
            ...countsWithInsights,
            verified: verifiedCount,
          });
          const summaryKey = `${summaryTotals.lead}:${summaryTotals.opportunity}:${scopedPrimary.length}`;
          if (lastHeatmapSummaryKeyRef.current !== summaryKey) {
            lastHeatmapSummaryKeyRef.current = summaryKey;
            onHeatmapSummarySyncRef.current?.(summaryTotals);
          }
          const milestoneKey = Object.keys(milestoneMap).length
            ? JSON.stringify(milestoneMap)
            : "";
          if (lastAdminMilestoneCountsKeyRef.current !== milestoneKey) {
            lastAdminMilestoneCountsKeyRef.current = milestoneKey;
            onAdminMilestoneCountsSyncRef.current?.(milestoneMap, leadsWorkspace);
          }
          return;
        }
        const resolvedVerification =
          summaryLeadType === "verified"
            ? "verified"
            : verificationStatusFromHeader.trim() ||
              defaultVerificationForLeadTypeFilter(
                summaryLeadType,
                leadsWorkspace,
                verificationStatusFromHeader,
                roleKey,
              );
        if (salesHierarchyFilterActive) {
          return;
        }
        const filterInput = {
          workspace: leadsWorkspace,
          search: debouncedSearch,
          assignee: effectiveAssignee,
          dateFrom,
          dateTo,
          dateField,
          crmMonthWindow: crmMonthWindowProp,
          verificationStatus: resolvedVerification,
          reinquiry,
          milestoneStage: "",
          milestoneStageCategory: "",
          milestoneSubStage: "",
          leadType: summaryLeadType,
        };
        const authHeaders = getCrmAuthHeaders();
        const fetchCrossPoolCounts = roleKey === "SUPER_ADMIN";
        let heatmapData;
        if (fetchCrossPoolCounts) {
          const crossPoolShared = {
            search: debouncedSearch,
            assignee: effectiveAssignee,
            dateFrom,
            dateTo,
            dateField,
            crmMonthWindow: crmMonthWindowProp,
            summaryLeadType,
            verificationStatusProp: verificationStatusFromHeader,
            reinquiry,
            roleKey,
            viewerWorkspace: leadsWorkspace,
          };
          const [salesData, presalesData] = await Promise.all([
            fetchAdminLeadsHeatmapData(
              buildCrossPoolHeatmapFilterInput("sales", crossPoolShared),
              authHeaders,
            ),
            fetchAdminLeadsHeatmapData(
              buildCrossPoolHeatmapFilterInput("presales", crossPoolShared),
              authHeaders,
            ),
          ]);
          if (cancelled) return;
          setCrossPoolLeadTypeCounts({
            sales: pickLeadTypeCountsFromHeatmap(salesData),
            presales: pickLeadTypeCountsFromHeatmap(presalesData),
          });
          heatmapData = leadsWorkspace === "presales" ? presalesData : salesData;
        } else {
          setCrossPoolLeadTypeCounts(null);
          heatmapData = await fetchAdminLeadsHeatmapData(filterInput, authHeaders);
        }
        if (cancelled) return;
        const poolTotal = Number(heatmapData.totalElements ?? heatmapData.leads.length ?? 0);
        const milestoneToolbarActive = Boolean(
          milestoneStage.trim() ||
            milestoneStageCategory.trim() ||
            milestoneSubStage.trim(),
        );
        const primaryTypes = heatmapData.leadTypeCountsPrimaryUnique;
        const allRowTypes = heatmapData.leadTypeCountsAllRows;
        setLeadTypeCountsPrimary(primaryTypes?.all > 0 ? primaryTypes : null);
        setLeadTypeCountsAllRows(allRowTypes?.all > 0 ? allRowTypes : null);
        const base =
          primaryTypes?.all > 0
            ? { ...primaryTypes }
            : heatmapData.leadTypeCounts?.all > 0
              ? { ...heatmapData.leadTypeCounts }
              : adminByLeadTypeToSourceCounts(undefined, poolTotal);
        const milestoneMap = heatmapData.milestoneCounts;
        const summaryTotals =
          leadsWorkspace === "sales"
            ? (heatmapData.summaryTotals ??
              salesJourneySummaryFromMilestoneCounts(milestoneMap))
            : {
                lead: heatmapData.uniquePrimaryTotal ?? heatmapData.pipelineTotal ?? poolTotal,
                opportunity: 0,
              };
        const superAdminCrossPoolSearch =
          roleKey === "SUPER_ADMIN" && debouncedSearch.trim().length > 0;
        if (!superAdminCrossPoolSearch) {
          const summaryKey = `${poolTotal}:${summaryTotals.lead}:${summaryTotals.opportunity}`;
          if (lastHeatmapSummaryKeyRef.current !== summaryKey) {
            lastHeatmapSummaryKeyRef.current = summaryKey;
            onHeatmapSummarySyncRef.current?.(summaryTotals);
          }
        }
        const milestoneKey = Object.keys(milestoneMap).length
          ? JSON.stringify(milestoneMap)
          : "";
        if (lastAdminMilestoneCountsKeyRef.current !== milestoneKey) {
          lastAdminMilestoneCountsKeyRef.current = milestoneKey;
          onAdminMilestoneCountsSyncRef.current?.(milestoneMap, leadsWorkspace);
        }
        if (leadsWorkspace === "presales") {
          onAdminPresalesSummarySyncRef.current?.(
            heatmapData.leads.length > 0
              ? presalesSummaryMetricsFromLeads(heatmapData.leads)
              : {
                  totalMonth: poolTotal,
                  verifiedMonth: heatmapData.verifiedCount,
                  teamVerifiedMonth: 0,
                },
          );
        }
        const adminInsightOpts = salesAdminPoolInsightOpts(
          currentUserName ?? "",
          managerTeamNamesFromHeader.length > 0
            ? managerTeamNamesFromHeader
            : managerTeamNames,
          dateFrom,
          dateTo,
        );
        const adminInsightPool =
          heatmapData.primaryRows.length > 0
            ? heatmapData.primaryRows
            : salesInsightCountLeads(heatmapData.leads);
        const countsWithInsights =
          roleUsesAdminPoolInsightTiles(roleKey) && leadsWorkspace === "sales"
            ? mergeSalesPoolInsightCounts(base, adminInsightPool, adminInsightOpts)
            : { ...base };
        setLeadTypeCounts({
          ...countsWithInsights,
          verified: Number(heatmapData.verifiedCount ?? 0),
        });
      } catch {
        if (!cancelled) {
          setLeadTypeCounts({});
          setLeadTypeCountsPrimary(null);
          setLeadTypeCountsAllRows(null);
          setAdminPoolDisplayTotals(null);
          setCrossPoolLeadTypeCounts(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    authRoleProp,
    currentRole,
    currentUserName,
    managerTeamNames,
    managerTeamNamesFromHeader,
    activeAssigneeScope,
    debouncedSearch,
    leadType,
    milestoneStage,
    milestoneStageCategory,
    milestoneSubStage,
    reinquiry,
    verificationStatusFromHeader,
    crmMonthWindowProp,
    dateFrom,
    dateTo,
    dateField,
    effectiveAssignee,
    activeAssigneeScope,
    fetchAllScopedMergedLeads,
    salesHierarchyFilterActive,
    salesExecFilter,
    salesManagerFilter,
    salesAdminFilter,
    assignee,
    leadsWorkspace,
  ]);

  useEffect(() => {
    const roleKey = normalizeRole(authRoleProp ?? currentRole);
    const milestoneToolbarActive = Boolean(
      milestoneStage.trim() || milestoneStageCategory.trim() || milestoneSubStage.trim(),
    );
    const useAdminMilestoneTable =
      usesAdminLeadsApi(roleKey) &&
      leadViewKey !== "my" &&
      leadViewKey !== "team" &&
      milestoneToolbarActive;

    if (!useAdminMilestoneTable) {
      setAdminMilestoneTableLeads(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const summaryLeadType =
          leadType.trim().toLowerCase() === "verified"
            ? "all"
            : leadType.trim().toLowerCase() || "all";
        const resolvedVerification =
          summaryLeadType === "verified"
            ? "verified"
            : verificationStatusFromHeader.trim() ||
              defaultVerificationForLeadTypeFilter(
                summaryLeadType,
                leadsWorkspace,
                verificationStatusFromHeader,
                roleKey,
              );
        const milestoneAliasSet =
          effectiveAssigneeScope.length > 0
            ? effectiveAssigneeScope
            : activeAssigneeScope.length > 0
              ? activeAssigneeScope
              : undefined;

        let leads: ApiLead[];
        let total: number;

        /** SALES_ADMIN + Sales Mgr/Exec toolbar: use same scoped pool as heatmap (not manager name only). */
        if (salesHierarchyFilterActive) {
          const scopedRows = await fetchAllScopedMergedLeads(summaryLeadType, sort);
          const primaryRows = pickMilestoneRepresentativeRows(scopedRows);
          leads = primaryRows.filter((lead) =>
            leadMatchesWorkspaceMilestoneFilter(
              lead,
              leadsWorkspace,
              milestoneStage,
              milestoneStageCategory,
              milestoneSubStage,
            ),
          );
          total = leads.length;
        } else {
          const result = await fetchAdminLeadsMilestoneFiltered(
            {
              workspace: leadsWorkspace,
              search: debouncedSearch,
              assignee: milestoneAliasSet?.[0]?.trim() || effectiveAssignee,
              assigneeAliasSet: milestoneAliasSet,
              dateFrom,
              dateTo,
              dateField,
              crmMonthWindow: crmMonthWindowProp,
              verificationStatus: resolvedVerification,
              reinquiry,
              leadType: summaryLeadType,
            },
            milestoneStage,
            milestoneStageCategory,
            milestoneSubStage,
            getCrmAuthHeaders(),
          );
          leads = result.leads;
          total = result.total;
        }

        if (cancelled) return;
        setAdminMilestoneTableLeads(leads);
        const primaryRows = pickPrimarySourceRows(leads);
        setVisibleFilteredTotal(total);
        if (roleKey === "SUPER_ADMIN" || roleKey === "SALES_ADMIN") {
          setAdminPoolDisplayTotals({
            uniquePrimary: primaryRows.length,
            totalRows: total,
          });
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to load filtered leads";
        setError(msg);
        setAdminMilestoneTableLeads([]);
        setVisibleFilteredTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authRoleProp,
    currentRole,
    leadViewKey,
    milestoneStage,
    milestoneStageCategory,
    milestoneSubStage,
    debouncedSearch,
    leadType,
    reinquiry,
    verificationStatusFromHeader,
    crmMonthWindowProp,
    dateFrom,
    dateTo,
    dateField,
    effectiveAssignee,
    effectiveAssigneeScope,
    activeAssigneeScope,
    salesHierarchyFilterActive,
    fetchAllScopedMergedLeads,
    sort,
    leadsWorkspace,
  ]);

  useEffect(() => {
    const roleKey = normalizeRole(authRoleProp ?? currentRole);
    if (usesAdminLeadsApi(roleKey)) return;

    let cancelled = false;
    void (async () => {
      try {
        const managerScopedTeam =
          effectiveAssigneeScope.length > 0
            ? effectiveAssigneeScope
            : managerTeamNamesFromHeader.length > 0
              ? managerTeamNamesFromHeader
              : managerTeamNames;
        const summaryLeadType =
          leadType.trim().toLowerCase() === "verified"
            ? "all"
            : leadType.trim().toLowerCase() || "all";
        const raw = await fetchAllScopedMergedLeads(summaryLeadType, "updatedAt,desc");
        if (cancelled) return;
        const scopedTeam =
          managerScopedTeam.length > 0
            ? managerScopedTeam
            : managerTeamNamesFromHeader.length > 0
              ? managerTeamNamesFromHeader
              : managerTeamNames;
        const managerRole = roleKey === "SALES_MANAGER" || roleKey === "MANAGER";
        const scoped =
          isGlobalSearchActive || trustPresalesUpstreamLeadScope(roleKey) || managerRole
            ? raw
            : raw.filter((lead) => canViewLeadByRole(lead, roleKey));
        const base = computeLeadTypeCountsFromRows(scoped);
        const summaryTotals = computeJourneySummaryCounts(scoped);
        // Only update total from this effect when
        // exec/hierarchy scope is active
        // Otherwise load() already set correct total
        if (
          effectiveAssigneeScope.length === 0 &&
          (roleKey === "SALES_MANAGER" || roleKey === "MANAGER")
        ) {
          // Manager all-team view — load() handles total
          // do not overwrite here
        } else {
          setVisibleFilteredTotal(scoped.length);
        }
        const summaryKey = `${summaryTotals.lead}:${summaryTotals.opportunity}`;
        if (lastHeatmapSummaryKeyRef.current !== summaryKey) {
          lastHeatmapSummaryKeyRef.current = summaryKey;
          onHeatmapSummarySyncRef.current?.(summaryTotals);
        }

        if (isPresalesRole(roleKey) || superAdminPresalesPoolActive) {
          setLeadTypeCounts({
            ...base,
            verified: 0,
          });
          return;
        }

        const smMineTeam =
          roleKey === "SALES_MANAGER"
            ? countSalesManagerMineVsTeam(
                scoped,
                currentUserName ?? "",
                scopedTeam,
              )
            : { managerMine: 0, teamLeads: 0 };
        const insightViewerRole =
          roleKey === "SALES_ADMIN" ? "SALES_MANAGER" : roleKey;
        const insightLeadViewForRole: "default" | "my" | "team" =
          roleKey === "SALES_ADMIN" ? "default" : insightLeadView;
        const insightPool = salesInsightCountLeads(scoped);
        const insightCountOpts = {
          viewerRole: insightViewerRole,
          currentUserName: currentUserName ?? "",
          managerTeamNames: scopedTeam,
          leadView: insightLeadViewForRole,
          dateFrom,
          dateTo,
        };
        const insights = computeFollowUpInsightCounts(insightPool, insightCountOpts);
        const milestoneTiles = computeMilestoneTileCounts(insightPool, insightCountOpts);
        const lostSegment = computeLostSegmentCounts(insightPool, insightCountOpts);
        setLeadTypeCounts({
          ...base,
          ...insights,
          ...milestoneTiles,
          ...lostSegment,
          managerMine: smMineTeam.managerMine,
          team: smMineTeam.teamLeads,
        });
      } catch {
        if (!cancelled) {
          setLeadTypeCounts({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    authRoleProp,
    currentRole,
    currentUserName,
    managerTeamNames,
    managerTeamNamesFromHeader,
    canViewLeadByRole,
    fetchAllScopedMergedLeads,
    debouncedSearch,
    leadType,
    milestoneStage,
    milestoneStageCategory,
    milestoneSubStage,
    reinquiry,
    verificationStatusFromHeader,
    crmMonthWindowProp,
    dateFrom,
    dateTo,
    insightLeadView,
    isGlobalSearchActive,
    effectiveAssigneeScopeKey,
    superAdminPresalesPoolActive,
    leadsWorkspace,
  ]);

  const load = useCallback(async (opts?: { forceNetwork?: boolean }) => {
    const roleKeyForLoad = normalizeRole(authRoleProp ?? currentRole);
    const insightModeActive = insightTableMode !== null;
    const requestPage = insightModeActive ? 0 : page;
    const requestSize = insightModeActive ? 500 : size;
    const requestLeadType = insightModeActive ? "all" : leadType;
    const cacheKey = buildLeadsListCacheKey({
      requestPage,
      requestSize,
      requestLeadType,
      sort,
      debouncedSearch,
      dateFrom,
      dateTo,
      dateField,
      milestoneStage,
      milestoneStageCategory,
      milestoneSubStage,
      reinquiry,
      leadViewKey,
      verificationStatusFromHeader,
      crmMonthWindowProp,
      activeAssigneeScopeKey,
      leadsWorkspace,
      roleKeyForLoad,
      insightModeActive,
    });
    const cached = opts?.forceNetwork ? null : readLeadsListCache(cacheKey);

    setError(null);
    if (cached) {
      setData(cached.data);
      if (cached.visibleFilteredTotal !== null) {
        setVisibleFilteredTotal(cached.visibleFilteredTotal);
      }
      setLoading(false);
      if (shouldRestoreLeadsListScroll()) {
        const scrollY = getPersistedLeadsScrollY();
        if (scrollY !== null) scheduleLeadsListScrollRestore(scrollY);
      }
    } else if (!opts?.forceNetwork) {
      setLoading(true);
      setData(null);
    }

    try {

      const applyAdminTotalsFromTablePage = (pageJson: SpringPage<ApiLead>) => {
        const totalRows = pageJson.totalRowCount ?? pageJson.totalElements ?? 0;
        const uniquePrimary = pageJson.uniquePrimaryTotal ?? totalRows;
        const assigneeScopedTotals = pageJson.uniquePrimaryTotal !== undefined;
        setVisibleFilteredTotal(
          assigneeScopedTotals ? uniquePrimary : (pageJson.totalElements ?? 0),
        );
        if (
          assigneeScopedTotals &&
          (roleKeyForLoad === "SUPER_ADMIN" ||
            roleKeyForLoad === "SALES_ADMIN" ||
            roleKeyForLoad === "SALES_MANAGER" ||
            roleKeyForLoad === "MANAGER")
        ) {
          setAdminPoolDisplayTotals({ uniquePrimary, totalRows });
        }
      };

      const applyLoadedPageMeta = (pageJson: SpringPage<ApiLead>, usePageMetaForUi: boolean) => {
        setData(pageJson);
        const superAdminCrossPoolSearch =
          roleKeyForLoad === "SUPER_ADMIN" && debouncedSearch.trim().length > 0;
        if (superAdminCrossPoolSearch) {
          setSuperAdminSearchPoolTotals({
            sales: Number(pageJson.salesSearchTotal ?? 0),
            presales: Number(pageJson.presalesSearchTotal ?? 0),
          });
        } else {
          setSuperAdminSearchPoolTotals(null);
        }
        if (usePageMetaForUi) {
          if (
            usesAdminLeadsApi(roleKeyForLoad) &&
            leadViewKey !== "my" &&
            leadViewKey !== "team"
          ) {
            applyAdminTotalsFromTablePage(pageJson);
          } else {
            setVisibleFilteredTotal(pageJson.totalElements ?? 0);
          }
        }
        if (usePageMetaForUi && pageJson.sourceCounts) {
          const sourceCounts = pageJson.sourceCounts;
          setLeadTypeCounts((prev) => ({
            ...prev,
            ...sourceCounts,
            all: Number(sourceCounts.all ?? pageJson.totalElements ?? 0),
          }));
        }
        if (pageJson.accessDeniedLeadTypes?.length) {
          notifyError(
            `Could not load lead types: ${pageJson.accessDeniedLeadTypes.join(", ")}. Check your role or sign in again.`,
          );
        }
        if (pageJson.apiUnavailable && pageJson.message?.trim()) {
          setError(pageJson.message.trim());
        }
        if (
          usePageMetaForUi &&
          pageJson.summaryTotals &&
          !superAdminCrossPoolSearch &&
          !salesHierarchyFilterActive
        ) {
          const st = pageJson.summaryTotals;
          const summaryKey = `${st.lead}:${st.opportunity}`;
          if (lastHeatmapSummaryKeyRef.current !== summaryKey) {
            lastHeatmapSummaryKeyRef.current = summaryKey;
            onHeatmapSummarySyncRef.current?.(st);
          }
        }
      };

      const usePageMetaForUi =
        activeAssigneeScope.length > 1 ||
        salesHierarchyFilterActive ||
        !requiresClientScopedDataset ||
        isGlobalSearchActive ||
        insightModeActive ||
        trustPresalesUpstreamLeadScope(normalizeRole(authRoleProp ?? currentRole));
      const requested = {
        page: requestPage,
        size: requestSize,
        leadType: requestLeadType,
        milestoneStage,
      };
      console.info("[crm:leads] request", requested);
      const json = await fetchScopedMergedPage(
        requestPage,
        requestSize,
        requestLeadType,
        sort,
      );
      console.info("[crm:leads] response", {
        ...requested,
        contentLength: (json.content ?? []).length,
        totalElements: json.totalElements ?? 0,
      });
      if (!insightModeActive && (json.content?.length ?? 0) === 0 && page > 0) {
        const fallbackPage = page - 1;
        const fallbackRequested = { ...requested, page: fallbackPage };
        console.info("[crm:leads] empty page fallback", fallbackRequested);
        const fallbackJson = await fetchScopedMergedPage(
          fallbackPage,
          size,
          leadType,
          sort,
        );
        console.info("[crm:leads] fallback response", {
          ...fallbackRequested,
          contentLength: (fallbackJson.content ?? []).length,
          totalElements: fallbackJson.totalElements ?? 0,
        });
        setPage(fallbackPage);
        applyLoadedPageMeta(fallbackJson, usePageMetaForUi);
        writeLeadsListCache(
          cacheKey,
          fallbackJson,
          fallbackJson.totalElements ?? null,
        );
        return;
      }
      applyLoadedPageMeta(json, usePageMetaForUi);
      writeLeadsListCache(cacheKey, json, json.totalElements ?? null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load leads";
      if (msg.toLowerCase().includes("session expired")) {
        window.dispatchEvent(new Event("crm:auth-expired"));
        return;
      }
      setError(msg);
      setData(null);
      setAdminPoolDisplayTotals(null);
    } finally {
      setLoading(false);
      if (shouldRestoreLeadsListScroll()) {
        const scrollY = getPersistedLeadsScrollY();
        if (scrollY !== null) scheduleLeadsListScrollRestore(scrollY);
        clearLeadsScrollRestoreFlag();
      }
    }
  }, [
    dateFrom,
    dateTo,
    debouncedSearch,
    activeAssigneeScopeKey,
    salesHierarchyFilterActive,
    effectiveAssigneeScopeKey,
    fetchScopedMergedPage,
    leadType,
    milestoneStage,
    milestoneStageCategory,
    milestoneSubStage,
    reinquiry,
    insightTableMode,
    page,
    size,
    sort,
    leadViewKey,
    isGlobalSearchActive,
    requiresClientScopedDataset,
    verificationStatusFromHeader,
    crmMonthWindowProp,
    superAdminPresalesPoolActive,
    notifyError,
    authRoleProp,
    leadViewKey,
  ]);

  useEffect(() => {
    const roleKey = normalizeRole(authRoleProp ?? currentRole);
    const milestoneToolbarActive = Boolean(
      milestoneStage.trim() || milestoneStageCategory.trim() || milestoneSubStage.trim(),
    );
    if (
      usesAdminLeadsApi(roleKey) &&
      leadViewKey !== "my" &&
      leadViewKey !== "team" &&
      milestoneToolbarActive
    ) {
      return;
    }
    void load();
  }, [load, authRoleProp, currentRole, leadViewKey, milestoneStage, milestoneStageCategory, milestoneSubStage]);

  const whatsappListActive = leadType.trim().toLowerCase() === "whatsapplead";

  /** MSG91 inbound hits Hub immediately — refresh on focus when WhatsApp list is open. */
  useEffect(() => {
    if (!whatsappListActive) return;
    const refreshWhatsappList = () => {
      void load({ forceNetwork: true });
      setLastRefreshTime(new Date());
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshWhatsappList();
    };
    window.addEventListener("focus", refreshWhatsappList);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", refreshWhatsappList);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [whatsappListActive, load]);

  useEffect(() => {
    const onInvalidate = () => {
      void load({ forceNetwork: true });
      setLastRefreshTime(new Date());
    };
    window.addEventListener("crm:leads-invalidate", onInvalidate);
    return () => window.removeEventListener("crm:leads-invalidate", onInvalidate);
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setError(null);
    handleResetAll();
    await load();
    setLastRefreshTime(new Date());
  }, [load, handleResetAll]);

  const adminMilestoneTableActive = adminMilestoneTableLeads !== null;
  const contentFromApi = adminMilestoneTableActive
    ? adminMilestoneTableLeads.slice(page * size, page * size + size)
    : (data?.content ?? []);
  const scopedTeamForInsight =
    managerTeamNamesFromHeader.length > 0 ? managerTeamNamesFromHeader : managerTeamNames;
  const scopeRoleKey = normalizeRole(authRoleProp ?? currentRole);
  const presalesExecNormSet = useMemo(
    () =>
      new Set(
        presalesTeamExecDisplayNames.map((n) => n.trim().toLowerCase()).filter(Boolean),
      ),
    [presalesTeamExecDisplayNames],
  );

  const isClientScopedRole = requiresClientScopedDataset;
  const trustPresalesScope = trustPresalesUpstreamLeadScope(scopeRoleKey);
  const managerScopeRole =
    clientScopeRoleKey === "SALES_MANAGER" || clientScopeRoleKey === "MANAGER";
  const roleScopedContent =
    isClientScopedRole && !isGlobalSearchActive && !trustPresalesScope && !managerScopeRole
      ? contentFromApi.filter((lead) => canViewLeadByRole(lead, clientScopeRoleKey))
      : contentFromApi;
  const hasMilestoneFilter = Boolean(
    milestoneStage.trim() || milestoneStageCategory.trim() || milestoneSubStage.trim(),
  );
  const dedicatedFilterTableView = isDedicatedFilterLeadType(leadType);
  const content = adminMilestoneTableActive
    ? contentFromApi
    : hasMilestoneFilter && !dedicatedFilterTableView
      ? roleScopedContent.filter((lead) =>
          leadMatchesWorkspaceMilestoneFilter(
            lead,
            leadsWorkspace,
            milestoneStage,
            milestoneStageCategory,
            milestoneSubStage,
          ),
        )
      : roleScopedContent;
  const showLostPathLeadsInTable = shouldShowLostPathLeadsInTable({
    searchActive: isGlobalSearchActive,
    insightTableMode,
    milestoneStageCategory,
    milestoneSubStage,
  });
  const tableContent = showLostPathLeadsInTable
    ? content
    : content.filter((lead) => !isLostPathLead(lead));
  const leadTypeFallbackForPersist = asCrmLeadType(
    leadType,
    (leadType.trim().toLowerCase() === "all" || leadType.trim().toLowerCase() === "verified"
      ? "formlead"
      : leadType.trim().toLowerCase()) as CrmLeadType,
  );
  const autoFollowUpPersistSignature = useMemo(
    () =>
      content
        .map((lead) => {
          const followUp = computeAutoFollowUpDateToPersist(lead);
          if (!followUp) return "";
          const lt = asCrmLeadType(lead.leadType, leadTypeFallbackForPersist);
          return `${lt}:${lead.id}`;
        })
        .filter(Boolean)
        .sort()
        .join("|"),
    [content, leadTypeFallbackForPersist],
  );
  useEffect(() => {
    if (!autoFollowUpPersistSignature) return;
    void persistAutoFollowUpDatesForLeads(content, leadTypeFallbackForPersist);
  }, [autoFollowUpPersistSignature, content, leadTypeFallbackForPersist]);
  const roleKeyForInsight = normalizeRole(authRoleProp ?? currentRole);
  const insightOpts = normalizeInsightCountOpts({
    viewerRole: roleKeyForInsight,
    currentUserName: currentUserName ?? "",
    managerTeamNames: scopedTeamForInsight,
    leadView: insightLeadView,
    dateFrom,
    dateTo,
  });
  const insightFilteredContent = filterLeadsForInsightMode(
    tableContent,
    insightTableMode,
    insightOpts,
  );
  const baseRows = insightFilteredContent.map((lead) => {
    const sourceLt = asCrmLeadType(
      lead.leadType,
      (leadType.trim().toLowerCase() === "all" || leadType.trim().toLowerCase() === "verified"
        ? "formlead"
        : leadType.trim().toLowerCase()) as CrmLeadType,
    );
    const mergedLead = applyStoredPresalesMilestoneToApiLead(lead, sourceLt);
    return {
      ...mapApiLeadToRow(mergedLead, sourceLt, stageOrder, scopeRoleKey, leadsWorkspace),
      callDelayed: isFirstCallDelayedLead(lead),
    };
  });
  const norm = (v: string) => v.trim().toLowerCase();
  const myName = norm(currentUserName);
  const scopedTeamNames = managerTeamNamesFromHeader.length > 0 ? managerTeamNamesFromHeader : managerTeamNames;
  const teamSet = new Set(scopedTeamNames.map(norm));
  const rows = baseRows;
  const managerScopedView =
    currentRole === "SALES_MANAGER" &&
    (leadView === "my" || leadView === "team" || leadView === "combined");
  const visibleRows =
    insightTableMode !== null
      ? rows.slice(page * size, page * size + size)
      : rows;
  const total =
    insightTableMode !== null
      ? rows.length
      : adminMilestoneTableActive
        ? adminMilestoneTableLeads.length
        : (visibleFilteredTotal ?? data?.totalElements ?? rows.length);
  const totalPages =
    insightTableMode !== null
      ? Math.max(1, Math.ceil(total / Math.max(1, size)))
      : adminMilestoneTableActive
        ? Math.max(1, Math.ceil(total / Math.max(1, size)))
        : visibleFilteredTotal !== null
          ? Math.max(1, Math.ceil(total / Math.max(1, size)))
          : data?.totalPages && data.totalPages > 0
            ? data.totalPages
            : Math.max(1, Math.ceil(total / Math.max(1, size)));
  const start = total === 0 ? 0 : page * size + 1;
  const end = Math.min(total, page * size + visibleRows.length);
  const rowsById = new Map(visibleRows.map((row) => [row.id, row]));
  const selectedLeads = selectedRowIds
    .map((id) => rowsById.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const selectedCount = selectedLeads.length;
  const isBulkBarVisible = selectedCount > 0;
  const selectedLeadsByType = useMemo(
    () => groupRowsByLeadType(selectedLeads),
    [selectedLeads],
  );
  const hasMixedLeadTypes = selectedLeadsByType.size > 1;
  const selectedLeadTypeSummary = useMemo(
    () =>
      [...selectedLeadsByType.entries()]
        .map(([type, rows]) => `${rows.length} ${toAssignmentLeadType(type)}`)
        .join(" · "),
    [selectedLeadsByType],
  );
  const canBulkAssign =
    currentRole === "SUPER_ADMIN" ||
    currentRole === "ADMIN" ||
    currentRole === "SALES_ADMIN" ||
    currentRole === "SALES_MANAGER" ||
    currentRole === "PRESALES_MANAGER";
  const bulkAssignShowsRolePicker =
    currentRole === "SUPER_ADMIN" ||
    currentRole === "ADMIN" ||
    currentRole === "SALES_ADMIN";
  const bulkAssignTeamLabel =
    currentRole === "SALES_MANAGER" || currentRole === "MANAGER"
      ? "Your team — Sales Executives"
      : currentRole === "PRESALES_MANAGER"
        ? "Your team — Presales Executives"
        : null;
  const canBulkDelete = currentRole === "SUPER_ADMIN" || currentRole === "ADMIN";
  const showDeleteAll = currentRole === "ADMIN";
  const canDeleteAll = showDeleteAll;
  const deleteAllConfirmPhrase =
    leadType === "all"
      ? "DELETE ALL"
      : `DELETE ${toAssignmentLeadType(leadType).toUpperCase()}`;
  const previewSuccess = previewResult?.success === true;
  const previewDistribution = Array.isArray(previewResult?.distribution)
    ? (previewResult.distribution as Array<Record<string, unknown>>)
    : [];
  const filteredAssignees = bulkAssignShowsRolePicker
    ? assigneeRoleFilter === "ALL"
      ? assigneeUsers
      : assigneeUsers.filter((user) => user.role === assigneeRoleFilter)
    : assigneeUsers;
  const totalManualPercentage = selectedAssigneeIds.reduce(
    (sum, userId) => sum + Number(manualPercentages[userId] ?? 0),
    0
  );

  const resolveApiLeadForRow = useCallback(
    (row: LeadRowModel): ApiLead | undefined => {
      const pool = adminMilestoneTableActive
        ? (adminMilestoneTableLeads ?? [])
        : content;
      return pool.find(
        (l) =>
          String(l.id) === String(row.id) &&
          asCrmLeadType(
            l.leadType,
            row.leadType,
          ) === row.leadType,
      );
    },
    [adminMilestoneTableActive, adminMilestoneTableLeads, content],
  );

  const rowAssignNeedsReason = useMemo(() => {
    if (!rowAssignLead || !rowAssignUserId) return false;
    const newUser = rowAssignUsers.find((u) => u.userId === rowAssignUserId);
    if (!newUser) return false;
    return requiresReassignReason({
      leadType: rowAssignLead.leadType,
      verified: rowAssignLead.verified,
      currentAssigneeRole: rowAssignLead.currentAssigneeRole,
      newAssigneeRole: newUser.role,
    });
  }, [rowAssignLead, rowAssignUserId, rowAssignUsers]);

  const bulkAssignNeedsReason = useMemo(() => {
    if (selectedLeads.length === 0 || selectedAssigneeIds.length === 0) return false;
    const targets = selectedAssigneeIds
      .map((id) => assigneeUsers.find((u) => u.userId === id))
      .filter((u): u is AssigneeUser => Boolean(u));
    if (targets.length === 0 || !targets.every((u) => isPresalesAssigneeRole(u.role))) {
      return false;
    }
    const newRole = targets[0]!.role;
    return selectedLeads.some((row) => {
      const apiLead = resolveApiLeadForRow(row);
      if (!apiLead) return false;
      return requiresReassignReason({
        leadType: String(apiLead.leadType ?? row.leadType),
        verified: isCrmLeadVerified(apiLead),
        currentAssigneeRole: assigneeRoleFromLead(apiLead),
        newAssigneeRole: newRole,
      });
    });
  }, [selectedLeads, selectedAssigneeIds, assigneeUsers, resolveApiLeadForRow]);

  const buildAssignmentPayloadForGroup = (
    groupLeadType: string,
    groupLeads: LeadRowModel[],
  ) => {
    const assignees = selectedAssigneeIds.map((userId) => ({
      userId,
      percentage: assignmentMode === "MANUAL" ? Number(manualPercentages[userId] ?? 0) : undefined,
    }));
    const payload = {
      leadType: toAssignmentLeadType(groupLeadType),
      leadIds: groupLeads.map((lead) => Number(lead.id)),
      assignmentMode,
      assignees,
    };
    if (bulkAssignNeedsReason && bulkReassignReason.trim()) {
      return { ...payload, reassignReason: bulkReassignReason.trim() };
    }
    return payload;
  };

  const validateBulkAssignForm = (): string | null => {
    if (selectedLeads.length === 0) return "Select at least one lead.";
    if (selectedAssigneeIds.length === 0) return "Select at least one assignee.";
    if (assignmentMode === "MANUAL") {
      const totalPercentage = selectedAssigneeIds.reduce(
        (sum, userId) => sum + Number(manualPercentages[userId] ?? 0),
        0,
      );
      if (totalPercentage !== 100) {
        return "Percentages must sum to exactly 100%.";
      }
    }
    if (bulkAssignNeedsReason) {
      return validateReassignReason(bulkReassignReason);
    }
    return null;
  };

  const handlePreview = async () => {
    try {
      setAssignmentError("");
      setPreviewResult(null);
      const validationErr = validateBulkAssignForm();
      if (validationErr) {
        setAssignmentError(validationErr);
        return;
      }
      setIsPreviewLoading(true);
      const grouped = groupRowsByLeadType(selectedLeads);
      const results = await Promise.all(
        [...grouped.entries()].map(([, leads]) =>
          assignmentApi.bulkAssignPreview(
            buildAssignmentPayloadForGroup(leads[0]!.leadType, leads),
          ),
        ),
      );
      const merged = mergeBulkAssignPreviewResults(results);
      setPreviewResult(merged);
      if (merged.success === false) {
        setAssignmentError(
          typeof merged.message === "string" ? merged.message : "Preview failed.",
        );
      }
    } catch (e) {
      setAssignmentError(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleExecute = async () => {
    try {
      const validationErr = validateBulkAssignForm();
      if (validationErr) {
        setAssignmentError(validationErr);
        return;
      }
      setIsExecuteLoading(true);
      const grouped = groupRowsByLeadType(selectedLeads);
      for (const [, leads] of grouped.entries()) {
        const res = await assignmentApi.bulkAssignExecute(
          buildAssignmentPayloadForGroup(leads[0]!.leadType, leads),
        );
        if (res.success === false) {
          setAssignmentError(typeof res.message === "string" ? res.message : "Bulk assign failed.");
          return;
        }
      }
      clearSelection();
      await load();
      notifySuccess(
        hasMixedLeadTypes
          ? `Bulk assign completed (${selectedLeadTypeSummary}).`
          : "Bulk assign completed.",
      );
    } catch (e) {
      setAssignmentError(e instanceof Error ? e.message : "Bulk assign failed.");
    } finally {
      setIsExecuteLoading(false);
    }
  };

  const executeDeleteLeadRow = async (row: LeadRowModel) => {
    try {
      setIsDeleting(true);
      await deleteLeadRowsByType(row.leadType, [Number(row.id)]);
      await load();
      const displayName = row.name.trim() || `Lead #${row.id}`;
      notifySuccess(`${displayName} deleted successfully.`);
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const requestDeleteLeadRow = (row: LeadRowModel) => {
    if (!canBulkDelete) {
      setError("Access denied. Only Admin/Super Admin can delete leads.");
      return;
    }
    setDeleteRowCandidate(row);
    setDeleteModalType("row");
  };

  const openRowAssignModal = async (row: LeadRowModel) => {
    const apiLead = resolveApiLeadForRow(row);
    setRowAssignLead({
      id: row.id,
      name: row.name,
      leadType: row.leadType,
      currentAssignee: row.owner.name,
      verified: apiLead ? isCrmLeadVerified(apiLead) : row.verificationTag === "verified",
      currentAssigneeRole: apiLead ? assigneeRoleFromLead(apiLead) : "SALES_EXECUTIVE",
    });
    setRowAssignUserId(null);
    setRowAssignError("");
    setRowReassignReason("");
    setRowAssignModalOpen(true);
    await loadRowAssignUsers();
  };

  const submitRowAssign = async () => {
    if (!rowAssignLead) return;
    if (!rowAssignUserId) {
      setRowAssignError("Please select an assignee.");
      return;
    }
    const newUser = rowAssignUsers.find((u) => u.userId === rowAssignUserId);
    const needsReason =
      newUser &&
      requiresReassignReason({
        leadType: rowAssignLead.leadType,
        verified: rowAssignLead.verified,
        currentAssigneeRole: rowAssignLead.currentAssigneeRole,
        newAssigneeRole: newUser.role,
      });
    if (needsReason) {
      const reasonErr = validateReassignReason(rowReassignReason);
      if (reasonErr) {
        setRowAssignError(reasonErr);
        return;
      }
    }
    try {
      setRowAssignSubmitting(true);
      setRowAssignError("");
      const res = await assignmentApi.assign({
        leadType: toAssignmentLeadType(rowAssignLead.leadType),
        leadId: Number(rowAssignLead.id),
        salesExecutiveId: rowAssignUserId,
        ...(needsReason ? { reassignReason: rowReassignReason.trim() } : {}),
      });
      if (res.success === false) {
        const msg = typeof res.message === "string" ? res.message : "Assign failed.";
        if (/inactive|not active|cannot assign lead to inactive user/i.test(msg)) {
          setRowAssignError("This assignee is inactive. Please select an active user and try again.");
        } else {
          setRowAssignError(msg);
        }
        return;
      }
      setRowAssignModalOpen(false);
      setRowAssignLead(null);
      setRowAssignUserId(null);
      await load();
      notifySuccess(typeof res.message === "string" ? res.message : "Lead assigned successfully.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Assign failed.";
      if (/inactive|not active|cannot assign lead to inactive user/i.test(msg)) {
        setRowAssignError("This assignee is inactive. Please select an active user and try again.");
      } else {
        setRowAssignError(msg);
      }
    } finally {
      setRowAssignSubmitting(false);
    }
  };

  const executeBulkDeleteSelected = async () => {
    if (selectedLeads.length === 0 || !canBulkDelete) return;
    try {
      setIsDeleting(true);
      const grouped = new Map<string, number[]>();
      for (const row of selectedLeads) {
        const list = grouped.get(row.leadType) ?? [];
        list.push(Number(row.id));
        grouped.set(row.leadType, list);
      }
      for (const [type, ids] of grouped.entries()) {
        await deleteLeadRowsByType(type, ids);
      }
      clearSelection();
      await load();
      notifySuccess("Selected leads deleted successfully.");
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Bulk delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const executeDeleteAllByType = async () => {
    if (!canDeleteAll) return;
    try {
      setIsDeleting(true);
      if (leadType !== "all") {
        const res = await fetch(`/api/admin/${toAdminDeleteAllPath(leadType)}`, {
          method: "DELETE",
          credentials: "include",
          headers: getCrmAuthHeaders(),
        });
        if (!res.ok) throw new Error("Delete-all failed.");
        notifyInfo(deleteNoticeText(currentRole, `Delete All (${toAssignmentLeadType(leadType)})`));
      } else {
        const targets = [
          "formlead",
          "glead",
          "mlead",
          "addlead",
          "websitelead",
          "walkinlead",
          "whatsapplead",
        ] as const;
        const results = await Promise.all(
          targets.map(async (t) => {
            const res = await fetch(`/api/admin/${toAdminDeleteAllPath(t)}`, {
              method: "DELETE",
              credentials: "include",
              headers: getCrmAuthHeaders(),
            });
            const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
            return {
              type: toAssignmentLeadType(t),
              ok: res.ok && body.success !== false,
              message: typeof body.message === "string" ? body.message : "",
            };
          })
        );
        const successTypes = results.filter((r) => r.ok).map((r) => r.type);
        const failedTypes = results.filter((r) => !r.ok).map((r) => r.type);
        if (failedTypes.length === 0) {
          notifyInfo(deleteNoticeText(currentRole, "Delete All"));
        } else if (successTypes.length === 0) {
          throw new Error(`Delete failed for: ${failedTypes.join(", ")}`);
        } else {
          notifyInfo(
            `${deleteNoticeText(currentRole, "Delete All")} — Deleted ${successTypes.join(", ")}. Failed: ${failedTypes.join(", ")}.`
          );
        }
      }
      await load();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Delete-all failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const insightBannerText =
    insightTableMode === "followUpActive"
      ? currentRole === "SALES_MANAGER"
        ? "Active follow up date — team (Discovery · Connection)"
        : "Active follow up date (Discovery · Connection)"
      : insightTableMode === "followUpClosure"
        ? currentRole === "SALES_MANAGER"
          ? "Closure follow up date — team (Experience & Design → Closed)"
          : "Closure follow up date (Experience & Design → Closed)"
        : insightTableMode === "overdueActive"
          ? "Lead Overdue (Discovery · Connection)"
          : insightTableMode === "overdueClosure"
            ? "Opportunity Overdue (Experience & Design → Closed)"
            : insightTableMode === "callDelayed"
              ? "First Call Delayed"
            : insightTableMode === "totalCalls"
              ? "Total Calls"
            : insightTableMode === "overdue"
              ? "Overdue follow-ups"
          : insightTableMode === "teamLeads"
            ? "Team leads — assigned to your sales executives"
            : insightTableMode === "meetingScheduled"
              ? "Meeting Scheduled — substage filter"
              : insightTableMode === "meetingRescheduled"
                ? "Meeting Rescheduled — substage filter"
                : insightTableMode === "meetingCancelled"
                  ? "Meeting Cancelled — substage filter"
                  : insightTableMode === "quoteSent"
                    ? "Quote Sent — meeting done, quotation shared"
                    : insightTableMode === "quoteDue"
                      ? "Quote Due — Meeting Done but Quote Pending"
                      : insightTableMode === "lostDiscovery"
                        ? "Lost Segment — Discovery Lost"
                        : insightTableMode === "lostConnection"
                          ? "Lost Segment — Connection Lost"
                          : insightTableMode === "lostExperienceDesign"
                            ? "Lost Segment — Experience & Design Lost"
                            : insightTableMode === "lostDecision"
                              ? "Lost Segment — Decision Lost"
                              : insightTableMode === "lostClosed"
                                ? "Lost Segment — Closed Lost"
                                : null;

  const insightBannerFollowUpNote =
    insightTableMode === "followUpActive" ||
    insightTableMode === "followUpClosure" ||
    insightTableMode === "overdue" ||
    insightTableMode === "overdueActive" ||
    insightTableMode === "overdueClosure" ||
    insightTableMode === "callDelayed";

  return (
    <>
      {insightBannerText ? (
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-6 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <p className="min-w-0 text-[13px] font-semibold text-[var(--crm-text-primary)]">
            {insightBannerText}
            {insightBannerFollowUpNote ? (
              <span className="ml-2 text-[12px] font-medium text-[var(--crm-text-muted)]">
                — matches your browser&apos;s local calendar day using each lead&apos;s{" "}
                <code className="rounded bg-[var(--crm-surface-subtle)] px-1">followUpDate</code>.
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setInsightTableMode(null)}
              className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface-subtle)]"
            >
              Clear insight
            </button>
          </div>
        </div>
      ) : null}
      <LeadsToolbar
        rangeStart={start}
        rangeEnd={end}
        totalCount={total}
        loading={loading}
        leadTypeCounts={leadTypeCounts}
        leadTypeCountsPrimary={leadTypeCountsPrimary ?? undefined}
        leadTypeCountsAllRows={
          normalizeRole(authRoleProp ?? currentRole) === "SUPER_ADMIN"
            ? leadTypeCountsAllRows ?? undefined
            : undefined
        }
        adminTotalLeadsDisplay={
          (() => {
            const rk = normalizeRole(authRoleProp ?? currentRole);
            return rk === "SUPER_ADMIN" || rk === "SALES_ADMIN"
              ? (adminPoolDisplayTotals ?? undefined)
              : undefined;
          })()
        }
        superAdminSearchPoolTotals={superAdminSearchPoolTotals ?? undefined}
        superAdminCrossPoolSearchActive={
          normalizeRole(authRoleProp ?? currentRole) === "SUPER_ADMIN" &&
          debouncedSearch.trim().length > 0
        }
        crossPoolLeadTypeCounts={crossPoolLeadTypeCounts ?? undefined}
        leadsWorkspace={leadsWorkspace}
        viewerRole={viewerRole}
        authRole={authRoleProp ?? ""}
        leadType={leadType}
        sort={sort}
        assignee={assignee}
        dateFrom={dateFrom}
        dateTo={dateTo}
        dateField={dateField}
        milestoneStage={milestoneStage}
        milestoneStageCategory={milestoneStageCategory}
        milestoneSubStage={milestoneSubStage}
        reinquiry={reinquiry}
        salesAdminFilter={salesAdminFilter}
        salesManagerFilter={salesManagerFilter}
        salesExecFilter={salesExecFilter}
        presalesManagerFilter={presalesManagerFilter}
        presalesExecFilter={presalesExecFilter}
        salesAdminOptions={
          salesAdmins.length
            ? salesAdmins.map((u) => userName(u)).filter(Boolean)
            : assigneeUsers.filter((u) => u.role === "SALES_ADMIN").map((u) => u.name).length
              ? assigneeUsers.filter((u) => u.role === "SALES_ADMIN").map((u) => u.name)
              : assigneeOptions
        }
        salesManagerOptions={
          salesManagers.length
            ? salesManagers.map((u) => userName(u)).filter(Boolean)
            : assigneeUsers.filter((u) => u.role === "SALES_MANAGER").map((u) => u.name).length
              ? assigneeUsers.filter((u) => u.role === "SALES_MANAGER").map((u) => u.name)
              : assigneeOptions
        }
        salesExecOptions={salesExecOptionsResolved}
        presalesManagerOptions={
          presalesManagers.length
            ? presalesManagers.map((u) => userName(u)).filter(Boolean)
            : assigneeUsers.filter((u) => u.role === "PRESALES_MANAGER").map((u) => u.name).length
              ? assigneeUsers.filter((u) => u.role === "PRESALES_MANAGER").map((u) => u.name)
              : assigneeOptions
        }
        presalesExecOptions={
          presalesExecs.length
            ? presalesExecs.map((u) => userName(u)).filter(Boolean)
            : assigneeUsers
                .filter((u) => u.role === "PRESALES_EXECUTIVE" || u.role === "PRE_SALES")
                .map((u) => u.name).length
              ? assigneeUsers
                  .filter((u) => u.role === "PRESALES_EXECUTIVE" || u.role === "PRE_SALES")
                  .map((u) => u.name)
              : assigneeOptions
        }
        assigneeOptions={assigneeOptions}
        pipelineNested={pipelineNested}
        onLeadTypeChange={onLeadTypeChange}
        onSortChange={onSortChange}
        onResetAll={handleResetAll}
        onAssigneeChange={(next) => {
          setSalesAdminFilter("");
          setSalesManagerFilter("");
          setSalesExecFilter("");
          setPresalesManagerFilter("");
          setPresalesExecFilter("");
          onAssigneeChange(next);
        }}
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
        onDateFieldChange={onDateFieldChange}
        onMilestoneStageChange={onMilestoneStageChange}
        onMilestoneStageCategoryChange={onMilestoneStageCategoryChange}
        onMilestoneSubStageChange={onMilestoneSubStageChange}
        onReinquiryChange={onReinquiryChange}
        onSalesAdminFilterChange={(next) => {
          setSalesAdminFilter(next);
          onAssigneeChange("");
          setSalesManagerFilter("");
          setSalesExecFilter("");
          setPresalesManagerFilter("");
          setPresalesExecFilter("");
        }}
        onSalesManagerFilterChange={(next) => {
          setSalesManagerFilter(next);
          onAssigneeChange("");
          setSalesAdminFilter("");
          setSalesExecFilter("");
          setPresalesManagerFilter("");
          setPresalesExecFilter("");
        }}
        onSalesExecFilterChange={(next) => {
          setSalesExecFilter(next);
          onAssigneeChange("");
          setSalesAdminFilter("");
          setSalesManagerFilter("");
          setPresalesManagerFilter("");
          setPresalesExecFilter("");
        }}
        onPresalesManagerFilterChange={(next) => {
          setPresalesManagerFilter(next);
          onAssigneeChange("");
          setSalesAdminFilter("");
          setSalesManagerFilter("");
          setSalesExecFilter("");
          setPresalesExecFilter("");
        }}
        onPresalesExecFilterChange={(next) => {
          setPresalesExecFilter(next);
          onAssigneeChange("");
          setSalesAdminFilter("");
          setSalesManagerFilter("");
          setSalesExecFilter("");
          setPresalesManagerFilter("");
        }}
        insightActive={insightTableMode}
        onInsightNavigate={(mode) =>
          setInsightTableMode((prev) => (prev === mode ? null : mode))
        }
        hideTotalLeadsPill={isPresalesRole(authRoleProp ?? currentRole)}
        onResetPresalesSummary={onPresalesSummaryClear}
        showDeleteAllButton={showDeleteAll}
        deleteAllLabel={leadType === "all" ? "Delete All" : `Delete All (${toAssignmentLeadType(leadType)})`}
        deleteAllDisabled={isDeleting || !canDeleteAll}
        onDeleteAllClick={() => setDeleteModalType("all")}
      />
      {isBulkBarVisible ? (
      <section className="mx-auto sticky top-2 z-20 mt-3 max-w-[1200px] px-6">
        <div className="rounded-2xl border border-emerald-200 bg-[#dcefe8] px-4 py-2.5 shadow-[0_6px_18px_rgba(16,24,40,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#2f80ed] bg-[#2f80ed] text-[12px] font-bold text-white shadow-sm">
              ✓
            </div>
            <div>
              <p className="text-[14px] font-semibold leading-tight text-[#1f2937]">
                {selectedCount} lead selected
              </p>
              <p className="mt-0.5 text-[11px] leading-tight text-[#4b5563]">
                Distribute these leads with a single tap.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canBulkAssign ? (
            <button
              type="button"
              disabled={selectedCount === 0 || isPreviewLoading || isExecuteLoading}
              onClick={() => {
                setAssignmentError("");
                setPreviewResult(null);
                void loadAssignableUsers();
                setShowAssignModal(true);
              }}
              className="h-9 rounded-lg bg-[#35a853] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#2f9a4c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              📋 Assign Selected
            </button>
            ) : null}
            {canBulkDelete ? (
            <button
              type="button"
              disabled={selectedCount === 0 || isDeleting}
              onClick={() => setDeleteModalType("selected")}
              className="h-9 rounded-lg bg-[#e85246] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#dc4639] disabled:cursor-not-allowed disabled:opacity-50"
            >
              🗑 Delete Selected
            </button>
            ) : null}
            <button
              type="button"
              onClick={clearSelection}
              className="h-9 rounded-lg border border-emerald-300 bg-transparent px-4 text-[13px] font-semibold text-[#0f766e] transition hover:bg-white/60"
            >
              Clear Selection
            </button>
          </div>
          </div>
        </div>
      </section>
      ) : null}
      {error ? (
        <div className="mx-auto mt-2 max-w-[1200px] px-6 text-[12px] text-[var(--crm-danger-text)]">
          {error}
          {process.env.NODE_ENV === "development" ? (
            <span className="mt-1 block text-[var(--crm-text-muted)]">
              Set <code className="rounded bg-[var(--crm-surface-subtle)] px-1">CRM_DEV_BEARER_TOKEN</code> in{" "}
              <code className="rounded bg-[var(--crm-surface-subtle)] px-1">.env.local</code> or store a token in{" "}
              <code className="rounded bg-[var(--crm-surface-subtle)] px-1">localStorage</code> as{" "}
              <code className="rounded bg-[var(--crm-surface-subtle)] px-1">crm_token</code> (login) or{" "}
              <code className="rounded bg-[var(--crm-surface-subtle)] px-1">access_token</code>.
            </span>
          ) : null}
        </div>
      ) : null}
      <LeadsTable
        rows={visibleRows}
        loading={loading}
        page={page}
        totalPages={totalPages}
        pageSize={size}
        onPageChange={(next) => setPage(Math.max(0, Math.min(totalPages - 1, next)))}
        onPageSizeChange={(nextSize) => setSize(nextSize)}
        selectedRowIds={selectedRowIds}
        onSelectedRowIdsChange={setSelectedRowIds}
        onDeleteRow={canBulkDelete ? (row) => void requestDeleteLeadRow(row) : undefined}
        onAssignRow={canBulkAssign ? (row) => void openRowAssignModal(row) : undefined}
        leadsWorkspace={leadsWorkspace}
      />
      {rowAssignModalOpen && rowAssignLead ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(9,14,30,0.55)] backdrop-blur-[4px] px-3 py-4">
          <div
            className="w-full max-w-[500px] overflow-hidden rounded-[12px] border border-[#d7dff0] bg-[#f6f8fc] shadow-[0_24px_54px_rgba(15,23,42,0.30)]"
            style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
          >
            <div className="border-b border-[#6a7be4] bg-gradient-to-r from-[#5b73e8] to-[#8a57d1] px-4 py-3.5">
              <h3 className="text-[20px] font-bold text-white">Assign Lead</h3>
              <p className="mt-1 text-[12px] font-medium text-[#eef1ff]">
                Lead: {rowAssignLead.name} | Type: {toAssignmentLeadType(rowAssignLead.leadType)}
              </p>
            </div>
            <div className="space-y-3 p-4">
              <div className="rounded-[8px] border border-[#e2e8f3] bg-white p-3">
                <p className="text-[13px] font-semibold text-[#555555]">Current assignee</p>
                <p className="mt-1 text-[14px] font-normal text-[#333333]">{rowAssignLead.currentAssignee || "Unassigned"}</p>
                <p className="mt-1 text-[12px] font-medium text-[#6f7f98]">Lead ID: {rowAssignLead.id}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#555555]">New assignee</label>
                <select
                  className="h-10 w-full rounded-[8px] border border-[#d1d5db] bg-white px-3 text-[14px] font-normal text-[#333333] outline-none transition focus:border-[#4f64d0] focus:ring-2 focus:ring-[#cfd8ff]"
                  value={rowAssignUserId ?? ""}
                  onChange={(e) => setRowAssignUserId(e.target.value ? Number(e.target.value) : null)}
                  disabled={rowAssignLoadingUsers || rowAssignSubmitting}
                >
                  <option value="">-- Select assignee --</option>
                  {rowAssignUsers.map((user) => (
                    <option key={user.userId} value={user.userId}>
                      {user.name} ({user.role.replace(/_/g, " ")})
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[12px] font-medium text-[#6f7f98]">
                  Role/hierarchy restrictions are validated by backend automatically.
                </p>
              </div>
              {rowAssignNeedsReason ? (
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#555555]">
                    Reassign reason <span className="text-[#b45309]">*</span>
                  </label>
                  <textarea
                    className="min-h-[72px] w-full rounded-[8px] border border-[#d1d5db] bg-white px-3 py-2 text-[14px] text-[#333333] outline-none transition focus:border-[#4f64d0] focus:ring-2 focus:ring-[#cfd8ff]"
                    value={rowReassignReason}
                    onChange={(e) => setRowReassignReason(e.target.value)}
                    placeholder="Required: verified G/M/Website lead moving from sales to presales (min 3 characters)"
                    disabled={rowAssignSubmitting}
                  />
                </div>
              ) : null}
              {rowAssignError ? (
                <div className="rounded-[8px] border border-[#f5c2c7] bg-[#f8d7da] px-3 py-2 text-[12px] font-medium text-[#721c24]">
                  {rowAssignError}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#dfe6f3] bg-[#f6f8fc] px-4 py-2.5">
              <button
                className="h-[38px] rounded-[8px] border border-[#d1d5db] bg-white px-5 text-[14px] font-medium text-[#6b7280] transition hover:bg-[#f9fafb]"
                onClick={() => {
                  setRowAssignModalOpen(false);
                  setRowAssignLead(null);
                }}
                disabled={rowAssignSubmitting}
              >
                Cancel
              </button>
              <button
                className="h-[38px] rounded-[8px] border border-[#7f83d5] bg-gradient-to-r from-[#8d95dd] to-[#a67fd9] px-5 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(141,149,221,0.28)] transition hover:from-[#7d86d8] hover:to-[#976ed5] disabled:opacity-60"
                onClick={() => void submitRowAssign()}
                disabled={rowAssignLoadingUsers || rowAssignSubmitting}
              >
                {rowAssignSubmitting ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showAssignModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(9,14,30,0.55)] backdrop-blur-[4px] px-2 py-3">
          <div
            className="w-[min(610px,90vw)] overflow-hidden rounded-[12px] border border-[#d7dff0] bg-[#f6f8fc] shadow-[0_28px_64px_rgba(15,23,42,0.30)]"
            style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
          >
            <div className="flex items-start justify-between bg-gradient-to-r from-[#5b73e8] to-[#8a57d1] px-4 py-3.5">
              <div>
                <h3 className="text-[20px] font-bold text-white">Bulk Assign Leads</h3>
                <p className="mt-1 text-[12px] font-medium text-[#eef1ff]">Selected: {selectedCount} leads</p>
              </div>
              <button className="text-xl text-white/90 transition hover:text-white" onClick={() => setShowAssignModal(false)}>
                ×
              </button>
            </div>
            <div className="max-h-[58vh] space-y-2.5 overflow-y-auto p-3">
              <div className="rounded-[10px] border border-[#9ec4f5] bg-gradient-to-r from-[#5f78ea] to-[#825dd1] px-4 py-3 shadow-[0_8px_20px_rgba(91,115,232,0.28)]">
                <p className="text-[13px] font-semibold text-[#eef1ff]">Selected Leads</p>
                <p className="text-[20px] font-bold text-white">{selectedCount}</p>
              </div>

              <div className="rounded-[10px] border border-[#e2e8f3] bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.06)]">
                <p className="text-[13px] font-semibold text-[#555555]">🧑‍💼 Select Role:</p>
                {bulkAssignShowsRolePicker ? (
                  <select
                    className="mt-1.5 h-10 w-full rounded-[8px] border border-[#d1d5db] bg-white px-3 text-[14px] font-normal text-[#333333] outline-none transition focus:border-[#3b82f6] focus:ring-2 focus:ring-[#bfdbfe]"
                    value={assigneeRoleFilter}
                    onChange={(e) => setAssigneeRoleFilter(e.target.value)}
                  >
                    <option value="ALL">All Roles</option>
                    <option value="SALES_MANAGER">Sales Manager</option>
                    <option value="SALES_EXECUTIVE">Sales Executive</option>
                    <option value="PRESALES_MANAGER">Presales Manager</option>
                    <option value="PRESALES_EXECUTIVE">Presales Executive</option>
                  </select>
                ) : (
                  <p className="mt-1.5 rounded-[8px] border border-[#d1d5db] bg-[#f8fafc] px-3 py-2 text-[14px] font-medium text-[#333333]">
                    {bulkAssignTeamLabel}
                  </p>
                )}
                <p className="mt-2 text-[12px] font-medium text-[#6f7f98]">
                  {filteredAssignees.length} active team member{filteredAssignees.length === 1 ? "" : "s"} available
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-[#555555]">Assignment Mode:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignmentMode("MANUAL")}
                    className={`flex h-[78px] flex-col items-center justify-center rounded-[8px] border px-4 text-[14px] font-semibold transition ${
                      assignmentMode === "MANUAL"
                        ? "border-[#6c7eea] bg-[#ecefff] text-[#2f3f8e] shadow-[inset_0_0_0_1px_rgba(108,126,234,0.15)]"
                        : "border-[#d7deec] bg-white text-[#6b7280]"
                    }`}
                  >
                    <span className="text-[18px] leading-none">🧍</span>
                    <span className="mt-1">Manual</span>
                    <span className="text-[12px] font-medium">By %</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignmentMode("AUTO")}
                    className={`flex h-[78px] flex-col items-center justify-center rounded-[8px] border px-4 text-[14px] font-semibold transition ${
                      assignmentMode === "AUTO"
                        ? "border-[#6c7eea] bg-[#ecefff] text-[#2f3f8e] shadow-[inset_0_0_0_1px_rgba(108,126,234,0.15)]"
                        : "border-[#d7deec] bg-white text-[#6b7280]"
                    }`}
                  >
                    <span className="text-[18px] leading-none">📊</span>
                    <span className="mt-1">Auto</span>
                    <span className="text-[12px] font-medium">By %</span>
                  </button>
                </div>
              </div>

              <div className="rounded-[10px] border border-[#e2e8f3] bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.06)]">
                <p className="mb-2 text-[13px] font-semibold text-[#555555]">👥 Select Users & Set Percentages:</p>
                <div className="rounded-[8px] border border-[#e7edf8] bg-[#f7f9fc] p-2">
                  <div className="grid gap-2">
                    {filteredAssignees.length === 0 ? (
                      <p className="rounded-[8px] border border-[#f6c58f] bg-[#fff8eb] px-3 py-2 text-[12px] font-medium text-[#b45309]">
                        No team members loaded. Refresh the page or contact admin if your team roster is empty.
                      </p>
                    ) : null}
                    {filteredAssignees.map((user) => (
                      <label key={user.userId} className="flex items-center justify-between rounded-[8px] border border-[#dde5f3] bg-white px-3 py-2 transition hover:border-[#cfdaf0] hover:bg-[#fbfcff]">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedAssigneeIds.includes(user.userId)}
                            onChange={(e) =>
                              setSelectedAssigneeIds((prev) =>
                                e.target.checked
                                  ? [...new Set([...prev, user.userId])]
                                  : prev.filter((id) => id !== user.userId)
                              )
                            }
                          />
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6f7fe3] text-[12px] font-semibold text-white">
                              {user.name.trim().charAt(0).toUpperCase() || "U"}
                            </span>
                            <p className="text-[14px] font-semibold text-[#1f2736]">{user.name}</p>
                            <p className="text-[12px] font-medium text-[#7f8c8d]">{user.role.replace(/_/g, " ")}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            className="w-[78px] rounded-[8px] border border-[#d1d5db] bg-[#f8fafc] px-2 py-1 text-right text-[14px] outline-none focus:border-[#3b82f6]"
                            value={manualPercentages[user.userId] ?? 0}
                            disabled={assignmentMode === "AUTO"}
                            onChange={(e) =>
                              setManualPercentages((prev) => ({
                                ...prev,
                                [user.userId]: Number(e.target.value),
                              }))
                            }
                          />
                          <span className="text-[14px] text-[#333333]">%</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                {assignmentMode === "MANUAL" ? (
                  <div className="mt-3 rounded-[8px] border border-[#f0cb58] bg-[#fff3c8] p-3">
                    <p className="text-[12px] font-medium text-[#8a6a08]">Total Percentage</p>
                    <p className={`text-[20px] font-bold ${totalManualPercentage === 100 ? "text-[#155724]" : "text-[#c01621]"}`}>
                      {totalManualPercentage}
                    </p>
                    <p className="text-[12px] font-medium text-[#8a6a08]">Select users and set percentages (must total 100%)</p>
                  </div>
                ) : (
                  <div className="mt-3 rounded-[8px] border border-[#b7e4c7] bg-[#d4edda] p-3">
                    <p className="text-[12px] font-medium text-[#155724]">Selected assignees</p>
                    <p className="text-[20px] font-bold text-[#155724]">{selectedAssigneeIds.length}</p>
                    <p className="text-[12px] font-medium text-[#155724]">Auto distribution will split evenly.</p>
                  </div>
                )}
              </div>

              {bulkAssignNeedsReason ? (
                <div className="rounded-[10px] border border-[#f6c58f] bg-[#fff8eb] p-3">
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#555555]">
                    Reassign reason <span className="text-[#b45309]">*</span>
                  </label>
                  <textarea
                    className="min-h-[72px] w-full rounded-[8px] border border-[#d1d5db] bg-white px-3 py-2 text-[14px] text-[#333333] outline-none transition focus:border-[#4f64d0] focus:ring-2 focus:ring-[#cfd8ff]"
                    value={bulkReassignReason}
                    onChange={(e) => setBulkReassignReason(e.target.value)}
                    placeholder="Required for verified G/M/Website leads moving to presales (min 3 characters)"
                  />
                </div>
              ) : null}

              {hasMixedLeadTypes ? (
                <p className="mt-3 rounded-[8px] border border-[#b9d5f3] bg-[#e9f3ff] p-2 text-[12px] font-medium text-[#27476a]">
                  Mixed lead types selected — assign runs once per type ({selectedLeadTypeSummary}).
                </p>
              ) : null}
              {assignmentError ? (
                <p className="mt-3 rounded-[8px] border border-[#f5c2c7] bg-[#f8d7da] p-2 text-[12px] font-medium text-[#721c24]">
                  {assignmentError}
                </p>
              ) : null}

              {previewResult ? (
                <div className="rounded-[10px] border border-[#b9d5f3] bg-[#e9f3ff] p-3.5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-[#27476a]">👁️ Assignment Preview</p>
                    <span className="rounded-full bg-[#6f7fe3] px-2 py-1 text-[12px] font-semibold text-white">
                      {selectedCount} Leads
                    </span>
                  </div>
                  {previewDistribution.map((item, idx) => (
                    <div key={`${item.userId ?? idx}`} className="mb-2 rounded-[8px] border border-[#cfe1f5] bg-white px-3 py-2 text-[14px]">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-[#1f2736]">{String(item.assigneeName ?? `User ${item.userId ?? idx}`)}</p>
                        <p className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[12px] font-semibold text-[#4b5fc4]">
                          {String(item.leadCount ?? 0)} leads
                        </p>
                      </div>
                      <p className="mt-1 text-[12px] font-medium text-[#7f8c8d]">
                        {item.percentage !== undefined ? `${String(item.percentage)}%` : "AUTO"} • Limit status shown by backend
                      </p>
                    </div>
                  ))}
                  <div
                    className={`rounded-[8px] p-2 text-[12px] font-medium ${
                      previewSuccess
                        ? "border border-[#b7e4c7] bg-[#d4edda] text-[#155724]"
                        : "border border-[#f5c2c7] bg-[#f8d7da] text-[#721c24]"
                    }`}
                  >
                    {previewSuccess ? "Ready to assign leads." : "Preview has warnings/errors."}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="sticky bottom-0 flex items-center justify-between border-t border-[#dfe6f3] bg-[#f6f8fc] px-3 py-2.5">
              <p className="text-[12px] font-medium text-[#6f7f98]">{selectedCount} selected</p>
              <div className="flex items-center gap-2">
              <button
                className="h-[38px] rounded-[8px] border border-[#d1d5db] bg-white px-5 text-[14px] font-medium text-[#6b7280] transition hover:-translate-y-px hover:bg-[#f9fafb]"
                onClick={() => setShowAssignModal(false)}
                disabled={isPreviewLoading || isExecuteLoading}
              >
                Cancel
              </button>
              <button
                className="h-[38px] rounded-[8px] border border-[#5063cf] bg-[#5d72df] px-5 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(93,114,223,0.28)] transition hover:-translate-y-px hover:bg-[#4f64d0] disabled:opacity-60"
                onClick={() => void handlePreview()}
                disabled={isPreviewLoading || isExecuteLoading}
              >
                {isPreviewLoading ? "Calculating..." : "👁️ Preview Distribution"}
              </button>
              <button
                className="h-[38px] rounded-[8px] border border-[#7f83d5] bg-gradient-to-r from-[#8d95dd] to-[#a67fd9] px-5 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(141,149,221,0.28)] transition hover:-translate-y-px hover:from-[#7d86d8] hover:to-[#976ed5] disabled:opacity-60"
                onClick={() => void handleExecute()}
                disabled={isPreviewLoading || isExecuteLoading || !previewResult || previewResult.success === false}
              >
                {isExecuteLoading ? "Assigning..." : "✨ Assign"}
              </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {deleteModalType ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_25px_60px_rgba(15,23,42,0.25)]">
            <h3 className="text-sm font-bold text-slate-800">
              {deleteModalType === "row"
                ? `Delete lead #${deleteRowCandidate?.id ?? ""}?`
                : deleteModalType === "all"
                  ? leadType === "all"
                    ? "Delete all lead types (global)?"
                    : `Delete all ${toAssignmentLeadType(leadType)} records?`
                  : "Delete selected leads?"}
            </h3>
            <p className="mt-1 text-xs text-slate-500">This action cannot be undone.</p>
            {deleteModalType === "all" ? (
              <div className="mt-3">
                <p className="text-[11px] font-semibold text-slate-700">
                  Type <span className="font-bold">{deleteAllConfirmPhrase}</span> to confirm.
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-[12px] text-slate-800 outline-none focus:border-slate-500"
                  placeholder={deleteAllConfirmPhrase}
                />
              </div>
            ) : null}
            {deleteModalType === "selected" ? (
              <p className="mt-2 text-xs font-semibold text-slate-700">Selected: {selectedCount}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                onClick={() => {
                  setDeleteModalType(null);
                  setDeleteRowCandidate(null);
                  setDeleteConfirmText("");
                }}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                onClick={() => {
                  if (deleteModalType === "row" && deleteRowCandidate) {
                    void executeDeleteLeadRow(deleteRowCandidate);
                  } else if (deleteModalType === "all") {
                    if (deleteConfirmText.trim().toUpperCase() !== deleteAllConfirmPhrase) {
                      setError(`Please type "${deleteAllConfirmPhrase}" to confirm.`);
                      return;
                    }
                    void executeDeleteAllByType();
                  } else {
                    void executeBulkDeleteSelected();
                  }
                  setDeleteModalType(null);
                  setDeleteRowCandidate(null);
                  setDeleteConfirmText("");
                }}
                disabled={
                  isDeleting ||
                  (deleteModalType === "all" &&
                    deleteConfirmText.trim().toUpperCase() !== deleteAllConfirmPhrase)
                }
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "fixed bottom-10 z-[100] transition-all duration-500 ease-in-out",
          isMinimized ? "-right-6 opacity-60 hover:opacity-100" : "right-10 opacity-100"
        )}
        onMouseEnter={handleActivity}
        onClick={handleActivity}
      >
        <button
          onClick={(e) => {
            if (isMinimized) {
              e.stopPropagation();
              setIsMinimized(false);
              handleActivity();
            } else {
              handleRefresh();
            }
          }}
          title={
            isMinimized
              ? "Expand Refresh Button"
              : whatsappListActive
                ? lastRefreshTime
                  ? `Last sync: ${relativeTime}. Refresh after MSG91 inbound if the list is stale.`
                  : "Refresh leads after MSG91 inbound."
                : lastRefreshTime
                  ? `Last sync: ${relativeTime}`
                  : "Refresh Leads"
          }
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 group",
            isMinimized ? "cursor-e-resize" : "cursor-pointer"
          )}
        >
          {isMinimized ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-4 w-4 -ml-4">
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-5 w-5 ${loading ? "animate-spin" : ""}`}
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
}
