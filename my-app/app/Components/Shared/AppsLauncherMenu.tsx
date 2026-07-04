"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CRM_ROLE_STORAGE_KEY } from "@/lib/auth/api";
import { cn } from "@/lib/cn";
import type { QuickAccessParentItem, QuickAccessSubItem } from "./QuickAccessSidebar";
import {
  filterSidebarSections,
  pathnameMatchesSidebarHref,
  sidebarHrefMatchLength,
} from "./sidebar-utils";

function SidebarIcon({ name, className }: { name: string; className?: string }) {
  const baseProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className: cn("h-5 w-5", className),
  };

  switch (name) {
    case "users":
      return (
        <svg {...baseProps}>
          <path d="M16 20V18C16 16.9 15.1 16 14 16H6C4.9 16 4 16.9 4 18V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="10" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M20 20V18.5C20 17.4 19.1 16.47 18 16.32" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M15 6.13C15.86 6.43 16.5 7.25 16.5 8.2C16.5 9.15 15.86 9.97 15 10.27" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "chart":
      return (
        <svg {...baseProps}>
          <path d="M4 19H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M7 17V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 17V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M17 17V13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "plus":
      return (
        <svg {...baseProps}>
          <path d="M12 5V19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M5 12H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "upload":
      return (
        <svg {...baseProps}>
          <path d="M12 15V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8.5 8.5L12 5L15.5 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 15.5V17C5 18.1 5.9 19 7 19H17C18.1 19 19 18.1 19 17V15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...baseProps}>
          <rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3.8V6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M16 3.8V6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M4 9H20" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "palette":
      return (
        <svg {...baseProps}>
          <path d="M12 4C7.58 4 4 7.13 4 11C4 13.76 6.02 16 8.5 16H9.27C10.23 16 11 16.77 11 17.73C11 18.98 12.02 20 13.27 20H13.5C17.64 20 21 16.64 21 12.5C21 7.81 17.08 4 12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="8" cy="11" r="1" fill="currentColor" />
          <circle cx="11" cy="8" r="1" fill="currentColor" />
          <circle cx="15" cy="8.5" r="1" fill="currentColor" />
          <circle cx="16.5" cy="12.5" r="1" fill="currentColor" />
        </svg>
      );
    case "settings":
      return (
        <svg {...baseProps}>
          <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M19.4 15A1 1 0 0 0 19.6 16.1L19.7 16.2A1 1 0 0 1 19.7 17.6L17.6 19.7A1 1 0 0 1 16.2 19.7L16.1 19.6A1 1 0 0 0 15 19.4A1 1 0 0 0 14.4 20.3V20.5A1 1 0 0 1 13.4 21.5H10.6A1 1 0 0 1 9.6 20.5V20.3A1 1 0 0 0 9 19.4A1 1 0 0 0 7.9 19.6L7.8 19.7A1 1 0 0 1 6.4 19.7L4.3 17.6A1 1 0 0 1 4.3 16.2L4.4 16.1A1 1 0 0 0 4.6 15A1 1 0 0 0 3.7 14.4H3.5A1 1 0 0 1 2.5 13.4V10.6A1 1 0 0 1 3.5 9.6H3.7A1 1 0 0 0 4.6 9A1 1 0 0 0 4.4 7.9L4.3 7.8A1 1 0 0 1 4.3 6.4L6.4 4.3A1 1 0 0 1 7.8 4.3L7.9 4.4A1 1 0 0 0 9 4.6A1 1 0 0 0 9.6 3.7V3.5A1 1 0 0 1 10.6 2.5H13.4A1 1 0 0 1 14.4 3.5V3.7A1 1 0 0 0 15 4.6A1 1 0 0 0 16.1 4.4L16.2 4.3A1 1 0 0 1 17.6 4.3L19.7 6.4A1 1 0 0 1 19.7 7.8L19.6 7.9A1 1 0 0 0 19.4 9A1 1 0 0 0 20.3 9.6H20.5A1 1 0 0 1 21.5 10.6V13.4A1 1 0 0 1 20.5 14.4H20.3A1 1 0 0 0 19.4 15Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );
    case "wrench":
      return (
        <svg {...baseProps}>
          <path d="M14.5 6.5A4 4 0 0 0 18 12L11 19L8 16L15 9A4 4 0 0 0 14.5 6.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M6 18L4 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "id-card":
      return (
        <svg {...baseProps}>
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="9" cy="11" r="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M6.8 15C7.4 14 8.1 13.5 9 13.5C9.9 13.5 10.6 14 11.2 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M13.5 10H17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M13.5 13H17.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...baseProps}>
          <path d="M7 4.5H17V19.5L15 18L13 19.5L11 18L9 19.5L7 18V4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9.5 9H14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M9.5 12H14.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
  }
}

function HowsHubLauncherIcon({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const g1 = `hows-tile-a-${uid}`;
  const g2 = `hows-tile-b-${uid}`;
  const g3 = `hows-tile-c-${uid}`;
  const g4 = `hows-tile-d-${uid}`;

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={g1} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id={g2} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id={g3} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id={g4} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="12" height="12" rx="3.5" fill={`url(#${g1})`} />
      <rect x="18" y="2" width="12" height="12" rx="3.5" fill={`url(#${g2})`} />
      <rect x="2" y="18" width="12" height="12" rx="3.5" fill={`url(#${g3})`} />
      <rect x="18" y="18" width="12" height="12" rx="3.5" fill={`url(#${g4})`} />
      <circle cx="16" cy="16" r="2.2" fill="white" fillOpacity="0.95" />
    </svg>
  );
}

function appIconTileClass(icon: string, isActive: boolean): string {
  const tones: Record<string, { idle: string; active: string }> = {
    chart: {
      idle: "from-[#dbeafe] to-[#bfdbfe] text-[#1d4ed8]",
      active: "from-[#2563eb] to-[#1d4ed8] text-white",
    },
    users: {
      idle: "from-[#cffafe] to-[#a5f3fc] text-[#0e7490]",
      active: "from-[#0891b2] to-[#0e7490] text-white",
    },
    plus: {
      idle: "from-[#d1fae5] to-[#a7f3d0] text-[#047857]",
      active: "from-[#059669] to-[#047857] text-white",
    },
    upload: {
      idle: "from-[#ffedd5] to-[#fed7aa] text-[#c2410c]",
      active: "from-[#ea580c] to-[#c2410c] text-white",
    },
    calendar: {
      idle: "from-[#ede9fe] to-[#ddd6fe] text-[#6d28d9]",
      active: "from-[#7c3aed] to-[#6d28d9] text-white",
    },
    palette: {
      idle: "from-[#fce7f3] to-[#fbcfe8] text-[#be185d]",
      active: "from-[#db2777] to-[#be185d] text-white",
    },
    settings: {
      idle: "from-[#e2e8f0] to-[#cbd5e1] text-[#475569]",
      active: "from-[#64748b] to-[#475569] text-white",
    },
    wrench: {
      idle: "from-[#fef3c7] to-[#fde68a] text-[#b45309]",
      active: "from-[#d97706] to-[#b45309] text-white",
    },
    "id-card": {
      idle: "from-[#e0e7ff] to-[#c7d2fe] text-[#4338ca]",
      active: "from-[#4f46e5] to-[#4338ca] text-white",
    },
    receipt: {
      idle: "from-[#ccfbf1] to-[#99f6e4] text-[#0f766e]",
      active: "from-[#0d9488] to-[#0f766e] text-white",
    },
  };
  const tone = tones[icon] ?? tones.chart;
  return cn(
    "bg-gradient-to-br transition-colors duration-200 ease-out",
    isActive
      ? `${tone.active} shadow-sm`
      : `${tone.idle} group-hover:brightness-[1.02]`,
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
  const [open, setOpen] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
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
    setOpen(false);
    if (onItemSelect?.(item)) return;
    if (!item.href) return;
    if (/^https?:\/\//.test(item.href)) {
      window.location.href = item.href;
      return;
    }
    if (pathnameMatchesSidebarHref(pathname, item.href)) return;
    router.push(item.href);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label="Open apps menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "group inline-flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent p-0 shadow-none outline-none ring-0 transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--crm-accent-ring)]",
          open
            ? "bg-[var(--crm-accent-soft)]"
            : "hover:bg-[var(--crm-surface-subtle)] active:bg-[var(--crm-accent-soft)]",
        )}
      >
        <HowsHubLauncherIcon className="h-9 w-9 md:h-10 md:w-10" />
      </button>

      {open ? (
        <div
          className={cn(
            "absolute right-0 top-[calc(100%+8px)] z-50 w-[min(92vw,400px)] origin-top-right overflow-hidden rounded-[22px] border border-[var(--crm-border)] bg-[var(--crm-surface-elevated)] shadow-[0_20px_50px_rgba(15,23,42,0.16)] ring-1 ring-black/[0.04] transition-all duration-200 ease-out",
            panelVisible
              ? "translate-y-0 scale-100 opacity-100"
              : "pointer-events-none -translate-y-2 scale-95 opacity-0",
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
                width={120}
                height={40}
                className="h-9 w-auto shrink-0 object-contain"
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
                  {section.items.map((item) => {
                    const isActive = item.id === activeItemId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleItemClick(item)}
                        className={cn(
                          "group flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-[16px] border px-2 py-3 text-center transition-colors duration-200",
                          isActive
                            ? "border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)]"
                            : "border-transparent bg-[var(--crm-surface)] hover:border-[var(--crm-border)] hover:bg-[var(--crm-surface-subtle)]",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-11 w-11 items-center justify-center rounded-[14px]",
                            appIconTileClass(item.icon, isActive),
                          )}
                        >
                          <SidebarIcon name={item.icon} className="h-5 w-5" />
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
