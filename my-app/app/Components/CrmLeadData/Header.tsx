"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { InsightTableMode } from "@/lib/lead-follow-up-insights";
import JourneyPhaseHeatmap from "./JourneyPhaseHeatmap";
import LeadsDataSection from "./LeadsDataSection";
import TopNav from "./TopNav";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import {
  CRM_TOKEN_STORAGE_KEY,
  CRM_ROLE_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
  fetchSalesExecutivesForManager,
  GetMeError,
  getMe,
  getNameFromUser,
  getRoleFromUser,
  normalizeRole,
  unwrapAuthUserPayload,
} from "@/lib/auth/api";
import { getCrmAuthHeaders, readStoredCrmToken } from "@/lib/crm-client-auth";
import {
  appendWorkspaceMilestoneFilterQuery,
  defaultLeadsVerificationStatus,
  sidebarSectionsForViewer,
  workspaceFromPathname,
} from "@/lib/crm-workspace";
import {
  hierarchyUserDisplayName,
  normalizeLegacyHierarchyUser,
} from "@/lib/hierarchy-user-display";
import { isLeadTypeAllowedForRole, isPresalesRole, sanitizeLeadTypeForRole } from "@/lib/crm-role-access";
import { fetchPresalesExecutiveNamesForManager } from "@/lib/fetch-presales-executives-for-manager";
import { setEffectiveNewCrmDateRange } from "@/lib/new-crm-cutoff";
import { usesAdminLeadsApi } from "@/lib/admin-leads-api";
import { fetchAllPresalesAssigneeDisplayNames } from "@/lib/fetch-all-presales-assignee-names";
import {
  appendCrmDateFilters,
  defaultSortForDateField,
  isToolbarDateFilterActive,
  parseCrmDateFieldSelection,
  sanitizeDateFieldForViewer,
  type CrmDateFieldSelection,
} from "@/lib/crm-date-field-filter";
const HEADER_PERSIST_KEY = "crm:lead-mgmt:header:v1";
const LEADS_VIEW_PERSIST_KEY = "crm:lead-mgmt:view:v1";

type HeaderPersistedState = {
  search?: string;
  leadType?: string;
  sort?: string;
  assignee?: string;
  dateFrom?: string;
  dateTo?: string;
  dateField?: CrmDateFieldSelection;
  milestoneStage?: string;
  milestoneStageCategory?: string;
  milestoneSubStage?: string;
  reinquiry?: string;
};

