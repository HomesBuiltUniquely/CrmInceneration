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

export type LeadIdentityWriteAccess = {
  name: boolean;
  email: boolean;
  phone: boolean;
};

function leadAssignedToViewer(
  lead: ApiLead,
  viewerAliases?: string[],
  managerTeamNames?: string[],
): boolean {
  const teamSet = new Set(
    (managerTeamNames ?? [])
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );
  const viewerSet = new Set(
    (viewerAliases ?? [])
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );
  for (const alias of assigneeAliasNorms(lead)) {
    if (teamSet.has(alias) || viewerSet.has(alias)) return true;
  }
  return false;
}

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
    return leadAssignedToViewer(
      args.lead,
      args.viewerAliases,
      args.managerTeamNames,
    );
  }

  return false;
}

/**
 * Email write access: full identity editors, plus Sales Executive on own assigned leads.
 * Phone/name stay locked for SE.
 */
export function canEditLeadEmailField(args: {
  viewerRole: string;
  lead: ApiLead;
  managerTeamNames?: string[];
  viewerAliases?: string[];
}): boolean {
  if (canEditLeadIdentityFields(args)) return true;

  const role = normalizeRole(args.viewerRole);
  if (role !== "SALES_EXECUTIVE") return false;

  return leadAssignedToViewer(args.lead, args.viewerAliases);
}

export function resolveLeadIdentityWriteAccess(args: {
  viewerRole: string;
  lead: ApiLead;
  managerTeamNames?: string[];
  viewerAliases?: string[];
}): LeadIdentityWriteAccess {
  if (canEditLeadIdentityFields(args)) {
    return { name: true, email: true, phone: true };
  }
  if (canEditLeadEmailField(args)) {
    return { name: false, email: true, phone: false };
  }
  return { name: false, email: false, phone: false };
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
  access?: LeadIdentityWriteAccess,
): Record<string, unknown> {
  const next = { ...body };
  const allow = access ?? { name: false, email: false, phone: false };
  const keysToRevert = [
    ...(allow.name ? [] : NAME_PUT_KEYS),
    ...(allow.email ? [] : EMAIL_PUT_KEYS),
    ...(allow.phone ? [] : PHONE_PUT_KEYS),
  ];
  for (const key of keysToRevert) {
    if (key in base) next[key] = base[key];
    else delete next[key];
  }
  return next;
}

/** @deprecated Prefer stripUnauthorizedLeadIdentityFromPutBody. */
export function stripUnauthorizedLeadEmailPhoneFromPutBody(
  body: Record<string, unknown>,
  base: Record<string, unknown>,
  access?: LeadIdentityWriteAccess,
): Record<string, unknown> {
  return stripUnauthorizedLeadIdentityFromPutBody(body, base, access);
}
