import type { ApiLead, CrmLeadType, SpringPage } from "@/lib/leads-filter";
import { CRM_LEAD_TYPES } from "@/lib/leads-filter";
import { isPresalesRole } from "@/lib/roleUtils";

/** Presales list should match search: trust Hub JWT scope, do not re-filter by assignee names client-side. */
export function trustPresalesUpstreamLeadScope(role: string): boolean {
  return isPresalesRole(role);
}

function normalizeLeadTypeKey(v: unknown): CrmLeadType | null {
  const k = String(v ?? "").trim().toLowerCase();
  return CRM_LEAD_TYPES.includes(k as CrmLeadType) ? (k as CrmLeadType) : null;
}

/** Flatten `GET /v1/leads/presales-search` envelope into ApiLead rows. */
export function flattenPresalesSearchContent(data: unknown): ApiLead[] {
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  const rows = Array.isArray(o.content) ? o.content : [];
  const out: ApiLead[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const type = normalizeLeadTypeKey(rec.type ?? rec.leadType);
    const lead = rec.lead;
    if (!type || !lead || typeof lead !== "object" || Array.isArray(lead)) continue;
    out.push({ ...(lead as ApiLead), leadType: type });
  }
  return out;
}

export function mergeLeadsById(...groups: ApiLead[][]): ApiLead[] {
  const byId = new Map<string, ApiLead>();
  for (const group of groups) {
    for (const lead of group) {
      const id = lead.id !== undefined && lead.id !== null ? String(lead.id) : "";
      if (!id) continue;
      const lt = normalizeLeadTypeKey(lead.leadType);
      byId.set(id, lt ? { ...lead, leadType: lt } : lead);
    }
  }
  return [...byId.values()];
}

export type FetchPresalesSearchPageOpts = {
  search?: string;
  page: number;
  size: number;
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
};

/** Page through presales-search (role-scoped list on Hub). */
export async function fetchAllPresalesSearchLeads(
  opts: FetchPresalesSearchPageOpts,
): Promise<ApiLead[]> {
  const size = Math.min(500, Math.max(50, opts.size));
  const search = (opts.search ?? "").trim();
  const all: ApiLead[] = [];
  for (let page = 0; page < 200; page += 1) {
    const q = new URLSearchParams();
    q.set("page", String(page));
    q.set("size", String(size));
    if (search) q.set("search", search);
    const res = await opts.fetchImpl(`/api/crm/presales-search?${q.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) break;
    const json = (await res.json().catch(() => ({}))) as SpringPage<unknown> | unknown;
    const chunk = flattenPresalesSearchContent(json);
    if (chunk.length === 0) break;
    all.push(...chunk);
    if (chunk.length < size) break;
  }
  return mergeLeadsById(all);
}
