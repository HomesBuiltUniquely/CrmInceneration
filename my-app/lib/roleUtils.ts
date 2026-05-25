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

/** Admin dashboards and dual-pipeline detail (incl. sales admin). */
export function canViewBothMilestonePipelines(role: string): boolean {
  const r = normalizeRole(role);
  return isAdminRole(r) || r === "SALES_ADMIN";
}

/** Hub `GET /v1/Leads/crm-pipeline?role=` value for the signed-in viewer. */
export function crmPipelineRoleParam(role: string): string {
  const r = normalizeRole(role);
  if (isPresalesRole(r)) return "PRESALES_EXECUTIVE";
  if (isSalesRole(r)) return "SALES_EXECUTIVE";
  return "SALES_EXECUTIVE";
}
