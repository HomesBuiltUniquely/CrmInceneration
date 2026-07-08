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
  headerMiddleContent?: ReactNode;
  enlargeLogo?: boolean;
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
  headerMiddleContent,
  enlargeLogo = false,
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
          <div className="flex h-16 w-full items-center justify-between gap-3 px-3 py-2.5 md:h-[68px] md:px-4 md:pr-6">
            <div className="flex min-w-0 items-center gap-3">
              <Image
                src="/logo-final-02.png"
                alt="Hows by HUB"
                width={enlargeLogo ? 240 : 120}
                height={enlargeLogo ? 80 : 40}
                className={`${enlargeLogo ? "h-14 md:h-16 origin-left scale-[1.15] md:scale-[1.2]" : "h-9"} w-auto object-contain`}
                priority
              />
            </div>

            {headerMiddleContent ? (
              <>
                <div
                  className="hidden h-10 w-px shrink-0 bg-[var(--crm-border)] lg:block"
                  aria-hidden="true"
                />
                <div className="hidden min-w-0 flex-1 items-center lg:flex">{headerMiddleContent}</div>
              </>
            ) : null}

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
