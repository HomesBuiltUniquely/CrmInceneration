"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CRM_ROLE_STORAGE_KEY,
  dashboardPathByRole,
  hasDashboardByRole,
} from "@/lib/auth/api";

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-[var(--crm-text-muted)]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M16.2 16.2 21 21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function TopNav({
  search,
  onSearchChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const router = useRouter();
  const [role] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
  });

  const handleDashboardClick = () => {
    if (!hasDashboardByRole(role)) return;
    router.push(dashboardPathByRole(role));
  };

  return (
    <div className="w-full border-b border-[var(--crm-border)] bg-[var(--crm-surface-elevated)] backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--crm-sidebar-active)] shadow-[var(--crm-shadow-sm)]">
              <Image
                src="/HowsCrmLogo.png"
                alt="Nexus CRM"
                width={24}
                height={24}
              />
            </div>
            <div className="text-[15px] font-semibold text-[var(--crm-text-primary)]">
              Hows CRM
            </div>
          </div>

          <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--crm-text-muted)]">
            {hasDashboardByRole(role) ? (
              <>
                <button
                  type="button"
                  onClick={handleDashboardClick}
                  className="rounded-full bg-[var(--crm-accent-soft)] px-3 py-1 text-[12px] font-semibold text-[var(--crm-accent)] ring-1 ring-[var(--crm-accent-ring)] transition-all duration-200 hover:-translate-y-px hover:bg-[rgba(37,99,235,0.16)]"
                >
                  Dashboard
                </button>
                <span className="px-2 text-[var(--crm-text-muted)]/50">/</span>
              </>
            ) : null}
            <span className="rounded-full bg-[var(--crm-accent-soft)] px-3 py-1 text-[12px] font-semibold text-[var(--crm-accent)] ring-1 ring-[var(--crm-accent-ring)]">
              Lead Management
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex w-[340px] items-center gap-2 rounded-xl bg-[var(--crm-surface-subtle)] px-3 py-2 ring-1 ring-[var(--crm-border)]">
            <SearchIcon />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-transparent text-[12px] font-medium text-[var(--crm-text-secondary)] placeholder:text-[var(--crm-text-muted)] focus:outline-none"
              placeholder="Search leads, tasks, owners..."
            />
          </div>
          <button className="rounded-xl  bg-[var(--crm-accent)] px-4 py-2 text-[12px] font-semibold  text-white shadow-[var(--crm-shadow-sm)]  transition-colorshover:brightness-110">
            + Add New Lead
          </button>
        </div>
      </div>
    </div>
  );
}
