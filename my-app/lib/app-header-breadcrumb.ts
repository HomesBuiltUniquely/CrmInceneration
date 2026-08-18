import type { CrmModuleId } from "@/app/Components/Shared/ActiveModuleContext";
import { dashboardSidebarSections } from "@/app/Components/Shared/sidebar-data";
import {
  pathnameMatchesSidebarHref,
  sidebarHrefMatchLength,
} from "@/app/Components/Shared/sidebar-utils";

const MODULE_PREFIX: Record<CrmModuleId, string> = {
  crm: "Hows crm",
  presales: "Hows presales",
  design: "Hows design",
  admin: "Hows admin",
};

/** User-facing labels for list pages. */
const PAGE_LABEL_OVERRIDES: Record<string, string> = {
  "/Leads": "Lead Managment",
  "/presales-leads": "Lead Managment",
};

function normalizePath(pathname: string): string {
  return (pathname ?? "").split("?")[0]?.split("#")[0] ?? "/";
}

export function inferModuleFromPathname(pathname: string): CrmModuleId {
  const path = normalizePath(pathname).toLowerCase();
  if (path === "/presales-leads" || path.startsWith("/presales-leads/")) return "presales";
  if (path === "/presales-dashboard" || path.startsWith("/presales-dashboard/")) return "presales";
  if (path === "/design-dashboard" || path.startsWith("/design-dashboard/")) return "design";
  if (path === "/appointment" || path.startsWith("/appointment/")) return "design";
  if (path === "/admin-panel" || path.startsWith("/admin-panel/")) return "admin";
  return "crm";
}

export function resolvePageLabel(
  pathname: string,
  moduleId: CrmModuleId | null,
): string {
  const path = normalizePath(pathname);

  if (PAGE_LABEL_OVERRIDES[path]) return PAGE_LABEL_OVERRIDES[path];
  if (path.startsWith("/Leads/") || path.startsWith("/presales-leads/")) {
    return "Lead Managment";
  }

  const scopedSections = moduleId
    ? dashboardSidebarSections.filter((section) => section.id === moduleId)
    : dashboardSidebarSections;

  let best: { label: string; matchLen: number } | null = null;

  for (const section of scopedSections) {
    for (const item of section.items) {
      if (!item.href || !pathnameMatchesSidebarHref(path, item.href)) continue;
      const matchLen = sidebarHrefMatchLength(item.href);
      if (!best || matchLen > best.matchLen) {
        best = { label: item.label, matchLen };
      }
    }
  }

  if (best) return best.label;

  for (const section of dashboardSidebarSections) {
    for (const item of section.items) {
      if (!item.href || !pathnameMatchesSidebarHref(path, item.href)) continue;
      const matchLen = sidebarHrefMatchLength(item.href);
      if (!best || matchLen > best.matchLen) {
        best = { label: item.label, matchLen };
      }
    }
  }

  return best?.label ?? "Dashboard";
}

export function buildAppBreadcrumb(
  pathname: string,
  activeModuleId: CrmModuleId | null,
  pageLabelOverride?: string,
): string {
  const moduleId = activeModuleId ?? inferModuleFromPathname(pathname);
  const prefix = MODULE_PREFIX[moduleId];
  const page = pageLabelOverride ?? resolvePageLabel(pathname, moduleId);
  return `${prefix} > ${page}`;
}

export function isLeadsListPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path === "/Leads" || path === "/presales-leads";
}
