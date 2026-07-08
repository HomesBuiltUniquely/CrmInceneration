"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import AnalyticsBar from "./AnalyticsBar";
import LeadFilters from "@/app/Components/CrmDashboard/LeadFilters";
import type { DashboardFilterState } from "@/app/Components/CrmDashboard/LeadFilters";
import CrmPipeline from "./CrmPipeline";
import InsightsStrip from "./InsightsStrip";
import CrmAppShell from "../Shared/CrmAppShell";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";
import { sidebarSectionsForViewer, type CrmWorkspace } from "@/lib/crm-workspace";

type Props = {
  role?: "sales_admin" | "sales_manager" | "super_admin";
  workspace?: CrmWorkspace;
};

export default function Header({ role = "sales_admin", workspace = "sales" }: Props) {
  const isPresalesWorkspace = workspace === "presales";
  const leadsHref = isPresalesWorkspace ? "/presales-leads" : "/Leads";
  const dashboardTitle = isPresalesWorkspace ? "Presales Journey" : "Lead Journey";
  const router = useRouter();
  const [currentRole] = useState(() => {
    if (typeof window === "undefined") return normalizeRole(role);
    const stored = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? role;
    return normalizeRole(stored);
  });
  const sidebarSections = useMemo(
    () => sidebarSectionsForViewer(workspace, currentRole),
    [workspace, currentRole],
  );
  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilterState>({
    assignee: "",
    assignees: [],
    milestoneStage: "",
    milestoneStageCategory: "",
    milestoneSubStage: "",
    dateFrom: "",
    dateTo: "",
  });

  const handleAppsItemSelect = useCallback(({ id }: { id: string }) => {
    if (id === "design-module") {
      window.location.href = "https://design.hubinterior.com";
      return true;
    }
    return false;
  }, []);

  const handleFiltersChange = useCallback((next: DashboardFilterState) => {
    setDashboardFilters((prev: DashboardFilterState) => {
      if (
        prev.assignee === next.assignee &&
        (prev.assignees ?? []).join("|") === (next.assignees ?? []).join("|") &&
        prev.milestoneStage === next.milestoneStage &&
        prev.milestoneStageCategory === next.milestoneStageCategory &&
        prev.milestoneSubStage === next.milestoneSubStage &&
        prev.dateFrom === next.dateFrom &&
        prev.dateTo === next.dateTo
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  return (
    <CrmAppShell
      sections={sidebarSections}
      profileName={currentRole.replace(/_/g, " ")}
      profileRole={currentRole}
      profileInitials="AD"
      enlargeLogo
      headerMiddleContent={
        <div className="flex w-full min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/HowsCrmLogo.png" alt="Hows CRM" width={40} height={40} className="h-9 w-9" />
            <h1 className="truncate text-base font-bold text-[var(--crm-text-primary)] xl:text-lg">
              {dashboardTitle}
            </h1>
            <button
              type="button"
              onClick={() => router.push(leadsHref)}
              className="rounded-full bg-[var(--crm-accent-soft)] px-3 py-1 text-[12px] font-semibold text-[var(--crm-accent)] ring-1 ring-[var(--crm-accent-ring)] transition-all duration-200 hover:-translate-y-px hover:bg-[rgba(37,99,235,0.16)]"
            >
              Lead Management
            </button>
          </div>
          <div className="hidden shrink-0 rounded-lg bg-[var(--crm-surface-subtle)] px-4 py-1 text-sm font-bold text-[var(--crm-text-muted)] xl:block">
            Q3 FY24
          </div>
        </div>
      }
      onAppsItemSelect={handleAppsItemSelect}
    >
      <div className="bg-[var(--crm-surface)]">
        <div>
          <LeadFilters role={role} workspace={workspace} onFiltersChange={handleFiltersChange} />
          <AnalyticsBar filters={dashboardFilters} workspace={workspace} />
          <CrmPipeline filters={dashboardFilters} workspace={workspace} />
          <InsightsStrip />
        </div>
      </div>
    </CrmAppShell>
  );
}
