import { normalizeRole } from "@/lib/auth/api";
import type { CrmWorkspace } from "@/lib/crm-workspace";
import { appendWorkspaceMilestoneFilterQuery } from "@/lib/crm-workspace";
import type { ApiLead, CrmLeadType, LeadSourceCounts, LeadSummaryTotals, SpringPage } from "@/lib/leads-filter";
import { CRM_LEAD_TYPES } from "@/lib/leads-filter";
import { normalizeStageKey } from "@/lib/milestone-progress";
import { getLocalMonthRangeIsoDates } from "@/lib/presales-heatmap-helpers";
import { isAdminRole } from "@/lib/roleUtils";

export type AdminLeadListEnvelope = {
  type?: string;
  lead?: ApiLead;
};

export type AdminLeadsListResponse = {
  success?: boolean;
  pool?: string;
  content?: AdminLeadListEnvelope[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
  summary?: {
    totalInPool?: number;
    verifiedCount?: number;
    unverifiedCount?: number;
    byLeadType?: Partial<Record<CrmLeadType, number>>;
  };
  message?: string;
};

export type AdminLeadsAnalyticsResponse = {
  success?: boolean;
  pool?: string;
  totalElements?: number;
  verifiedCount?: number;
  unverifiedCount?: number;
  byLeadType?: Partial<Record<CrmLeadType, number>>;
  countsBySalesMilestone?: Record<string, number>;
  countsByPresalesMilestone?: Record<string, number>;
  message?: string;
};

export type AdminLeadsFilterInput = {
  workspace: CrmWorkspace;
  page?: number;
  size?: number;
  search?: string;
  assignee?: string;
  dateFrom?: string;
  dateTo?: string;
  crmMonthWindow?: string;
  dateField?: "createdAt" | "assignedAt";
  verificationStatus?: string;
  milestoneStage?: string;
  milestoneStageCategory?: string;
  milestoneSubStage?: string;
  leadType?: string;
};

/** SUPER_ADMIN, ADMIN, SALES_ADMIN — Hub admin pool APIs (not `/filter` merge). */
export function usesAdminLeadsApi(role: string): boolean {
  const r = normalizeRole(role);
  return isAdminRole(r) || r === "SALES_ADMIN";
}

export function adminListApiPath(workspace: CrmWorkspace): string {
  return workspace === "presales" ? "/api/crm/admin/presales" : "/api/crm/admin/sales-crm";
}

export function adminAnalyticsApiPath(workspace: CrmWorkspace): string {
  return workspace === "presales"
    ? "/api/crm/admin/presales/analytics"
    : "/api/crm/admin/sales-crm/analytics";
}

export function flattenAdminListContent(rows: AdminLeadListEnvelope[] | undefined): ApiLead[] {
  if (!Array.isArray(rows)) return [];
  const out: ApiLead[] = [];
  for (const row of rows) {
    const lead = row.lead;
    if (!lead || typeof lead !== "object") continue;
    const lt = String(row.type ?? lead.leadType ?? "")
      .trim()
      .toLowerCase();
    const typed = CRM_LEAD_TYPES.includes(lt as CrmLeadType) ? (lt as CrmLeadType) : undefined;
    out.push(typed ? { ...lead, leadType: typed } : lead);
  }
  return out;
}

export function adminByLeadTypeToSourceCounts(
  byLeadType: Partial<Record<CrmLeadType, number>> | undefined,
  totalElements: number,
): LeadSourceCounts {
  const counts: LeadSourceCounts = {
    all: totalElements,
    formlead: 0,
    glead: 0,
    mlead: 0,
    addlead: 0,
    websitelead: 0,
  };
  if (!byLeadType) return counts;
  for (const t of CRM_LEAD_TYPES) {
    counts[t] = Number(byLeadType[t] ?? 0);
  }
  return counts;
}

const SALES_LEAD_STAGES = new Set(["fresh lead", "discovery", "connection"]);
const SALES_OPPORTUNITY_STAGES = new Set(["experience & design", "decision", "closed"]);

export function salesJourneySummaryFromMilestoneCounts(
  counts: Record<string, number> | undefined,
): LeadSummaryTotals {
  let lead = 0;
  let opportunity = 0;
  if (!counts) return { lead: 0, opportunity: 0 };
  for (const [stage, raw] of Object.entries(counts)) {
    const n = Number(raw) || 0;
    const key = stage.trim().toLowerCase();
    if (SALES_LEAD_STAGES.has(key)) lead += n;
    else if (SALES_OPPORTUNITY_STAGES.has(key)) opportunity += n;
  }
  return { lead, opportunity };
}

export function milestoneCountForPhase(
  counts: Record<string, number> | undefined,
  phaseName: string,
): number {
  if (!counts) return 0;
  const key = normalizeStageKey(phaseName);
  for (const [stage, raw] of Object.entries(counts)) {
    if (normalizeStageKey(stage) === key) return Number(raw) || 0;
  }
  return 0;
}

export function appendAdminLeadsFilters(qs: URLSearchParams, input: AdminLeadsFilterInput): void {
  let dateFrom = (input.dateFrom ?? "").trim();
  let dateTo = (input.dateTo ?? "").trim();
  let dateField = input.dateField ?? (input.workspace === "presales" ? "assignedAt" : "createdAt");

  if ((input.crmMonthWindow ?? "").trim().toLowerCase() === "current") {
    const month = getLocalMonthRangeIsoDates();
    dateFrom = month.from;
    dateTo = month.to;
    dateField = "assignedAt";
  }

  if (dateFrom) qs.set("dateFrom", dateFrom);
  if (dateTo) qs.set("dateTo", dateTo);
  qs.set("dateField", dateField);

  const lt = (input.leadType ?? "all").trim().toLowerCase();
  if (lt && lt !== "verified") qs.set("leadType", lt);

  const vs = (input.verificationStatus ?? "").trim();
  if (vs) qs.set("verificationStatus", vs);

  if (input.search?.trim()) qs.set("search", input.search.trim());
  if (input.assignee?.trim()) qs.set("assignee", input.assignee.trim());

  appendWorkspaceMilestoneFilterQuery(
    qs,
    input.workspace,
    input.milestoneStage ?? "",
    input.milestoneStageCategory ?? "",
    input.milestoneSubStage ?? "",
  );
}

function parseAdminErrorMessage(json: unknown, fallback: string): string {
  if (!json || typeof json !== "object") return fallback;
  const o = json as Record<string, unknown>;
  return String(o.message ?? o.error ?? fallback);
}

export async function fetchAdminLeadsPage(
  input: AdminLeadsFilterInput & { page: number; size: number },
  init?: RequestInit,
): Promise<SpringPage<ApiLead>> {
  const qs = new URLSearchParams();
  qs.set("page", String(input.page));
  qs.set("size", String(Math.min(500, Math.max(1, input.size))));
  appendAdminLeadsFilters(qs, input);

  const res = await fetch(`${adminListApiPath(input.workspace)}?${qs.toString()}`, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });
  const json = (await res.json().catch(() => ({}))) as AdminLeadsListResponse;
  if (!res.ok) {
    throw new Error(parseAdminErrorMessage(json, `HTTP ${res.status}`));
  }

  const content = flattenAdminListContent(json.content);
  const totalElements = Number(json.totalElements ?? content.length);
  const summary = json.summary;

  return {
    content,
    totalElements,
    totalPages: Math.max(1, Number(json.totalPages ?? 1)),
    number: Number(json.number ?? input.page),
    size: Number(json.size ?? input.size),
    sourceCounts: adminByLeadTypeToSourceCounts(summary?.byLeadType, totalElements),
    summaryTotals:
      input.workspace === "sales"
        ? salesJourneySummaryFromMilestoneCounts(undefined)
        : undefined,
  };
}

export async function fetchAdminLeadsAnalytics(
  input: AdminLeadsFilterInput,
  init?: RequestInit,
): Promise<AdminLeadsAnalyticsResponse> {
  const qs = new URLSearchParams();
  appendAdminLeadsFilters(qs, input);

  const res = await fetch(`${adminAnalyticsApiPath(input.workspace)}?${qs.toString()}`, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });
  const json = (await res.json().catch(() => ({}))) as AdminLeadsAnalyticsResponse;
  if (!res.ok) {
    throw new Error(parseAdminErrorMessage(json, `HTTP ${res.status}`));
  }
  return json;
}
