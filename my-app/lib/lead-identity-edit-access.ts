import { normalizeRole } from "@/lib/auth/api";
import { assigneeAliasNorms } from "@/lib/lead-follow-up-insights";
import type { ApiLead } from "@/lib/leads-filter";

const EMAIL_PUT_KEYS = ["email", "emailAddress", "mail"] as const;
const PHONE_PUT_KEYS = ["phone", "phoneNumber", "mobile", "altPhone", "alternatePhone"] as const;
const NAME_PUT_KEYS = [
  "name",
  "fullName",
  "customerName",
  "customer_name",
  "leadName",
] as const;

/**
 * Super Admin / Admin / Sales Admin: name + contact on any lead.
 * Sales Manager: only leads assigned to self or their under-team executives
 * (not other managers' teams).
 */
export function canEditLeadIdentityFields(args: {
  viewerRole: string;
  lead: ApiLead;
  managerTeamNames?: string[];
  viewerAliases?: string[];
}): boolean {
  const role = normalizeRole(args.viewerRole);
  if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "SALES_ADMIN") {
    return true;
  }

  if (role === "SALES_MANAGER" || role === "MANAGER") {
    const teamSet = new Set(
      (args.managerTeamNames ?? [])
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean),
    );
    const viewerSet = new Set(
      (args.viewerAliases ?? [])
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean),
    );
    for (const alias of assigneeAliasNorms(args.lead)) {
      if (teamSet.has(alias) || viewerSet.has(alias)) return true;
    }
    return false;
  }

  return false;
}

/** @deprecated Prefer canEditLeadIdentityFields — same rule (name + email + phone). */
export function canEditLeadEmailAndPhone(args: {
  viewerRole: string;
  lead: ApiLead;
  managerTeamNames?: string[];
  viewerAliases?: string[];
}): boolean {
  return canEditLeadIdentityFields(args);
}

/** Revert name/email/phone on PUT when the viewer cannot edit those fields. */
export function stripUnauthorizedLeadIdentityFromPutBody(
  body: Record<string, unknown>,
  base: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...body };
  for (const key of [...NAME_PUT_KEYS, ...EMAIL_PUT_KEYS, ...PHONE_PUT_KEYS]) {
    if (key in base) next[key] = base[key];
    else delete next[key];
  }
  return next;
}

/** @deprecated Prefer stripUnauthorizedLeadIdentityFromPutBody. */
export function stripUnauthorizedLeadEmailPhoneFromPutBody(
  body: Record<string, unknown>,
  base: Record<string, unknown>,
): Record<string, unknown> {
  return stripUnauthorizedLeadIdentityFromPutBody(body, base);
}