function readHeaderPersistedState(): HeaderPersistedState {
  if (typeof window === "undefined") return {};
  try {
    const nav = window.performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const raw = window.sessionStorage.getItem(HEADER_PERSIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as HeaderPersistedState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export default function Header() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const leadsWorkspace = workspaceFromPathname(pathname);
  const isPresalesLeadsPage = leadsWorkspace === "presales";
  const persistedHeaderState = readHeaderPersistedState();
  const [currentRole, setCurrentRole] = useState(() => {
    if (typeof window === "undefined") return "SUPER_ADMIN";
    const stored = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "SUPER_ADMIN";
    return normalizeRole(stored);
  });
  const sidebarSections = useMemo(
    () => sidebarSectionsForViewer(leadsWorkspace, currentRole),
    [leadsWorkspace, currentRole],
  );
  const [currentUserName, setCurrentUserName] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(CRM_USER_NAME_STORAGE_KEY) ?? "";
  });
  const [currentUserAliases, setCurrentUserAliases] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState(0);
  /** When token + role exist in storage, show CRM immediately; getMe still refreshes identity in the background. */
  const [authResolved, setAuthResolved] = useState(() => {
    if (typeof window === "undefined") return false;
    const token = readStoredCrmToken()?.trim();
    const role = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY)?.trim();
    return Boolean(token && role);
  });
  const [search, setSearch] = useState(persistedHeaderState.search ?? "");
  const [leadType, setLeadType] = useState(persistedHeaderState.leadType ?? "all");
  const [sort, setSort] = useState(persistedHeaderState.sort ?? "updatedAt,desc");
  const [assignee, setAssignee] = useState(persistedHeaderState.assignee ?? "");
  const [dateFrom, setDateFrom] = useState(persistedHeaderState.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(persistedHeaderState.dateTo ?? "");
  const [dateField, setDateField] = useState<CrmDateFieldSelection>(() =>
    sanitizeDateFieldForViewer(
      parseCrmDateFieldSelection(persistedHeaderState.dateField ?? ""),
      leadsWorkspace,
      typeof window !== "undefined"
        ? normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "")
        : "",
    ),
  );
  const [milestoneStage, setMilestoneStage] = useState(
    persistedHeaderState.milestoneStage ?? "",
  );
  const [milestoneStageCategory, setMilestoneStageCategory] = useState(
    persistedHeaderState.milestoneStageCategory ?? "",
  );
  const [milestoneSubStage, setMilestoneSubStage] = useState(
    persistedHeaderState.milestoneSubStage ?? "",
  );
  const [reinquiry, setReinquiry] = useState(persistedHeaderState.reinquiry ?? "");
  const [managerTeamNames, setManagerTeamNames] = useState<string[]>([]);
  /** Toolbar Sales Exec / hierarchy filters — same effective assignee as the lead table. */
  const [heatmapToolbarAssignee, setHeatmapToolbarAssignee] = useState("");
  const [heatmapToolbarAssigneeScope, setHeatmapToolbarAssigneeScope] = useState<string[]>([]);
  const [heatmapSummaryTotals, setHeatmapSummaryTotals] = useState<{
    lead: number;
    opportunity: number;
  } | null>(null);
  const [adminMilestoneCounts, setAdminMilestoneCounts] = useState<
    Record<string, number> | null
  >(null);
  const [adminPresalesSummary, setAdminPresalesSummary] = useState<{
    totalMonth: number;
    verifiedMonth: number;
    teamVerifiedMonth: number;
  } | null>(null);
  /** Insight tile filter (Team Leads, Follow ups today, etc.) — heatmap uses same subset as the grid. */
  const [insightTableMode, setInsightTableMode] = useState<InsightTableMode>(null);
  const [presalesSummaryTab, setPresalesSummaryTab] = useState<
    "total" | "verified" | "teamVerified" | null
  >(() => {
    if (typeof window === "undefined") return null;
    return isPresalesRole(
      normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? ""),
    )
      ? "total"
      : null;
  });
  const [presalesTeamNames, setPresalesTeamNames] = useState<string[]>([]);
  const [superAdminPresalesNames, setSuperAdminPresalesNames] = useState<string[]>([]);
  const presalesSummaryTabRef = useRef(presalesSummaryTab);
  presalesSummaryTabRef.current = presalesSummaryTab;
  const handleHeatmapSummarySync = useCallback(
    (summary: { lead: number; opportunity: number } | null) => {
      setHeatmapSummaryTotals((prev) => {
        if (!summary && !prev) return prev;
        if (
          summary &&
          prev &&
          summary.lead === prev.lead &&
          summary.opportunity === prev.opportunity
        ) {
          return prev;
        }
        return summary;
      });
    },
    [],
  );

  const adminMilestoneCountsKeyRef = useRef("");
  const handleAdminMilestoneCountsSync = useCallback(
    (_counts: Record<string, number> | undefined) => {
      const next = _counts ?? null;
      const key = next ? JSON.stringify(next) : "";
      if (adminMilestoneCountsKeyRef.current === key) return;
      adminMilestoneCountsKeyRef.current = key;
      setAdminMilestoneCounts(next);
    },
    [],
  );

  const handleAdminPresalesSummarySync = useCallback(
    (metrics: { totalMonth: number; verifiedMonth: number; teamVerifiedMonth: number }) => {
      setAdminPresalesSummary((prev) => {
        if (
          prev &&
          prev.totalMonth === metrics.totalMonth &&
          prev.verifiedMonth === metrics.verifiedMonth &&
          prev.teamVerifiedMonth === metrics.teamVerifiedMonth
        ) {
          return prev;
        }
        return metrics;
      });
    },
    [],
  );

  const isSuperAdminPresalesWorkspace =
    pathname === "/presales-leads" && normalizeRole(currentRole) === "SUPER_ADMIN";

  useEffect(() => {
    if (!authResolved) return;
    const r = normalizeRole(currentRole);
    if (r === "SUPER_ADMIN") return;
    if (isPresalesLeadsPage && (r === "SALES_EXECUTIVE" || r === "SALES_MANAGER")) {
      router.replace("/Leads");
      return;
    }
    if (!isPresalesLeadsPage && isPresalesRole(currentRole)) {
      router.replace("/presales-leads");
    }
  }, [authResolved, currentRole, isPresalesLeadsPage, router]);

  useEffect(() => {
    let cancelled = false;
    if (!isSuperAdminPresalesWorkspace) {
      setSuperAdminPresalesNames([]);
      return;
    }
    void fetchAllPresalesAssigneeDisplayNames()
      .then((names) => {
        if (!cancelled) setSuperAdminPresalesNames(names);
      })
      .catch(() => {
        if (!cancelled) setSuperAdminPresalesNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isSuperAdminPresalesWorkspace]);

  useEffect(() => {
    let cancelled = false;
    const token = readStoredCrmToken();
    if (!token) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(HEADER_PERSIST_KEY);
        window.sessionStorage.removeItem(LEADS_VIEW_PERSIST_KEY);
      }
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
      setAuthResolved(true);
      return;
    }
    void getMe(token)
      .then((raw) => {
        if (cancelled) return;
        const user = unwrapAuthUserPayload(raw as Record<string, unknown>);
        const role = normalizeRole(getRoleFromUser(user));
        const name = getNameFromUser(user);
        const id = Number(user.id ?? 0);
        if (role) {
          setCurrentRole(role);
          window.localStorage.setItem(CRM_ROLE_STORAGE_KEY, role);
        }
        if (name) {
          setCurrentUserName(name);
          window.localStorage.setItem(CRM_USER_NAME_STORAGE_KEY, name);
        }
        if (Number.isFinite(id) && id > 0) {
          setCurrentUserId(id);
        }
        const aliases = [
          String(user.fullName ?? ""),
          String(user.name ?? ""),
          String(user.username ?? ""),
          String(user.email ?? ""),
        ]
          .map((v) => v.trim().toLowerCase())
          .filter(Boolean);
        setCurrentUserAliases(Array.from(new Set(aliases)));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const status = e instanceof GetMeError ? e.status : 0;
        const msg = e instanceof Error ? e.message : "";
        const invalidateSession =
          status === 401 ||
          status === 403 ||
          status === 404 ||
          /user not found/i.test(msg);
        if (invalidateSession && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("crm:auth-expired"));
        }
      })
      .finally(() => {
        if (!cancelled) setAuthResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onAuthExpired = () => {
      try {
        window.localStorage.removeItem(CRM_TOKEN_STORAGE_KEY);
        window.localStorage.removeItem(CRM_ROLE_STORAGE_KEY);
        window.localStorage.removeItem(CRM_USER_NAME_STORAGE_KEY);
        window.sessionStorage.removeItem(HEADER_PERSIST_KEY);
        window.sessionStorage.removeItem(LEADS_VIEW_PERSIST_KEY);
      } finally {
        window.location.replace("/login");
      }
    };
    window.addEventListener("crm:auth-expired", onAuthExpired);
    return () => window.removeEventListener("crm:auth-expired", onAuthExpired);
  }, []);

  const forcedLeadType = useMemo(() => {
    return sanitizeLeadTypeForRole(currentRole, leadType);
  }, [currentRole, leadType]);

  const forcedAssignee = useMemo(() => assignee, [assignee]);

  useEffect(() => {
    if (!isPresalesRole(currentRole)) return;
    if (isLeadTypeAllowedForRole(currentRole, leadType)) return;
    setLeadType("all");
  }, [currentRole, leadType]);

  const isDesignRole =
    currentRole === "DESIGNER" ||
    currentRole === "DESIGN_MANAGER" ||
    currentRole === "TERRITORY_DESIGN_MANAGER";
  const isSalesManager = currentRole === "SALES_MANAGER" || currentRole === "MANAGER";

  useEffect(() => {
    let cancelled = false;
    if (!isSalesManager || !currentUserId) {
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
          const n = hierarchyUserDisplayName(u as { fullName?: string; name?: string; username?: string });
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
  }, [isSalesManager, currentUserId]);

  const isPresalesManager = normalizeRole(currentRole) === "PRESALES_MANAGER";

  useEffect(() => {
    let cancelled = false;
    if (!isPresalesManager || !currentUserId) {
      setPresalesTeamNames([]);
      return;
    }
    void fetchPresalesExecutiveNamesForManager(currentUserId)
      .then((names) => {
        if (!cancelled) setPresalesTeamNames(names);
      })
      .catch(() => {
        if (!cancelled) setPresalesTeamNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isPresalesManager, currentUserId]);

  const viewerUsesAdminLeadsApi = usesAdminLeadsApi(normalizeRole(currentRole));

  useEffect(() => {
    if (!authResolved) return;
    // Admin presales menu = full assignee pool (RDS); skip exec month-tab defaults.
    if (viewerUsesAdminLeadsApi) {
      setPresalesSummaryTab(null);
      return;
    }
    if (isPresalesRole(currentRole)) {
      setPresalesSummaryTab((prev) => (prev === null ? "total" : prev));
      return;
    }
    if (isSuperAdminPresalesWorkspace) {
      if (superAdminPresalesNames.length > 0) {
        setPresalesSummaryTab((prev) => (prev === null ? "total" : prev));
      }
      return;
    }
    setPresalesSummaryTab(null);
  }, [
    authResolved,
    currentRole,
    isSuperAdminPresalesWorkspace,
    superAdminPresalesNames.length,
    viewerUsesAdminLeadsApi,
  ]);

  const listVerificationStatus = useMemo(() => {
    if (!isPresalesLeadsPage) {
      return defaultLeadsVerificationStatus("sales", undefined, currentRole);
    }
    if (viewerUsesAdminLeadsApi) {
      if (presalesSummaryTab === "verified" || presalesSummaryTab === "teamVerified") {
        return "verified";
      }
      return "";
    }
    const superAdminPresalesCards =
      isSuperAdminPresalesWorkspace && superAdminPresalesNames.length > 0;
    if (!isPresalesRole(currentRole) && !superAdminPresalesCards) return "";
    if (presalesSummaryTab === "verified" || presalesSummaryTab === "teamVerified") return "verified";
    // "Total" tab should not force unverified-only filter.
    return "";
  }, [
    currentRole,
    presalesSummaryTab,
    isSuperAdminPresalesWorkspace,
    superAdminPresalesNames.length,
    isPresalesLeadsPage,
    viewerUsesAdminLeadsApi,
  ]);

  const heatmapFilterQuery = useMemo(() => {
    const q = new URLSearchParams();
    if (search.trim()) q.set("search", search.trim());
    if (forcedLeadType && forcedLeadType !== "all") q.set("leadType", forcedLeadType);
    const assigneeForHeatmap =
      heatmapToolbarAssignee.trim() || forcedAssignee.trim();
    if (assigneeForHeatmap) {
      q.set("assignee", assigneeForHeatmap);
    }
    const superAdminPresalesCards =
      isSuperAdminPresalesWorkspace && superAdminPresalesNames.length > 0;
    const presalesMonthCards =
      !viewerUsesAdminLeadsApi &&
      ((isPresalesRole(currentRole) && presalesSummaryTab !== null) ||
        (superAdminPresalesCards && presalesSummaryTab !== null));
    if (presalesMonthCards) {
      appendCrmDateFilters(q, { crmMonthWindow: "current" });
    } else {
      setEffectiveNewCrmDateRange(q, dateFrom, dateTo);
      appendCrmDateFilters(q, {
        dateFrom: q.get("dateFrom") ?? dateFrom,
        dateTo: q.get("dateTo") ?? dateTo,
        dateField,
      });
    }
    appendWorkspaceMilestoneFilterQuery(
      q,
      leadsWorkspace,
      milestoneStage,
      milestoneStageCategory,
      milestoneSubStage,
    );
    if (reinquiry.trim()) q.set("reinquiry", reinquiry.trim());
    if (listVerificationStatus.trim()) q.set("verificationStatus", listVerificationStatus.trim());
    return q.toString();
  }, [
    search,
    dateFrom,
    dateTo,
    dateField,
    milestoneStage,
    milestoneStageCategory,
    milestoneSubStage,
    forcedAssignee,
    forcedLeadType,
    heatmapToolbarAssignee,
    heatmapToolbarAssigneeScope,
    reinquiry,
    listVerificationStatus,
    leadsWorkspace,
    currentRole,
    presalesSummaryTab,
    isSuperAdminPresalesWorkspace,
    superAdminPresalesNames.length,
    viewerUsesAdminLeadsApi,
  ]);

  const handlePhaseFilterToggle = (stageName: string) => {
    const sameStage =
      milestoneStage.trim().toLowerCase() === stageName.trim().toLowerCase();
    if (sameStage) {
      setMilestoneStage("");
      setMilestoneStageCategory("");
      setMilestoneSubStage("");
      return;
    }
    setMilestoneStage(stageName);
    setMilestoneStageCategory("");
    setMilestoneSubStage("");
  };

  const handlePresalesSummaryTabChange = useCallback((tab: "total" | "verified" | "teamVerified") => {
    const prev = presalesSummaryTabRef.current;
    if (prev === tab) {
      setPresalesSummaryTab(null);
      return;
    }
    setPresalesSummaryTab(tab);
  }, []);

  const handleToolbarDateFromChange = useCallback((v: string) => {
    setPresalesSummaryTab(null);
    setDateFrom(v);
  }, []);

  const handleToolbarDateToChange = useCallback((v: string) => {
    setPresalesSummaryTab(null);
    setDateTo(v);
  }, []);

  const handleToolbarDateFieldChange = useCallback(
    (next: CrmDateFieldSelection) => {
      setPresalesSummaryTab(null);
      setDateField(next);
      if (!next) {
        setDateFrom("");
        setDateTo("");
      }
    },
    [],
  );

  useEffect(() => {
    const sanitized = sanitizeDateFieldForViewer(dateField, leadsWorkspace, currentRole);
    if (sanitized === dateField) return;
    setDateField(sanitized);
    if (!sanitized) {
      setDateFrom("");
      setDateTo("");
    }
  }, [leadsWorkspace, currentRole, dateField]);

  useEffect(() => {
    if (!isToolbarDateFilterActive({ dateField, dateFrom, dateTo })) return;
    const nextSort = defaultSortForDateField(dateField);
    if (nextSort) setSort(nextSort);
  }, [dateField, dateFrom, dateTo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: HeaderPersistedState = {
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
    };
    try {
      window.sessionStorage.setItem(HEADER_PERSIST_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage failures.
    }
  }, [
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
  ]);

  const handleResetAll = useCallback(() => {
    setSearch("");
    setLeadType("all");
    setSort("updatedAt,desc");
    setAssignee("");
    setDateFrom("");
    setDateTo("");
    setDateField("");
    setMilestoneStage("");
    setMilestoneStageCategory("");
    setMilestoneSubStage("");
    setReinquiry("");
    setPresalesSummaryTab(isPresalesRole(currentRole) ? "total" : null);
  }, [currentRole]);

  return (
    <div className="min-h-screen bg-[var(--crm-app-bg)] xl:h-screen xl:overflow-hidden">
      <div className="xl:grid xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <QuickAccessSidebar
            appBadge="LD"
            appName="Lead"
            appTagline="workspace"
            sections={sidebarSections}
            profileName={currentRole.replace(/_/g, " ")}
            profileRole={currentRole}
            profileInitials="AD"
          />
        </div>
        <div id="crm-leads-scroll-root" className="xl:h-screen xl:overflow-y-auto">
          <TopNav search={search} onSearchChange={setSearch} />
          {!authResolved ? (
            <div className="mx-auto mt-6 max-w-[1200px] rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] px-6 py-5 text-[13px] text-[var(--crm-text-muted)]">
              Loading your role access...
            </div>
          ) : isDesignRole ? (
            <div className="mx-auto mt-6 max-w-[1200px] rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] px-6 py-5 text-[13px] text-[var(--crm-text-muted)]">
              You don&apos;t have access to CRM lead management in this role.
            </div>
          ) : (
            <>
              <JourneyPhaseHeatmap
                leadsWorkspace={leadsWorkspace}
                milestoneFilterQuery={heatmapFilterQuery}
                adminMilestoneCounts={adminMilestoneCounts}
                adminPresalesSummary={adminPresalesSummary}
                currentRole={currentRole}
                leadView="default"
                currentUserName={currentUserName}
                currentUserAliases={currentUserAliases}
                currentUserId={currentUserId}
                managerTeamNames={managerTeamNames}
                assigneeScope={heatmapToolbarAssigneeScope}
                summaryTotalsOverride={heatmapSummaryTotals}
                presalesTeamNames={presalesTeamNames}
                aggregatePresalesAssigneeNames={
                  isSuperAdminPresalesWorkspace ? superAdminPresalesNames : undefined
                }
                insightTableMode={insightTableMode}
                activeStageFilter={milestoneStage}
                onPhaseFilterToggle={handlePhaseFilterToggle}
                presalesSummaryTab={presalesSummaryTab}
                onPresalesSummaryTabChange={handlePresalesSummaryTabChange}
              />
              <LeadsDataSection
                search={search}
                leadType={forcedLeadType}
                authRole={currentRole}
                leadView={isSalesManager ? "combined" : "default"}
                currentUserName={currentUserName}
                currentUserAliases={currentUserAliases}
                currentUserId={currentUserId}
                managerTeamNamesFromHeader={managerTeamNames}
                sort={sort}
                assignee={forcedAssignee}
                dateFrom={dateFrom}
                dateTo={dateTo}
                dateField={dateField}
                milestoneStage={milestoneStage}
                milestoneStageCategory={milestoneStageCategory}
                milestoneSubStage={milestoneSubStage}
                reinquiry={reinquiry}
                verificationStatus={listVerificationStatus}
                leadsWorkspace={leadsWorkspace}
                crmMonthWindow=""
                onPresalesSummaryClear={() => setPresalesSummaryTab(null)}
                presalesTeamExecutivesOnly={
                  isPresalesManager && presalesSummaryTab === "teamVerified"
                }
                presalesTeamExecDisplayNames={presalesTeamNames}
                superAdminPresalesAssigneeNames={
                  isSuperAdminPresalesWorkspace ? superAdminPresalesNames : undefined
                }
                onLeadTypeChange={(next) => {
                  if (isPresalesRole(currentRole)) {
                    setLeadType(sanitizeLeadTypeForRole(currentRole, next));
                    return;
                  }
                  setLeadType(next);
                }}
                onSortChange={setSort}
                onResetAll={handleResetAll}
                onAssigneeChange={(next) => {
                  if (
                    currentRole === "SALES_EXECUTIVE" ||
                    currentRole === "PRESALES_EXECUTIVE"
                  ) {
                    return;
                  }
                  setAssignee(next);
                }}
                onDateFromChange={handleToolbarDateFromChange}
                onDateToChange={handleToolbarDateToChange}
                onDateFieldChange={handleToolbarDateFieldChange}
                onMilestoneStageChange={setMilestoneStage}
                onMilestoneStageCategoryChange={setMilestoneStageCategory}
                onMilestoneSubStageChange={setMilestoneSubStage}
                onReinquiryChange={setReinquiry}
                onHeatmapAssigneeSync={setHeatmapToolbarAssignee}
                onHeatmapAssigneeScopeSync={setHeatmapToolbarAssigneeScope}
                onHeatmapSummarySync={handleHeatmapSummarySync}
                onAdminMilestoneCountsSync={handleAdminMilestoneCountsSync}
                onAdminPresalesSummarySync={handleAdminPresalesSummarySync}
                onInsightTableModeChange={setInsightTableMode}
              />
            </>
          )}
          <div className="h-10" />
        </div>
      </div>
    </div>
  );
}
