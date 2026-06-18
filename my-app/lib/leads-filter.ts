/** CRM `/v1/leads/filter` + merged list helpers (Project-ERP contract). */

import { computeMilestoneProgress, normalizeStageKey } from "@/lib/milestone-progress";
import {
  isClosedWonCustomerSubstage,
  isClosedWonPathCategory,
} from "@/lib/milestone-substage-map";
import { getLeadDisplayName } from "@/lib/lead-display";
import {
  formatPresalesListStatusLabel,
  getListDisplayMilestone,
  isPresalesHandedOffReadOnly,
  PRESALES_PIPELINE_STAGE_ORDER,
  presalesTopLevelStage,
  shouldUsePresalesListDisplay,
  usePresalesListDisplayForWorkspace,
} from "@/lib/presales-milestone";
import type { CrmWorkspace } from "@/lib/crm-workspace";

export const CRM_LEAD_TYPES = [
  "formlead",
  "glead",
  "mlead",
  "addlead",
  "websitelead",
  "walkinlead",
  "whatsapplead",
] as const;

export type CrmLeadType = (typeof CRM_LEAD_TYPES)[number];

export type LeadSourceCounts = Record<"all" | CrmLeadType, number>;

export type LeadSummaryTotals = {
  lead: number;
  opportunity: number;
};

export type SpringPage<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  /** Unique customers (primary-source phone dedupe) when list API provides it. */
  uniquePrimaryTotal?: number;
  /** Hub row count when it differs from `totalElements` (pagination basis). */
  totalRowCount?: number;
  sourceCounts?: LeadSourceCounts;
  summaryTotals?: LeadSummaryTotals;
  /** SUPER_ADMIN cross-pool search: per-pool match counts (not deduped across pools). */
  salesSearchTotal?: number;
  presalesSearchTotal?: number;
  /** Present when mergeAll could not load one or more lead types (e.g. Hub 403). */
  accessDeniedLeadTypes?: CrmLeadType[];
};

/** Minimal lead fields from backend; extend as entity stabilizes. */
export type ApiLead = {
  id?: number | string;
  /** Filter API often includes which source bucket this row came from */
  leadType?: string;
  name?: string;
  fullName?: string;
  customerName?: string;
  dynamicFields?: Record<string, unknown>;
  companyName?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  mobile?: string;
  mobileNumber?: string;
  customerId?: string | number;
  assignee?: string | { name?: string; fullName?: string };
  salesOwner?: string | { name?: string; fullName?: string };
  updatedAt?: string;
  createdAt?: string;
  createdDate?: string;
  leadDate?: string;
  createdOn?: string;
  firstCallAt?: string | null;
  verified?: boolean | null;
  /**
   * Backend truth for New CRM list/detail and `verificationStatus=verified` filters.
   * Optional: `presalesTrackingReadOnly` (when API sends it) — detail UX only; does not redefine “verified”.
   */
  verificationStatus?: string | null;
  presalesTrackingReadOnly?: boolean | null;
  /** Next follow-up (string in API; parse client-side for “today” / overdue). */
  followUpDate?: string | null;
  meetingDate?: string | null;
  assignedAt?: string | null;
  additionalLeadSources?: string | string[] | null;
  presalesMilestoneStage?: string | null;
  presalesMilestoneCategory?: string | null;
  presalesMilestoneSubStage?: string | null;
  /** Hub admin pool rows: assignee's CRM role (SALES_EXECUTIVE, PRESALES_EXECUTIVE, …). */
  assigneeRole?: string | null;
  stage?: {
    milestoneStage?: string | null;
    milestoneStageCategory?: string | null;
    milestoneSubStage?: string | null;
    presalesMilestoneStage?: string | null;
    presalesMilestoneCategory?: string | null;
    presalesMilestoneSubStage?: string | null;
    stage?: string | null;
    substage?: { substage?: string | null } | null;
  } | null;
};

export type LeadRowModel = {
  id: string;
  /** Required for detail URL `/Leads/[leadType]/[id]` */
  leadType: CrmLeadType;
  enquiryDate: string;
  name: string;
  company: string;
  statusLabel?: string;
  verificationTag?: "verified" | "unverified";
  reinquiry?: boolean;
  callDelayed?: boolean;
  journey: {
    stage: string;
    progressLabel: string;
    progressPct: number;
    status?: { label: string; tone: "critical" | "intervention" };
  };
  owner: { name: string };
  engagement: { time: string; action: string; tone?: "ok" | "late" };
  actionIcon?: "bolt" | "alert";
  /** Orange = presales pipeline, blue = sales pipeline (list journey column). */
  pipelineBadge?: "presales" | "sales";
  handedOffReadOnly?: boolean;
};

