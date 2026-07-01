import { normalizeRole } from "@/lib/auth/api";

export function isPresalesRole(role: string): boolean {
  const r = normalizeRole(role);
  return ["PRESALES_EXECUTIVE", "PRESALES_MANAGER", "PRE_SALES"].includes(r);
}

export function isSalesRole(role: string): boolean {
  const r = normalizeRole(role);
  return ["SALES_EXECUTIVE", "SALES_MANAGER", "SALES_ADMIN"].includes(r);
}

export function isAdminRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

export function isSuperAdminRole(role: string): boolean {
  return normalizeRole(role) === "SUPER_ADMIN";
}

/** Booking & Token dashboard — sales hierarchy + admin roles. */
export function canAccessBookingTokenDashboard(role: string): boolean {
  const r = normalizeRole(role);
  return (
    isAdminRole(r) ||
    r === "SALES_ADMIN" ||
    r === "SALES_MANAGER" ||
    r === "SALES_EXECUTIVE"
  );
}

/** Admin dashboards and dual-pipeline detail (incl. sales admin). */
export function canViewBothMilestonePipelines(role: string): boolean {
  const r = normalizeRole(role);
  return isAdminRole(r) || r === "SALES_ADMIN";
}

/** Presales Manager / Executive hierarchy filters (leads toolbar + dashboard). */
export function canUsePresalesHierarchyFilters(role: string): boolean {
  return canViewBothMilestonePipelines(role);
}

/** Hub `GET /v1/Leads/crm-pipeline?role=` value for the signed-in viewer. */
export function crmPipelineRoleParam(role: string): string {
  const r = normalizeRole(role);
  if (isPresalesRole(r)) return "PRESALES_EXECUTIVE";
  if (isSalesRole(r)) return "SALES_EXECUTIVE";
  return "SALES_EXECUTIVE";
}
