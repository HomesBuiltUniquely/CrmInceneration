"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import CrmAppShell from "../Shared/CrmAppShell";
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
    <div
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
    <CrmAppShell
      sections={dashboardSidebarSections}
      profileName={roleLabel}
      profileRole={role}
      profileInitials="AD"
      enlargeLogo
      headerMiddleContent={
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/HowsCrmLogo.png" alt="Hows CRM" width={40} height={40} className="h-9 w-9" />
          <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-[var(--crm-text-primary)] xl:text-lg">
            {roleLabel} Panel
          </h1>
          <p className="hidden text-xs text-[var(--crm-text-muted)] xl:block">
            Configuration & controls - {roleLabel} view
          </p>
          </div>
        </div>
      }
    >
        <div className="bg-[var(--crm-surface)]">
          <AdminPanelContent />
        </div>
    </CrmAppShell>
    </div>
  );
}
