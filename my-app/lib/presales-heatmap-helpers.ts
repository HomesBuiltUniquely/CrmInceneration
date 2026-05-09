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

function parseLeadTs(v: unknown): number {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

/** Assignment timestamp used by Presales “assigned this month” summary. */
export function leadAssignedTimestampForPresalesMonthWindow(lead: ApiLead): number {
  const r = lead as Record<string, unknown>;
  const df =
    lead.dynamicFields && typeof lead.dynamicFields === "object" && !Array.isArray(lead.dynamicFields)
      ? (lead.dynamicFields as Record<string, unknown>)
      : null;
  const keys = [
    "assignedAt",
    "assignmentDate",
    "assignDate",
    "assignedOn",
    "lastAssignedAt",
  ];
  let max = 0;
  for (const k of keys) {
    max = Math.max(max, parseLeadTs(r[k]));
    if (df) max = Math.max(max, parseLeadTs(df[k]));
  }
  return max;
}

export function isTimestampInCurrentMonth(ts: number, now = new Date()): boolean {
  if (!ts) return false;
  const d = new Date(ts);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function filterLeadsCurrentMonthAssignedPool(leads: ApiLead[]): ApiLead[] {
  return leads.filter((l) =>
    isTimestampInCurrentMonth(leadAssignedTimestampForPresalesMonthWindow(l)),
  );
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
