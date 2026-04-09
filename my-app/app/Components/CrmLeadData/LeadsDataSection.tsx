"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiLead, SpringPage } from "@/lib/leads-filter";
import { asCrmLeadType, mapApiLeadToRow } from "@/lib/leads-filter";
import { fetchCrmPipeline } from "@/lib/crm-pipeline";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { assignmentApi } from "@/lib/assignment-api";
import { adminPanelApi } from "@/lib/admin-panel-api";
import { CRM_ROLE_STORAGE_KEY, getAuthApiBaseUrl, normalizeRole } from "@/lib/auth/api";
import LeadsTable from "./LeadsTable";
import LeadsToolbar from "./LeadsToolbar";

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
  onLeadTypeChange: (next: string) => void;
  onSortChange: (next: string) => void;
  onAssigneeChange: (next: string) => void;
  onDateFromChange: (next: string) => void;
  onDateToChange: (next: string) => void;
  onMilestoneStageChange: (next: string) => void;
  onMilestoneStageCategoryChange: (next: string) => void;
  onMilestoneSubStageChange: (next: string) => void;
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

type AssignmentMode = "AUTO" | "MANUAL";
type RowAssignLead = {
  id: string;
  name: string;
  leadType: string;
  currentAssignee: string;
};

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
  milestoneSubStage: string
): Promise<SpringPage<ApiLead>> {
  const qs = new URLSearchParams();
  const normalizedLeadType = leadType.trim().toLowerCase();
  qs.set("mergeAll", "1");
  qs.set("page", String(page));
  qs.set("size", String(size));
  qs.set("sort", sort);
  qs.set("leadType", normalizedLeadType === "verified" ? "all" : normalizedLeadType || "all");
  if (search.trim()) qs.set("search", search.trim());
  if (assignee.trim()) qs.set("assignee", assignee.trim());
  if (dateFrom.trim()) qs.set("dateFrom", dateFrom.trim());
  if (dateTo.trim()) qs.set("dateTo", dateTo.trim());
  if (milestoneStage.trim()) qs.set("milestoneStage", milestoneStage.trim());
  if (milestoneStageCategory.trim()) qs.set("milestoneStageCategory", milestoneStageCategory.trim());
  if (milestoneSubStage.trim()) qs.set("milestoneSubStage", milestoneSubStage.trim());
  if (normalizedLeadType === "verified") qs.set("verificationStatus", "verified");

  const res = await fetch(
    `/api/crm/leads?${qs.toString()}`,
    { cache: "no-store", credentials: "include", headers: getCrmAuthHeaders() }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchFilterOptions(): Promise<{
  assignees: string[];
  stages: string[];
  categories: string[];
  subStages: string[];
}> {
  const [leadsRes, subRes] = await Promise.all([
    fetch("/api/crm/leads?mergeAll=1&page=0&size=250&sort=updatedAt,desc", {
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
  onLeadTypeChange,
  onSortChange,
  onAssigneeChange,
  onDateFromChange,
  onDateToChange,
  onMilestoneStageChange,
  onMilestoneStageCategoryChange,
  onMilestoneSubStageChange,
}: Props) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SpringPage<ApiLead> | null>(null);
  const [stageOrder, setStageOrder] = useState<string[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [assigneeOptions, setAssigneeOptions] = useState<string[]>([]);
  const [milestoneStageOptions, setMilestoneStageOptions] = useState<string[]>([]);
  const [milestoneStageCategoryOptions, setMilestoneStageCategoryOptions] = useState<string[]>([]);
  const [milestoneSubStageOptions, setMilestoneSubStageOptions] = useState<string[]>([]);
  const [leadTypeCounts, setLeadTypeCounts] = useState<Record<string, number>>({});
  const [viewerRole, setViewerRole] = useState("");
  const [salesAdminFilter, setSalesAdminFilter] = useState("");
  const [salesManagerFilter, setSalesManagerFilter] = useState("");
  const [salesExecFilter, setSalesExecFilter] = useState("");
  const [presalesManagerFilter, setPresalesManagerFilter] = useState("");
  const [presalesExecFilter, setPresalesExecFilter] = useState("");
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isExecuteLoading, setIsExecuteLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentRole, setCurrentRole] = useState("");
  const [rowAssignModalOpen, setRowAssignModalOpen] = useState(false);
  const [rowAssignLead, setRowAssignLead] = useState<RowAssignLead | null>(null);
  const [rowAssignUsers, setRowAssignUsers] = useState<AssigneeUser[]>([]);
  const [rowAssignUserId, setRowAssignUserId] = useState<number | null>(null);
  const [rowAssignLoadingUsers, setRowAssignLoadingUsers] = useState(false);
  const [rowAssignSubmitting, setRowAssignSubmitting] = useState(false);
  const [rowAssignError, setRowAssignError] = useState("");

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
  }, [assignee, dateFrom, dateTo, leadType, milestoneStage, milestoneStageCategory, milestoneSubStage, sort, debouncedSearch]);

  useEffect(() => {
    setPage(0);
  }, [size]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const p = await fetchCrmPipeline(true);
        const order = p.nested?.map((n) => n.stage.trim()).filter(Boolean) ?? [];
        if (!cancelled) setStageOrder(order);
      } catch {
        if (!cancelled) setStageOrder([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCurrentRole(normalizeRole(window.localStorage.getItem("crm_role")));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void adminPanelApi
      .listAllUsers()
      .then((rows) => {
        if (cancelled) return;
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
      })
      .catch(() => {
        if (!cancelled) setAssigneeUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRowIds([]);
    setShowAssignModal(false);
    setShowDeleteModal(false);
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
      const roles = ["SALES_EXECUTIVE", "PRESALES_MANAGER", "PRESALES_EXECUTIVE"];
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
          return {
            userId: Number(item.id ?? 0),
            name: String(item.fullName ?? item.name ?? item.username ?? `User ${item.id}`),
            role: normalizeRole(item.role),
          };
        })
        .filter((row) => row.userId > 0);
      const unique = Array.from(new Map(mapped.map((u) => [u.userId, u])).values());
      setRowAssignUsers(unique);
    } catch {
      setRowAssignUsers([]);
      setRowAssignError("Failed to load assignee list.");
    } finally {
      setRowAssignLoadingUsers(false);
    }
  }, []);

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
      if (showDeleteModal) {
        setShowDeleteModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rowAssignModalOpen, showAssignModal, showDeleteModal]);

  useEffect(() => {
    let cancelled = false;
    const auth = getCrmAuthHeaders();
    void Promise.all([
      fetch("/api/admin/users-by-role?role=SALES_ADMIN", { cache: "no-store", headers: auth, credentials: "include" }),
      fetch("/api/admin/users-by-role?role=SALES_MANAGER", { cache: "no-store", headers: auth, credentials: "include" }),
      fetch("/api/admin/users-by-role?role=SALES_EXECUTIVE", { cache: "no-store", headers: auth, credentials: "include" }),
      fetch("/api/admin/users-by-role?role=PRESALES_MANAGER", { cache: "no-store", headers: auth, credentials: "include" }),
      fetch("/api/admin/users-by-role?role=PRESALES_EXECUTIVE", { cache: "no-store", headers: auth, credentials: "include" }),
    ])
      .then(async ([sa, sm, se, pm, pe]) => {
        const parse = async (r: Response): Promise<HierarchyUser[]> => {
          if (!r.ok) return [];
          const j = (await r.json().catch(() => [])) as unknown;
          return Array.isArray(j) ? (j as HierarchyUser[]) : [];
        };
        const [saJ, smJ, seJ, pmJ, peJ] = await Promise.all([parse(sa), parse(sm), parse(se), parse(pm), parse(pe)]);
        if (cancelled) return;
        setSalesAdmins(saJ.filter((u) => u.active !== false));
        setSalesManagers(smJ.filter((u) => u.active !== false));
        setSalesExecs(seJ.filter((u) => u.active !== false));
        setPresalesManagers(pmJ.filter((u) => u.active !== false));
        setPresalesExecs(peJ.filter((u) => u.active !== false));
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
  }, []);

  const userName = (u: HierarchyUser) => (u.fullName ?? u.username ?? "").trim();
  const effectiveAssignee =
    salesExecFilter ||
    presalesExecFilter ||
    salesManagerFilter ||
    presalesManagerFilter ||
    salesAdminFilter ||
    assignee;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const o = await fetchFilterOptions();
        if (cancelled) return;
        setAssigneeOptions(o.assignees);
        setMilestoneStageOptions(o.stages);
        setMilestoneStageCategoryOptions(o.categories);
        setMilestoneSubStageOptions(o.subStages);
      } catch {
        if (cancelled) return;
        setAssigneeOptions([]);
        setMilestoneStageOptions([]);
        setMilestoneStageCategoryOptions([]);
        setMilestoneSubStageOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const typeKeys = ["all", "formlead", "glead", "mlead", "addlead", "websitelead", "verified"] as const;
        const results = await Promise.all(
          typeKeys.map(async (t) => {
            const page = await fetchMergedPage(
              0,
              1,
              t,
              "updatedAt,desc",
              debouncedSearch,
              assignee,
              dateFrom,
              dateTo,
              milestoneStage,
              milestoneStageCategory,
              milestoneSubStage,
            );
            return [t, page.totalElements ?? 0] as const;
          }),
        );
        if (cancelled) return;
        setLeadTypeCounts(Object.fromEntries(results));
      } catch {
        if (!cancelled) setLeadTypeCounts({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    assignee,
    dateFrom,
    dateTo,
    debouncedSearch,
    milestoneStage,
    milestoneStageCategory,
    milestoneSubStage,
    presalesExecFilter,
    presalesManagerFilter,
    salesAdminFilter,
    salesExecFilter,
    salesManagerFilter,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchMergedPage(
        page,
        size,
        leadType,
        sort,
        debouncedSearch,
        effectiveAssignee,
        dateFrom,
        dateTo,
        milestoneStage,
        milestoneStageCategory,
        milestoneSubStage
      );
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    dateFrom,
    dateTo,
    debouncedSearch,
    effectiveAssignee,
    leadType,
    milestoneStage,
    milestoneStageCategory,
    milestoneSubStage,
    page,
    size,
    sort,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const content = data?.content ?? [];
  const rows = content.map((lead) =>
    mapApiLeadToRow(lead, asCrmLeadType(lead.leadType, "formlead"), stageOrder)
  );
  const total = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const start = total === 0 ? 0 : page * size + 1;
  const end = Math.min(total, page * size + content.length);
  const rowsById = new Map(rows.map((row) => [row.id, row]));
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
  const canDeleteAll = canBulkDelete && leadType !== "all";
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
      window.alert(typeof res.message === "string" ? res.message : "Bulk assign completed.");
    } catch (e) {
      setAssignmentError(e instanceof Error ? e.message : "Bulk assign failed.");
    } finally {
      setIsExecuteLoading(false);
    }
  };

  const deleteLeadRow = async (row: (typeof rows)[number]) => {
    if (!window.confirm(`Delete lead #${row.id}?`)) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/crm/lead/${row.leadType}/${row.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: getCrmAuthHeaders(),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error(typeof body.message === "string" ? body.message : "Delete failed");
      }
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const openRowAssignModal = async (row: (typeof rows)[number]) => {
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
        setRowAssignError(typeof res.message === "string" ? res.message : "Assign failed.");
        return;
      }
      setRowAssignModalOpen(false);
      setRowAssignLead(null);
      setRowAssignUserId(null);
      await load();
      window.alert(typeof res.message === "string" ? res.message : "Lead assigned successfully.");
    } catch (e) {
      setRowAssignError(e instanceof Error ? e.message : "Assign failed.");
    } finally {
      setRowAssignSubmitting(false);
    }
  };

  const bulkDeleteSelected = async () => {
    if (selectedLeads.length === 0) return;
    if (!window.confirm(`Delete ${selectedLeads.length} selected lead(s)?`)) return;
    try {
      setIsDeleting(true);
      const grouped = new Map<string, number[]>();
      for (const row of selectedLeads) {
        const list = grouped.get(row.leadType) ?? [];
        list.push(Number(row.id));
        grouped.set(row.leadType, list);
      }
      for (const [type, ids] of grouped.entries()) {
        await fetch(`/api/admin/${toAdminBulkDeletePath(type)}`, {
          method: "DELETE",
          credentials: "include",
          headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ ids }),
        });
      }
      clearSelection();
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Bulk delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteAllByType = async () => {
    if (!canDeleteAll) return;
    if (!window.confirm(`Delete all ${toAssignmentLeadType(leadType)} records? This cannot be undone.`)) {
      return;
    }
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/admin/${toAdminDeleteAllPath(leadType)}`, {
        method: "DELETE",
        credentials: "include",
        headers: getCrmAuthHeaders(),
      });
      if (!res.ok) throw new Error("Delete-all failed.");
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Delete-all failed");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <LeadsToolbar
        rangeStart={start}
        rangeEnd={end}
        totalCount={total}
        loading={loading}
        leadTypeCounts={leadTypeCounts}
        viewerRole={viewerRole}
        leadType={leadType}
        sort={sort}
        assignee={assignee}
        dateFrom={dateFrom}
        dateTo={dateTo}
        milestoneStage={milestoneStage}
        milestoneStageCategory={milestoneStageCategory}
        milestoneSubStage={milestoneSubStage}
        salesAdminFilter={salesAdminFilter}
        salesManagerFilter={salesManagerFilter}
        salesExecFilter={salesExecFilter}
        presalesManagerFilter={presalesManagerFilter}
        presalesExecFilter={presalesExecFilter}
        salesAdminOptions={salesAdmins.map((u) => userName(u)).filter(Boolean)}
        salesManagerOptions={salesManagers.map((u) => userName(u)).filter(Boolean)}
        salesExecOptions={salesExecs.map((u) => userName(u)).filter(Boolean)}
        presalesManagerOptions={presalesManagers.map((u) => userName(u)).filter(Boolean)}
        presalesExecOptions={presalesExecs.map((u) => userName(u)).filter(Boolean)}
        assigneeOptions={assigneeOptions}
        milestoneStageOptions={milestoneStageOptions}
        milestoneStageCategoryOptions={milestoneStageCategoryOptions}
        milestoneSubStageOptions={milestoneSubStageOptions}
        onLeadTypeChange={onLeadTypeChange}
        onSortChange={onSortChange}
        onAssigneeChange={onAssigneeChange}
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
        onMilestoneStageChange={onMilestoneStageChange}
        onMilestoneStageCategoryChange={onMilestoneStageCategoryChange}
        onMilestoneSubStageChange={onMilestoneSubStageChange}
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
              onClick={() => setShowDeleteModal(true)}
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
            {canDeleteAll ? (
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void deleteAllByType()}
                className="rounded-xl bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete All ({toAssignmentLeadType(leadType)})
              </button>
            ) : null}
          </div>
          </div>
        </div>
      </section>
      ) : null}
      {error ? (
        <div className="mx-auto mt-2 max-w-[1200px] px-6 text-[12px] text-rose-600">
          {error}
          {process.env.NODE_ENV === "development" ? (
            <span className="mt-1 block text-slate-500">
              Set <code className="rounded bg-slate-100 px-1">CRM_DEV_BEARER_TOKEN</code> in{" "}
              <code className="rounded bg-slate-100 px-1">.env.local</code> or store a token in{" "}
              <code className="rounded bg-slate-100 px-1">localStorage</code> as{" "}
              <code className="rounded bg-slate-100 px-1">crm_token</code> (login) or{" "}
              <code className="rounded bg-slate-100 px-1">access_token</code>.
            </span>
          ) : null}
        </div>
      ) : null}
      <LeadsTable
        rows={rows}
        loading={loading}
        page={page}
        totalPages={totalPages}
        pageSize={size}
        onPageChange={(next) => setPage(Math.max(0, Math.min(totalPages - 1, next)))}
        onPageSizeChange={(nextSize) => setSize(nextSize)}
        selectedRowIds={selectedRowIds}
        onSelectedRowIdsChange={setSelectedRowIds}
        onDeleteRow={(row) => void deleteLeadRow(row)}
        onAssignRow={(row) => void openRowAssignModal(row)}
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
      {showDeleteModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_25px_60px_rgba(15,23,42,0.25)]">
            <h3 className="text-sm font-bold text-slate-800">Delete selected leads?</h3>
            <p className="mt-1 text-xs text-slate-500">This action cannot be undone.</p>
            <p className="mt-2 text-xs font-semibold text-slate-700">Selected: {selectedCount}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                onClick={() => void bulkDeleteSelected()}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting selected leads..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
