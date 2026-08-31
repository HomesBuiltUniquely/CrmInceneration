import { normalizeRole } from "@/lib/auth/api";
import type { CrmWorkspace } from "@/lib/crm-workspace";
import {
  appendWorkspaceMilestoneFilterQuery,
  leadMatchesWorkspaceMilestoneFilter,
} from "@/lib/crm-workspace";
import type { ApiLead, CrmLeadType, LeadSourceCounts, LeadSummaryTotals, SpringPage } from "@/lib/leads-filter";
import {
  CRM_LEAD_TYPES,
  crmLeadTopLevelStage,
  isCrmLeadVerified,
  SALES_POOL_NO_MILESTONE,
} from "@/lib/leads-filter";
import { presalesTopLevelStage } from "@/lib/presales-milestone";
import {
  filterLeadsCurrentMonthAssignedPool,
  isLeadVerifiedForPresales,
} from "@/lib/presales-heatmap-helpers";
import { normalizeStageKey } from "@/lib/milestone-progress";
import { appendCrmDateFilters } from "@/lib/crm-date-field-filter";
import type { CrmDateField } from "@/lib/crm-date-field-filter";
import { isAdminRole } from "@/lib/roleUtils";
import {
  appendIvrLeadSourceFilter,
  hubLeadTypeForFilterKey,
  isIvrCallFilterKey,
} from "@/lib/ivr-lead-source";
import {
  augmentLeadSourceCountsWithWalkIn,
  mergeWalkInCountIntoSourceCounts,
} from "@/lib/crm-walkin-leads";
import {
  augmentLeadSourceCountsWithWhatsapp,
  mergeWhatsappCountIntoSourceCounts,
} from "@/lib/crm-whatsapp-leads";
import {
  buildAdminPoolDualCounts,
  computeLeadTypeCountsFromRows,
  overlayIvrLeadTypeCountsFromRows,
  pickMilestoneRepresentativeRows,
  pickPrimarySourceRows,
} from "@/lib/primary-source-leads";

export type AdminLeadListEnvelope = {
  leadType?: string;
  type?: string;
  assigneeRole?: string;
  lead?: ApiLead;
};

export type AdminLeadsListResponse = {
  success?: boolean;
  pool?: string;
  content?: AdminLeadListEnvelope[];
  totalElements?: number;
  uniquePrimaryTotal?: number;
  totalPages?: number;
  number?: number;
  size?: number;
  dateField?: string;
  message?: string;
};

export type AdminLeadsCountsResponse = {
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
  sort?: string;
  search?: string;
  assignee?: string;
  /** Exact hierarchy aliases — forwarded to admin list BFF for server-side scope. */
  assigneeAliasSet?: string[];
  dateFrom?: string;
  dateTo?: string;
  dateField?: CrmDateField | string;
  crmMonthWindow?: string;
  verificationStatus?: string;
  reinquiry?: string;
  milestoneStage?: string;
  milestoneStageCategory?: string;
  milestoneSubStage?: string;
  leadType?: string;
  /**
   * When `false`, omits `milestoneScope=crm` on Hub admin pool APIs.
   * Default: send `milestoneScope=crm` (backend integration guide).
   */
  crmMilestoneScope?: boolean;
};

/**
 * SUPER_ADMIN, ADMIN, SALES_ADMIN — Hub assignee-role pools (`/v1/leads/admin/sales|presales`).
 * Expect ~1,212 sales + ~2,539 presales assignee rows (RDS); UI sends `milestoneScope=crm` (slightly smaller).
 * Presales exec inbox uses month + unverified filters — not comparable to admin presales pool totals.
 */
export function usesAdminLeadsApi(role: string): boolean {
  const r = normalizeRole(role);
  return isAdminRole(r) || r === "SALES_ADMIN";
}

/** Sales manager filtering a named exec — same Hub admin pool as SUPER_ADMIN/SALES_ADMIN. */
export function usesAdminSalesPoolForAssigneeScope(
  role: string,
  workspace: CrmWorkspace,
  assigneeAliasCount: number,
): boolean {
  if (workspace !== "sales" || assigneeAliasCount <= 0) return false;
  const r = normalizeRole(role);
  return r === "SALES_MANAGER" || r === "MANAGER";
}

export function adminListApiPath(workspace: CrmWorkspace): string {
  return workspace === "presales" ? "/api/crm/admin/presales" : "/api/crm/admin/sales";
}

export function adminCountsApiPath(workspace: CrmWorkspace): string {
  return workspace === "presales"
    ? "/api/crm/admin/presales/counts"
    : "/api/crm/admin/sales/counts";
}

