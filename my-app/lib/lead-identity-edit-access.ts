import { normalizeRole } from "@/lib/auth/api";
import { assigneeAliasNorms } from "@/lib/lead-follow-up-insights";
import type { ApiLead } from "@/lib/leads-filter";

const EMAIL_PUT_KEYS = ["email", "emailAddress", "mail"] as const;
const PHONE_PUT_KEYS = ["phone", "phoneNumber", "mobile"] as const;

export function canEditLeadEmailAndPhone(args: {
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
      (args.managerTeamNames ?? []).map((name) => name.trim().toLowerCase()).filter(Boolean),
    );
    const viewerSet = new Set(
      (args.viewerAliases ?? []).map((name) => name.trim().toLowerCase()).filter(Boolean),
    );
    for (const alias of assigneeAliasNorms(args.lead)) {
      if (teamSet.has(alias) || viewerSet.has(alias)) return true;
    }
    return false;
  }

  return false;
}

/** Revert email/phone on PUT when the viewer cannot edit those fields. */
export function stripUnauthorizedLeadEmailPhoneFromPutBody(
  body: Record<string, unknown>,
  base: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...body };
  for (const key of EMAIL_PUT_KEYS) {
    if (key in base) next[key] = base[key];
  }
  for (const key of PHONE_PUT_KEYS) {
    if (key in base) next[key] = base[key];
  }
  return next;
}
