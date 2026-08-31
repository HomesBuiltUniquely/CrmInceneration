/** Hub `leadSource` badge value for IVR voice inbound (MSG91). */
export const IVR_CALL_LEAD_SOURCE = "IVR Call";

/** Canonical CRM `leadType` after IVR moved off Add Lead (`/v1/IvrLead`). */
export const IVR_LEAD_TYPE = "ivrlead";

/**
 * Legacy Lead Types panel key. Maps to `ivrlead`.
 * Old URLs used `leadType=addlead&leadSource=IVR Call`.
 */
export const IVR_CALL_FILTER_KEY = "ivr_call";

function compactLeadTypeToken(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** True for `ivrlead` and Hub aliases (`ivr`, `ivr-lead`, `ivr call`, legacy `ivr_call`). */
export function isIvrLeadTypeKey(leadType: string | null | undefined): boolean {
  const compact = compactLeadTypeToken(leadType);
  return compact === "ivrlead" || compact === "ivr" || compact === "ivrcall";
}

export function isIvrCallFilterKey(leadType: string | null | undefined): boolean {
  return isIvrLeadTypeKey(leadType);
}

export function isIvrCallLeadSource(raw: unknown): boolean {
  const compact = compactLeadTypeToken(raw);
  return compact === "ivrcall" || compact === "ivr";
}

/** IVR inbound row: new `ivrlead` table row, or legacy `addlead` + IVR Call source.
 *  Matches Hub `IvrLeadTableMigration` criteria (`ivr call`, `ivr`). */
export function isIvrInboundLead(
  leadType: string | null | undefined,
  leadSource?: unknown,
): boolean {
  if (isIvrLeadTypeKey(leadType)) return true;
  return compactLeadTypeToken(leadType) === "addlead" && isIvrCallLeadSource(leadSource);
}

/** Hub filter `leadType` when the IVR tile/dropdown is selected. */
export function hubLeadTypeForFilterKey(leadTypeFilter: string): string {
  if (isIvrLeadTypeKey(leadTypeFilter)) return IVR_LEAD_TYPE;
  const normalized = leadTypeFilter.trim().toLowerCase();
  if (normalized === "verified") return "all";
  return leadTypeFilter.trim() || "all";
}

/**
 * IVR is its own Hub `leadType`. Do not send `leadSource=IVR Call` as a list filter.
 */
export function appendIvrLeadSourceFilter(
  _qs: URLSearchParams,
  _leadTypeFilter: string,
): void {
  // no-op — kept so existing call sites stay valid
}

function readLeadSourceField(lead: Record<string, unknown>): unknown {
  const dynamic =
    lead.dynamicFields && typeof lead.dynamicFields === "object" && !Array.isArray(lead.dynamicFields)
      ? (lead.dynamicFields as Record<string, unknown>)
      : {};
  return (
    lead.leadSource ??
    lead.LeadSource ??
    lead.leadsource ??
    lead.source ??
    dynamic.leadSource ??
    dynamic.LeadSource ??
    dynamic.leadsource ??
    dynamic.source ??
    ""
  );
}

/** Keep IVR inbound rows: `ivrlead` type or legacy `addlead` + IVR Call source. */
export function filterIvrCallLeads<T extends Record<string, unknown> | object>(leads: T[]): T[] {
  return leads.filter((lead) => {
    const rec = lead as Record<string, unknown>;
    const leadType = String(rec.leadType ?? rec.lead_type ?? "");
    return isIvrInboundLead(leadType, readLeadSourceField(rec));
  });
}

/** Count all IVR inbound rows (new `ivrlead` + legacy add-lead IVR Call). */
export function countIvrCallLeads(leads: Array<Record<string, unknown> | object>): number {
  return filterIvrCallLeads(leads).length;
}
