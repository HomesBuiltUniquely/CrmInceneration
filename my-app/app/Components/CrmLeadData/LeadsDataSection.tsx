"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiLead, LeadRowModel, SpringPage } from "@/lib/leads-filter";
import { asCrmLeadType, isCrmLeadVerified, mapApiLeadToRow } from "@/lib/leads-filter";
import { fetchCrmPipeline } from "@/lib/crm-pipeline";
import { nestedStageForSelection } from "@/lib/milestone-filter-tree";
import type { CrmNestedStage } from "@/types/crm-pipeline";
import { getCrmAuthHeaders, readStoredCrmToken } from "@/lib/crm-client-auth";
import { assignmentApi } from "@/lib/assignment-api";
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
import LeadsTable from "./LeadsTable";
import LeadsToolbar from "./LeadsToolbar";
import { useGlobalNotifier } from "../Shared/GlobalNotifier";
import {
  assigneeAliasNorms,
  computeFollowUpInsightCounts,
  filterLeadsForInsightMode,
  isFirstCallDelayedLead,
  type InsightTableMode,
} from "@/lib/lead-follow-up-insights";
import {
  countSalesManagerMineVsTeam,
  narrowSalesManagerLeadsIfTeamKnown,
} from "@/lib/sales-manager-lead-scope";
import { leadAssignedToPresalesExecNameSet } from "@/lib/presales-heatmap-helpers";

type Props = {
  search: string;
  leadType: string;
  sort: string;
  assignee: string;
  dateFrom: string;
  dateTo: string;
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
  onMilestoneStageChange: (next: string) => void;
  onMilestoneStageCategoryChange: (next: string) => void;
  onMilestoneSubStageChange: (next: string) => void;
  onReinquiryChange: (next: string) => void;
  /** Keeps Journey Phase Heatmap assignee filter aligned with toolbar (Sales Exec, etc.). */
  onHeatmapAssigneeSync?: (effectiveAssignee: string) => void;
  /** Keeps heatmap phase counts aligned with the active insight filter (e.g. Team Leads). */
  onInsightTableModeChange?: (mode: InsightTableMode) => void;
};

