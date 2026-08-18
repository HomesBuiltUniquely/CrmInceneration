"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CRM_ROLE_STORAGE_KEY } from "@/lib/auth/api";
import { isAdminRole } from "@/lib/roleUtils";
import { cn } from "@/lib/cn";
import { dashboardSidebarSections } from "./sidebar-data";
import {
  useActiveModule,
  type CrmModuleId,
} from "./ActiveModuleContext";
import type { QuickAccessParentItem } from "./QuickAccessSidebar";
import {
  appIconTileClass,
  CrmSidebarIcon,
  isModuleTileIcon,
} from "./CrmSidebarIcons";
import { useSmoothRouter } from "@/lib/use-smooth-router";

function normalizeRole(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "PRE_SALES") return "PRESALES_EXECUTIVE";
  if (normalized === "PRE_SALES_MANAGER") return "PRESALES_MANAGER";
  return normalized;
}

function modulesForRole(roleRaw: string): QuickAccessParentItem[] {
  const role = normalizeRole(roleRaw);
  const isSalesAdmin = role === "SALES_ADMIN";
  const isSalesManager = role === "SALES_MANAGER";
  const isPresalesManager = role === "PRESALES_MANAGER";
  const isSalesExecutive = role === "SALES_EXECUTIVE";
  const isPresalesExecutive = role === "PRESALES_EXECUTIVE";
  const isTerritoryDesignManager = role === "TERRITORY_DESIGN_MANAGER";
  const isDesignManager = role === "DESIGN_MANAGER";
  const isDesigner = role === "DESIGNER";
  const isDesignRole = isTerritoryDesignManager || isDesignManager || isDesigner;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isHubAdmin = isAdminRole(role) || role === "SALES_ADMIN";

  return dashboardSidebarSections.filter((section) => {
    if (section.id === "presales") {
      return isSuperAdmin || isHubAdmin || isPresalesManager || isPresalesExecutive;
    }
    if (isDesignRole) return section.id === "design";
    if (isPresalesManager || isPresalesExecutive) return section.id === "presales";
    if (isSalesAdmin || isSalesManager || isSalesExecutive) return section.id === "crm";
    return true;
  });
}

function firstHrefForModule(section: QuickAccessParentItem, roleRaw: string): string | undefined {
  const role = normalizeRole(roleRaw);
  const isSalesExecutive = role === "SALES_EXECUTIVE";

  // CRM / Presales open My Leads by default (not Dashboard).
  if (section.id === "crm") {
    const myLeads = section.items.find((item) => item.id === "crm-my-leads" && item.href);
    if (myLeads?.href) return myLeads.href;
  }
  if (section.id === "presales") {
    const myLeads = section.items.find((item) => item.id === "presales-my-leads" && item.href);
    if (myLeads?.href) return myLeads.href;
  }

  for (const item of section.items) {
    if (!item.href) continue;
    if (isSalesExecutive && item.id === "crm-dashboard") continue;
    return item.href;
  }
  return undefined;
}

/** Parent module → user-provided Hows tiles. */
function resolveModuleIcon(moduleId: string): string {
  const map: Record<string, string> = {
    presales: "hows-presales",
    design: "hows-design",
    crm: "hows-crm",
    admin: "hows-admin",
  };
  return map[moduleId] ?? "layout-dashboard";
}

/** Same 4-tile launcher mark as icon-branch AppsLauncherMenu. */
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

type ModuleSwitcherProps = {
  /** When true, show compact Apps button even if a module is already selected. */
  forceCompact?: boolean;
  className?: string;
};

export default function ModuleSwitcher({ forceCompact = false, className }: ModuleSwitcherProps) {
  const router = useSmoothRouter();
  const { activeModuleId, setActiveModuleId, hydrated } = useActiveModule();
  const [open, setOpen] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [role, setRole] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "");
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!activeModuleId) setOpen(true);
  }, [activeModuleId, hydrated]);

  useEffect(() => {
    if (!open) {
      setPanelVisible(false);
      return;
    }
    const frame = requestAnimationFrame(() => setPanelVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(event.target as Node)) return;
      if (!activeModuleId) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && activeModuleId) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [activeModuleId, open]);

  const modules = useMemo(() => modulesForRole(role), [role]);

  const handleSelect = (section: QuickAccessParentItem) => {
    const id = section.id as CrmModuleId;
    setActiveModuleId(id);
    setOpen(false);
    const href = firstHrefForModule(section, role);
    if (href) router.push(href);
  };

  const showAsHubTrigger = !activeModuleId;
  const showCompact = Boolean(activeModuleId) || forceCompact;

  if (!hydrated) {
    return (
      <div
        className={cn(
          "h-11 w-11 animate-pulse rounded-full bg-[var(--crm-surface-subtle)]",
          className,
        )}
      />
    );
  }

  return (
    <div className={cn("relative", className)} ref={panelRef}>
      {(showAsHubTrigger || showCompact) && (
        <button
          type="button"
          aria-label="Open apps menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
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
      )}

      {open ? (
        <div
          className={cn(
            "absolute right-0 top-[calc(100%+6px)] z-[80] origin-top-right overflow-visible rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface-elevated)] px-1.5 py-1.5 shadow-[0_12px_28px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03] backdrop-blur-[8px] transition-all duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
            !activeModuleId &&
              "fixed left-1/2 top-20 z-[90] -translate-x-1/2 sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+8px)] sm:translate-x-0",
            panelVisible
              ? "translate-y-0 scale-100 opacity-100"
              : "pointer-events-none -translate-y-2 scale-[0.96] opacity-0",
          )}
          role="dialog"
          aria-label="Hows modules"
        >
          <div className="flex items-center gap-1">
            {modules.map((section, index) => {
              const isActive = section.id === activeModuleId;
              const iconName = resolveModuleIcon(section.id);
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => handleSelect(section)}
                  title={section.label}
                  aria-label={section.label}
                  className={cn(
                    "group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] border transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                    isActive
                      ? "border-[#93c5fd] bg-[#eff6ff] shadow-[0_4px_12px_rgba(37,99,235,0.14)]"
                      : "border-transparent bg-transparent hover:-translate-y-px hover:border-[#bfdbfe] hover:bg-[#eff6ff] hover:shadow-[0_6px_14px_rgba(37,99,235,0.12)]",
                    panelVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
                  )}
                  style={{ transitionDelay: `${index * 18}ms` }}
                >
                  <div
                    className={cn(
                      "flex h-[34px] w-[34px] items-center justify-center overflow-hidden rounded-[10px] transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.06]",
                      isModuleTileIcon(iconName) ? "rounded-tr-[18px] bg-transparent" : appIconTileClass(iconName, isActive),
                    )}
                  >
                    <CrmSidebarIcon
                      name={iconName}
                      className={isModuleTileIcon(iconName) ? "h-[34px] w-[34px]" : "h-[20px] w-[20px]"}
                    />
                  </div>
                  <span className="pointer-events-none absolute -bottom-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#111827] px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
                    {section.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
