import { canAccessBookingTokenDashboard, isAdminRole } from "@/lib/roleUtils";
import type { QuickAccessParentItem } from "./QuickAccessSidebar";

export function normalizeSidebarRole(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "PRE_SALES") return "PRESALES_EXECUTIVE";
  if (normalized === "PRE_SALES_MANAGER") return "PRESALES_MANAGER";
  return normalized;
}

export function pathnameMatchesSidebarHref(pathname: string, href: string): boolean {
  const path = (pathname ?? "").split("?")[0]?.split("#")[0] ?? "/";
  const base = href.trim();
  if (!base) return false;
  if (base === "/") return path === "/" || path === "";
  return path === base || path.startsWith(`${base}/`);
}

export function sidebarHrefMatchLength(href: string): number {
  return href.trim() === "/" ? 1 : href.trim().length;
}

export function filterSidebarSections(
  sections: QuickAccessParentItem[],
  currentRole: string,
): QuickAccessParentItem[] {
  const role = normalizeSidebarRole(currentRole);
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
      if (section.id === "presales") {
        return isSuperAdmin || isHubAdmin || isPresalesManager || isPresalesExecutive;
      }
      if (isDesignRole) {
        return section.id === "design";
      }
      if (isPresalesManager || isPresalesExecutive) {
        return section.id === "presales";
      }
      if (isSalesAdmin || isSalesManager || isSalesExecutive) {
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
        if (item.id === "crm-booking-token") {
          return canAccessBookingTokenDashboard(currentRole);
        }
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}
