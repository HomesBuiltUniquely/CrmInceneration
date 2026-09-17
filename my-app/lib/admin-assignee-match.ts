import {
  flattenAdminListContent,
  type AdminLeadListEnvelope,
} from "@/lib/admin-leads-api";
import type { ApiLead } from "@/lib/leads-filter";
import {
  crmLeadAssigneeAliasNorms,
  readLeadSalesExecutiveIds,
} from "@/lib/leads-filter";

function assigneeScopeNormSet(scope: string[]): Set<string> {
  return new Set(
    scope.map((s) => String(s ?? "").trim().toLowerCase()).filter(Boolean),
  );
}

function looseNameToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Exact / Kulwant↔Kulwanth style match used by hierarchy filters. */
function namesLooselyEqual(left: string, right: string): boolean {
  const a = looseNameToken(left);
  const b = looseNameToken(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return a === `${b}h` || b === `${a}h`;
}

export type AssigneeScopeMatchOpts = {
  /** Hierarchy user ids — Hub team-leads membership is id-based; names alone miss variants. */
  userIds?: number[];
};

/** Match flattened admin pool rows against one or more assignee display names / aliases. */
export function adminRowMatchesAssigneeScope(
  row: unknown,
  scope: string[],
  opts?: AssigneeScopeMatchOpts,
): boolean {
  const scopeSet = assigneeScopeNormSet(scope);
  const userIds = (opts?.userIds ?? []).filter((id) => Number.isFinite(id) && id > 0);
  if (scopeSet.size === 0 && userIds.length === 0) return true;
  if (!row || typeof row !== "object") return false;
  const leads = flattenAdminListContent([row as AdminLeadListEnvelope]);
  if (leads.length === 0) return false;
  for (const lead of leads) {
    if (leadMatchesAssigneeScope(lead, scope, opts)) return true;
  }
  return false;
}

export function adminRowMatchesAssigneeQuery(row: unknown, assigneeQuery: string): boolean {
  const query = String(assigneeQuery ?? "").trim();
  if (!query) return true;
  return adminRowMatchesAssigneeScope(row, [query]);
}

export function leadMatchesAssigneeScope(
  lead: ApiLead,
  scope: string[],
  opts?: AssigneeScopeMatchOpts,
): boolean {
  const userIdSet = new Set(
    (opts?.userIds ?? []).filter((id) => Number.isFinite(id) && id > 0),
  );
  if (userIdSet.size > 0) {
    for (const id of readLeadSalesExecutiveIds(lead)) {
      if (userIdSet.has(id)) return true;
    }
  }
  const scopeSet = assigneeScopeNormSet(scope);
  if (scopeSet.size === 0) return userIdSet.size === 0;
  const aliases = crmLeadAssigneeAliasNorms(lead);
  for (const alias of aliases) {
    if (scopeSet.has(alias)) return true;
  }
  // Name drift on assigned Fresh rows (e.g. "Meghana S" vs hierarchy "Meghana").
  for (const alias of aliases) {
    for (const scopeName of scopeSet) {
      if (namesLooselyEqual(alias, scopeName)) return true;
      const a = looseNameToken(alias);
      const b = looseNameToken(scopeName);
      if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) {
        return true;
      }
    }
  }
  return false;
}

export function filterLeadsByAssigneeScope(
  leads: ApiLead[],
  scope: string[],
  opts?: AssigneeScopeMatchOpts,
): ApiLead[] {
  if (scope.length === 0 && !(opts?.userIds && opts.userIds.length > 0)) return leads;
  return leads.filter((lead) => leadMatchesAssigneeScope(lead, scope, opts));
}

/** `assigneeAliasSet` query param — exact hierarchy aliases (`\0`-joined). */
export function parseAssigneeAliasSetQuery(raw: string | null | undefined): string[] {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return [];
  return trimmed
    .split("\0")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function formatAssigneeAliasSetQuery(aliases: string[]): string {
  return aliases
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\0");
}

/** `assigneeUserIds` query param — hierarchy user ids (comma-separated). */
export function parseAssigneeUserIdsQuery(raw: string | null | undefined): number[] {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return [];
  return trimmed
    .split(/[,|\u0000]/)
    .map((s) => Number(s.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export function formatAssigneeUserIdsQuery(userIds: number[]): string {
  return userIds
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0)
    .join(",");
}
