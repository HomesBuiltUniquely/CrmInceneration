"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import AnalyticsBar from "./AnalyticsBar";
import LeadFilters from "@/app/Components/CrmDashboard/LeadFilters";
import type { DashboardFilterState } from "@/app/Components/CrmDashboard/LeadFilters";
import CrmPipeline from "./CrmPipeline";
import InsightsStrip from "./InsightsStrip";

import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";

type Props = {
  role?: "sales_admin" | "sales_manager" | "super_admin";
};

export default function Header({ role = "sales_admin" }: Props) {
  const router = useRouter();
  const [currentRole] = useState(() => {
    if (typeof window === "undefined") return normalizeRole(role);
    const stored = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? role;
    return normalizeRole(stored);
  });
  const [activeDashboardView, setActiveDashboardView] = useState<
    "overview" | "design-module"
  >("overview");
  const [dashboardFilters, setDashboardFilters] = useState<DashboardFilterState>({
    assignee: "",
    assignees: [],
    milestoneStage: "",
    milestoneStageCategory: "",
    milestoneSubStage: "",
    dateFrom: "",
    dateTo: "",
  });

  const handleSidebarSelection = useCallback(({ subItem }: { subItem: { id: string } }) => {
    const next = subItem.id === "design-module" ? "design-module" : "overview";
    setActiveDashboardView((prev) => (prev === next ? prev : next));
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
    <div className="min-h-screen bg-[var(--crm-app-bg)] xl:h-screen xl:overflow-hidden">
      <div className="grid min-h-screen xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <QuickAccessSidebar
            appBadge="HO WS"
            appName="Hows"
            appTagline="by HUB"
            sections={dashboardSidebarSections}
            profileName={currentRole.replace(/_/g, " ")}
            profileRole={currentRole}
            profileInitials="AD"
            onSelectionChange={handleSidebarSelection}
          />
        </div>
        <div className="bg-[var(--crm-surface)] xl:h-screen xl:overflow-y-auto">
          <div className="border-b border-[var(--crm-border)] bg-[var(--crm-surface-elevated)] xl:flex xl:h-16 xl:w-full xl:justify-between xl:px-4 xl:shadow-[var(--crm-shadow-sm)]">
            <div className="xl:flex xl:items-center xl:pt-2">
              <div>
                <Image
                  src="/HowsCrmLogo.png"
                  alt="Description"
                  width={50}
                  height={50}
                />
              </div>
              <h1 className="xl:pl-3 xl:font-bold text-[var(--crm-text-primary)]">
                Lead Journey
                <button
                  type="button"
                  onClick={() => router.push("/Leads")}
                  className="ml-4 rounded-full bg-[var(--crm-accent-soft)] px-3 py-1 text-[12px] font-semibold text-[var(--crm-accent)] ring-1 ring-[var(--crm-accent-ring)] transition-all duration-200 hover:-translate-y-px hover:bg-[rgba(37,99,235,0.16)]"
                >
                  Lead Management
                </button>
              </h1>
            </div>
            <div className="xl:flex xl:items-center">
              <div className="xl:mr-4 xl:h-7.5 xl:w-25 xl:rounded-lg xl:bg-[var(--crm-surface-subtle)] xl:pl-4.5 xl:pt-1 xl:font-bold xl:text-[var(--crm-text-muted)]">
                Q3 FY24
              </div>
            </div>
          </div>
          {activeDashboardView === "design-module" ? (
            <div className="bg-[var(--crm-app-bg)] p-4 md:p-6">
              <div className="mx-auto space-y-4">
                <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] px-6 py-5 shadow-[var(--crm-shadow-sm)]">
                  <h2 className="text-[1.6rem] font-bold tracking-[-0.04em] text-[var(--crm-text-primary)]">
                    Design Module
                  </h2>
                  <p className="mt-1 text-sm text-[var(--crm-text-muted)]">
                    Embedded design workspace inside the dashboard, same like
                    the old CRM tab flow.
                  </p>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-[var(--crm-shadow-md)]">
                  <iframe
                    src="https://design.hubinterior.com"
                    title="Design Module"
                    className="h-[calc(100vh-150px)] w-full border-0 bg-[var(--crm-surface-subtle)]"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <LeadFilters role={role} onFiltersChange={handleFiltersChange} />
              <AnalyticsBar />
              <CrmPipeline filters={dashboardFilters} />
              <InsightsStrip />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
