import { normalizeRole } from "@/lib/auth/api";

/** Sales / presales frontline — masked phone, no phone/email edit. */
export function isSalesOrPresalesExecutiveRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "SALES_EXECUTIVE" || r === "PRESALES_EXECUTIVE";
}

/**
 * Manager, team lead, and admin roles that may view full phone/email and edit them.
 */
export function canEditLeadPhoneAndEmail(role: string): boolean {
  const r = normalizeRole(role);
  return (
    r === "SUPER_ADMIN" ||
    r === "ADMIN" ||
    r === "SALES_ADMIN" ||
    r === "SALES_MANAGER" ||
    r === "PRESALES_MANAGER" ||
    r === "MANAGER" ||
    r === "TEAM_LEAD"
  );
}

export function shouldMaskLeadPhoneForRole(role: string): boolean {
  return isSalesOrPresalesExecutiveRole(role);
}
