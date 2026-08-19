"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  CRM_ACTIVE_MODULE_KEY,
  CRM_ROLE_STORAGE_KEY,
  defaultModuleByRole,
} from "@/lib/auth/api";

export type CrmModuleId = "crm" | "presales" | "design" | "admin";

/** Derive the correct sidebar module from the current pathname. */
function moduleFromPathname(pathname: string): CrmModuleId | null {
  const p = (pathname ?? "").toLowerCase();
  if (p === "/presales-leads" || p.startsWith("/presales-leads/")) return "presales";
  if (p === "/presales-dashboard" || p.startsWith("/presales-dashboard/")) return "presales";
  if (p === "/design-dashboard" || p.startsWith("/design-dashboard/")) return "design";
  if (p === "/appointment" || p.startsWith("/appointment/")) return "design";
  if (
    p === "/leads" ||
    p.startsWith("/leads/") ||
    p === "/" ||
    p === "/create-lead" ||
    p.startsWith("/create-lead/") ||
    p === "/import-leads" ||
    p.startsWith("/import-leads/") ||
    p === "/google-calendar" ||
    p.startsWith("/google-calendar/") ||
    p === "/admin-panel" ||
    p.startsWith("/admin-panel/") ||
    p === "/booking-token" ||
    p.startsWith("/booking-token/") ||
    p === "/insights" ||
    p.startsWith("/insights/") ||
    p === "/incentives" ||
    p.startsWith("/incentives/") ||
    p === "/admin" ||
    p.startsWith("/admin/") ||
    p === "/super-admin" ||
    p.startsWith("/super-admin/") ||
    p === "/sales-manager" ||
    p.startsWith("/sales-manager/")
  ) {
    return "crm";
  }
  return null;
}

type ActiveModuleContextValue = {
  /** null = hub mode: no module chosen, sidebar hidden */
  activeModuleId: CrmModuleId | null;
  setActiveModuleId: (id: CrmModuleId | null) => void;
  clearActiveModule: () => void;
  hydrated: boolean;
};

const ActiveModuleContext = createContext<ActiveModuleContextValue | null>(null);

function isCrmModuleId(value: string | null): value is CrmModuleId {
  return value === "crm" || value === "presales" || value === "design" || value === "admin";
}

export function ActiveModuleProvider({ children }: { children: ReactNode }) {
  const [activeModuleId, setActiveModuleIdState] = useState<CrmModuleId | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CRM_ACTIVE_MODULE_KEY);
      if (isCrmModuleId(stored)) {
        setActiveModuleIdState(stored);
      } else {
        const role = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
        const fallbackModule = defaultModuleByRole(role);
        if (fallbackModule && isCrmModuleId(fallbackModule)) {
          setActiveModuleIdState(fallbackModule);
          window.localStorage.setItem(CRM_ACTIVE_MODULE_KEY, fallbackModule);
        }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Auto-sync module to current pathname so sidebar matches the page.
  useEffect(() => {
    if (!hydrated) return;
    if (pathname === "/login" || pathname.startsWith("/login/")) return;
    const fromPath = moduleFromPathname(pathname);
    if (fromPath && fromPath !== activeModuleId) {
      setActiveModuleIdState(fromPath);
      try {
        window.localStorage.setItem(CRM_ACTIVE_MODULE_KEY, fromPath);
      } catch { /* ignore */ }
    }
  }, [pathname, hydrated, activeModuleId]);

  const setActiveModuleId = useCallback((id: CrmModuleId | null) => {
    setActiveModuleIdState(id);
    try {
      if (id) window.localStorage.setItem(CRM_ACTIVE_MODULE_KEY, id);
      else window.localStorage.removeItem(CRM_ACTIVE_MODULE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const clearActiveModule = useCallback(() => {
    setActiveModuleId(null);
  }, [setActiveModuleId]);

  const value = useMemo(
    () => ({
      activeModuleId,
      setActiveModuleId,
      clearActiveModule,
      hydrated,
    }),
    [activeModuleId, clearActiveModule, hydrated, setActiveModuleId],
  );

  return (
    <ActiveModuleContext.Provider value={value}>{children}</ActiveModuleContext.Provider>
  );
}

export function useActiveModule(): ActiveModuleContextValue {
  const ctx = useContext(ActiveModuleContext);
  if (!ctx) {
    throw new Error("useActiveModule must be used within ActiveModuleProvider");
  }
  return ctx;
}

/** Safe when provider may be missing (e.g. login). */
export function useOptionalActiveModule(): ActiveModuleContextValue | null {
  return useContext(ActiveModuleContext);
}