export function flattenAdminListContent(rows: AdminLeadListEnvelope[] | undefined): ApiLead[] {
  if (!Array.isArray(rows)) return [];
  const out: ApiLead[] = [];
  for (const row of rows) {
    const lead = row.lead;
    if (!lead || typeof lead !== "object") continue;
    const lt = String(row.leadType ?? row.type ?? lead.leadType ?? "")
      .trim()
      .toLowerCase();
    const typed = CRM_LEAD_TYPES.includes(lt as CrmLeadType) ? (lt as CrmLeadType) : undefined;
    const assigneeRole = String(row.assigneeRole ?? "").trim();
    const merged = typed ? { ...lead, leadType: typed } : { ...lead };
    if (assigneeRole) {
      (merged as ApiLead & { assigneeRole?: string }).assigneeRole = assigneeRole;
    }
    out.push(merged);
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
    ivrlead: 0,
    websitelead: 0,
    walkinlead: 0,
    whatsapplead: 0,
  };
  if (!byLeadType) return counts;
  for (const t of CRM_LEAD_TYPES) {
    counts[t] = Number(byLeadType[t] ?? 0);
  }
  return counts;
}

const SALES_LEAD_STAGES = new Set(["fresh lead", "discovery", "connection"]);
const SALES_OPPORTUNITY_STAGES = new Set(["experience & design", "decision", "closed"]);

const SALES_CANONICAL_PHASES = [
  "Fresh Lead",
  "Discovery",
  "Connection",
  "Experience & Design",
  "Decision",
  "Closed",
] as const;

const PRESALES_CANONICAL_PHASES = ["Fresh Data", "Data Discovery", "Data Conversion"] as const;

function canonicalSalesMilestoneLabel(raw: string): (typeof SALES_CANONICAL_PHASES)[number] {
  const key = normalizeStageKey(raw);
  // Hub /counts empty, null, and legacy "no milestone" → Fresh (current sales inbox).
  if (
    !key ||
    key === "null" ||
    key === "undefined" ||
    key === "none" ||
    key === "n/a" ||
    key === "na" ||
    key.includes("no milestone") ||
    key === "unassigned" ||
    key === "initial stage" ||
    key === "initial"
  ) {
    return "Fresh Lead";
  }
  for (const phase of SALES_CANONICAL_PHASES) {
    if (normalizeStageKey(phase) === key) return phase;
  }
  if (key.includes("closed") || key.includes("close")) return "Closed";
  if (key.includes("booking") && key.includes("done")) return "Closed";
  if (key.includes("token") && key.includes("done")) return "Closed";
  if (key.includes("fresh")) return "Fresh Lead";
  if (key.includes("discover")) return "Discovery";
  if (key.includes("connect")) return "Connection";
  if (key.includes("experience") || key.includes("design")) return "Experience & Design";
  if (key.includes("decision")) return "Decision";
  return "Fresh Lead";
}

/** Public: map any raw stage → one of 6 sales journey phases (heatmap + cards + table). */
export function toCanonicalSalesMilestone(raw: string): string {
  return canonicalSalesMilestoneLabel(raw);
}

function canonicalPresalesMilestoneLabel(raw: string): (typeof PRESALES_CANONICAL_PHASES)[number] {
  const key = normalizeStageKey(raw);
  if (!key) return "Fresh Data";
  for (const phase of PRESALES_CANONICAL_PHASES) {
    if (normalizeStageKey(phase) === key) return phase;
  }
  if (key.includes("fresh")) return "Fresh Data";
  if (key.includes("discover")) return "Data Discovery";
  if (key.includes("convers")) return "Data Conversion";
  return "Fresh Data";
}

export function normalizeMilestoneCountsToCanonical(
  counts: Record<string, number>,
  workspace: CrmWorkspace,
): Record<string, number> {
  const out: Record<string, number> = {};
  const canonicalize =
    workspace === "presales" ? canonicalPresalesMilestoneLabel : canonicalSalesMilestoneLabel;
  for (const phase of workspace === "presales" ? PRESALES_CANONICAL_PHASES : SALES_CANONICAL_PHASES) {
    out[phase] = 0;
  }
  for (const [stage, raw] of Object.entries(counts)) {
    if (workspace === "sales" && stage === SALES_POOL_NO_MILESTONE) {
      continue;
    }
    const label = canonicalize(stage);
    out[label] = (out[label] ?? 0) + (Number(raw) || 0);
  }
  if (workspace === "sales") {
    const unassigned = Number(counts[SALES_POOL_NO_MILESTONE] ?? 0) || 0;
    if (unassigned > 0) {
      out["Fresh Lead"] = (out["Fresh Lead"] ?? 0) + unassigned;
    }
  }
  return out;
}

export function totalFromMilestoneCountMap(counts: Record<string, number> | undefined): number {
  if (!counts) return 0;
  return Object.values(counts).reduce((sum, n) => sum + (Number(n) || 0), 0);
}

export function salesJourneySummaryFromMilestoneCounts(
  counts: Record<string, number> | undefined,
): LeadSummaryTotals {
  if (!counts) return { lead: 0, opportunity: 0 };
  let lead = 0;
  let opportunity = 0;
  for (const phase of SALES_CANONICAL_PHASES) {
    const n = Number(counts[phase] ?? 0) || 0;
    if (SALES_LEAD_STAGES.has(phase.toLowerCase())) lead += n;
    else opportunity += n;
  }
  return { lead, opportunity };
}

