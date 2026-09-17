"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CRM_ROLE_STORAGE_KEY,
  CRM_TOKEN_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
  logout as apiLogout,
} from "@/lib/auth/api";
import {
  canAccessBookingTokenDashboard,
  canAccessCrmInsights,
  isAdminRole,
} from "@/lib/roleUtils";
import { cn } from "@/lib/cn";
import ThemeToggle from "./ThemeToggle";
import { useOptionalActiveModule } from "./ActiveModuleContext";
import { useSmoothRouter } from "@/lib/use-smooth-router";
import { CrmSidebarIcon as ClassicSidebarIcon } from "./CrmSidebarIcons";

const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";
const EXPAND_MS = 300;

function pathnameMatchesSidebarHref(pathname: string, href: string): boolean {
  const path = (pathname ?? "").split("?")[0]?.split("#")[0] ?? "/";
  const base = href.trim();
  if (!base) return false;
  if (base === "/") return path === "/" || path === "";
  const normPath = path.toLowerCase();
  const normBase = base.toLowerCase();
  return normPath === normBase || normPath.startsWith(`${normBase}/`);
}

function sidebarHrefMatchLength(href: string): number {
  return href.trim() === "/" ? 1 : href.trim().length;
}

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
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "PRE_SALES") return "PRESALES_EXECUTIVE";
  if (normalized === "PRE_SALES_MANAGER") return "PRESALES_MANAGER";
  return normalized;
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