function pickLeadScalar(lead: ApiLead, keys: string[]): unknown {
  const r = lead as Record<string, unknown>;
  for (const k of keys) {
    if (!(k in r)) continue;
    const v = r[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  const df = lead.dynamicFields;
  if (df && typeof df === "object" && !Array.isArray(df)) {
    const d = df as Record<string, unknown>;
    for (const k of keys) {
      if (!(k in d)) continue;
      const v = d[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
  }
  return undefined;
}

function normalizeVerificationTag(lead: ApiLead): "verified" | "unverified" | undefined {
  const rawVs = pickLeadScalar(lead, [
    "verificationStatus",
    "verification_status",
    "verifyStatus",
    "leadVerificationStatus",
  ]);
  const vs = String(rawVs ?? lead.verificationStatus ?? "").trim().toLowerCase();
  if (
    vs === "verified" ||
    vs === "true" ||
    vs === "1" ||
    vs === "yes" ||
    vs === "complete" ||
    vs === "done"
  ) {
    return "verified";
  }
  if (vs === "unverified" || vs === "false" || vs === "0" || vs === "no" || vs === "pending") {
    return "unverified";
  }

  const boolKeys = ["verified", "isVerified", "is_verified", "leadVerified", "presalesVerified"];
  for (const k of boolKeys) {
    const v = pickLeadScalar(lead, [k]);
    if (typeof v === "boolean") return v ? "verified" : "unverified";
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "true" || s === "yes" || s === "1" || s === "verified") return "verified";
      if (s === "false" || s === "no" || s === "0" || s === "unverified") return "unverified";
    }
    if (typeof v === "number") {
      if (v === 1) return "verified";
      if (v === 0) return "unverified";
    }
  }
  if (typeof lead.verified === "boolean") return lead.verified ? "verified" : "unverified";
  return undefined;
}

/**
 * Whether this lead counts as verified — same rule as the grid tag, heatmap “Verified” card,
 * and `GET .../leads?verificationStatus=verified` (backend fields only; not editable client-side).
 */
export function isCrmLeadVerified(lead: ApiLead): boolean {
  return normalizeVerificationTag(lead) === "verified";
}

function hasReinquiry(lead: ApiLead): boolean {
  const src = lead.additionalLeadSources;
  if (Array.isArray(src)) return src.some((v) => String(v).trim().length > 0);
  return typeof src === "string" && src.trim().length > 0;
}

function leadDynamicFields(lead: ApiLead): Record<string, unknown> {
  const r = lead as Record<string, unknown>;
  const df = r.dynamicFields;
  if (df && typeof df === "object" && !Array.isArray(df)) {
    return df as Record<string, unknown>;
  }
  return {};
}

function pickLeadAssigneeFlatString(lead: ApiLead): string {
  const r = lead as Record<string, unknown>;
  const keys = [
    "salesExecutive",
    "assignedTo",
    "assignedToName",
    "salesOwnerName",
    "executiveName",
    "ownerName",
    "salesRepName",
    "rmName",
    "relationshipManager",
    "assignee",
  ];
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const d = leadDynamicFields(lead);
  for (const k of keys) {
    const v = d[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Numeric owner ids on list rows (FormLead often uses snake_case or nested user). */
export function readLeadSalesExecutiveIds(lead: ApiLead): number[] {
  const r = lead as Record<string, unknown>;
  const ids = new Set<number>();
  const push = (v: unknown) => {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) ids.add(n);
  };
  for (const k of [
    "assigneeId",
    "assignee_id",
    "assignedToId",
    "assigned_to_id",
    "salesExecutiveId",
    "sales_executive_id",
    "salesOwnerId",
    "sales_owner_id",
    "userId",
  ]) {
    push(r[k]);
  }
  const d = leadDynamicFields(lead);
  for (const k of ["assigneeId", "assignedToId", "salesExecutiveId", "sales_executive_id"]) {
    push(d[k]);
  }
  for (const key of ["assignee", "assignedTo", "salesOwner", "assignedUser", "owner"]) {
    const v = r[key];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      push((v as { id?: unknown }).id);
    }
  }
  return [...ids];
}

function pickPersonAssigneeString(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const o = value as { name?: string; fullName?: string; username?: string };
  return String(o.name ?? o.fullName ?? o.username ?? "").trim();
}

/** Same fields the list uses for “owner”; flat + nested assignee fields. */
export function crmLeadAssigneeLabel(lead: ApiLead): string {
  const flat = pickLeadAssigneeFlatString(lead);
  if (flat) return flat;
  const r = lead as Record<string, unknown>;
  for (const key of ["assignee", "salesOwner", "assignedTo", "assignedUser", "owner"]) {
    const picked = pickPersonAssigneeString(r[key]);
    if (picked) return picked;
  }
  const a = lead.assignee ?? lead.salesOwner;
  return pickPersonAssigneeString(a);
}

/** Lowercase tokens for matching filters / team scope (all assignee-like fields on the lead). */
export function crmLeadAssigneeAliasNorms(lead: ApiLead): Set<string> {
  const out = new Set<string>();
  const add = (s: string) => {
    const n = s.trim().toLowerCase();
    if (n) out.add(n);
  };
  const r = lead as Record<string, unknown>;
  const flatKeys = [
    "salesExecutive",
    "assignedTo",
    "assignedToName",
    "salesOwnerName",
    "executiveName",
    "ownerName",
    "salesRepName",
    "rmName",
    "relationshipManager",
    "assignee",
  ];
  for (const k of flatKeys) {
    const v = r[k];
    if (typeof v === "string") add(v);
  }
  const d = leadDynamicFields(lead);
  for (const k of flatKeys) {
    const v = d[k];
    if (typeof v === "string") add(v);
  }
  for (const key of ["assignee", "salesOwner", "assignedTo", "assignedUser", "owner"]) {
    const v = r[key];
    if (typeof v === "string") add(v);
    else if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as { name?: string; fullName?: string; username?: string };
      add(String(o.name ?? ""));
      add(String(o.fullName ?? ""));
      add(String(o.username ?? ""));
    }
  }
  add(crmLeadAssigneeLabel(lead));
  return out;
}

function assigneeName(lead: ApiLead): string {
  return crmLeadAssigneeLabel(lead) || "—";
}

function leadDisplayName(lead: ApiLead): string {
  return getLeadDisplayName(lead as Record<string, unknown>);
}

function companyFallback(lead: ApiLead): string {
  return lead.companyName ?? "—";
}

/** Legacy filter bucket — only rows with no milestone fields at all. */
export const SALES_POOL_NO_MILESTONE = "No milestone";

const SALES_POOL_STAGES = [
  "Fresh Lead",
  "Discovery",
  "Connection",
  "Experience & Design",
  "Decision",
  "Closed",
] as const;

function leadStageObject(lead: ApiLead): Record<string, unknown> | null {
  const r = lead as Record<string, unknown>;
  if (lead.stage && typeof lead.stage === "object" && !Array.isArray(lead.stage)) {
    return lead.stage as Record<string, unknown>;
  }
  const stageBlock = r.stageBlock;
  if (stageBlock && typeof stageBlock === "object" && !Array.isArray(stageBlock)) {
    return stageBlock as Record<string, unknown>;
  }
  return null;
}

/** Read sales milestone fields from `stage`, `stageBlock`, root, or `dynamicFields`. */
export function readSalesStageFieldsFromLead(lead: ApiLead): {
  milestoneStage: string;
  milestoneStageCategory: string;
  milestoneSubStage: string;
} {
  const st = leadStageObject(lead);
  const milestoneStage = String(
    st?.milestoneStage ??
      pickLeadScalar(lead, ["milestoneStage", "milestone_stage"]) ??
      "",
  ).trim();
  const milestoneStageCategory = String(
    st?.milestoneStageCategory ??
      pickLeadScalar(lead, ["milestoneStageCategory", "milestone_stage_category"]) ??
      "",
  ).trim();
  const substageObj = st?.substage;
  const nestedSub =
    substageObj && typeof substageObj === "object" && !Array.isArray(substageObj)
      ? String((substageObj as { substage?: string }).substage ?? "").trim()
      : "";
  const scalarSub = pickLeadScalar(lead, ["milestoneSubStage", "milestone_sub_stage"]);
  const fallbackSub =
    nestedSub || (typeof scalarSub === "string" ? scalarSub.trim() : "");
  const milestoneSubStage = String(st?.milestoneSubStage ?? fallbackSub).trim();
  return { milestoneStage, milestoneStageCategory, milestoneSubStage };
}

/** True when any sales milestone field is present on the row (strict empty check). */
export function leadHasRawSalesMilestone(lead: ApiLead): boolean {
  const fields = readSalesStageFieldsFromLead(lead);
  return Boolean(
    fields.milestoneStage || fields.milestoneStageCategory || fields.milestoneSubStage,
  );
}

function readSalesMilestoneStageRaw(lead: ApiLead): string {
  return readSalesStageFieldsFromLead(lead).milestoneStage;
}

/** Strict top-level stage for milestone filters (`No milestone` = all fields empty). */
export function salesPoolMilestoneStage(lead: ApiLead): string {
  const raw = readSalesMilestoneStageRaw(lead);
  if (!raw) return "";
  const key = normalizeStageKey(raw);
  for (const phase of SALES_POOL_STAGES) {
    if (normalizeStageKey(phase) === key) return phase;
  }
  return raw;
}

/** Same rules as the leads table journey column and journey summary cards. */
export function crmLeadTopLevelStage(lead: ApiLead): string {
  const { milestoneStage: stage, milestoneStageCategory: stageCategory, milestoneSubStage: subStage } =
    readSalesStageFieldsFromLead(lead);
  const stageKey = normalizeStageKey(stage);
  const categoryKey = normalizeStageKey(stageCategory);

  // Won / booking / token paths often keep a non-Closed `milestoneStage` on the API.
  if (
    stageKey === "closed" ||
    categoryKey.includes("closed") ||
    isClosedWonPathCategory(stageCategory) ||
    isClosedWonCustomerSubstage(subStage)
  ) {
    return "Closed";
  }

  const looksFreshLead = [stage, stageCategory, subStage].some((value) => {
    const normalized = normalizeStageKey(value);
    return normalized === "fresh lead" || normalized === "fresh leads" || /^fresh\s+leads?$/.test(normalized);
  });

  if (looksFreshLead) return "Fresh Lead";
  if (stage) return stage;
  return "Fresh Lead";
}

function leadCreatedAtRaw(lead: ApiLead): string {
  return String(
    lead.createdAt ??
      lead.createdDate ??
      lead.leadDate ??
      lead.createdOn ??
      "",
  ).trim();
}

function formatEnquiryDate(raw?: string): string {
  if (!raw) return "—";
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return "—";
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(t).toLocaleDateString();
}

export function asCrmLeadType(raw: string | undefined, fallback: CrmLeadType): CrmLeadType {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "formlead" || t === "glead" || t === "mlead" || t === "addlead" || t === "websitelead" || t === "walkinlead" || t === "whatsapplead") {
    return t;
  }
  return fallback;
}

/** Map API entity to the existing Leads table row shape. */
export function mapApiLeadToRow(
  lead: ApiLead,
  sourceLeadType: CrmLeadType,
  orderedPipelineStages: string[] = [],
  userRole = "",
  leadsWorkspace: CrmWorkspace = "sales",
): LeadRowModel {
  const usePresalesDisplay = usePresalesListDisplayForWorkspace(
    leadsWorkspace,
    lead,
    userRole,
  );
  const display = getListDisplayMilestone(lead, userRole);
  const st = lead.stage;
  const pipelineOrder = usePresalesDisplay
    ? [...PRESALES_PIPELINE_STAGE_ORDER]
    : orderedPipelineStages;

  const statusLabel = usePresalesDisplay
    ? formatPresalesListStatusLabel(display)
    : st?.milestoneSubStage?.trim() ||
      st?.milestoneStage?.trim() ||
      st?.substage?.substage?.trim() ||
      undefined;

  const ms = usePresalesDisplay ? presalesTopLevelStage(lead) : crmLeadTopLevelStage(lead);
  const prog = computeMilestoneProgress(ms, pipelineOrder);
  const fallbackJourney = usePresalesDisplay
    ? (display.stage || "Fresh Data").trim()
    : (st?.milestoneStageCategory ?? ms ?? "PIPELINE").trim() || "PIPELINE";
  const journeyStage =
    pipelineOrder.length > 0 ? prog.stageLabel : fallbackJourney.toUpperCase();

  return {
    id: String(lead.id ?? ""),
    leadType: asCrmLeadType(lead.leadType, sourceLeadType),
    enquiryDate: formatEnquiryDate(leadCreatedAtRaw(lead)),
    name: leadDisplayName(lead),
    company: companyFallback(lead),
    statusLabel,
    verificationTag: normalizeVerificationTag(lead),
    reinquiry: hasReinquiry(lead),
    journey: {
      stage: journeyStage,
      progressLabel: pipelineOrder.length > 0 ? prog.progressLabel : "—",
      progressPct: pipelineOrder.length > 0 ? prog.pct : 0,
    },
    owner: { name: assigneeName(lead) },
    engagement: {
      time: formatRelativeTime(lead.updatedAt),
      action: "Updated",
      tone: "ok",
    },
    actionIcon: "bolt",
    pipelineBadge: usePresalesDisplay ? "presales" : "sales",
    handedOffReadOnly: isPresalesHandedOffReadOnly(lead, userRole),
  };
}
