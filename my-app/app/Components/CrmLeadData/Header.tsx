"use client";

import { useMemo, useState } from "react";
import JourneyPhaseHeatmap from "./JourneyPhaseHeatmap";
import LeadsDataSection from "./LeadsDataSection";
import TopNav from "./TopNav";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";

export default function Header() {
  const [currentRole] = useState(() => {
    if (typeof window === "undefined") return "SUPER_ADMIN";
    const stored = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "SUPER_ADMIN";
    return normalizeRole(stored);
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

  const milestoneFilterQuery = useMemo(() => {
    const q = new URLSearchParams();
    if (leadType && leadType !== "all") q.set("leadType", leadType);
    if (assignee.trim()) q.set("assignee", assignee.trim());
    if (dateFrom.trim()) q.set("dateFrom", dateFrom.trim());
    if (dateTo.trim()) q.set("dateTo", dateTo.trim());
    if (milestoneStage.trim()) q.set("milestoneStage", milestoneStage.trim());
    if (milestoneStageCategory.trim()) q.set("milestoneStageCategory", milestoneStageCategory.trim());
    if (milestoneSubStage.trim()) q.set("milestoneSubStage", milestoneSubStage.trim());
    return q.toString();
  }, [assignee, dateFrom, dateTo, leadType, milestoneStage, milestoneStageCategory, milestoneSubStage]);

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
          <JourneyPhaseHeatmap milestoneFilterQuery={milestoneFilterQuery} />
          <LeadsDataSection
            search={search}
            leadType={leadType}
            sort={sort}
            assignee={assignee}
            dateFrom={dateFrom}
            dateTo={dateTo}
            milestoneStage={milestoneStage}
            milestoneStageCategory={milestoneStageCategory}
            milestoneSubStage={milestoneSubStage}
            onLeadTypeChange={setLeadType}
            onSortChange={setSort}
            onAssigneeChange={setAssignee}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onMilestoneStageChange={setMilestoneStage}
            onMilestoneStageCategoryChange={setMilestoneStageCategory}
            onMilestoneSubStageChange={setMilestoneSubStage}
          />
          <div className="h-10" />
        </div>
      </div>
    </div>
  );
}
