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

export type CrmModuleId = "crm" | "presales" | "design" | "admin";

export const CRM_ACTIVE_MODULE_KEY = "crm_active_module";

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

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CRM_ACTIVE_MODULE_KEY);
      if (isCrmModuleId(stored)) setActiveModuleIdState(stored);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

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
