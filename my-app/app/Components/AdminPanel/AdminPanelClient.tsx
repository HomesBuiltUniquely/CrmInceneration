"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import AdminPanelContent from "./AdminPanelContent";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";

export default function AdminPanelClient() {
  const [role] = useState(() => {
    if (typeof window === "undefined") return "SUPER_ADMIN";
    const stored = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "SUPER_ADMIN";
    return normalizeRole(stored) || "SUPER_ADMIN";
  });
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
    <div
      className="min-h-screen bg-[var(--crm-app-bg)] xl:h-screen xl:overflow-hidden"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
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

        <div className="bg-[var(--crm-surface)] xl:h-screen xl:overflow-y-auto">
          <div className="border-b border-[var(--crm-border)] bg-[var(--crm-surface-elevated)] shadow-[var(--crm-shadow-sm)]">
            <div className="flex min-h-16 items-center justify-between px-4 md:px-6">
              <div className="flex items-center gap-3">
                <Image
                  src="/HowsCrmLogo.png"
                  alt="Hows CRM"
                  width={46}
                  height={46}
                />
                <div>
                  <div className="text-[1.6rem] font-extrabold tracking-[-0.04em] text-[var(--crm-text-primary)]">
                    {roleLabel} Panel
                  </div>
                  <div className="text-sm text-[var(--crm-text-muted)]">
                    Configuration & controls - {roleLabel} view
                  </div>
                </div>
              </div>
            </div>
          </div>

          <AdminPanelContent />
        </div>
      </div>
    </div>
  );
}
