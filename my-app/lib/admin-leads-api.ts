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
  if (!key) return "Fresh Lead";
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
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
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
  return String(row.leadId ?? row.lead_identifier ?? row.leadIdentifier ?? "")
    .trim()
    .toLowerCase();
}

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

/** Milestone buckets: one customer per phone using current milestone row (latest with stage). */
function milestoneCountsFromPrimarySourceRows(
  leads: ApiLead[],
  workspace: CrmWorkspace,
): Record<string, number> {
  return normalizeMilestoneCountsToCanonical(
    milestoneCountsFromLeads(pickMilestoneRepresentativeRows(leads), workspace),
    workspace,
  );
}

/** Full admin pool + milestone filter on primary-source rows (heatmap card = table rows). */
export async function fetchAdminLeadsMilestoneFiltered(
  input: AdminLeadsFilterInput,
  stage: string,
  category: string,
  subStage: string,
  headers?: HeadersInit,
): Promise<{ leads: ApiLead[]; total: number }> {
  const { leads } = await fetchAllAdminLeads(input, headers);
  const primaryRows = pickMilestoneRepresentativeRows(leads);
  const filtered = primaryRows.filter((lead) =>
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

    const { leads, totalElements } = await fetchAllAdminLeads(poolInput, headers);
    const pool = buildAdminPoolDualCounts(leads);
    const authoritativeTotal = Math.max(
      Number(countsJson?.totalElements ?? 0),
      totalElements,
      pool.totalRows,
    );
    const milestonePrimaryRows = pickMilestoneRepresentativeRows(leads);
    const milestoneCountsFromRows = normalizeMilestoneCountsToCanonical(
      milestoneCountsFromLeads(milestonePrimaryRows, input.workspace),
      input.workspace,
    );
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
    const hubSummaryTotal = salesJourneySummaryTotalFromMilestoneCounts(hubMilestoneCounts);
    const milestoneCounts =
      input.workspace === "sales"
        ? rowSummaryTotal >= pool.uniquePrimaryTotal
          ? milestoneCountsFromRows
          : hubSummaryTotal >= pool.uniquePrimaryTotal
            ? hubMilestoneCounts
            : rowMilestoneTotal >= hubMilestoneTotal
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
    const fromRowsTypes = computeLeadTypeCountsFromRows(leads);
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
    const verifiedPrimary = pool.primaryRows.filter((l) => isCrmLeadVerified(l)).length;

    let leadTypeCountsForUi = leadTypeCounts;
    let leadTypeAllRowsForUi = pool.leadTypeAllRows;
    let leadTypePrimaryForUi = pool.leadTypePrimaryUnique;
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
    } catch {
      // Walk-in / WhatsApp augment is optional; admin pool must still load.
    }

    const displayTotal = Math.max(
      authoritativeTotal,
      leadTypeCountsForUi.all,
      leadTypePrimaryForUi.all,
      leadTypeAllRowsForUi.all,
    );

    return finalizeAdminHeatmapData(
      milestoneCounts,
      input.workspace,
      displayTotal,
      pool.uniquePrimaryTotal,
      countsJson?.verifiedCount !== undefined
        ? Number(countsJson.verifiedCount)
        : verifiedPrimary,
      leadTypeCountsForUi,
      leadTypeAllRowsForUi,
      leadTypePrimaryForUi,
      leads,
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