type SubStatusResp = {
  mappings?: Array<{ stage: string; stageCategory: string; subStageName: string }>;
};
type HierarchyUser = {
  id: number;
  fullName?: string;
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

const LEADS_VIEW_PERSIST_KEY = "crm:lead-mgmt:view:v1";

type LeadsViewPersistedState = {
  page?: number;
  size?: number;
  salesAdminFilter?: string;
  salesManagerFilter?: string;
  salesExecFilter?: string;
  presalesManagerFilter?: string;
  presalesExecFilter?: string;
  insightTableMode?: InsightTableMode;
};

function readLeadsViewPersistedState(): LeadsViewPersistedState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(LEADS_VIEW_PERSIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LeadsViewPersistedState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
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

type AssignmentMode = "AUTO" | "MANUAL";
type RowAssignLead = {
  id: string;
  name: string;
  leadType: string;
  currentAssignee: string;
};

const EMPTY_ASSIGNEE_SCOPE: string[] = [];

function normText(value: string): string {
  return value.trim().toLowerCase();
}

function buildHierarchyScopedAssignees(args: {
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
    const selectedManagerNorm = normText(salesManagerName);
    const selectedManager = args.salesManagers.find((u) => {
      const n = normText(String(u.fullName ?? u.username ?? ""));
      return n === selectedManagerNorm;
    });
    if (selectedManager && Number(selectedManager.id ?? 0) > 0) {
      const managerId = Number(selectedManager.id);
      managerNames.push(String(selectedManager.fullName ?? selectedManager.username ?? "").trim());
      salesExecUnderManager = args.salesExecs.filter(
        (u) => Number(u.managerId ?? 0) === managerId,
      );
      presalesMgrUnderManager = args.presalesManagers.filter(
        (u) => Number(u.managerId ?? 0) === managerId,
      );
      const presalesMgrIds = new Set(
        presalesMgrUnderManager.map((u) => Number(u.id)).filter((id) => id > 0),
      );
      presalesExecUnderManager = args.presalesExecs.filter((u) => {
        const mid = Number(u.managerId ?? 0);
        return mid > 0 && presalesMgrIds.has(mid);
      });
    }
  } else if (presalesManagerName) {
    const selectedPresalesManagerNorm = normText(presalesManagerName);
    const selectedPresalesManager = args.presalesManagers.find((u) => {
      const n = normText(String(u.fullName ?? u.username ?? ""));
      return n === selectedPresalesManagerNorm;
    });
    if (selectedPresalesManager && Number(selectedPresalesManager.id ?? 0) > 0) {
      const presalesManagerId = Number(selectedPresalesManager.id);
      managerNames.push(
        String(selectedPresalesManager.fullName ?? selectedPresalesManager.username ?? "").trim(),
      );
      presalesExecUnderManager = args.presalesExecs.filter(
        (u) => Number(u.managerId ?? 0) === presalesManagerId,
      );
    }
  }

  return Array.from(
    new Set(
      [
        ...managerNames,
        ...salesExecUnderManager.map((u) => String(u.fullName ?? u.username ?? "").trim()),
        ...presalesMgrUnderManager.map((u) => String(u.fullName ?? u.username ?? "").trim()),
        ...presalesExecUnderManager.map((u) => String(u.fullName ?? u.username ?? "").trim()),
      ].filter(Boolean),
    ),
  );
}

function normalizeLeadTypeKey(raw: unknown): "formlead" | "glead" | "mlead" | "addlead" | "websitelead" {
  const compact = String(raw ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact === "glead" || compact === "googleads") return "glead";
  if (compact === "mlead" || compact === "metaads") return "mlead";
  if (compact === "addlead" || compact === "alead" || compact === "addlead") return "addlead";
  if (compact === "websitelead" || compact === "wlead") return "websitelead";
  return "formlead";
}

function leadPersonKey(lead: ApiLead): string {
  const record = lead as Record<string, unknown>;
  const dynamic =
    record.dynamicFields && typeof record.dynamicFields === "object" && !Array.isArray(record.dynamicFields)
      ? (record.dynamicFields as Record<string, unknown>)
      : {};
  const phone =
    String(
      record.phone ??
        record.phoneNumber ??
        record.mobile ??
        record.mobileNumber ??
        dynamic.customerPhone ??
        dynamic.phone ??
        ""
    )
      .replace(/\D/g, "")
      .trim();
  const email = String(record.email ?? record.emailId ?? record.emailAddress ?? dynamic.customerEmail ?? "")
    .trim()
    .toLowerCase();
  const name = String(record.name ?? record.fullName ?? record.customerName ?? dynamic.customerName ?? "")
    .trim()
    .toLowerCase();
  if (phone) return `p:${phone}`;
  if (email) return `e:${email}`;
  if (name) return `n:${name}`;
  const id = String(record.id ?? "").trim();
  return id ? `id:${id}` : `id:unknown`;
}

function parseLeadCreatedAt(lead: ApiLead): number {
  const record = lead as Record<string, unknown>;
  const createdRaw =
    String(record.createdAt ?? record.createdDate ?? record.leadDate ?? record.createdOn ?? record.updatedAt ?? "").trim();
  const ts = createdRaw ? Date.parse(createdRaw) : Number.NaN;
  return Number.isNaN(ts) ? Number.MAX_SAFE_INTEGER : ts;
}

function computePrimarySourceCounts(leads: ApiLead[]): Record<string, number> {
  const byPerson = new Map<string, ApiLead[]>();
  for (const lead of leads) {
    const key = leadPersonKey(lead);
    const list = byPerson.get(key) ?? [];
    list.push(lead);
    byPerson.set(key, list);
  }

  const counts: Record<string, number> = {
    all: 0,
    formlead: 0,
    glead: 0,
    mlead: 0,
    addlead: 0,
    websitelead: 0,
    verified: 0,
  };

  for (const group of byPerson.values()) {
    const primary = [...group].sort((a, b) => parseLeadCreatedAt(a) - parseLeadCreatedAt(b))[0];
    const type = normalizeLeadTypeKey(primary.leadType);
    counts.all += 1;
    counts[type] += 1;
    if (isCrmLeadVerified(primary)) counts.verified += 1;
  }
  return counts;
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
  milestoneStage: string,
  milestoneStageCategory: string,
  milestoneSubStage: string,
  reinquiry: string,
  leadView: "default" | "my" | "team" | "combined" = "default",
  verificationStatus = "",
  crmMonthWindow = ""
): Promise<SpringPage<ApiLead>> {
  const qs = new URLSearchParams();
  const normalizedLeadType = leadType.trim().toLowerCase();
  const usesRoleEndpoint = leadView === "my" || leadView === "team";
  const wideListFetch = usesRoleEndpoint || leadView === "combined";
  const shouldMerge = wideListFetch || normalizedLeadType === "all" || normalizedLeadType === "verified";
  const isNewCrmGlobalSearchMode = search.trim().length > 0;
  qs.set("mergeAll", shouldMerge ? "1" : "0");
  qs.set("page", wideListFetch ? "0" : String(page));
  qs.set("size", wideListFetch ? "500" : String(size));
  qs.set("sort", sort);
  qs.set("leadType", normalizedLeadType === "verified" ? "all" : normalizedLeadType || "all");
  qs.set("milestoneScope", "crm");
  if (isNewCrmGlobalSearchMode) qs.set("newCrmGlobalSearch", "true");
  if (search.trim()) qs.set("search", search.trim());
  if (assignee.trim()) qs.set("assignee", assignee.trim());
  if (crmMonthWindow.trim()) qs.set("crmMonthWindow", crmMonthWindow.trim());
  else {
    if (dateFrom.trim()) qs.set("dateFrom", dateFrom.trim());
    if (dateTo.trim()) qs.set("dateTo", dateTo.trim());
  }
  if (milestoneStage.trim()) qs.set("milestoneStage", milestoneStage.trim());
  if (milestoneStageCategory.trim()) qs.set("milestoneStageCategory", milestoneStageCategory.trim());
  if (milestoneSubStage.trim()) qs.set("milestoneSubStage", milestoneSubStage.trim());
  if (reinquiry.trim()) qs.set("reinquiry", reinquiry.trim());
  if (normalizedLeadType === "verified") qs.set("verificationStatus", "verified");
  else if (verificationStatus.trim()) qs.set("verificationStatus", verificationStatus.trim());
  if (usesRoleEndpoint) qs.set("roleView", leadView);

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
  return res.json();
}

async function fetchFilterOptions(leadView: "default" | "my" | "team" | "combined" = "default"): Promise<{
  assignees: string[];
  stages: string[];
  categories: string[];
  subStages: string[];
}> {
  const leadsQs = new URLSearchParams({
    mergeAll: "1",
    page: "0",
    size: "250",
    sort: "updatedAt,desc",
  });
  if (leadView === "my" || leadView === "team") {
    leadsQs.set("roleView", leadView);
  }
  // "combined" uses merged filter without roleView (same as default)
  const [leadsRes, subRes] = await Promise.all([
    fetch(`/api/crm/leads?${leadsQs.toString()}`, {
      cache: "no-store",
      credentials: "include",
      headers: getCrmAuthHeaders(),
    }),
    fetch("/api/milestone-count?resource=sub-status", {
      cache: "no-store",
      credentials: "include",
      headers: getCrmAuthHeaders(),
    }),
  ]);

  const assignees = new Set<string>();
  if (leadsRes.ok) {
    const leads = (await leadsRes.json()) as SpringPage<ApiLead>;
    for (const lead of leads.content ?? []) {
      const a = typeof lead.assignee === "string" ? lead.assignee : lead.assignee?.name;
      const t = (a ?? "").trim();
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
  return "Form Lead";
}

function toAdminBulkDeletePath(leadType: string): string {
  if (leadType === "formlead") return "bulk-delete-formleads";
  if (leadType === "glead") return "bulk-delete-gleads";
  if (leadType === "mlead") return "bulk-delete-mleads";
  if (leadType === "addlead") return "bulk-delete-addleads";
  return "bulk-delete-websiteleads";
}

function toAdminDeleteAllPath(leadType: string): string {
  if (leadType === "formlead") return "delete-all-formleads";
  if (leadType === "glead") return "delete-all-gleads";
  if (leadType === "mlead") return "delete-all-mleads";
  if (leadType === "addlead") return "delete-all-addleads";
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
  if (!res.ok || body.success === false) {
    throw new Error(typeof body.message === "string" ? body.message : "Delete failed");
  }
  return body;
}

export default function LeadsDataSection({
  search,
  leadType,
  sort,
  assignee,
  dateFrom,
  dateTo,
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
  verificationStatus: verificationStatusProp = "",
  crmMonthWindow: crmMonthWindowProp = "",
  onPresalesSummaryClear,
  presalesTeamExecutivesOnly = false,
  presalesTeamExecDisplayNames = [],
  onLeadTypeChange,
  onSortChange,
  onAssigneeChange,
  onDateFromChange,
  onDateToChange,
  onMilestoneStageChange,
  onMilestoneStageCategoryChange,
  onMilestoneSubStageChange,
  onReinquiryChange,
  onHeatmapAssigneeSync,
  onInsightTableModeChange,
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
  const [stageOrder, setStageOrder] = useState<string[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [assigneeOptions, setAssigneeOptions] = useState<string[]>([]);
  const [pipelineNested, setPipelineNested] = useState<CrmNestedStage[]>([]);
  const [leadTypeCounts, setLeadTypeCounts] = useState<Record<string, number>>({});
  const [insightTableMode, setInsightTableMode] = useState<InsightTableMode>(() => {
    const mode = persistedView.insightTableMode;
    return mode ?? null;
  });

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
  const { notifySuccess, notifyError, notifyInfo } = useGlobalNotifier();
  const [managerTeamNames, setManagerTeamNames] = useState<string[]>([]);

  const loadAssignableUsers = useCallback(async () => {
    if (!canLoadAllUsers(currentRole)) {
      console.warn("Skipping /api/admin/all-users: only SUPER_ADMIN can access this endpoint.");
      setAssigneeUsers([]);
      return [];
    }
    const rows = await adminPanelApi.listAllUsers();
    const eligibleRoles = new Set([
      "SALES_EXECUTIVE",
      "SALES_MANAGER",
      "PRESALES_MANAGER",
      "PRESALES_EXECUTIVE",
    ]);
    const mapped = rows
      .filter((row) => {
        const role = normalizeRole(row.role);
        return eligibleRoles.has(role) && Boolean(row.active ?? true);
      })
      .map((row) => ({
        userId: Number(row.id ?? 0),
        name: String(row.fullName ?? row.name ?? row.username ?? `User ${row.id}`),
        role: normalizeRole(row.role),
      }))
      .filter((row) => row.userId > 0);
    setAssigneeUsers(mapped);
    return mapped;
  }, [currentRole]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const role = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
    setViewerRole(normalizeRole(role));
  }, []);

  useEffect(() => {
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
    verificationStatusProp,
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
    void fetchSalesExecutivesForManager(token)
      .then((users) => {
        if (cancelled) return;
        const names = users
          .map((u) => String(u.fullName ?? u.name ?? u.username ?? "").trim())
          .filter(Boolean);
        setManagerTeamNames(names);
      })
      .catch(() => {
        if (!cancelled) setManagerTeamNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentRole, currentUserId]);


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
  }, []);

  const loadRowAssignUsers = useCallback(async () => {
    setRowAssignLoadingUsers(true);
    setRowAssignError("");
    try {
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
  }, []);

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
  }, [clearSelection, leadType, page, size, debouncedSearch, assignee, dateFrom, dateTo, milestoneStage, milestoneStageCategory, milestoneSubStage]);

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
    void Promise.all(
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
    )
      .then((pairs) => {
        if (cancelled) return;
        const byRole = new Map<string, HierarchyUser[]>(pairs);
        const saJ = byRole.get("SALES_ADMIN") ?? [];
        const smJ = byRole.get("SALES_MANAGER") ?? [];
        const seJ = byRole.get("SALES_EXECUTIVE") ?? [];
        const pmJ = byRole.get("PRESALES_MANAGER") ?? [];
        const peJ = byRole.get("PRESALES_EXECUTIVE") ?? [];
        const preJ = byRole.get("PRE_SALES") ?? [];
        setSalesAdmins(saJ.filter((u) => u.active !== false));
        setSalesManagers(smJ.filter((u) => u.active !== false));
        setSalesExecs(seJ.filter((u) => u.active !== false));
        setPresalesManagers(pmJ.filter((u) => u.active !== false));
        const mergedPresalesExecs = [...peJ, ...preJ].filter((u) => u.active !== false);
        const dedupedPresalesExecs = Array.from(
          new Map(mergedPresalesExecs.map((u) => [u.id, u])).values(),
        );
        setPresalesExecs(dedupedPresalesExecs);
      })
      .catch(() => {
        if (cancelled) return;
        setSalesAdmins([]);
        setSalesManagers([]);
        setSalesExecs([]);
        setPresalesManagers([]);
        setPresalesExecs([]);
      });
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

  const userName = (u: HierarchyUser) => (u.fullName ?? u.username ?? "").trim();
  const meNorm = (currentUserName ?? "").trim().toLowerCase();
  const meAliasSet = new Set(
    [meNorm, ...currentUserAliases.map((v) => v.trim().toLowerCase())].filter(Boolean)
  );
  const leadAssignedToSelfById = (lead: ApiLead): boolean => {
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
  };
  const leadAssignedToSelf = (lead: ApiLead): boolean => {
    if (leadAssignedToSelfById(lead)) return true;
    if (meAliasSet.size === 0) return false;
    const aliases = assigneeAliasNorms(lead);
    for (const meAlias of meAliasSet) {
      if (aliases.has(meAlias)) return true;
    }
    return false;
  };
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
          verificationStatusFilter: verificationStatusProp,
          isSelfLead: leadAssignedToSelf,
        });
      }

      if (roleKey === "SALES_MANAGER" || roleKey === "MANAGER") {
        const scopedTeam =
          managerTeamNamesFromHeader.length > 0 ? managerTeamNamesFromHeader : managerTeamNames;
        const teamSet = new Set(scopedTeam.map((n) => n.trim().toLowerCase()).filter(Boolean));
        if (teamSet.size === 0) return isSelf;
        for (const alias of leadAliases) {
          if (teamSet.has(alias)) return true;
        }
        return isSelf;
      }

      if (roleKey === "PRESALES_MANAGER") {
        const presalesTeamSet = new Set(
          presalesExecs.map((u) => userName(u).trim().toLowerCase()).filter(Boolean)
        );
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
      meNorm,
      presalesExecs,
      currentUserId,
      verificationStatusProp,
      leadAssignedToSelf,
    ]
  );
  const leadViewKey: "default" | "my" | "team" | "combined" =
    leadView === "my" || leadView === "team" || leadView === "combined" ? leadView : "default";
  const filterOptionsView =
    leadView === "my" || leadView === "team" ? leadView : "default";
  const insightLeadView: "default" | "my" | "team" =
    leadView === "my" || leadView === "team" ? leadView : "default";
  const effectiveAssignee =
    salesExecFilter ||
    presalesExecFilter ||
    salesManagerFilter ||
    presalesManagerFilter ||
    salesAdminFilter ||
    assignee;
  const hierarchyScopedAssignees = useMemo(
    () =>
      buildHierarchyScopedAssignees({
        salesManagerFilter,
        salesExecFilter,
        presalesManagerFilter,
        presalesExecFilter,
        salesManagers,
        salesExecs,
        presalesManagers,
        presalesExecs,
      }),
    [
      salesManagerFilter,
      salesExecFilter,
      presalesManagerFilter,
      presalesExecFilter,
      salesManagers,
      salesExecs,
      presalesManagers,
      presalesExecs,
    ],
  );
  const effectiveAssigneeScope = useMemo(
    () =>
      hierarchyScopedAssignees.length > 0
        ? hierarchyScopedAssignees
        : EMPTY_ASSIGNEE_SCOPE,
    [hierarchyScopedAssignees],
  );

  useEffect(() => {
    onHeatmapAssigneeSync?.(effectiveAssignee);
  }, [effectiveAssignee, onHeatmapAssigneeSync]);

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
    try {
      window.sessionStorage.setItem(LEADS_VIEW_PERSIST_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage failures.
    }
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
    let cancelled = false;
    void (async () => {
      try {
        const [o, p] = await Promise.all([
          fetchFilterOptions(filterOptionsView),
          fetchCrmPipeline(true),
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
  }, [filterOptionsView]);

  useEffect(() => {
    if (pipelineNested.length === 0) return;
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
  ]);

  const fetchScopedMergedPage = useCallback(
    async (
      targetPage: number,
      targetSize: number,
      targetLeadType: string,
      targetSort: string,
    ): Promise<SpringPage<ApiLead>> => {
      if (effectiveAssigneeScope.length <= 1) {
        return fetchMergedPage(
          targetPage,
          targetSize,
          targetLeadType,
          targetSort,
          debouncedSearch,
          effectiveAssigneeScope[0] ?? effectiveAssignee,
          dateFrom,
          dateTo,
          milestoneStage,
          milestoneStageCategory,
          milestoneSubStage,
          reinquiry,
          leadViewKey,
          verificationStatusProp,
          crmMonthWindowProp,
        );
      }
      const pages = await Promise.all(
        effectiveAssigneeScope.map((assigneeName) =>
          fetchMergedPage(
            0,
            500,
            targetLeadType,
            targetSort,
            debouncedSearch,
            assigneeName,
            dateFrom,
            dateTo,
            milestoneStage,
            milestoneStageCategory,
            milestoneSubStage,
            reinquiry,
            leadViewKey,
            verificationStatusProp,
            crmMonthWindowProp,
          ),
        ),
      );
      const byId = new Map<string, ApiLead>();
      for (const pg of pages) {
        for (const lead of pg.content ?? []) {
          const id = String(lead.id ?? "").trim();
          if (!id || byId.has(id)) continue;
          byId.set(id, lead);
        }
      }
      const merged = [...byId.values()].sort((a, b) => {
        const at = Date.parse(a.updatedAt ?? "");
        const bt = Date.parse(b.updatedAt ?? "");
        return (Number.isNaN(bt) ? 0 : bt) - (Number.isNaN(at) ? 0 : at);
      });
      const start = targetPage * targetSize;
      return {
        content: merged.slice(start, start + targetSize),
        totalElements: merged.length,
        totalPages: Math.max(1, Math.ceil(merged.length / Math.max(1, targetSize))),
        number: targetPage,
        size: targetSize,
      };
    },
    [
      effectiveAssigneeScope,
      debouncedSearch,
      effectiveAssignee,
      dateFrom,
      dateTo,
      milestoneStage,
      milestoneStageCategory,
      milestoneSubStage,
      reinquiry,
      leadViewKey,
      verificationStatusProp,
      crmMonthWindowProp,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const roleKey = normalizeRole(authRoleProp ?? currentRole);
        const fetchCount = async (type: string): Promise<number> => {
          const page = await fetchScopedMergedPage(0, 1, type, "updatedAt,desc");
          return Number(page.totalElements ?? 0);
        };

        // Presales tabs should use server pagination metadata only (no client-side visibility re-filter).
        if (isPresalesRole(roleKey)) {
          const [all, formlead, glead, mlead, addlead, websitelead] = await Promise.all([
            fetchCount("all"),
            fetchCount("formlead"),
            fetchCount("glead"),
            fetchCount("mlead"),
            fetchCount("addlead"),
            fetchCount("websitelead"),
          ]);
          if (cancelled) return;
          setLeadTypeCounts({
            all,
            formlead,
            glead,
            mlead,
            addlead,
            websitelead,
            verified: 0,
          });
          return;
        }

        // Non-presales insight tiles still need row-level data.
        const page = await fetchScopedMergedPage(0, 500, "all", "updatedAt,desc");
        if (cancelled) return;
        const raw = page.content ?? [];
        const managerScopedTeam = effectiveAssigneeScope;
        const scopedTeam =
          managerScopedTeam.length > 0
            ? managerScopedTeam
            : managerTeamNamesFromHeader.length > 0
              ? managerTeamNamesFromHeader
              : managerTeamNames;
        const scoped = raw;
        const base = computePrimarySourceCounts(scoped);
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
        const insights = computeFollowUpInsightCounts(scoped, {
          viewerRole: insightViewerRole,
          currentUserName: currentUserName ?? "",
          managerTeamNames: scopedTeam,
          leadView: insightLeadViewForRole,
          dateFrom,
          dateTo,
        });
        setLeadTypeCounts({
          ...base,
          ...insights,
          managerMine: smMineTeam.managerMine,
          team: smMineTeam.teamLeads,
        });
      } catch {
        if (!cancelled) setLeadTypeCounts({});
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
    fetchScopedMergedPage,
    dateFrom,
    dateTo,
    insightLeadView,
    effectiveAssignee,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const insightModeActive = insightTableMode !== null;
      const requestPage = insightModeActive ? 0 : page;
      const requestSize = insightModeActive ? 500 : size;
      const requestLeadType = insightModeActive ? "all" : leadType;
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
        setData(fallbackJson);
        return;
      }
      setData(json);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load leads";
      if (msg.toLowerCase().includes("session expired")) {
        window.dispatchEvent(new Event("crm:auth-expired"));
        return;
      }
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    dateFrom,
    dateTo,
    debouncedSearch,
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
    verificationStatusProp,
    crmMonthWindowProp,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const contentFromApi = data?.content ?? [];
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

  const content = contentFromApi;
  const insightOpts = {
    viewerRole: normalizeRole(authRoleProp ?? currentRole),
    currentUserName: currentUserName ?? "",
    managerTeamNames: scopedTeamForInsight,
    leadView: insightLeadView,
    dateFrom,
    dateTo,
  };
  const insightFilteredContent = filterLeadsForInsightMode(
    content,
    insightTableMode,
    insightOpts,
  );
  const baseRows = insightFilteredContent.map((lead) => ({
    ...mapApiLeadToRow(lead, asCrmLeadType(lead.leadType, "formlead"), stageOrder),
    callDelayed: isFirstCallDelayedLead(lead),
  }));
  const norm = (v: string) => v.trim().toLowerCase();
  const myName = norm(currentUserName);
  const scopedTeamNames = managerTeamNamesFromHeader.length > 0 ? managerTeamNamesFromHeader : managerTeamNames;
  const teamSet = new Set(scopedTeamNames.map(norm));
  const rows = baseRows;
  const managerScopedView =
    currentRole === "SALES_MANAGER" &&
    (leadView === "my" || leadView === "team" || leadView === "combined");
  const isClientScopedRole = (() => {
    const role = normalizeRole(authRoleProp ?? currentRole);
    return (
      role === "SALES_MANAGER" ||
      role === "MANAGER" ||
      role === "SALES_EXECUTIVE" ||
      role === "PRESALES_MANAGER" ||
      role === "PRESALES_EXECUTIVE" ||
      role === "PRE_SALES"
    );
  })();
  const visibleRows =
    insightTableMode !== null
      ? rows.slice(page * size, page * size + size)
      : rows;
  const total =
    insightTableMode !== null
      ? rows.length
      : (data?.totalElements ?? rows.length);
  const totalPages =
    insightTableMode !== null
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
  const selectedLeadType = selectedCount > 0 ? selectedLeads[0]?.leadType ?? null : null;
  const hasMixedLeadTypes = selectedLeads.some((lead) => lead.leadType !== selectedLeadType);
  const canBulkAssign =
    currentRole === "SUPER_ADMIN" ||
    currentRole === "ADMIN" ||
    currentRole === "SALES_ADMIN" ||
    currentRole === "SALES_MANAGER" ||
    currentRole === "PRESALES_MANAGER";
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
  const filteredAssignees =
    assigneeRoleFilter === "ALL"
      ? assigneeUsers
      : assigneeUsers.filter((user) => user.role === assigneeRoleFilter);
  const totalManualPercentage = selectedAssigneeIds.reduce(
    (sum, userId) => sum + Number(manualPercentages[userId] ?? 0),
    0
  );

  const buildAssignmentPayload = () => {
    const assignees = selectedAssigneeIds.map((userId) => ({
      userId,
      percentage: assignmentMode === "MANUAL" ? Number(manualPercentages[userId] ?? 0) : undefined,
    }));
    return {
      leadType: toAssignmentLeadType(leadType),
      leadIds: selectedLeads.map((lead) => Number(lead.id)),
      assignmentMode,
      assignees,
    };
  };

  const handlePreview = async () => {
    try {
      setAssignmentError("");
      setPreviewResult(null);
      if (selectedLeads.length === 0) {
        setAssignmentError("Select at least one lead.");
        return;
      }
      if (selectedAssigneeIds.length === 0) {
        setAssignmentError("Select at least one assignee.");
        return;
      }
      if (leadType === "all") {
        setAssignmentError("Choose a single lead type before assignment.");
        return;
      }
      if (assignmentMode === "MANUAL") {
        const totalPercentage = selectedAssigneeIds.reduce(
          (sum, userId) => sum + Number(manualPercentages[userId] ?? 0),
          0
        );
        if (totalPercentage !== 100) {
          setAssignmentError("Percentages must sum to exactly 100%.");
          return;
        }
      }
      setIsPreviewLoading(true);
      const res = await assignmentApi.bulkAssignPreview(buildAssignmentPayload());
      setPreviewResult(res);
      if (res.success === false) {
        setAssignmentError(typeof res.message === "string" ? res.message : "Preview failed.");
      }
    } catch (e) {
      setAssignmentError(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleExecute = async () => {
    try {
      setIsExecuteLoading(true);
      const res = await assignmentApi.bulkAssignExecute(buildAssignmentPayload());
      if (res.success === false) {
        setAssignmentError(typeof res.message === "string" ? res.message : "Bulk assign failed.");
        return;
      }
      clearSelection();
      await load();
      notifySuccess(typeof res.message === "string" ? res.message : "Bulk assign completed.");
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
    setRowAssignLead({
      id: row.id,
      name: row.name,
      leadType: row.leadType,
      currentAssignee: row.owner.name,
    });
    setRowAssignUserId(null);
    setRowAssignError("");
    setRowAssignModalOpen(true);
    await loadRowAssignUsers();
  };

  const submitRowAssign = async () => {
    if (!rowAssignLead) return;
    if (!rowAssignUserId) {
      setRowAssignError("Please select an assignee.");
      return;
    }
    try {
      setRowAssignSubmitting(true);
      setRowAssignError("");
      const res = await assignmentApi.assign({
        leadType: toAssignmentLeadType(rowAssignLead.leadType),
        leadId: Number(rowAssignLead.id),
        salesExecutiveId: rowAssignUserId,
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
        const targets = ["formlead", "glead", "mlead", "addlead", "websitelead"] as const;
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
        viewerRole={viewerRole}
        authRole={authRoleProp ?? ""}
        leadType={leadType}
        sort={sort}
        assignee={assignee}
        dateFrom={dateFrom}
        dateTo={dateTo}
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
        salesExecOptions={
          salesExecs.length
            ? salesExecs.map((u) => userName(u)).filter(Boolean)
            : assigneeUsers.filter((u) => u.role === "SALES_EXECUTIVE").map((u) => u.name).length
              ? assigneeUsers.filter((u) => u.role === "SALES_EXECUTIVE").map((u) => u.name)
              : assigneeOptions
        }
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
        onAssigneeChange={onAssigneeChange}
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
        onMilestoneStageChange={onMilestoneStageChange}
        onMilestoneStageCategoryChange={onMilestoneStageCategoryChange}
        onMilestoneSubStageChange={onMilestoneSubStageChange}
        onReinquiryChange={onReinquiryChange}
        onSalesAdminFilterChange={(next) => {
          setSalesAdminFilter(next);
          setSalesManagerFilter("");
          setSalesExecFilter("");
        }}
        onSalesManagerFilterChange={(next) => {
          setSalesManagerFilter(next);
          setSalesExecFilter("");
        }}
        onSalesExecFilterChange={setSalesExecFilter}
        onPresalesManagerFilterChange={(next) => {
          setPresalesManagerFilter(next);
          setPresalesExecFilter("");
        }}
        onPresalesExecFilterChange={setPresalesExecFilter}
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
              disabled={selectedCount === 0 || isPreviewLoading || isExecuteLoading || hasMixedLeadTypes}
              onClick={() => {
                setShowAssignModal(true);
                setAssignmentError("");
                setPreviewResult(null);
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
                  <option value="">-- Select Sales Executive --</option>
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
                <p className="mt-2 text-[12px] font-medium text-[#6f7f98]">{filteredAssignees.length} active users available</p>
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

              {hasMixedLeadTypes ? (
                <p className="mt-3 rounded-[8px] border border-[#f6c58f] bg-[#fff3e0] p-2 text-[12px] font-medium text-[#f57c00]">
                  Select leads from one type only for bulk assign.
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
    </>
  );
}