/** Sum of canonical sales phases only (matches Lead + Opportunity cards). */
export function salesJourneySummaryTotalFromMilestoneCounts(
  counts: Record<string, number> | undefined,
): number {
  const { lead, opportunity } = salesJourneySummaryFromMilestoneCounts(counts);
  return lead + opportunity;
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

function asMilestoneCountRecord(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw) return out;
  // Hub sometimes returns `[{ key, count }]` instead of a map.
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const o = row as Record<string, unknown>;
      const stage = String(o.key ?? o.stage ?? o.name ?? o.milestoneStage ?? "").trim();
      const n = Number(o.count ?? o.value ?? o.total);
      if (!stage || !Number.isFinite(n)) continue;
      out[stage] = (out[stage] ?? 0) + n;
    }
    return out;
  }
  if (typeof raw !== "object") return out;
  for (const [stage, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(value);
    if (Number.isFinite(n)) out[stage] = n;
  }
  return out;
}

/** Hub `/counts` may use countsBySalesMilestone, countsByPresalesMilestone, or legacy keys. */
export function milestoneCountsFromAdminResponse(
  json: AdminLeadsCountsResponse,
  workspace: CrmWorkspace,
): Record<string, number> {
  const bag = json as Record<string, unknown>;
  const candidates: unknown[] =
    workspace === "presales"
      ? [
          json.countsByPresalesMilestone,
          json.countsBySalesMilestone,
          bag.countsByMilestone,
          bag.presalesMilestoneCounts,
          bag.milestoneCounts,
        ]
      : [
          json.countsBySalesMilestone,
          bag.countsByMilestone,
          bag.salesMilestoneCounts,
          bag.milestoneCounts,
          json.countsByPresalesMilestone,
        ];
  for (const c of candidates) {
    const parsed = asMilestoneCountRecord(c);
    if (Object.keys(parsed).length > 0) return parsed;
  }
  return asMilestoneCountRecord(candidates[0]);
}

/** Build phase counts from admin list rows when Hub `/counts` is missing or empty. */
export function milestoneCountsFromLeads(
  leads: ApiLead[],
  workspace: CrmWorkspace,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const phase of workspace === "presales" ? PRESALES_CANONICAL_PHASES : SALES_CANONICAL_PHASES) {
    out[phase] = 0;
  }
  for (const lead of leads) {
    if (workspace === "presales") {
      const label = canonicalPresalesMilestoneLabel(presalesTopLevelStage(lead));
      out[label] = (out[label] ?? 0) + 1;
      continue;
    }
    const label = canonicalSalesMilestoneLabel(crmLeadTopLevelStage(lead));
    out[label] = (out[label] ?? 0) + 1;
  }
  return out;
}

function leadStableIdentifier(lead: ApiLead): string {
  const row = lead as Record<string, unknown>;
  const fromFields = String(
    row.leadId ?? row.lead_identifier ?? row.leadIdentifier ?? row.uniqueId ?? "",
  )
    .trim()
    .toLowerCase();
  if (fromFields) return fromFields;
  if (lead.id !== undefined && lead.id !== null && String(lead.id).trim()) {
    return String(lead.id).trim();
  }
  return "";
}

/**
 * Journey inventory for admin heatmap (SA / Admin / Super Admin).
 * Id-merge only — same as SM My Leads. Do not phone-collapse:
 * pickMilestoneRepresentativeRows drops blank-milestone Fresh siblings.
 */
function mergeLeadsById(leads: ApiLead[]): ApiLead[] {
  const byId = new Map<string, ApiLead>();
  let noIdSeq = 0;
  for (const lead of leads) {
    const leadIdentifier = leadStableIdentifier(lead);
    const key = leadIdentifier || `__noid_${noIdSeq++}`;
    if (byId.has(key)) continue;
    byId.set(key, lead);
  }
  return [...byId.values()];
}

/**
 * Every admin list row (same `id` in formlead + glead = 2 rows), matching RDS row counts.
 * Do not dedupe by `id` only — that dropped ~243 rows vs `totalElements`.
 */
export async function fetchAllAdminPoolRows(
  input: AdminLeadsFilterInput,
  headers?: HeadersInit,
  maxPages = 80,
): Promise<{ rows: ApiLead[]; totalElements: number }> {
  const pageSize = 500;
  const rows: ApiLead[] = [];
  let totalElements = 0;
  let page = 0;

  while (page < maxPages) {
    const res = await fetchAdminLeadsPage(
      { ...input, page, size: pageSize },
      headers,
      { preserveAllRows: true },
    );
    const chunk = Array.isArray(res.content) ? res.content : [];
    if (page === 0) {
      totalElements = Number(res.totalRowCount ?? res.totalElements ?? chunk.length);
    }
    if (chunk.length === 0) break;
    rows.push(...chunk);
    page += 1;
    const totalPages = Math.max(1, Number(res.totalPages ?? 1));
    if (page >= totalPages) break;
    if (totalElements > 0 && rows.length >= totalElements) break;
    if (chunk.length < pageSize) break;
  }

  return {
    rows,
    totalElements: Math.max(totalElements, rows.length),
  };
}

