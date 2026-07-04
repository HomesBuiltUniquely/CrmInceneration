"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import type { QuickAccessParentItem, QuickAccessSubItem } from "./QuickAccessSidebar";
import AppsLauncherMenu from "./AppsLauncherMenu";
import CrmUserMenu from "./CrmUserMenu";

type CrmAppShellProps = {
  sections: QuickAccessParentItem[];
  profileName?: string;
  profileRole?: string;
  profileInitials?: string;
  scrollRootId?: string;
  className?: string;
  hideHeader?: boolean;
  onAppsItemSelect?: (item: QuickAccessSubItem) => boolean | void;
  children: ReactNode;
};

export default function CrmAppShell({
  sections,
  profileName = "User",
  profileRole = "USER",
  profileInitials = "U",
  scrollRootId,
  className = "",
  hideHeader = false,
  onAppsItemSelect,
  children,
}: CrmAppShellProps) {
  return (
    <div className={`min-h-screen bg-[var(--crm-app-bg)] xl:h-screen xl:overflow-hidden ${className}`.trim()}>
      <div
        id={scrollRootId}
        className="xl:h-screen xl:overflow-y-auto"
      >
        {!hideHeader ? (
        <header className="sticky top-0 z-30 border-b border-[var(--crm-border)] bg-[var(--crm-surface-elevated)] backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 md:px-6 md:pr-10">
            <div className="flex min-w-0 items-center gap-3">
              <Image
                src="/logo-final-02.png"
                alt="Hows by HUB"
                width={120}
                height={40}
                className="h-9 w-auto object-contain"
                priority
              />
            </div>

            <div className="flex shrink-0 items-center gap-3 md:gap-4">
              <AppsLauncherMenu
                sections={sections}
                profileRole={profileRole}
                onItemSelect={onAppsItemSelect}
              />
              <CrmUserMenu
                profileName={profileName}
                profileRole={profileRole}
                profileInitials={profileInitials}
              />
            </div>
          </div>
        </header>
        ) : null}

        {children}
      </div>
    </div>
  );
}
