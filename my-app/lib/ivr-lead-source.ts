/** Hub `AddLead` leadSource value for IVR voice inbound (MSG91). */
export const IVR_CALL_LEAD_SOURCE = "IVR Call";

/**
 * Virtual Lead Types panel / filter key (not a Hub `leadType`).
 * Resolves to `leadType=addlead&leadSource=IVR Call`.
 */
export const IVR_CALL_FILTER_KEY = "ivr_call";

export function isIvrCallFilterKey(leadType: string | null | undefined): boolean {
  return String(leadType ?? "").trim().toLowerCase() === IVR_CALL_FILTER_KEY;
}

export function isIvrCallLeadSource(raw: unknown): boolean {
  const compact = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return compact === "ivrcall" || compact === "ivr";
}

/** Hub filter `leadType` when the IVR Call tile/dropdown is selected. */
export function hubLeadTypeForFilterKey(leadTypeFilter: string): string {
  if (isIvrCallFilterKey(leadTypeFilter)) return "addlead";
  const normalized = leadTypeFilter.trim().toLowerCase();
  if (normalized === "verified") return "all";
  return leadTypeFilter.trim() || "all";
}

export function appendIvrLeadSourceFilter(
  qs: URLSearchParams,
  leadTypeFilter: string,
): void {
  if (isIvrCallFilterKey(leadTypeFilter)) {
    qs.set("leadSource", IVR_CALL_LEAD_SOURCE);
  }
}

import { getLeadDisplaySource } from "@/lib/lead-display";

/** Count AddLead rows whose display source is IVR Call (virtual tile key `ivr_call`). */
export function countIvrCallLeads(leads: Array<Record<string, unknown> | object>): number {
  let n = 0;
  for (const lead of leads) {
    const source = getLeadDisplaySource(lead as Parameters<typeof getLeadDisplaySource>[0]);
    if (isIvrCallLeadSource(source)) n += 1;
  }
  return n;
}
