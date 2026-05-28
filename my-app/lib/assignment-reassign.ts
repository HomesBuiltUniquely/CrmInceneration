import { normalizeRole } from "@/lib/auth/api";
import { isPresalesRole } from "@/lib/crm-role-access";
import type { ApiLead } from "@/lib/leads-filter";
import { isCrmLeadVerified } from "@/lib/leads-filter";

export const REASSIGN_REASON_MIN_LENGTH = 3;

/** G / M / Website — reassign reason required on verified sales → presales. */
export function isGmwLeadType(leadType: string): boolean {
  const t = leadType.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    t === "glead" ||
    t === "mlead" ||
    t === "websitelead" ||
    t === "googleads" ||
    t === "metaads" ||
    t === "wlead"
  );
}

export function isPresalesAssigneeRole(role: string): boolean {
  return isPresalesRole(normalizeRole(role));
}

export function isSalesAssigneeRole(role: string): boolean {
  const r = normalizeRole(role);
  return r === "SALES_EXECUTIVE" || r === "SALES_MANAGER" || r === "SALES_ADMIN";
}

/** Prefer Hub `assigneeRole`; fall back to verified → sales pool heuristic. */
export function assigneeRoleFromLead(lead: ApiLead): string {
  const explicit = String(lead.assigneeRole ?? "").trim();
  if (explicit) return normalizeRole(explicit);
  if (isCrmLeadVerified(lead)) return "SALES_EXECUTIVE";
  return "PRESALES_EXECUTIVE";
}

export function requiresReassignReason(input: {
  leadType: string;
  verified: boolean;
  currentAssigneeRole: string;
  newAssigneeRole: string;
}): boolean {
  if (!isGmwLeadType(input.leadType)) return false;
  if (!input.verified) return false;
  const fromSales = isSalesAssigneeRole(input.currentAssigneeRole);
  const toPresales = isPresalesAssigneeRole(input.newAssigneeRole);
  return fromSales && toPresales;
}

export function validateReassignReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < REASSIGN_REASON_MIN_LENGTH) {
    return `Reassign reason is required (at least ${REASSIGN_REASON_MIN_LENGTH} characters).`;
  }
  return null;
}
