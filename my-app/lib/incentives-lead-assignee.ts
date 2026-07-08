import { fetchAllAdminPoolRows } from "@/lib/admin-leads-api";
import { leadMatchesAssigneeScope } from "@/lib/admin-assignee-match";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import type { ApiLead } from "@/lib/leads-filter";
import { readLeadSalesExecutiveIds } from "@/lib/leads-filter";
import type { IncentiveMemberRef } from "@/lib/incentives-profile";

export function normalizeIncentiveLeadKey(leadType: string, leadId: number): string {
  return `${String(leadType ?? "").trim().toLowerCase()}:${leadId}`;
}

/** Name tokens used to match CRM assignee fields to roster executives. */
export function assigneeScopeForExecutive(member: IncentiveMemberRef): string[] {
  if (member.assigneeAliases?.length) {
    return member.assigneeAliases;
  }
  const raw = member.name.trim();
  if (!raw) return [];
  const lower = raw.toLowerCase();
  const parts = lower.split(/\s+/).filter(Boolean);
  const scope = new Set<string>([lower, raw]);
  if (parts[0]) scope.add(parts[0]);
  if (parts.length > 1) scope.add(parts[parts.length - 1]);
  return [...scope];
}

function leadPoolKey(lead: ApiLead): string | null {
  const id = Number(lead.id ?? 0);
  if (!id) return null;
  const type = String(lead.leadType ?? "").trim().toLowerCase();
  if (!type) return null;
  return normalizeIncentiveLeadKey(type, id);
}

/**
 * Map each executive → lead keys they own in the CRM admin sales pool.
 * Used when admin/manager browses incentives — booking_token rows often lack assignee ids.
 */
export function buildExecutiveLeadKeysIndex(
  poolRows: ApiLead[],
  executives: IncentiveMemberRef[],
): Map<number, Set<string>> {
  const index = new Map<number, Set<string>>();
  for (const exec of executives) {
    index.set(exec.id, new Set());
  }

  for (const lead of poolRows) {
    const key = leadPoolKey(lead);
    if (!key) continue;
    const ownerIds = readLeadSalesExecutiveIds(lead);

    for (const exec of executives) {
      const bucket = index.get(exec.id);
      if (!bucket) continue;
      if (ownerIds.includes(exec.id)) {
        bucket.add(key);
        continue;
      }
      if (leadMatchesAssigneeScope(lead, assigneeScopeForExecutive(exec))) {
        bucket.add(key);
      }
    }
  }

  return index;
}

export async function fetchExecutiveLeadKeysIndex(
  executives: IncentiveMemberRef[],
): Promise<Map<number, Set<string>>> {
  if (executives.length === 0) return new Map();

  try {
    const { rows } = await fetchAllAdminPoolRows(
      { workspace: "sales", crmMilestoneScope: false },
      getCrmAuthHeaders({ Accept: "application/json" }),
      24,
    );
    return buildExecutiveLeadKeysIndex(rows, executives);
  } catch {
    return new Map();
  }
}
