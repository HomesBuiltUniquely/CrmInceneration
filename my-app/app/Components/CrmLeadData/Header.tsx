"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InsightTableMode } from "@/lib/lead-follow-up-insights";
import JourneyPhaseHeatmap from "./JourneyPhaseHeatmap";
import LeadsDataSection from "./LeadsDataSection";
import TopNav from "./TopNav";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
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
import { readStoredCrmToken } from "@/lib/crm-client-auth";
import { isLeadTypeAllowedForRole, isPresalesRole, sanitizeLeadTypeForRole } from "@/lib/crm-role-access";
import { fetchPresalesExecutiveNamesForManager } from "@/lib/fetch-presales-executives-for-manager";

export default function Header() {
  const [currentRole, setCurrentRole] = useState(() => {
    if (typeof window === "undefined") return "SUPER_ADMIN";
    const stored = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "SUPER_ADMIN";
    return normalizeRole(stored);
  });
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
  const [search, setSearch] = useState("");
  const [leadType, setLeadType] = useState("all");
  const [sort, setSort] = useState("updatedAt,desc");
  const [assignee, setAssignee] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [milestoneStage, setMilestoneStage] = useState("");
  const [milestoneStageCategory, setMilestoneStageCategory] = useState("");
  const [milestoneSubStage, setMilestoneSubStage] = useState("");
  const [reinquiry, setReinquiry] = useState("");
  const [managerTeamNames, setManagerTeamNames] = useState<string[]>([]);
  /** Toolbar Sales Exec / hierarchy filters — same effective assignee as the lead table. */
  const [heatmapToolbarAssignee, setHeatmapToolbarAssignee] = useState("");
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
  const presalesSummaryTabRef = useRef(presalesSummaryTab);
  presalesSummaryTabRef.current = presalesSummaryTab;

  useEffect(() => {
    let cancelled = false;
    const token = readStoredCrmToken();
    if (!token) {
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
    setLeadType("formlead");
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

  useEffect(() => {
    if (!authResolved || !isPresalesRole(currentRole)) return;
    setPresalesSummaryTab((prev) => (prev === null ? "total" : prev));
  }, [authResolved, currentRole]);

  const presalesVerificationStatus = useMemo(() => {
    if (!isPresalesRole(currentRole)) return "";
    if (presalesSummaryTab === "verified" || presalesSummaryTab === "teamVerified") return "verified";
    return "";
  }, [currentRole, presalesSummaryTab]);

  const heatmapFilterQuery = useMemo(() => {
    const q = new URLSearchParams();
    if (search.trim()) q.set("search", search.trim());
    if (forcedLeadType && forcedLeadType !== "all") q.set("leadType", forcedLeadType);
    const assigneeForHeatmap =
      heatmapToolbarAssignee.trim() || forcedAssignee.trim();
    if (assigneeForHeatmap) q.set("assignee", assigneeForHeatmap);
    const presalesMonthCards =
      isPresalesRole(currentRole) && presalesSummaryTab !== null;
    if (presalesMonthCards) q.set("crmMonthWindow", "current");
    else {
      if (dateFrom.trim()) q.set("dateFrom", dateFrom.trim());
      if (dateTo.trim()) q.set("dateTo", dateTo.trim());
    }
    if (reinquiry.trim()) q.set("reinquiry", reinquiry.trim());
    if (presalesVerificationStatus.trim()) q.set("verificationStatus", presalesVerificationStatus.trim());
    return q.toString();
  }, [
    search,
    dateFrom,
    dateTo,
    forcedAssignee,
    forcedLeadType,
    heatmapToolbarAssignee,
    reinquiry,
    presalesVerificationStatus,
    currentRole,
    presalesSummaryTab,
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

  return (
    <div className="min-h-screen bg-[var(--crm-app-bg)] xl:h-screen xl:overflow-hidden">
      <div className="xl:grid xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <QuickAccessSidebar
            appBadge="LD"
            appName="Lead"
            appTagline="workspace"
            sections={dashboardSidebarSections}
            profileName={currentRole.replace(/_/g, " ")}
            profileRole={currentRole}
            profileInitials="AD"
          />
        </div>
        <div className="xl:h-screen xl:overflow-y-auto">
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
                milestoneFilterQuery={heatmapFilterQuery}
                currentRole={currentRole}
                leadView="default"
                currentUserName={currentUserName}
                currentUserAliases={currentUserAliases}
                currentUserId={currentUserId}
                managerTeamNames={managerTeamNames}
                presalesTeamNames={presalesTeamNames}
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
                milestoneStage={milestoneStage}
                milestoneStageCategory={milestoneStageCategory}
                milestoneSubStage={milestoneSubStage}
                reinquiry={reinquiry}
                verificationStatus={presalesVerificationStatus}
                crmMonthWindow={
                  isPresalesRole(currentRole) && presalesSummaryTab ? "current" : ""
                }
                onPresalesSummaryClear={() => setPresalesSummaryTab(null)}
                presalesTeamExecutivesOnly={
                  isPresalesManager && presalesSummaryTab === "teamVerified"
                }
                presalesTeamExecDisplayNames={presalesTeamNames}
                onLeadTypeChange={(next) => {
                  if (isPresalesRole(currentRole)) {
                    setLeadType(sanitizeLeadTypeForRole(currentRole, next));
                    return;
                  }
                  setLeadType(next);
                }}
                onSortChange={setSort}
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
                onMilestoneStageChange={setMilestoneStage}
                onMilestoneStageCategoryChange={setMilestoneStageCategory}
                onMilestoneSubStageChange={setMilestoneSubStage}
                onReinquiryChange={setReinquiry}
                onHeatmapAssigneeSync={setHeatmapToolbarAssignee}
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
