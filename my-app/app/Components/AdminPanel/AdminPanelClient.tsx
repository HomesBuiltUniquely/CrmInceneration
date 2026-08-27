"use client";

import { useEffect, useMemo, useState } from "react";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import AppTopBar from "../Shared/AppTopBar";
import SlimScrollArea from "../Shared/SlimScrollArea";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import AdminPanelContent from "./AdminPanelContent";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";

const DEFAULT_PANEL_ROLE = "SUPER_ADMIN";

export default function AdminPanelClient() {
  /** Same initial value on server and first client paint — read localStorage after mount to avoid hydration mismatch. */
  const [role, setRole] = useState<string>(DEFAULT_PANEL_ROLE);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
      setRole(normalizeRole(stored) || DEFAULT_PANEL_ROLE);
    } catch {
      setRole(DEFAULT_PANEL_ROLE);
    }
  }, []);
  const roleLabel = useMemo(
    () =>
      role
        .toLowerCase()
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    [role],
  );

  return (
    <div className="min-h-screen bg-[var(--crm-app-bg)] xl:h-screen xl:overflow-hidden">
      <div className="grid min-h-screen xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <QuickAccessSidebar
            appBadge="HO WS"
            appName="Hows"
            appTagline="by HUB"
            sections={dashboardSidebarSections}
            profileName={roleLabel}
            profileRole={role}
            profileInitials="AD"
          />
        </div>

        <SlimScrollArea className="bg-[var(--crm-surface)] xl:h-screen">
          <AppTopBar />

          <AdminPanelContent />
        </SlimScrollArea>
      </div>
    </div>
  );
}
