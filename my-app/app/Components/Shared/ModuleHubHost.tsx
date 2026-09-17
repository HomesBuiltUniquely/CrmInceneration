"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import ModuleSwitcher from "./ModuleSwitcher";
import { useActiveModule } from "./ActiveModuleContext";

/** Routes that already mount ModuleSwitcher in the page header (via AppTopBar). */
const HEADER_SWITCHER_PATHS = [
  "/",
  "/Leads",
  "/presales-leads",
  "/presales-dashboard",
  "/design-dashboard",
  "/appointment",
  "/admin-panel",
  "/admin",
  "/super-admin",
  "/sales-manager",
  "/create-lead",
  "/import-leads",
  "/booking-token",
  "/incentives",
  "/Insights",
  "/google-calendar",
  "/schedule-hub-meeting",
];

function pathHasHeaderSwitcher(pathname: string): boolean {
  const path = (pathname ?? "").split("?")[0]?.split("#")[0] ?? "/";
  return HEADER_SWITCHER_PATHS.some(
    (base) => path === base || (base !== "/" && path.startsWith(`${base}/`)),
  );
}

/**
 * Fallback picker for pages without a header ModuleSwitcher.
 * Sidebar stays hidden until a module is chosen.
 */
export default function ModuleHubHost() {
  const pathname = usePathname();
  const { activeModuleId, hydrated } = useActiveModule();
  const [headerHasSwitcher, setHeaderHasSwitcher] = useState(() =>
    pathHasHeaderSwitcher(pathname),
  );

  useEffect(() => {
    if (pathHasHeaderSwitcher(pathname)) {
      setHeaderHasSwitcher(true);
      return;
    }
    setHeaderHasSwitcher(Boolean(document.querySelector("[data-app-topbar]")));
  }, [pathname]);

  if (!hydrated || activeModuleId) return null;
  if (pathname === "/login" || pathname.startsWith("/login/")) return null;
  if (headerHasSwitcher) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] sm:right-6 sm:top-5">
      <div className="pointer-events-auto">
        <ModuleSwitcher />
      </div>
    </div>
  );
}
