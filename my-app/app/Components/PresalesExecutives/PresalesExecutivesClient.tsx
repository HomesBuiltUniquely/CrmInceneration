"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import AppTopBar from "../Shared/AppTopBar";
import SlimScrollArea from "@/app/Components/Shared/SlimScrollArea";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import AdminPanelContent from "../AdminPanel/AdminPanelContent";
import {
  CRM_ROLE_STORAGE_KEY,
  normalizeRole,
} from "@/lib/auth/api";

/**
 * Presales Manager — manage executives under their team.
 * Reuses AdminPanelContent manager-scoped SalesExecSection (Presales Executives).
 */
export default function PresalesExecutivesClient() {
  const router = useRouter();
  const [role, setRole] = useState("");

  useEffect(() => {
    try {
      const stored = normalizeRole(
        window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "",
      );
      setRole(stored);
      if (stored && stored !== "PRESALES_MANAGER") {
        router.replace("/presales-leads");
      }
    } catch {
      setRole("");
    }
  }, [router]);

  const roleLabel = useMemo(
    () =>
      role
        ? role
            .toLowerCase()
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")
        : "Presales Manager",
    [role],
  );

  if (role && role !== "PRESALES_MANAGER") {
    return null;
  }

  return (
    <div className="min-h-screen min-h-dvh bg-[var(--crm-app-bg)] xl:h-screen xl:overflow-hidden crm-page-shell">
      <div className="grid min-h-screen xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <QuickAccessSidebar
            appBadge="HO WS"
            appName="Hows"
            appTagline="by HUB"
            sections={dashboardSidebarSections}
            profileName={roleLabel}
            profileRole={role || "PRESALES_MANAGER"}
            profileInitials="PM"
          />
        </div>

        <SlimScrollArea className="bg-[var(--crm-surface)] xl:h-screen crm-main-scroll">
          <AppTopBar />
          <AdminPanelContent />
        </SlimScrollArea>
      </div>
    </div>
  );
}