function useTouchDevice(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    setTouch(mq.matches);
    const handler = (e: MediaQueryListEvent) => setTouch(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return touch;
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
  const router = useSmoothRouter();
  const pathname = usePathname();
  const activeModule = useOptionalActiveModule();
  const activeModuleId = activeModule?.activeModuleId ?? null;
  const moduleHydrated = activeModule?.hydrated ?? true;
  const clearActiveModule = activeModule?.clearActiveModule;
  const initialParentId = sections[0]?.id ?? "";
  const [openParentId, setOpenParentId] = useState(initialParentId);
  const [activeSubItemId, setActiveSubItemId] = useState("");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [currentName, setCurrentName] = useState(profileName);
  const [currentRole, setCurrentRole] = useState(profileRole);
  const [currentInitials, setCurrentInitials] = useState(profileInitials);

  const [hovered, setHovered] = useState(false);
  const isTouch = useTouchDevice();
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCollapsed = !hovered;

  const handleMouseEnter = useCallback(() => {
    if (collapseTimer.current) { clearTimeout(collapseTimer.current); collapseTimer.current = null; }
    setHovered(true);
  }, []);
  const handleMouseLeave = useCallback(() => { setHovered(false); }, []);
  const scheduleCollapse = useCallback(() => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => { setHovered(false); collapseTimer.current = null; }, 180);
  }, []);

  useEffect(() => { setHovered(false); setIsMobileOpen(false); }, [pathname]);
  useEffect(() => () => { if (collapseTimer.current) clearTimeout(collapseTimer.current); }, []);

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
    const isSuperAdmin = role === "SUPER_ADMIN";
    const isHubAdmin = isAdminRole(role) || role === "SALES_ADMIN";

    return sections
      .filter((section) => {
        if (activeModuleId && section.id !== activeModuleId) return false;
        if (section.id === "presales") return isSuperAdmin || isHubAdmin || isPresalesManager || isPresalesExecutive;
        if (isDesignRole) return section.id === "design";
        if (isPresalesManager || isPresalesExecutive) return section.id === "presales";
        if (isSalesAdmin || isSalesManager || isSalesExecutive) return section.id === "crm";
        return true;
      })
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.id === "design-create-user") return (normalizeRole(currentRole || profileRole) === "TERRITORY_DESIGN_MANAGER") || (normalizeRole(currentRole || profileRole) === "DESIGN_MANAGER");
          if (item.id === "crm-sales-managers") return isSalesAdmin || isSalesManager;
          if (item.id === "crm-presales-executives") return isPresalesManager;
          if (isSalesExecutive && item.id === "crm-dashboard") return false;
          if ((isSalesExecutive || isPresalesExecutive) && item.id === "crm-import-leads") return false;
          if ((isPresalesManager || isPresalesExecutive) && item.id === "crm-hub-calendar") return false;
          if (isSalesExecutive && item.id === "crm-presales-executives") return false;
          if (isPresalesExecutive && item.id === "crm-sales-managers") return false;
          if (item.id === "crm-booking-token") return canAccessBookingTokenDashboard(currentRole || profileRole);
          if (item.id === "crm-insights") return canAccessCrmInsights(currentRole || profileRole);
          return true;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [activeModuleId, currentRole, profileRole, sections]);

  const hideSidebar = Boolean(activeModule) && moduleHydrated && !activeModuleId;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedName = window.localStorage.getItem(CRM_USER_NAME_STORAGE_KEY)?.trim();
    const storedRole = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY)?.trim();
    const roleName = roleDisplayName(storedRole || profileRole);
    const useRoleAsName = !storedName || normalizeRole(storedName) === "ADMIN" || normalizeRole(storedName) === "USER";
    const nextName = useRoleAsName && roleName ? roleName : storedName || profileName;
    const nextRole = storedRole || profileRole;
    const nextInitials = nextName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || profileInitials;
    setCurrentName(nextName);
    setCurrentRole(nextRole);
    setCurrentInitials(nextInitials);
  }, [profileInitials, profileName, profileRole]);

  useEffect(() => {
    let best: { sectionId: string; itemId: string; matchLen: number } | null = null;
    for (const section of filteredSections) {
      for (const item of section.items) {
        if (!item.href || !pathnameMatchesSidebarHref(pathname, item.href)) continue;
        const matchLen = sidebarHrefMatchLength(item.href);
        if (!best || matchLen > best.matchLen) best = { sectionId: section.id, itemId: item.id, matchLen };
      }
    }
    if (!best) return;
    if (best.sectionId === "design" || best.sectionId === "admin") setActiveSubItemId("");
    else setActiveSubItemId(best.itemId);
    setOpenParentId(best.sectionId);
  }, [filteredSections, pathname]);

  const openParent = useMemo(
    () => filteredSections.find((s) => s.id === openParentId) ?? filteredSections[0],
    [filteredSections, openParentId],
  );

  useEffect(() => {
    if (!filteredSections.length) return;
    if (openParentId === "" || !filteredSections.some((s) => s.id === openParentId)) setOpenParentId(filteredSections[0].id);
    if (activeSubItemId && !filteredSections.some((s) => s.items.some((i) => i.id === activeSubItemId))) setActiveSubItemId("");
  }, [activeSubItemId, filteredSections, openParentId]);

  useEffect(() => { if (activeModuleId) setOpenParentId(activeModuleId); }, [activeModuleId]);
  useEffect(() => {
    if (!filteredSections.length || !openParent) return;
    const sub = openParent.items.find((i) => i.id === activeSubItemId);
    if (sub) onSelectionChange?.({ parent: openParent, subItem: sub });
  }, [activeSubItemId, filteredSections, onSelectionChange, openParent]);

  const handleParentClick = (section: QuickAccessParentItem) => {
    if (isCollapsed) setHovered(true);
    if (!isMobileOpen && typeof window !== "undefined" && window.innerWidth < 1280) setIsMobileOpen(true);
    setOpenParentId(openParentId === section.id ? "" : section.id);
  };
  const handleDropdownToggle = (section: QuickAccessParentItem) => {
    if (openParentId === section.id) { setOpenParentId(""); return; }
    setOpenParentId(section.id);
    if (section.items[0]) setActiveSubItemId(section.items[0].id);
  };
  const handleSubItemClick = (item: QuickAccessSubItem) => {
    setActiveSubItemId(item.id);
    if (!item.href) return;
    if (/^https?:\/\//.test(item.href)) { window.location.href = item.href; return; }
    if (pathnameMatchesSidebarHref(pathname, item.href)) { scheduleCollapse(); return; }
    router.push(item.href);
    scheduleCollapse();
  };
  const handleLogoutClick = async () => {
    setLogoutBusy(true);
    try { const t = window.localStorage.getItem(CRM_TOKEN_STORAGE_KEY); if (t) await apiLogout(t); }
    finally {
      window.localStorage.removeItem(CRM_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(CRM_ROLE_STORAGE_KEY);
      window.localStorage.removeItem(CRM_USER_NAME_STORAGE_KEY);
      clearActiveModule?.();
      router.replace("/login");
      setLogoutBusy(false);
    }
  };
  const handleSwitchModules = () => { clearActiveModule?.(); setIsMobileOpen(false); };

  if (hideSidebar) return null;

  const moduleMode = Boolean(activeModuleId);
  const activeModuleSection = moduleMode ? filteredSections.find((s) => s.id === activeModuleId) ?? filteredSections[0] : null;

  const sidebarTransition = `width ${EXPAND_MS}ms ${SPRING}, box-shadow ${EXPAND_MS}ms ${SPRING}`;

  return (
    <>
      {/* Mobile hamburger */}
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

      {/* Mobile backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm transition-opacity xl:hidden",
          isMobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsMobileOpen(false)}
        aria-hidden="true"
      />

      <aside
        onMouseEnter={isTouch ? undefined : handleMouseEnter}
        onMouseLeave={isTouch ? undefined : handleMouseLeave}
        {...(isTouch ? { onClick: () => setHovered((v) => !v) } : {})}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen flex-col overflow-hidden border-r border-[var(--crm-border)] bg-[var(--crm-surface)] text-[var(--crm-text-primary)] shadow-[var(--crm-shadow-lg)] xl:static xl:z-auto xl:h-full xl:min-h-0 xl:translate-x-0",
          isCollapsed ? "xl:w-[68px]" : "xl:w-[286px]",
          isMobileOpen ? "translate-x-0 w-[min(84vw,320px)]" : "-translate-x-full w-[min(84vw,320px)]",
        )}
        style={{ transition: sidebarTransition, willChange: "width" }}
      >
        {/* Header / Logo — ORIGINAL DESIGN */}
        <div
          className={cn(
            "border-b border-[var(--crm-border)] transition-all ease-[cubic-bezier(0.32,0.72,0,1)]",
            isCollapsed ? "px-1 py-2" : "px-3 py-2.5",
          )}
          style={{ transitionDuration: `${EXPAND_MS}ms` }}
        >
          <div className="mb-4 flex items-center justify-between xl:hidden">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--crm-text-muted)]">{appBadge}</div>
              <div className="mt-1 text-lg font-bold tracking-[-0.04em] text-[var(--crm-text-primary)]">Navigation</div>
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

          <div
            className={cn(
              "flex items-center",
              isCollapsed ? "justify-center px-0 py-1" : "min-h-[68px] justify-start gap-0",
            )}
            style={{ transition: `all ${EXPAND_MS}ms ${SPRING}` }}
          >
            <button
              type="button"
              title="Hows ERP"
              className={cn(
                "flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-transparent",
                isCollapsed ? "h-[42px] w-[42px]" : "h-[52px] w-[52px]",
              )}
              style={{ transition: `all ${EXPAND_MS}ms ${SPRING}` }}
              aria-label="Hows ERP"
            >
              <Image
                src="/logo-final-02.png"
                alt="Hows ERP logo"
                width={260}
                height={260}
                className={cn(
                  "object-contain",
                  isCollapsed ? "h-[78px] w-[78px] scale-[1.5]" : "h-[168px] w-[168px] scale-[2.15]",
                )}
                style={{ transition: `all ${EXPAND_MS}ms ${SPRING}` }}
                priority
              />
            </button>
            {!isCollapsed ? (
              <div className="ml-2 min-w-0 truncate text-[17px] font-bold leading-none tracking-[-0.02em] text-[var(--crm-text-primary)] [text-shadow:none]">
                Hows ERP
              </div>
            ) : null}
          </div>
        </div>

        {/* Nav items — ORIGINAL DESIGN */}
        <div
          className={cn(
            "flex-1 overflow-y-auto bg-[var(--crm-app-bg)] py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            isCollapsed ? "px-1.5" : "px-2.5 pt-2",
          )}
          style={{ transition: `all ${EXPAND_MS}ms ${SPRING}` }}
        >
          <div className="space-y-1">
            {moduleMode && activeModuleSection ? (
              <>
                {!isCollapsed ? (
                  <div className="mb-2 px-1 pb-2">
                    <div className="flex w-full items-center gap-2.5 rounded-xl border border-black/10 bg-white/70 px-2.5 py-2 text-left shadow-[0_2px_10px_rgba(0,0,0,0.12)] backdrop-blur-[6px]">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-black/70">
                        <ClassicSidebarIcon name="grid" className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40">All modules</span>
                        <span className="block truncate text-[15px] font-semibold leading-tight text-black">{activeModuleSection.label}</span>
                      </span>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-black/70" fill="none" aria-hidden="true">
                        <path d="M10 7.2L14.8 12L10 16.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className="mb-2 flex justify-center pb-2" title={activeModuleSection.label}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white/70 text-black/70 shadow-[0_2px_10px_rgba(0,0,0,0.12)] backdrop-blur-[6px]">
                      <ClassicSidebarIcon name="grid" className="h-[18px] w-[18px]" />
                    </div>
                  </div>
                )}

                <div className={cn("space-y-0.5", !isCollapsed && "px-1")}>
                  {activeModuleSection.items.map((item) => {
                    const isActive = item.id === activeSubItemId;
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "relative flex items-center transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5",
                          isCollapsed ? "justify-center" : "gap-0.5",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleSubItemClick(item)}
                          title={isCollapsed ? item.label : undefined}
                          className={cn(
                            "group relative flex w-full items-center gap-3 rounded-xl text-left transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                            isCollapsed ? "justify-center px-0 py-1.5" : "min-h-[2.25rem] px-2.5 py-1.5",
                            isActive
                              ? "bg-[linear-gradient(135deg,#dbe9ff_0%,#cddfff_100%)] text-[#274690] ring-1 ring-[#c4d8ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                              : "text-[#374151] hover:bg-[#eef2f7] hover:shadow-[0_6px_14px_rgba(15,23,42,0.06)]",
                          )}
                        >
                          {isActive && !isCollapsed ? (
                            <span aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#5b8def] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]" />
                          ) : null}
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-300",
                              isActive ? "bg-white/45 text-[#4b74d8]" : "bg-transparent text-black group-hover:text-[#111827]",
                            )}
                          >
                            <ClassicSidebarIcon name={item.icon} className="h-5 w-5" />
                          </div>
                          {!isCollapsed ? (
                            <div className="min-w-0 flex-1 pr-5">
                              <div className={cn("truncate text-[0.92rem] font-semibold leading-tight", isActive ? "text-[#274690]" : "text-[#374151]")}>
                                {item.label}
                              </div>
                            </div>
                          ) : null}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              filteredSections.map((section) => {
                const isOpen = section.id === openParentId;
                return (
                  <div key={section.id} className="space-y-2">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleParentClick(section)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleParentClick(section); } }}
                      className={cn(
                        "flex w-full rounded-xl border text-left transition-all duration-200",
                        isCollapsed ? "items-center justify-center px-0 py-3" : "min-h-[2.8rem] items-center gap-2.5 px-2.5 py-2",
                        isOpen ? "border-[#c1cad8] bg-[#e8edf5]" : "border-[var(--crm-border)] bg-[var(--crm-surface)] hover:bg-[#eef2f7]",
                      )}
                    >
                      <button
                        type="button"
                        title={section.label}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edf1f6] text-[#4b5563] transition-transform duration-200 hover:scale-[1.03]"
                        onClick={(e) => { e.stopPropagation(); }}
                      >
                        <ClassicSidebarIcon name={section.icon} className="h-[21px] w-[21px]" />
                      </button>
                      {!isCollapsed ? (
                        <>
                          <div className="min-w-0 flex-1">
                            <div className="text-[0.95rem] font-semibold leading-tight text-[var(--crm-text-primary)]">{section.label}</div>
                            <div className="mt-0.5 line-clamp-1 text-[0.67rem] font-medium leading-snug text-[var(--crm-text-muted)]">{section.subtitle}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {section.badge ? (
                              <span className="rounded-full bg-[var(--crm-danger-bg)] px-3 py-1 text-[0.72rem] font-bold text-[var(--crm-danger)]">{section.badge}</span>
                            ) : null}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDropdownToggle(section); }}
                              aria-label={isOpen ? `Close ${section.label}` : `Open ${section.label}`}
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-full bg-[var(--crm-surface-elevated)] text-[#6b7280] transition-all duration-200",
                                isOpen ? "rotate-180 text-[#111827]" : "",
                              )}
                            >
                              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>

                    {!isCollapsed && isOpen && section.items.length > 0 ? (
                      <div className="space-y-1 px-2">
                        {section.items.map((item) => {
                          const isActive = item.id === activeSubItemId;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSubItemClick(item)}
                              className={cn(
                                "group relative flex w-full min-h-[2.2rem] items-center gap-3 rounded-xl px-2.5 py-1.5 text-left transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5",
                                isActive
                                  ? "bg-[linear-gradient(135deg,#dbe9ff_0%,#cddfff_100%)] text-[#274690] ring-1 ring-[#c4d8ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                                  : "text-[#374151] hover:bg-[#eef2f7] hover:shadow-[0_6px_14px_rgba(15,23,42,0.06)]",
                              )}
                            >
                              {isActive ? <span aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#5b8def]" /> : null}
                              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-300", isActive ? "bg-white/45 text-[#4b74d8]" : "bg-transparent text-[#4b5563] group-hover:text-[#111827]")}>
                                <ClassicSidebarIcon name={item.icon} className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1 pr-5">
                                <div className={cn("truncate text-[0.92rem] font-semibold leading-tight", isActive ? "text-[#274690]" : "text-[#374151]")}>{item.label}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer — ORIGINAL DESIGN */}
        <div
          className={cn(
            "border-t border-[var(--crm-border)]",
            isCollapsed ? "px-1 py-2" : "px-3 py-2",
          )}
          style={{ transition: `all ${EXPAND_MS}ms ${SPRING}` }}
        >
          {!isCollapsed ? (
            <>
              <div className="hidden rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-2 shadow-[var(--crm-shadow-sm)] min-[900px]:block">
                <div className="flex items-center gap-2 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-2 py-1.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--crm-accent-soft)] text-[0.72rem] font-bold text-[var(--crm-accent)] ring-1 ring-[var(--crm-accent-ring)]">{currentInitials}</div>
                  <div className="min-w-0">
                    <div className="truncate text-[0.9rem] font-bold leading-tight text-[var(--crm-text-primary)]">{currentName}</div>
                    <div className="truncate text-[0.58rem] uppercase tracking-[0.08em] text-[var(--crm-text-muted)]">{currentRole}</div>
                  </div>
                  <div className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--crm-success)]" />
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <ThemeToggle className="h-9 w-full justify-center rounded-xl border-[var(--crm-border)] px-0 py-0" compact />
                  <button
                    type="button"
                    onClick={handleLogoutClick}
                    disabled={logoutBusy}
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[var(--crm-danger)] px-3 text-[0.78rem] font-semibold text-white shadow-[var(--crm-shadow-sm)] transition-transform duration-200 hover:-translate-y-px hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="min-[900px]:hidden">
                <div className="flex items-center justify-center gap-2">
                  <ThemeToggle className="h-8 w-8 justify-center rounded-lg border-[var(--crm-border)] px-0 py-0" compact />
                  <button type="button" onClick={handleLogoutClick} disabled={logoutBusy} className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--crm-danger)] px-3 text-[0.72rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{logoutBusy ? "Signing..." : "Logout"}</button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-1">
              <ThemeToggle compact />
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--crm-accent-soft)] text-[0.74rem] font-bold text-[var(--crm-accent)] ring-1 ring-[var(--crm-accent-ring)]" title={currentName}>{currentInitials}</div>
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
