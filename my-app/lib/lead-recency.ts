import { parseLeadSortTimestamp, type ApiLead } from "@/lib/leads-filter";

/** Best available recency timestamp for inbox ordering (new creates + reinquiries). */
export function leadRecencyMs(lead: ApiLead): number {
  return parseLeadSortTimestamp(lead);
}

export function compareLeadsByRecencyDesc(a: ApiLead, b: ApiLead): number {
  return leadRecencyMs(b) - leadRecencyMs(a);
}
