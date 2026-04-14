"use client";

import { useState } from "react";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";

export default function DesignDashboardClient() {
  const [role] = useState(() => {
    if (typeof window === "undefined") return "DESIGNER";
    const storedRole = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "DESIGNER";
    return normalizeRole(storedRole) || "DESIGNER";
  });
  const roleLabel = role
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

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
            profileInitials={roleLabel.slice(0, 2).toUpperCase()}
          />
        </div>

        <div className="bg-[var(--crm-surface)] xl:h-screen xl:overflow-y-auto">
          <div className="border-b border-[var(--crm-border)] bg-[var(--crm-surface-elevated)] shadow-[var(--crm-shadow-sm)]">
            <div className="flex min-h-16 items-center justify-between px-4 md:px-6">
              <h1 className="text-[2rem] font-bold tracking-[-0.04em] text-[var(--crm-text-primary)]">
                {roleLabel} Panel
              </h1>
            </div>
          </div>

          <main className="px-6 py-6">
            <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6">
              <h2 className="text-3xl font-bold text-[var(--crm-text-primary)]">Welcome, Designer!</h2>
              <div className="mt-2 h-px bg-[var(--crm-accent)]" />
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {[
                  "My Assigned Clients",
                  "My Appointments",
                  "Upcoming Meetings",
                ].map((label) => (
                  <div key={label} className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-5 text-center">
                    <div className="text-4xl font-extrabold text-[var(--crm-accent)]">0</div>
                    <div className="mt-2 text-sm font-semibold text-[var(--crm-text-muted)]">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <div className="text-2xl font-bold text-[var(--crm-text-primary)]">Quick Actions</div>
                <button className="mt-3 rounded-lg bg-[var(--crm-accent)] px-5 py-2 text-sm font-semibold text-white">
                  Manage Availability
                </button>
              </div>
              <div className="mt-8 text-xl font-bold text-[var(--crm-text-secondary)]">Recent Assigned Clients</div>
              <div className="mt-3 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-6 text-center text-[var(--crm-text-muted)]">
                No clients assigned yet. Clients will appear here when sales executives schedule meetings with you.
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
