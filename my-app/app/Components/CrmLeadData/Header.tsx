"use client";

import { useEffect, useMemo, useState } from "react";
import JourneyPhaseHeatmap from "./JourneyPhaseHeatmap";
import LeadsDataSection from "./LeadsDataSection";
import TopNav from "./TopNav";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import { adminPanelApi } from "@/lib/admin-panel-api";
import {
  CRM_TOKEN_STORAGE_KEY,
  CRM_ROLE_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
  getMe,
  getRoleFromUser,
  getNameFromUser,
  normalizeRole,
} from "@/lib/auth/api";
import { readStoredCrmToken } from "@/lib/crm-client-auth";

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
  const [currentUserId, setCurrentUserId] = useState(0);
  const [authResolved, setAuthResolved] = useState(false);
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
  const [managerLeadView, setManagerLeadView] = useState<"my" | "team">("my");
  const [managerTeamNames, setManagerTeamNames] = useState<string[]>([]);

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
      .then((user) => {
        if (cancelled) return;
        const role = normalizeRole(getRoleFromUser(user));
        const name = getNameFromUser(user);
        const id = Number((user as Record<string, unknown>).id ?? 0);
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
    if (currentRole === "PRESALES_MANAGER") return "formlead";
    return leadType;
  }, [currentRole, leadType]);

  const forcedAssignee = useMemo(() => {
    if (currentRole === "SALES_EXECUTIVE" || currentRole === "PRESALES_EXECUTIVE") {
      return currentUserName.trim();
    }
    return assignee;
  }, [assignee, currentRole, currentUserName]);

  useEffect(() => {
    if (currentRole === "PRESALES_MANAGER" && leadType !== "formlead") {
      setLeadType("formlead");
    }
  }, [currentRole, leadType]);

  const isDesignRole =
    currentRole === "DESIGNER" ||
    currentRole === "DESIGN_MANAGER" ||
    currentRole === "TERRITORY_DESIGN_MANAGER";
  const isSalesManager = currentRole === "SALES_MANAGER";

  useEffect(() => {
    let cancelled = false;
    if (!isSalesManager || !currentUserId) {
      setManagerTeamNames([]);
      return;
    }
    void adminPanelApi
      .listAllUsers()
      .then((users) => {
        if (cancelled) return;
        const names = users
          .filter((u) => normalizeRole(u.role) === "SALES_EXECUTIVE" && Number(u.managerId ?? 0) === Number(currentUserId))
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

  const milestoneFilterQuery = useMemo(() => {
    const q = new URLSearchParams();
    if (forcedLeadType && forcedLeadType !== "all") q.set("leadType", forcedLeadType);
    if (forcedAssignee.trim()) q.set("assignee", forcedAssignee.trim());
    if (dateFrom.trim()) q.set("dateFrom", dateFrom.trim());
    if (dateTo.trim()) q.set("dateTo", dateTo.trim());
    if (milestoneStage.trim()) q.set("milestoneStage", milestoneStage.trim());
    if (milestoneStageCategory.trim()) q.set("milestoneStageCategory", milestoneStageCategory.trim());
    if (milestoneSubStage.trim()) q.set("milestoneSubStage", milestoneSubStage.trim());
    if (reinquiry.trim()) q.set("reinquiry", reinquiry.trim());
    if (isSalesManager) q.set("roleView", managerLeadView);
    return q.toString();
  }, [
    dateFrom,
    dateTo,
    forcedAssignee,
    forcedLeadType,
    milestoneStage,
    milestoneStageCategory,
    milestoneSubStage,
    reinquiry,
    isSalesManager,
    managerLeadView,
  ]);

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
              {isSalesManager ? (
                <section className="mx-auto mt-4 flex max-w-[1200px] items-center justify-end px-6">
                  <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-1">
                    <button
                      type="button"
                      onClick={() => setManagerLeadView("my")}
                      className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                        managerLeadView === "my"
                          ? "bg-[var(--crm-accent)] text-white"
                          : "text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface-subtle)]"
                      }`}
                    >
                      My Leads
                    </button>
                    <button
                      type="button"
                      onClick={() => setManagerLeadView("team")}
                      className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
                        managerLeadView === "team"
                          ? "bg-[var(--crm-accent)] text-white"
                          : "text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface-subtle)]"
                      }`}
                    >
                      Team Leads
                    </button>
                  </div>
                </section>
              ) : null}
              <JourneyPhaseHeatmap
                milestoneFilterQuery={milestoneFilterQuery}
                currentRole={currentRole}
                leadView={isSalesManager ? managerLeadView : "default"}
                currentUserName={currentUserName}
                managerTeamNames={managerTeamNames}
              />
              <LeadsDataSection
                search={search}
                leadType={forcedLeadType}
                leadView={isSalesManager ? managerLeadView : "default"}
                currentUserName={currentUserName}
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
                onLeadTypeChange={(next) => {
                  if (currentRole === "PRESALES_MANAGER") {
                    setLeadType("formlead");
                    return;
                  }
                  setLeadType(next);
                }}
                onSortChange={setSort}
                onAssigneeChange={(next) => {
                  if (currentRole === "SALES_EXECUTIVE" || currentRole === "PRESALES_EXECUTIVE") {
                    return;
                  }
                  setAssignee(next);
                }}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                onMilestoneStageChange={setMilestoneStage}
                onMilestoneStageCategoryChange={setMilestoneStageCategory}
                onMilestoneSubStageChange={setMilestoneSubStage}
                onReinquiryChange={setReinquiry}
              />
            </>
          )}
          <div className="h-10" />
        </div>
      </div>
    </div>
  );
}
