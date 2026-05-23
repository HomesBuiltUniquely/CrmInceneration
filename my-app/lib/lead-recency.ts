import type { ApiLead } from "@/lib/leads-filter";
import { readLeadCreatedAtRaw } from "@/lib/lead-follow-up-insights";

function parseIsoMs(raw: string | null | undefined): number {
  const s = String(raw ?? "").trim();
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

/** Best available recency timestamp for inbox ordering (new creates often lack `updatedAt`). */
export function leadRecencyMs(lead: ApiLead): number {
  const updated = parseIsoMs(lead.updatedAt);
  const created = parseIsoMs(readLeadCreatedAtRaw(lead));
  const best = Math.max(updated, created);
  if (best > 0) return best;
  // Rows synced before timestamps exist still need to surface at the top of the inbox.
  return Date.now();
}

export function compareLeadsByRecencyDesc(a: ApiLead, b: ApiLead): number {
  return leadRecencyMs(b) - leadRecencyMs(a);
}
