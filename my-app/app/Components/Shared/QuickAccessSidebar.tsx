"use client";

import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CRM_ROLE_STORAGE_KEY,
  CRM_TOKEN_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
  logout as apiLogout,
} from "@/lib/auth/api";
import { cn } from "@/lib/cn";
import ThemeToggle from "./ThemeToggle";

export type QuickAccessSubItem = {
  id: string;
  label: string;
  description: string;
  icon: string;
  href?: string;
};

export type QuickAccessParentItem = {
  id: string;
  label: string;
  subtitle: string;
  icon: string;
  badge?: string;
  items: QuickAccessSubItem[];
};

type SelectionPayload = {
  parent: QuickAccessParentItem;
  subItem: QuickAccessSubItem;
};

interface QuickAccessSidebarProps {
  appBadge: string;
  appName: string;
  appTagline: string;
  sections: QuickAccessParentItem[];
  profileName?: string;
  profileRole?: string;
  profileInitials?: string;
  logoutLabel?: string;
  onSelectionChange?: (selection: SelectionPayload) => void;
}

function normalizeRole(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function roleDisplayName(role: string): string {
  const r = normalizeRole(role);
  if (r === "SUPER_ADMIN") return "Super Admin";
  if (r === "ADMIN") return "Admin";
  if (r === "SALES_ADMIN") return "Sales Admin";
  if (r === "SALES_MANAGER") return "Sales Manager";
  if (r === "SALES_EXECUTIVE") return "Sales Executive";
  if (r === "PRESALES_MANAGER") return "Presales Manager";
  if (r === "PRESALES_EXECUTIVE") return "Presales Executive";
  if (r === "TERRITORY_DESIGN_MANAGER") return "Territory Design Manager";
  if (r === "DESIGN_MANAGER") return "Design Manager";
  if (r === "DESIGNER") return "Designer";
  return "";
}

function SidebarIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
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
          <path
            d="M16 20V18C16 16.9 15.1 16 14 16H6C4.9 16 4 16.9 4 18V20"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle
            cx="10"
            cy="9"
            r="3"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M20 20V18.5C20 17.4 19.1 16.47 18 16.32"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M15 6.13C15.86 6.43 16.5 7.25 16.5 8.2C16.5 9.15 15.86 9.97 15 10.27"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "chart":
      return (
        <svg {...baseProps}>
          <path
            d="M4 19H20"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M7 17V11"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M12 17V7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M17 17V13"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "plus":
      return (
        <svg {...baseProps}>
          <path
            d="M12 5V19"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M5 12H19"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "upload":
      return (
        <svg {...baseProps}>
          <path
            d="M12 15V5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M8.5 8.5L12 5L15.5 8.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 15.5V17C5 18.1 5.9 19 7 19H17C18.1 19 19 18.1 19 17V15.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "calendar":
      return (
        <svg {...baseProps}>
          <rect
            x="4"
            y="5"
            width="16"
            height="15"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M8 3.8V6.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M16 3.8V6.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M4 9H20" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "palette":
      return (
        <svg {...baseProps}>
          <path
            d="M12 4C7.58 4 4 7.13 4 11C4 13.76 6.02 16 8.5 16H9.27C10.23 16 11 16.77 11 17.73C11 18.98 12.02 20 13.27 20H13.5C17.64 20 21 16.64 21 12.5C21 7.81 17.08 4 12 4Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="8" cy="11" r="1" fill="currentColor" />
          <circle cx="11" cy="8" r="1" fill="currentColor" />
          <circle cx="15" cy="8.5" r="1" fill="currentColor" />
          <circle cx="16.5" cy="12.5" r="1" fill="currentColor" />
        </svg>
      );
    case "settings":
      return (
        <svg {...baseProps}>
          <path
            d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M19.4 15A1 1 0 0 0 19.6 16.1L19.7 16.2A1 1 0 0 1 19.7 17.6L17.6 19.7A1 1 0 0 1 16.2 19.7L16.1 19.6A1 1 0 0 0 15 19.4A1 1 0 0 0 14.4 20.3V20.5A1 1 0 0 1 13.4 21.5H10.6A1 1 0 0 1 9.6 20.5V20.3A1 1 0 0 0 9 19.4A1 1 0 0 0 7.9 19.6L7.8 19.7A1 1 0 0 1 6.4 19.7L4.3 17.6A1 1 0 0 1 4.3 16.2L4.4 16.1A1 1 0 0 0 4.6 15A1 1 0 0 0 3.7 14.4H3.5A1 1 0 0 1 2.5 13.4V10.6A1 1 0 0 1 3.5 9.6H3.7A1 1 0 0 0 4.6 9A1 1 0 0 0 4.4 7.9L4.3 7.8A1 1 0 0 1 4.3 6.4L6.4 4.3A1 1 0 0 1 7.8 4.3L7.9 4.4A1 1 0 0 0 9 4.6A1 1 0 0 0 9.6 3.7V3.5A1 1 0 0 1 10.6 2.5H13.4A1 1 0 0 1 14.4 3.5V3.7A1 1 0 0 0 15 4.6A1 1 0 0 0 16.1 4.4L16.2 4.3A1 1 0 0 1 17.6 4.3L19.7 6.4A1 1 0 0 1 19.7 7.8L19.6 7.9A1 1 0 0 0 19.4 9A1 1 0 0 0 20.3 9.6H20.5A1 1 0 0 1 21.5 10.6V13.4A1 1 0 0 1 20.5 14.4H20.3A1 1 0 0 0 19.4 15Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "wrench":
      return (
        <svg {...baseProps}>
          <path
            d="M14.5 6.5A4 4 0 0 0 18 12L11 19L8 16L15 9A4 4 0 0 0 14.5 6.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M6 18L4 20"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "id-card":
      return (
        <svg {...baseProps}>
          <rect
            x="3.5"
            y="5"
            width="17"
            height="14"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle
            cx="9"
            cy="11"
            r="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M6.8 15C7.4 14 8.1 13.5 9 13.5C9.9 13.5 10.6 14 11.2 15"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M13.5 10H17.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M13.5 13H17.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "note":
      return (
        <svg {...baseProps}>
          <path
            d="M7 4.5H14.5L18 8V19.5H7C5.9 19.5 5 18.6 5 17.5V6.5C5 5.4 5.9 4.5 7 4.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M14 4.5V8H17.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 11H14.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M8.5 14H14.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "folder":
      return (
        <svg {...baseProps}>
          <path
            d="M4 8C4 6.9 4.9 6 6 6H9L10.5 7.5H18C19.1 7.5 20 8.4 20 9.5V17C20 18.1 19.1 19 18 19H6C4.9 19 4 18.1 4 17V8Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "map-pin":
      return (
        <svg {...baseProps}>
          <path
            d="M12 20C12 20 18 14.5 18 10A6 6 0 1 0 6 10C6 14.5 12 20 12 20Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle
            cx="12"
            cy="10"
            r="2"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "clock":
      return (
        <svg {...baseProps}>
          <circle
            cx="12"
            cy="12"
            r="8"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M12 8V12L14.5 14"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "message":
      return (
        <svg {...baseProps}>
          <path
            d="M6 17.5L4.5 19V7C4.5 5.9 5.4 5 6.5 5H17.5C18.6 5 19.5 5.9 19.5 7V14C19.5 15.1 18.6 16 17.5 16H7.5L6 17.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "box":
      return (
        <svg {...baseProps}>
          <path
            d="M12 3.5L19 7.5V16.5L12 20.5L5 16.5V7.5L12 3.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M5 7.5L12 11.5L19 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M12 11.5V20.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...baseProps}>
          <path
            d="M7 4.5H17V19.5L15 18L13 19.5L11 18L9 19.5L7 18V4.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 9H14.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M9.5 12H14.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case "check-circle":
      return (
        <svg {...baseProps}>
          <circle
            cx="12"
            cy="12"
            r="8"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M8.5 12.2L10.7 14.3L15.5 9.7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "activity":
      return (
        <svg {...baseProps}>
          <path
            d="M4 12H8L10 7L14 17L16 12H20"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "bell":
      return (
        <svg {...baseProps}>
          <path
            d="M8 18H16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M9 18C9.3 19.2 10.4 20 11.7 20H12.3C13.6 20 14.7 19.2 15 18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M18 15H6L7.2 13.4V10.5C7.2 7.74 9.44 5.5 12.2 5.5C14.96 5.5 17.2 7.74 17.2 10.5V13.4L18 15Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg {...baseProps}>
          <circle
            cx="12"
            cy="12"
            r="7"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      );
  }
}

export default function QuickAccessSidebar({
  appBadge,
  appName,
  appTagline,
  sections,
  profileName = "User",
  profileRole = "USER",
  profileInitials = "U",
  logoutLabel = "Logout",
  onSelectionChange,
}: QuickAccessSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const initialParentId = sections[0]?.id ?? "";
  const [openParentId, setOpenParentId] = useState(initialParentId);
  const [activeSubItemId, setActiveSubItemId] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [currentName, setCurrentName] = useState(profileName);
  const [currentRole, setCurrentRole] = useState(profileRole);
  const [currentInitials, setCurrentInitials] = useState(profileInitials);

  const filteredSections = useMemo(() => {
    const role = normalizeRole(currentRole || profileRole);
    const isSalesAdmin = role === "SALES_ADMIN";
    const isSalesManager = role === "SALES_MANAGER";
    const isPresalesManager = role === "PRESALES_MANAGER";
    const isSalesExecutive = role === "SALES_EXECUTIVE";
    const isPresalesExecutive = role === "PRESALES_EXECUTIVE";
    const isTerritoryDesignManager = role === "TERRITORY_DESIGN_MANAGER";
    const isDesignManager = role === "DESIGN_MANAGER";
    const isDesigner = role === "DESIGNER";
    const isDesignRole = isTerritoryDesignManager || isDesignManager || isDesigner;

    return sections
      .filter((section) => {
        if (isDesignRole) {
          return section.id === "design";
        }
        if (
          isSalesAdmin ||
          isSalesManager ||
          isPresalesManager ||
          isSalesExecutive ||
          isPresalesExecutive
        ) {
          return section.id === "crm";
        }
        return true;
      })
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.id === "design-create-user") return isTerritoryDesignManager || isDesignManager;
          if (item.id === "crm-sales-managers") return isSalesAdmin || isSalesManager;
          if (item.id === "crm-presales-executives") return isPresalesManager;
          if ((isSalesExecutive || isPresalesExecutive) && item.id === "crm-import-leads") return false;
          if ((isPresalesManager || isPresalesExecutive) && item.id === "crm-hub-calendar") return false;
          if (isSalesExecutive && item.id === "crm-presales-executives") return false;
          if (isPresalesExecutive && item.id === "crm-sales-managers") return false;
          return true;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [currentRole, profileRole, sections]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedName = window.localStorage.getItem(CRM_USER_NAME_STORAGE_KEY)?.trim();
    const storedRole = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY)?.trim();

    const roleName = roleDisplayName(storedRole || profileRole);
    const useRoleAsName =
      !storedName || normalizeRole(storedName) === "ADMIN" || normalizeRole(storedName) === "USER";
    const nextName = useRoleAsName && roleName ? roleName : storedName || profileName;
    const nextRole = storedRole || profileRole;
    const nextInitials =
      nextName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("") || profileInitials;

    setCurrentName(nextName);
    setCurrentRole(nextRole);
    setCurrentInitials(nextInitials);
  }, [profileInitials, profileName, profileRole]);

  // Set active item based on current pathname
  useEffect(() => {
    for (const section of filteredSections) {
      for (const item of section.items) {
        if (item.href && pathname.startsWith(item.href)) {
          if (section.id === "design" || section.id === "admin") {
            setActiveSubItemId("");
          } else {
            setActiveSubItemId(item.id);
          }
          setOpenParentId(section.id);
          return;
        }
      }
    }
  }, [filteredSections, pathname]);

  const openParent = useMemo(
    () =>
      filteredSections.find((section) => section.id === openParentId) ?? filteredSections[0],
    [filteredSections, openParentId],
  );

  useEffect(() => {
    if (!filteredSections.length) return;
    const hasOpenParent =
      openParentId === "" || filteredSections.some((s) => s.id === openParentId);
    if (!hasOpenParent) setOpenParentId(filteredSections[0].id);
    const hasActiveSub = filteredSections.some((s) =>
      s.items.some((i) => i.id === activeSubItemId),
    );
    if (activeSubItemId && !hasActiveSub) setActiveSubItemId("");
  }, [activeSubItemId, filteredSections, openParentId]);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!filteredSections.length || !openParent) {
      return;
    }
    const nextParent = openParent;
    const subItem = nextParent.items.find((item) => item.id === activeSubItemId);

    if (subItem) {
      onSelectionChange?.({ parent: nextParent, subItem });
    }
  }, [activeSubItemId, filteredSections, onSelectionChange, openParent]);

  const handleParentClick = (section: QuickAccessParentItem) => {
    if (isCollapsed) {
      setIsCollapsed(false);
    }
    if (!isMobileOpen && typeof window !== "undefined" && window.innerWidth < 1280) {
      setIsMobileOpen(true);
    }
    // Clicking anywhere on the parent tab toggles subtabs.
    if (openParentId === section.id) {
      setOpenParentId("");
    } else {
      setOpenParentId(section.id);
    }
  };

  const handleDropdownToggle = (section: QuickAccessParentItem) => {
    if (openParentId === section.id) {
      setOpenParentId("");
      return;
    }

    setOpenParentId(section.id);
    if (section.items[0]) {
      setActiveSubItemId(section.items[0].id);
    }
  };

  const handleSubItemClick = (item: QuickAccessSubItem) => {
    setActiveSubItemId(item.id);

    if (item.href) {
      if (/^https?:\/\//.test(item.href)) {
        window.location.href = item.href;
        return;
      }

      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return;
      }
      router.push(item.href);
    }
  };

  const handleLogoutClick = async () => {
    setLogoutBusy(true);
    try {
      const token = window.localStorage.getItem(CRM_TOKEN_STORAGE_KEY);
      if (token) {
        await apiLogout(token);
      }
    } finally {
      window.localStorage.removeItem(CRM_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(CRM_ROLE_STORAGE_KEY);
      window.localStorage.removeItem(CRM_USER_NAME_STORAGE_KEY);
      router.replace("/login");
      setLogoutBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="fixed bottom-5 left-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--crm-border-strong)] bg-[var(--crm-surface-elevated)] text-[var(--crm-text-primary)] shadow-[var(--crm-shadow-md)] backdrop-blur xl:hidden"
        aria-label="Open navigation"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
          <path d="M4 7H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M4 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M4 17H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm transition-opacity xl:hidden",
          isMobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsMobileOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen flex-col overflow-hidden border-r border-[var(--crm-border)] bg-[var(--crm-surface)] text-[var(--crm-text-primary)] shadow-[var(--crm-shadow-lg)] transition-all duration-300 ease-out xl:static xl:z-auto xl:translate-x-0",
          isCollapsed ? "xl:w-[72px]" : "xl:w-[320px]",
          isMobileOpen ? "translate-x-0 w-[min(88vw,360px)]" : "-translate-x-full w-[min(88vw,360px)]",
        )}
      >
        <div
          className={cn(
            "border-b border-[var(--crm-border)] transition-all duration-300",
            isCollapsed ? "px-1 py-2" : "px-2 py-1.5",
          )}
        >
          <div className="mb-4 flex items-center justify-between xl:hidden">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--crm-text-muted)]">
                {appBadge}
              </div>
              <div className="mt-1 text-lg font-bold tracking-[-0.04em] text-[var(--crm-text-primary)]">
                Navigation
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--crm-border-strong)] bg-[var(--crm-surface-elevated)] text-[var(--crm-text-secondary)]"
              aria-label="Close navigation"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path d="M6 6L18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              title={`${appName} ${appTagline}`.trim()}
              className={cn(
                "flex items-center justify-center overflow-hidden rounded-2xl transition-all duration-300",
                isCollapsed ? "h-[44px] w-[44px]" : "h-[112px] w-[112px]",
              )}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Image
                src="/logo-final-02.png"
                alt={`${appName} logo`}
                width={260}
                height={260}
                className={cn(
                  "object-contain transition-transform duration-300",
                  isCollapsed
                    ? "h-[78px] w-[78px] scale-[1.5]"
                    : "h-[220px] w-[220px] scale-[1.58]",
                )}
                priority
              />
            </button>
          </div>
        </div>

        <div
          className={cn(
            "flex-1 overflow-y-auto bg-[var(--crm-app-bg)] py-5 transition-all duration-300",
            isCollapsed ? "px-1.5" : "px-3 pt-3",
          )}
        >
          <div className="space-y-2.5">
            {filteredSections.map((section) => {
              const isOpen = section.id === openParentId;

              return (
                <div key={section.id} className="space-y-3">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleParentClick(section)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleParentClick(section);
                      }
                    }}
                    className={cn(
                      "flex w-full items-center rounded-[22px] border text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-all duration-200",
                      isCollapsed ? "justify-center px-0 py-3.5" : "gap-3 px-4 py-4",
                      isOpen
                        ? "border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)]"
                        : "border-[var(--crm-border)] bg-[var(--crm-surface)] hover:border-[var(--crm-border-strong)]",
                    )}
                  >
                    <button
                      type="button"
                      title={section.label}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--crm-accent-soft)] text-[var(--crm-accent)] transition-transform duration-200 hover:scale-[1.03]"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsCollapsed((prev) => {
                          const next = !prev;
                          if (prev) {
                            setOpenParentId(section.id);
                          }
                          return next;
                        });
                      }}
                    >
                      <SidebarIcon name={section.icon} className="h-5 w-5" />
                    </button>
                    {!isCollapsed ? (
                      <>
                        <div className="min-w-0 flex-1">
                          <div className="text-[1.15rem] font-extrabold tracking-[-0.04em] text-[var(--crm-text-primary)]">
                            {section.label}
                          </div>
                          <div className="mt-0.5 text-[0.7rem] font-medium uppercase tracking-[0.24em] text-[var(--crm-text-muted)]">
                            {section.subtitle}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {section.badge ? (
                            <span className="rounded-full bg-[var(--crm-danger-bg)] px-3 py-1 text-[0.72rem] font-bold text-[var(--crm-danger)]">
                              {section.badge}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDropdownToggle(section);
                            }}
                            aria-label={isOpen ? `Close ${section.label}` : `Open ${section.label}`}
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full bg-[var(--crm-surface-elevated)] text-[var(--crm-text-muted)] shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-all duration-200",
                              isOpen ? "rotate-180 text-[var(--crm-accent)]" : "",
                            )}
                          >
                            <svg
                              viewBox="0 0 20 20"
                              fill="none"
                              className="h-4 w-4"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M5 7.5L10 12.5L15 7.5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>

                  {!isCollapsed && isOpen && section.items.length > 0 ? (
                    <div className="space-y-2.5 px-2">
                      {section.items.map((item) => {
                        const isActive = item.id === activeSubItemId;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSubItemClick(item)}
                            className={cn(
                              "relative flex w-full items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition-all duration-200",
                              isActive
                                ? "border-[var(--crm-accent-ring)] bg-[var(--crm-surface-elevated)] shadow-[0_10px_24px_rgba(37,99,235,0.08)]"
                                : "border-[var(--crm-border)] bg-[var(--crm-surface)] opacity-85 hover:border-[var(--crm-border-strong)] hover:opacity-100",
                            )}
                          >
                            {isActive ? (
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute right-[2px] top-1/2 h-[64%] w-[4px] -translate-y-1/2 rounded-full bg-[var(--crm-accent)]"
                              />
                            ) : null}
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[var(--crm-accent-soft)] text-[var(--crm-accent)]">
                              <SidebarIcon name={item.icon} className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div
                                className={cn(
                                  "text-[1rem] font-semibold",
                                  isActive ? "text-[var(--crm-accent)]" : "text-[var(--crm-text-secondary)]",
                                )}
                              >
                                {item.label}
                              </div>
                              <div className="mt-0.5 text-[0.78rem] text-[var(--crm-text-muted)]">
                                {item.description}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={cn(
            "border-t border-[var(--crm-border)] transition-all duration-300",
            isCollapsed ? "px-1 py-3" : "px-3.5 py-3",
          )}
        >
          {!isCollapsed ? (
            <>
              <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-2.5 shadow-[var(--crm-shadow-sm)]">
                <div className="flex items-center gap-2.5 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-2.5 py-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--crm-accent-soft)] text-[0.76rem] font-bold text-[var(--crm-accent)] ring-1 ring-[var(--crm-accent-ring)]">
                    {currentInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[0.9rem] font-bold leading-tight text-[var(--crm-text-primary)]">
                      {currentName}
                    </div>
                    <div className="truncate text-[0.58rem] uppercase tracking-[0.08em] text-[var(--crm-text-muted)]">
                      {currentRole}
                    </div>
                  </div>
                  <div className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--crm-success)]" />
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <ThemeToggle className="h-10 w-full justify-center rounded-xl border-[var(--crm-border)] px-0 py-0" compact />
                  <button
                    type="button"
                    onClick={handleLogoutClick}
                    disabled={logoutBusy}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--crm-danger)] px-3 text-[0.82rem] font-semibold text-white shadow-[var(--crm-shadow-sm)] transition-transform duration-200 hover:-translate-y-px hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                      <path d="M14 7V5.5C14 4.67 13.33 4 12.5 4H7.5C6.67 4 6 4.67 6 5.5V18.5C6 19.33 6.67 20 7.5 20H12.5C13.33 20 14 19.33 14 18.5V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M10 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M17 8.5L20.5 12L17 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {logoutBusy ? "Signing..." : "Logout"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <ThemeToggle compact />
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--crm-border-strong)] bg-[var(--crm-accent-soft)] text-[0.74rem] font-bold text-[var(--crm-accent)] shadow-[var(--crm-shadow-sm)]"
                title={currentName}
              >
                {currentInitials}
              </div>
              <button
                type="button"
                onClick={handleLogoutClick}
                disabled={logoutBusy}
                title={logoutBusy ? "Signing out..." : logoutLabel}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--crm-danger)] text-white shadow-[var(--crm-shadow-sm)] transition-transform duration-200 hover:-translate-y-px hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" aria-hidden="true">
                  <path d="M14 7V5.5C14 4.67 13.33 4 12.5 4H7.5C6.67 4 6 4.67 6 5.5V18.5C6 19.33 6.67 20 7.5 20H12.5C13.33 20 14 19.33 14 18.5V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M10 12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M17 8.5L20.5 12L17 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
