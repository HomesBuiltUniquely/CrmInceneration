import { normalizeRole } from "@/lib/auth/api";

type ActiveFields = {
  active?: boolean;
  isActive?: boolean;
};

/** Primary status flag — treats missing fields as active. */
export function isUserActive(user: ActiveFields): boolean {
  return user.active !== false && user.isActive !== false;
}

export function isSalesExecutiveRole(role: string): boolean {
  return normalizeRole(role) === "SALES_EXECUTIVE";
}

export function isPresalesExecutiveRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "PRESALES_EXECUTIVE" || r === "PRE_SALES";
}

export function isExecutiveAssigneeRole(role: string): boolean {
  return isSalesExecutiveRole(role) || isPresalesExecutiveRole(role);
}

export function isManagerStatusToggleRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "SALES_MANAGER" || r === "PRESALES_MANAGER" || r === "MANAGER";
}

/** Super Admin / Admin / Sales Admin — keep inactive executives in filter scope and counts. */
export function includeInactiveExecutivesInHierarchyFilters(role?: string): boolean {
  const r = normalizeRole(role ?? "");
  return r === "SUPER_ADMIN" || r === "ADMIN" || r === "SALES_ADMIN";
}
