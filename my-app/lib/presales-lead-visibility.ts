import type { ApiLead } from "@/lib/leads-filter";
import { isCrmLeadVerified } from "@/lib/leads-filter";

/** Backend may nest flags on `dynamicFields`. */
function readLeadFlag(lead: ApiLead, key: string): unknown {
  const r = lead as Record<string, unknown>;
  if (key in r && r[key] !== undefined && r[key] !== null) return r[key];
  const df = lead.dynamicFields;
  if (df && typeof df === "object" && !Array.isArray(df)) {
    const d = df as Record<string, unknown>;
    if (key in d && d[key] !== undefined && d[key] !== null) return d[key];
  }
  return undefined;
}

/** New CRM: verified → sales handoff rows the presales user may still open read-only. */
export function presalesTrackingReadOnlyFromApi(lead: ApiLead): boolean {
  const v = readLeadFlag(lead, "presalesTrackingReadOnly");
  return v === true || String(v).trim().toLowerCase() === "true";
}

export type PresalesExecPoolOpts = {
  currentUserId: number;
  /** From URL/query: `verified` when Verified tab or team verified is active. */
  verificationStatusFilter: string;
  isSelfLead: (l: ApiLead) => boolean;
};

/**
 * Presales executive list + heatmap pool: own assigned rows, API-marked tracking,
 * and **any verified** row the Hub already returned for this JWT (incl. sales handoff).
 * `verificationStatusFilter` is kept for callers; visibility does not drop verified rows on Total.
 */
export function shouldPresalesExecutiveSeeLeadInCrmPool(
  lead: ApiLead,
  opts: PresalesExecPoolOpts,
): boolean {
  void opts.currentUserId;
  void opts.verificationStatusFilter;
  if (opts.isSelfLead(lead)) return true;
  if (presalesTrackingReadOnlyFromApi(lead)) return true;
  if (isCrmLeadVerified(lead)) return true;
  return false;
}
