/**
 * Primary-source dedupe: same phone → one customer; earliest `created_at` row wins.
 * Assignee + milestone on that row (not latest update).
 */

import type { ApiLead, CrmLeadType, LeadSourceCounts } from "@/lib/leads-filter";
import { CRM_LEAD_TYPES } from "@/lib/leads-filter";

export function normalizeLeadTypeKey(raw: unknown): CrmLeadType {
  const compact = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (compact === "glead" || compact === "googleads") return "glead";
  if (compact === "mlead" || compact === "metaads") return "mlead";
  if (compact === "addlead" || compact === "alead") return "addlead";
  if (compact === "websitelead" || compact === "wlead") return "websitelead";
  if (compact === "walkinlead" || compact === "walkin") return "walkinlead";
  return "formlead";
}

/** Digits-only phone; empty when missing/too short to dedupe. */
export function leadPhoneDigits(lead: ApiLead): string {
  const record = lead as Record<string, unknown>;
  const dynamic =
    record.dynamicFields && typeof record.dynamicFields === "object" && !Array.isArray(record.dynamicFields)
      ? (record.dynamicFields as Record<string, unknown>)
      : {};
  return String(
    record.phone ??
      record.phoneNumber ??
      record.mobile ??
      record.mobileNumber ??
      dynamic.customerPhone ??
      dynamic.phone ??
      "",
  )
    .replace(/\D/g, "")
    .trim();
}

export function parseLeadCreatedAtMs(lead: ApiLead): number {
  const record = lead as Record<string, unknown>;
  const createdRaw = String(
    record.createdAt ??
      record.createdDate ??
      record.leadDate ??
      record.createdOn ??
      record.updatedAt ??
      "",
  ).trim();
  const ts = createdRaw ? Date.parse(createdRaw) : Number.NaN;
  return Number.isNaN(ts) ? Number.MAX_SAFE_INTEGER : ts;
}

function dedupeGroupKey(lead: ApiLead, orphanSeq: number): string {
  const phone = leadPhoneDigits(lead);
  if (phone.length >= 8) return `p:${phone}`;
  const row = lead as Record<string, unknown>;
  const leadIdentifier = String(row.leadId ?? row.lead_identifier ?? row.leadIdentifier ?? "")
    .trim()
    .toLowerCase();
  const lt = normalizeLeadTypeKey(lead.leadType);
  return leadIdentifier ? `lid:${leadIdentifier}:${lt}` : `__orphan_${orphanSeq}`;
}

/** One row per phone (earliest created_at); orphan rows without phone stay separate. */
export function pickPrimarySourceRows(leads: ApiLead[]): ApiLead[] {
  const byKey = new Map<string, ApiLead[]>();
  let orphanSeq = 0;
  for (const lead of leads) {
    const key = dedupeGroupKey(lead, orphanSeq++);
    const list = byKey.get(key) ?? [];
    list.push(lead);
    byKey.set(key, list);
  }
  const primary: ApiLead[] = [];
  for (const group of byKey.values()) {
    primary.push(
      [...group].sort((a, b) => {
        const diff = parseLeadCreatedAtMs(a) - parseLeadCreatedAtMs(b);
        if (diff !== 0) return diff;
        return String(a.id ?? "").localeCompare(String(b.id ?? ""));
      })[0],
    );
  }
  return primary;
}

export function computeLeadTypeCountsFromRows(leads: ApiLead[]): LeadSourceCounts {
  const counts: LeadSourceCounts = {
    all: leads.length,
    formlead: 0,
    glead: 0,
    mlead: 0,
    addlead: 0,
    websitelead: 0,
    walkinlead: 0,
  };
  for (const lead of leads) {
    const type = normalizeLeadTypeKey(lead.leadType);
    counts[type] += 1;
  }
  return counts;
}

/** Primary-source unique customers by first-touch `leadType`. */
export function computeLeadTypeCountsPrimaryUnique(leads: ApiLead[]): LeadSourceCounts {
  return computeLeadTypeCountsFromRows(pickPrimarySourceRows(leads));
}

export type AdminPoolDualCounts = {
  totalRows: number;
  uniquePrimaryTotal: number;
  leadTypeAllRows: LeadSourceCounts;
  leadTypePrimaryUnique: LeadSourceCounts;
  primaryRows: ApiLead[];
};

export function buildAdminPoolDualCounts(leads: ApiLead[]): AdminPoolDualCounts {
  const primaryRows = pickPrimarySourceRows(leads);
  return {
    totalRows: leads.length,
    uniquePrimaryTotal: primaryRows.length,
    leadTypeAllRows: computeLeadTypeCountsFromRows(leads),
    leadTypePrimaryUnique: computeLeadTypeCountsFromRows(primaryRows),
    primaryRows,
  };
}

export function emptyLeadSourceCounts(): LeadSourceCounts {
  const counts = { all: 0 } as LeadSourceCounts;
  for (const t of CRM_LEAD_TYPES) counts[t] = 0;
  return counts;
}