export async function fetchAllAdminLeads(
  input: AdminLeadsFilterInput,
  headers?: HeadersInit,
  maxPages = 80,
): Promise<{ leads: ApiLead[]; totalElements: number }> {
  const { rows, totalElements } = await fetchAllAdminPoolRows(input, headers, maxPages);
  return { leads: rows, totalElements };
}

/**
 * Full sales CRM inventory for Super Admin / SA / Admin journey heatmap.
 * Hub `/admin/sales` omits walk-in & blank-assignee rows, so Fresh can be ~9 while a single
 * manager filter (using filter merge) shows Fresh ~16. Always use filter mergeAll for sales.
 */
export async function fetchAllSalesFilterMergeLeads(
  input: AdminLeadsFilterInput,
  headers?: HeadersInit,
  maxPages = 80,
): Promise<{ leads: ApiLead[]; totalElements: number }> {
  const pageSize = 500;
  const leads: ApiLead[] = [];
  let totalElements = 0;
  let page = 0;
  let totalPages = 1;

  while (page < maxPages && page < totalPages) {
    const qs = new URLSearchParams();
    qs.set("mergeAll", "1");
    qs.set("page", String(page));
    qs.set("size", String(pageSize));
    const lt = (input.leadType ?? "all").trim().toLowerCase() || "all";
    qs.set("leadType", hubLeadTypeForFilterKey(lt) || "all");
    appendAdminLeadsFilters(qs, {
      ...input,
      workspace: "sales",
      crmMilestoneScope: true,
    });
    if (!qs.get("sort")) {
      qs.set("sort", (input.sort ?? "updatedAt,desc").trim() || "updatedAt,desc");
    }

    const res = await fetch(`/api/crm/leads?${qs.toString()}`, {
      cache: "no-store",
      credentials: "include",
      headers,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Sales filter merge failed (HTTP ${res.status})`);
    }
    const json = (await res.json().catch(() => ({}))) as SpringPage<ApiLead>;
    const chunk = Array.isArray(json.content) ? json.content : [];
    if (page === 0) {
      totalElements = Number(json.totalElements ?? chunk.length);
      totalPages = Math.max(1, Number(json.totalPages ?? 1));
    }
    if (chunk.length === 0) break;
    leads.push(...chunk);
    if (chunk.length < pageSize) break;
    page += 1;
  }

  return {
    leads,
    totalElements: Math.max(totalElements, leads.length),
  };
}

/**
 * Sales: id-merged journey inventory (blank → Fresh Lead).
 * Presales: phone representative still used for month cards parity.
 */
function milestoneCountsFromJourneyRows(
  leads: ApiLead[],
  workspace: CrmWorkspace,
): Record<string, number> {
  const inventory =
    workspace === "sales" ? mergeLeadsById(leads) : pickMilestoneRepresentativeRows(leads);
  return normalizeMilestoneCountsToCanonical(
    milestoneCountsFromLeads(inventory, workspace),
    workspace,
  );
}

/**
 * Milestone phase click for Super Admin / Sales Admin / Admin:
 * same inventory as journey heatmap (sales = filter mergeAll id-merge; blank→Fresh).
 * Hub `/admin/sales` alone under-counts Fresh (e.g. card 70 / 30 vs table 13).
 */
export async function fetchAdminLeadsMilestoneFiltered(
  input: AdminLeadsFilterInput,
  stage: string,
  category: string,
  subStage: string,
  headers?: HeadersInit,
): Promise<{ leads: ApiLead[]; total: number }> {
  let inventory: ApiLead[];
  if (input.workspace === "sales") {
    try {
      const merged = await fetchAllSalesFilterMergeLeads(input, headers);
      inventory = mergeLeadsById(merged.leads);
    } catch {
      const admin = await fetchAllAdminLeads(input, headers);
      inventory = mergeLeadsById(admin.leads);
    }
  } else {
    const admin = await fetchAllAdminLeads(input, headers);
    inventory = admin.leads;
  }
  const vs = (input.verificationStatus ?? "").trim().toLowerCase();
  if (vs === "verified") {
    inventory = inventory.filter((lead) => isCrmLeadVerified(lead));
  } else if (vs === "unverified") {
    inventory = inventory.filter((lead) => !isCrmLeadVerified(lead));
  }
  const filtered = inventory.filter((lead) =>
    leadMatchesWorkspaceMilestoneFilter(lead, input.workspace, stage, category, subStage),
  );
  return { leads: filtered, total: filtered.length };
}

export type AdminLeadsHeatmapData = {
  /** Primary-source unique milestone buckets (RDS heatmap cards). */
  milestoneCounts: Record<string, number>;
  /** Hub `/counts` assignee-pool rows (Total Leads pill). */
  totalElements: number;
  /** Unique customers after phone dedupe (primary `created_at` row). */
  uniquePrimaryTotal: number;
  /** Sum of `milestoneCounts` — heatmap % denominator. */
  pipelineTotal: number;
  verifiedCount: number;
  /** Hub row counts (all tables / duplicates). */
  leadTypeCounts: LeadSourceCounts;
  leadTypeCountsAllRows: LeadSourceCounts;
  /** Primary-source unique per first-touch `leadType`. */
  leadTypeCountsPrimaryUnique: LeadSourceCounts;
  summaryTotals: LeadSummaryTotals;
  /** All pool rows from Hub list (paginated fetch). */
  leads: ApiLead[];
  /** One row per phone for milestone filter + cards. */
  primaryRows: ApiLead[];
  source: "counts" | "list";
};

function finalizeAdminHeatmapData(
  milestoneCounts: Record<string, number>,
  workspace: CrmWorkspace,
  totalElements: number,
  uniquePrimaryTotal: number,
  verifiedCount: number,
  leadTypeCounts: LeadSourceCounts,
  leadTypeCountsAllRows: LeadSourceCounts,
  leadTypeCountsPrimaryUnique: LeadSourceCounts,
  leads: ApiLead[],
  primaryRows: ApiLead[],
  source: "counts" | "list",
): AdminLeadsHeatmapData {
  const normalized = normalizeMilestoneCountsToCanonical(milestoneCounts, workspace);
  const pipelineTotal = totalFromMilestoneCountMap(normalized);
  const summaryTotals =
    workspace === "sales"
      ? salesJourneySummaryFromMilestoneCounts(normalized)
      : { lead: pipelineTotal, opportunity: 0 };
  return {
    milestoneCounts: normalized,
    totalElements,
    uniquePrimaryTotal,
    pipelineTotal,
    verifiedCount,
    leadTypeCounts,
    leadTypeCountsAllRows,
    leadTypeCountsPrimaryUnique,
    summaryTotals,
    leads,
    primaryRows,
    source,
  };
}

export function presalesSummaryMetricsFromLeads(leads: ApiLead[]): {
  totalMonth: number;
  verifiedMonth: number;
  teamVerifiedMonth: number;
} {
  const monthPool = filterLeadsCurrentMonthAssignedPool(leads);
  return {
    totalMonth: monthPool.length,
    verifiedMonth: monthPool.filter((l) => isLeadVerifiedForPresales(l)).length,
    teamVerifiedMonth: 0,
  };
}

const adminHeatmapInflight = new Map<string, Promise<AdminLeadsHeatmapData>>();

/**
 * Heatmap + toolbar totals: prefer Hub `/counts`, fall back to paginated admin list aggregation.
 */
export async function fetchAdminLeadsHeatmapData(
  input: AdminLeadsFilterInput,
  headers?: HeadersInit,
): Promise<AdminLeadsHeatmapData> {
  const cacheKey = `${input.workspace}:${buildAdminLeadsCountsQuery(input).toString()}`;
  const inflight = adminHeatmapInflight.get(cacheKey);
  if (inflight) return inflight;

  const poolInput: AdminLeadsFilterInput = {
    ...input,
    milestoneStage: "",
    milestoneStageCategory: "",
    milestoneSubStage: "",
  };

  const promise = (async (): Promise<AdminLeadsHeatmapData> => {
    let countsJson: AdminLeadsCountsResponse | null = null;
    try {
      countsJson = await fetchAdminLeadsCounts(poolInput, headers);
    } catch {
      countsJson = null;
    }

    /**
     * Sales journey inventory must come from filter mergeAll (includes walk-in /
     * blank-assignee Fresh). Hub `/admin/sales` alone under-counts Fresh (e.g.
     * global Fresh 9 while Kulwanth-filter shows Fresh 16).
     */
    let leads: ApiLead[] = [];
    let totalElements = 0;
    if (input.workspace === "sales") {
      try {
        const merged = await fetchAllSalesFilterMergeLeads(poolInput, headers);
        leads = merged.leads;
        totalElements = merged.totalElements;
      } catch {
        const admin = await fetchAllAdminLeads(poolInput, headers);
        leads = admin.leads;
        totalElements = admin.totalElements;
      }
      const vs = (poolInput.verificationStatus ?? "").trim().toLowerCase();
      if (vs === "verified") {
        leads = leads.filter((lead) => isCrmLeadVerified(lead));
      } else if (vs === "unverified") {
        leads = leads.filter((lead) => !isCrmLeadVerified(lead));
      }
      totalElements = leads.length;
    } else {
      const admin = await fetchAllAdminLeads(poolInput, headers);
      leads = admin.leads;
      totalElements = admin.totalElements;
    }

    const pool = buildAdminPoolDualCounts(leads);
    const authoritativeTotal = Math.max(
      Number(countsJson?.totalElements ?? 0),
      totalElements,
      pool.totalRows,
    );
    /** Sales journey uses id-merge (not phone) so blank milestone stays Fresh Lead. */
    const salesJourneyRows =
      input.workspace === "sales" ? mergeLeadsById(leads) : pickMilestoneRepresentativeRows(leads);
    const milestonePrimaryRows =
      input.workspace === "sales" ? salesJourneyRows : pickMilestoneRepresentativeRows(leads);
    const milestoneCountsFromRows = milestoneCountsFromJourneyRows(leads, input.workspace);
    const hubMilestoneRaw = countsJson
      ? milestoneCountsFromAdminResponse(countsJson, input.workspace)
      : {};
    const hubMilestoneCounts = normalizeMilestoneCountsToCanonical(
      hubMilestoneRaw,
      input.workspace,
    );
    const hubMilestoneTotal = totalFromMilestoneCountMap(hubMilestoneCounts);
    const rowMilestoneTotal = totalFromMilestoneCountMap(milestoneCountsFromRows);
    const rowSummaryTotal = salesJourneySummaryTotalFromMilestoneCounts(milestoneCountsFromRows);
    /**
     * Sales Admin / Super Admin / Admin: always bucket journey from list rows
     * (id-merge, blank/Initial → Fresh). Hub `/counts` only counts exact
     * "Fresh Lead" labels and freezes Fresh low.
     */
    const milestoneCounts =
      input.workspace === "sales"
        ? rowSummaryTotal > 0
          ? milestoneCountsFromRows
          : hubMilestoneTotal > 0
            ? hubMilestoneCounts
            : milestoneCountsFromRows
        : hubMilestoneTotal >= pool.uniquePrimaryTotal
          ? hubMilestoneCounts
          : rowMilestoneTotal >= hubMilestoneTotal
            ? milestoneCountsFromRows
            : hubMilestoneTotal > 0
              ? hubMilestoneCounts
              : milestoneCountsFromRows;
    const fromRowsTypes = computeLeadTypeCountsFromRows(
      input.workspace === "sales" ? salesJourneyRows : leads,
    );
    const leadTypeCounts =
      countsJson?.byLeadType && Object.keys(countsJson.byLeadType).length > 0
        ? adminByLeadTypeToSourceCounts(countsJson.byLeadType, authoritativeTotal)
        : fromRowsTypes;
    if (leadTypeCounts.all === 0 && fromRowsTypes.all > 0) {
      leadTypeCounts.all = fromRowsTypes.all;
      for (const t of CRM_LEAD_TYPES) {
        leadTypeCounts[t] = fromRowsTypes[t];
      }
    }
    // Prefer journey-row type counts for sales so source tiles match heatmap inventory.
    if (input.workspace === "sales" && fromRowsTypes.all > 0) {
      leadTypeCounts.all = fromRowsTypes.all;
      for (const t of CRM_LEAD_TYPES) {
        leadTypeCounts[t] = fromRowsTypes[t];
      }
    }
    const verifiedPrimary =
      input.workspace === "sales"
        ? salesJourneyRows.filter((l) => isCrmLeadVerified(l)).length
        : pool.primaryRows.filter((l) => isCrmLeadVerified(l)).length;

    const ivrOverlayRows =
      input.workspace === "sales"
        ? salesJourneyRows
        : pool.primaryRows.length > 0
          ? pool.primaryRows
          : leads;

    let leadTypeCountsForUi = leadTypeCounts;
    let leadTypeAllRowsForUi =
      input.workspace === "sales" ? fromRowsTypes : pool.leadTypeAllRows;
    let leadTypePrimaryForUi =
      input.workspace === "sales" ? fromRowsTypes : pool.leadTypePrimaryUnique;
    const dateFrom = (poolInput.dateFrom ?? "").trim();
    const dateTo = (poolInput.dateTo ?? "").trim();
    const externalLeadCtx = {
      headers,
      workspace: input.workspace,
      sort: (poolInput.sort ?? "updatedAt,desc").trim() || "updatedAt,desc",
      search: (poolInput.search ?? "").trim(),
      effDates: { from: dateFrom, to: dateTo },
      extraParams: [
        { key: "verificationStatus", value: (poolInput.verificationStatus ?? "").trim() },
        { key: "reinquiry", value: (poolInput.reinquiry ?? "").trim() },
        { key: "assignee", value: (poolInput.assignee ?? "").trim() },
        { key: "dateFrom", value: dateFrom },
        { key: "dateTo", value: dateTo },
        { key: "dateField", value: (poolInput.dateField ?? "").trim() },
        {
          key: "milestoneStage",
          value: (poolInput.milestoneStage ?? "").trim(),
        },
        {
          key: "milestoneStageCategory",
          value: (poolInput.milestoneStageCategory ?? "").trim(),
        },
        {
          key: "milestoneSubStage",
          value: (poolInput.milestoneSubStage ?? "").trim(),
        },
      ],
    };
    try {
      // Sales filter-merge already includes walk-in / WhatsApp rows — do not double-count.
      if (input.workspace !== "sales") {
        let augmented = await augmentLeadSourceCountsWithWalkIn(leadTypeCounts, externalLeadCtx);
        augmented = await augmentLeadSourceCountsWithWhatsapp(augmented, externalLeadCtx);
        leadTypeCountsForUi = augmented;
        leadTypeAllRowsForUi = mergeWhatsappCountIntoSourceCounts(
          mergeWalkInCountIntoSourceCounts(pool.leadTypeAllRows, augmented.walkinlead),
          augmented.whatsapplead,
        );
        leadTypePrimaryForUi = mergeWhatsappCountIntoSourceCounts(
          mergeWalkInCountIntoSourceCounts(pool.leadTypePrimaryUnique, augmented.walkinlead),
          augmented.whatsapplead,
        );
      }
    } catch {
      // Walk-in / WhatsApp augment is optional; admin pool must still load.
    }

    // Hub byLeadType is table-based; reconcile ivrlead + addlead after all augment steps.
    leadTypeCountsForUi = overlayIvrLeadTypeCountsFromRows(leadTypeCountsForUi, ivrOverlayRows);
    if (input.workspace !== "sales") {
      leadTypeAllRowsForUi = overlayIvrLeadTypeCountsFromRows(leadTypeAllRowsForUi, leads);
      leadTypePrimaryForUi = overlayIvrLeadTypeCountsFromRows(
        leadTypePrimaryForUi,
        pool.primaryRows.length > 0 ? pool.primaryRows : leads,
      );
    }

    const journeyTotal =
      input.workspace === "sales"
        ? Math.max(
            salesJourneyRows.length,
            totalFromMilestoneCountMap(milestoneCounts),
          )
        : 0;
    // Sales: Total Leads = journey inventory only (same basis as milestones).
    // Do not max with Hub `/admin/sales` or `/counts` (those omit WI/blank-assignee).
    const displayTotal =
      input.workspace === "sales"
        ? Math.max(journeyTotal, leadTypeCountsForUi.all || 0)
        : Math.max(
            authoritativeTotal,
            leadTypeCountsForUi.all,
            leadTypePrimaryForUi.all,
            leadTypeAllRowsForUi.all,
          );

    return finalizeAdminHeatmapData(
      milestoneCounts,
      input.workspace,
      displayTotal,
      // Sales: id-merge journey length (= phase sum). Not phone primary (under-counts rows).
      input.workspace === "sales" ? salesJourneyRows.length : pool.uniquePrimaryTotal,
      countsJson?.verifiedCount !== undefined && input.workspace !== "sales"
        ? Number(countsJson.verifiedCount)
        : verifiedPrimary,
      leadTypeCountsForUi,
      leadTypeAllRowsForUi,
      leadTypePrimaryForUi,
      input.workspace === "sales" ? salesJourneyRows : leads,
      milestonePrimaryRows,
      countsJson ? "counts" : "list",
    );
  })().finally(() => {
    adminHeatmapInflight.delete(cacheKey);
  });

  adminHeatmapInflight.set(cacheKey, promise);
  return promise;
}

export function appendAdminLeadsFilters(qs: URLSearchParams, input: AdminLeadsFilterInput): void {
  if (input.crmMilestoneScope !== false) {
    qs.set("milestoneScope", "crm");
  }
  qs.set("sort", (input.sort ?? "updatedAt,desc").trim() || "updatedAt,desc");

  appendCrmDateFilters(qs, {
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    dateField: input.dateField,
    crmMonthWindow: input.crmMonthWindow,
    expandMonthWindow: true,
  });

  const lt = (input.leadType ?? "all").trim().toLowerCase();
  if (lt && lt !== "all" && lt !== "verified") {
    qs.set("leadType", hubLeadTypeForFilterKey(lt));
  }
  appendIvrLeadSourceFilter(qs, lt);

  const vs = (input.verificationStatus ?? "").trim();
  if (vs) qs.set("verificationStatus", vs);

  if (input.search?.trim()) qs.set("search", input.search.trim());
  if (input.assigneeAliasSet && input.assigneeAliasSet.length > 0) {
    const aliasJoined = input.assigneeAliasSet
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\0");
    if (aliasJoined) qs.set("assigneeAliasSet", aliasJoined);
  } else if (input.assignee?.trim()) {
    qs.set("assignee", input.assignee.trim());
  }
  if (input.reinquiry?.trim()) qs.set("reinquiry", input.reinquiry.trim());

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

export function adminFilterInputFromQueryString(
  query: string,
  workspace: CrmWorkspace,
  presalesSummaryTab: "total" | "verified" | "teamVerified" | null = null,
): AdminLeadsFilterInput {
  const q = new URLSearchParams(query);
  let verificationStatus = (q.get("verificationStatus") ?? "").trim();
  if (workspace === "presales") {
    if (presalesSummaryTab === "verified" || presalesSummaryTab === "teamVerified") {
      verificationStatus = "verified";
    } else if (presalesSummaryTab === "total") {
      verificationStatus = "";
    }
  }

  const milestoneStage =
    workspace === "presales"
      ? (q.get("presalesMilestoneStage") ?? "")
      : (q.get("milestoneStage") ?? "");
  const milestoneStageCategory =
    workspace === "presales"
      ? (q.get("presalesMilestoneCategory") ?? "")
      : (q.get("milestoneStageCategory") ?? "");
  const milestoneSubStage =
    workspace === "presales"
      ? (q.get("presalesMilestoneSubStage") ?? "")
      : (q.get("milestoneSubStage") ?? "");

  return {
    workspace,
    search: q.get("search") ?? "",
    assignee: q.get("assignee") ?? "",
    dateFrom: q.get("dateFrom") ?? "",
    dateTo: q.get("dateTo") ?? "",
    dateField: q.get("dateField") ?? "",
    crmMonthWindow: q.get("crmMonthWindow") ?? "",
    verificationStatus,
    reinquiry: q.get("reinquiry") ?? "",
    milestoneStage,
    milestoneStageCategory,
    milestoneSubStage,
    leadType: q.get("leadType") ?? "",
  };
}

export async function fetchAdminLeadsPage(
  input: AdminLeadsFilterInput & { page: number; size: number },
  headers?: HeadersInit,
  options?: { preserveAllRows?: boolean },
): Promise<SpringPage<ApiLead>> {
  const qs = new URLSearchParams();
  qs.set("page", String(input.page));
  qs.set("size", String(Math.min(500, Math.max(1, input.size))));
  appendAdminLeadsFilters(qs, input);

  const res = await fetch(`${adminListApiPath(input.workspace)}?${qs.toString()}`, {
    cache: "no-store",
    credentials: "include",
    headers,
  });
  const json = (await res.json().catch(() => ({}))) as AdminLeadsListResponse;
  if (!res.ok) {
    throw new Error(parseAdminErrorMessage(json, `HTTP ${res.status}`));
  }

  const contentRaw = flattenAdminListContent(json.content);
  const totalRowCount = Number(json.totalElements ?? contentRaw.length);
  const uniquePrimaryTotal = Number(json.uniquePrimaryTotal);

  if (options?.preserveAllRows) {
    return {
      content: contentRaw,
      totalElements: contentRaw.length,
      totalRowCount,
      ...(Number.isFinite(uniquePrimaryTotal) && uniquePrimaryTotal >= 0
        ? { uniquePrimaryTotal }
        : {}),
      totalPages: Math.max(1, Number(json.totalPages ?? 1)),
      number: Number(json.number ?? input.page),
      size: Number(json.size ?? input.size),
    };
  }

  const dedupedById = new Map<string, ApiLead>();
  let noIdSeq = 0;
  for (const lead of contentRaw) {
    const leadIdentifier = leadStableIdentifier(lead);
    const key = leadIdentifier || `__noid_${noIdSeq++}`;
    if (!dedupedById.has(key)) dedupedById.set(key, lead);
  }
  const content = [...dedupedById.values()];
  const resolvedTotalElements =
    Number.isFinite(uniquePrimaryTotal) && uniquePrimaryTotal >= 0
      ? uniquePrimaryTotal
      : totalRowCount > 0
        ? totalRowCount
        : content.length;

  return {
    content,
    totalElements: resolvedTotalElements,
    totalRowCount: totalRowCount > 0 ? totalRowCount : resolvedTotalElements,
    ...(Number.isFinite(uniquePrimaryTotal) && uniquePrimaryTotal >= 0
      ? { uniquePrimaryTotal }
      : {}),
    totalPages: Math.max(1, Number(json.totalPages ?? 1)),
    number: Number(json.number ?? input.page),
    size: Number(json.size ?? input.size),
  };
}

export function buildAdminLeadsCountsQuery(input: AdminLeadsFilterInput): URLSearchParams {
  const qs = new URLSearchParams();
  appendAdminLeadsFilters(qs, input);
  return qs;
}

const adminCountsInflight = new Map<string, Promise<AdminLeadsCountsResponse>>();

export async function fetchAdminLeadsCounts(
  input: AdminLeadsFilterInput,
  headers?: HeadersInit,
): Promise<AdminLeadsCountsResponse> {
  const qs = buildAdminLeadsCountsQuery(input);
  const cacheKey = `${input.workspace}:${qs.toString()}`;
  const inflight = adminCountsInflight.get(cacheKey);
  if (inflight) return inflight;

  const promise = (async () => {
    const res = await fetch(`${adminCountsApiPath(input.workspace)}?${qs.toString()}`, {
      cache: "no-store",
      credentials: "include",
      headers,
    });
    const json = (await res.json().catch(() => ({}))) as AdminLeadsCountsResponse;
    if (!res.ok) {
      throw new Error(parseAdminErrorMessage(json, `HTTP ${res.status}`));
    }
    return json;
  })().finally(() => {
    adminCountsInflight.delete(cacheKey);
  });

  adminCountsInflight.set(cacheKey, promise);
  return promise;
}
