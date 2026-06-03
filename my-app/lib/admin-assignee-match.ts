import {
  flattenAdminListContent,
  type AdminLeadListEnvelope,
} from "@/lib/admin-leads-api";
import type { ApiLead } from "@/lib/leads-filter";
import { crmLeadAssigneeAliasNorms } from "@/lib/leads-filter";

function assigneeScopeNormSet(scope: string[]): Set<string> {
  return new Set(
    scope.map((s) => String(s ?? "").trim().toLowerCase()).filter(Boolean),
  );
}

/** Match flattened admin pool rows against one or more assignee display names / aliases. */
export function adminRowMatchesAssigneeScope(row: unknown, scope: string[]): boolean {
  const scopeSet = assigneeScopeNormSet(scope);
  if (scopeSet.size === 0) return true;
  if (!row || typeof row !== "object") return false;
  const leads = flattenAdminListContent([row as AdminLeadListEnvelope]);
  if (leads.length === 0) return false;
  for (const lead of leads) {
    if (leadMatchesAssigneeScope(lead, scope)) return true;
  }
  return false;
}

export function adminRowMatchesAssigneeQuery(row: unknown, assigneeQuery: string): boolean {
  const query = String(assigneeQuery ?? "").trim();
  if (!query) return true;
  return adminRowMatchesAssigneeScope(row, [query]);
}

export function leadMatchesAssigneeScope(lead: ApiLead, scope: string[]): boolean {
  const scopeSet = assigneeScopeNormSet(scope);
  if (scopeSet.size === 0) return true;
  const aliases = crmLeadAssigneeAliasNorms(lead);
  for (const alias of aliases) {
    if (scopeSet.has(alias)) return true;
  }
  return false;
}

export function filterLeadsByAssigneeScope(leads: ApiLead[], scope: string[]): ApiLead[] {
  if (scope.length === 0) return leads;
  return leads.filter((lead) => leadMatchesAssigneeScope(lead, scope));
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
