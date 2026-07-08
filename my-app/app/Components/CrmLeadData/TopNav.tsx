"use client";

import Image from "next/image";
import AppsLauncherMenu from "../Shared/AppsLauncherMenu";
import CrmUserMenu from "../Shared/CrmUserMenu";
import type { QuickAccessParentItem } from "../Shared/QuickAccessSidebar";
import { LEADS_PAGE_HEADER_CLASS } from "./leads-page-layout";

const SEARCH_BAR_WIDTH_CLASS = "w-[280px] sm:w-[340px] md:w-[400px] lg:w-[460px]";

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-[var(--crm-text-muted)]"
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

type TopNavProps = {
  search: string;
  onSearchChange: (value: string) => void;
  sections: QuickAccessParentItem[];
  profileName?: string;
  profileRole?: string;
  profileInitials?: string;
};

export default function TopNav({
  search,
  onSearchChange,
  sections,
  profileName = "User",
  profileRole = "USER",
  profileInitials = "U",
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--crm-border)] bg-[var(--crm-surface-elevated)]/95 backdrop-blur-md">
      <div className={`${LEADS_PAGE_HEADER_CLASS} py-2 md:py-2.5`}>
        <div className="flex min-h-[44px] items-center justify-between gap-2 md:min-h-[48px] md:gap-3">
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
            <Image
              src="/logo-final-02.png"
              alt="Hows by HUB"
              width={250}
              height={84}
              className="h-14 w-auto shrink-0 origin-left scale-[1.15] object-contain sm:h-16 sm:scale-[1.2] md:h-16 md:scale-[1.2]"
              priority
            />
            <span
              className="shrink-0 text-[18px] font-light leading-none text-[var(--crm-text-muted)]/35 md:text-[20px]"
              aria-hidden="true"
            >
              |
            </span>
            <span className="whitespace-nowrap text-[16px] font-bold tracking-[-0.03em] text-[var(--crm-text-primary)] md:text-[18px]">
              Lead Journey
            </span>
          </div>

          <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5 md:gap-2">
            <div
              className={`flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[var(--crm-surface-subtle)] px-3 ring-1 ring-[var(--crm-border)] transition-shadow focus-within:ring-[var(--crm-accent-ring)] ${SEARCH_BAR_WIDTH_CLASS}`}
            >
              <SearchIcon />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-[var(--crm-text-secondary)] placeholder:text-[var(--crm-text-muted)] focus:outline-none md:text-[13px]"
                placeholder="Search leads, tasks, owners..."
              />
            </div>
            <AppsLauncherMenu sections={sections} profileRole={profileRole} />
            <CrmUserMenu
              profileName={profileName}
              profileRole={profileRole}
              profileInitials={profileInitials}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
