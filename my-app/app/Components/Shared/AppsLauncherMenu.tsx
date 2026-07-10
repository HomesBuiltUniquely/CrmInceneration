"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CRM_ROLE_STORAGE_KEY } from "@/lib/auth/api";
import { cn } from "@/lib/cn";
import type { QuickAccessParentItem, QuickAccessSubItem } from "./QuickAccessSidebar";
import {
  appIconTileClass,
  CrmSidebarIcon,
  isImageSidebarIcon,
  resolveAppLauncherIcon,
} from "./CrmSidebarIcons";
import {
  filterSidebarSections,
  pathnameMatchesSidebarHref,
  sidebarHrefMatchLength,
} from "./sidebar-utils";

function HowsHubLauncherIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="12" height="12" rx="3.2" fill="#1DA1E6" />
      <circle cx="24" cy="8" r="6" fill="#1DA1E6" />
      <rect x="2" y="18" width="12" height="12" rx="3.2" fill="#1DA1E6" />
      <rect x="18" y="18" width="12" height="12" rx="3.2" fill="#1DA1E6" />
    </svg>
  );
}

function AppItemIcon({
  itemId,
  icon,
}: {
  itemId: string;
  icon: string;
  label: string;
}) {
  const resolved = resolveAppLauncherIcon(itemId, icon);
  return (
    <CrmSidebarIcon
      name={resolved}
      className={isImageSidebarIcon(resolved) ? "h-10 w-10" : "h-6 w-6"}
    />
  );
}

type AppsLauncherMenuProps = {
  sections: QuickAccessParentItem[];
  profileRole?: string;
  onItemSelect?: (item: QuickAccessSubItem) => boolean | void;
};

export default function AppsLauncherMenu({
  sections,
  profileRole = "USER",
  onItemSelect,
}: AppsLauncherMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const clickTimeoutRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [clickedItemId, setClickedItemId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState(profileRole);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedRole = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY)?.trim();
    if (storedRole) setCurrentRole(storedRole);
  }, [profileRole]);

  useEffect(() => {
    if (!open) {
      setPanelVisible(false);
      return;
    }
    const frame = requestAnimationFrame(() => setPanelVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        window.clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const filteredSections = useMemo(
    () => filterSidebarSections(sections, currentRole || profileRole),
    [currentRole, profileRole, sections],
  );

  const activeItemId = useMemo(() => {
    let best: { itemId: string; matchLen: number } | null = null;
    for (const section of filteredSections) {
      for (const item of section.items) {
        if (!item.href || !pathnameMatchesSidebarHref(pathname, item.href)) continue;
        const matchLen = sidebarHrefMatchLength(item.href);
        if (!best || matchLen > best.matchLen) {
          best = { itemId: item.id, matchLen };
        }
      }
    }
    return best?.itemId ?? "";
  }, [filteredSections, pathname]);

  const handleItemClick = (item: QuickAccessSubItem) => {
    if (clickTimeoutRef.current) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }

    setClickedItemId(item.id);
    clickTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
      setClickedItemId(null);
      if (onItemSelect?.(item)) return;
      if (item.id === "design-module" && !item.href) {
        window.location.href = "https://design.hubinterior.com";
        return;
      }
      if (!item.href) return;
      if (/^https?:\/\//.test(item.href)) {
        window.location.href = item.href;
        return;
      }
      if (pathnameMatchesSidebarHref(pathname, item.href)) return;
      router.push(item.href);
    }, 140);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label="Open apps menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "group inline-flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent p-0 shadow-none outline-none ring-0 transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--crm-accent-ring)] active:scale-95",
          open
            ? "scale-105 bg-[var(--crm-accent-soft)]"
            : "hover:bg-[var(--crm-surface-subtle)] active:bg-[var(--crm-accent-soft)]",
        )}
      >
        <HowsHubLauncherIcon
          className={cn(
            "h-9 w-9 transition-transform duration-300 ease-out md:h-10 md:w-10",
            open ? "rotate-[8deg] scale-110" : "rotate-0 scale-100",
          )}
        />
      </button>

      {open ? (
        <div
          className={cn(
            "absolute right-0 top-[calc(100%+8px)] z-50 w-[min(92vw,400px)] origin-top-right overflow-hidden rounded-[22px] border border-[var(--crm-border)] bg-[var(--crm-surface-elevated)] shadow-[0_20px_50px_rgba(15,23,42,0.16)] ring-1 ring-black/[0.04] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
            panelVisible
              ? "translate-y-0 scale-100 opacity-100"
              : "pointer-events-none -translate-y-2 scale-[0.96] opacity-0",
          )}
          role="dialog"
          aria-label="Hows apps"
        >
          <div className="border-b border-[var(--crm-border)] bg-[var(--crm-surface-elevated)] px-10 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[15px] font-bold tracking-[-0.02em] text-[var(--crm-text-primary)]">
                  Apps
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--crm-text-muted)]">
                  Jump to any workspace module
                </div>
              </div>
              <Image
                src="/logo-final-02.png"
                alt="Hows"
                width={168}
                height={56}
                className="h-12 w-auto shrink-0 object-contain"
              />
            </div>
          </div>

          <div className="max-h-[min(70vh,520px)] overflow-y-auto bg-[var(--crm-surface-elevated)] p-3.5">
            {filteredSections.map((section) => (
              <div key={section.id} className="mb-4 last:mb-0">
                <div className="mb-2.5 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--crm-text-muted)]">
                  {section.label}
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {section.items.map((item, itemIndex) => {
                    const isActive = item.id === activeItemId;
                    const isClicked = clickedItemId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleItemClick(item)}
                        className={cn(
                          "group flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-[16px] border px-2 py-3 text-center transition-all duration-200 ease-out",
                          isActive
                            ? "border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)]"
                            : "border-transparent bg-[var(--crm-surface)] hover:border-[var(--crm-border)] hover:bg-[var(--crm-surface-subtle)]",
                          panelVisible
                            ? "translate-y-0 opacity-100"
                            : "translate-y-1 opacity-0",
                          isClicked
                            ? "scale-[0.96] border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)]"
                            : "scale-100",
                        )}
                        style={{ transitionDelay: `${itemIndex * 24}ms` }}
                      >
                        <div
                          className={cn(
                            "flex h-14 w-14 items-center justify-center rounded-[16px]",
                            appIconTileClass(resolveAppLauncherIcon(item.id, item.icon), isActive),
                          )}
                        >
                          <AppItemIcon itemId={item.id} icon={item.icon} label={item.label} />
                        </div>
                        <span
                          className={cn(
                            "line-clamp-2 text-[11px] font-semibold leading-tight transition-colors duration-300",
                            isActive
                              ? "text-[var(--crm-accent)]"
                              : "text-[var(--crm-text-secondary)] group-hover:text-[var(--crm-text-primary)]",
                          )}
                        >
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
