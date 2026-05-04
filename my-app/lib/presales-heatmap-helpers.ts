import type { ApiLead } from "@/lib/leads-filter";
import { isCrmLeadVerified } from "@/lib/leads-filter";
import { assigneeAliasNorms } from "@/lib/lead-follow-up-insights";

/** First / last calendar day of the current month in local time (`yyyy-MM-dd`). */
export function getLocalMonthRangeIsoDates(now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (x: number) => String(x).padStart(2, "0");
  const lastDay = new Date(y, m + 1, 0).getDate();
  return {
    from: `${y}-${pad(m + 1)}-01`,
    to: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
  };
}

/** Presales heatmap counts — must match {@link isCrmLeadVerified} and the Verified tab API filter. */
export function isLeadVerifiedForPresales(lead: ApiLead): boolean {
  return isCrmLeadVerified(lead);
}

/** Prefer assignment date when present so “this month” aligns with assignment; falls back to created / updated. */
export function leadTimestampForPresalesMonthWindow(lead: ApiLead): number {
  const r = lead as Record<string, unknown>;
  const raw = String(
    r.assignedAt ??
      r.assignmentDate ??
      r.assignDate ??
      r.createdAt ??
      lead.createdDate ??
      lead.leadDate ??
      r.createdDate ??
      lead.updatedAt ??
      ""
  ).trim();
  const ts = raw ? Date.parse(raw) : Number.NaN;
  return Number.isNaN(ts) ? 0 : ts;
}

export function isTimestampInCurrentMonth(ts: number, now = new Date()): boolean {
  if (!ts) return false;
  const d = new Date(ts);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function filterLeadsCurrentMonthAssignedPool(leads: ApiLead[]): ApiLead[] {
  return leads.filter((l) => isTimestampInCurrentMonth(leadTimestampForPresalesMonthWindow(l)));
}

export function leadAssignedToPresalesExecNameSet(
  lead: ApiLead,
  execNamesLower: Set<string>,
): boolean {
  if (execNamesLower.size === 0) return false;
  for (const a of assigneeAliasNorms(lead)) {
    if (execNamesLower.has(a)) return true;
  }
  return false;
}
