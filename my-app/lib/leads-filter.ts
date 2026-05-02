/** CRM `/v1/leads/filter` + merged list helpers (Project-ERP contract). */

import { computeMilestoneProgress } from "@/lib/milestone-progress";
import { getLeadDisplayName } from "@/lib/lead-display";

export const CRM_LEAD_TYPES = ["formlead", "glead", "mlead", "addlead", "websitelead"] as const;

export type CrmLeadType = (typeof CRM_LEAD_TYPES)[number];

export type SpringPage<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
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
  additionalLeadSources?: string | string[] | null;
  stage?: {
    milestoneStage?: string | null;
    milestoneStageCategory?: string | null;
    milestoneSubStage?: string | null;
    stage?: string | null;
    substage?: { substage?: string | null } | null;
  } | null;
};

export type LeadRowModel = {
  id: string;
  /** Required for detail URL `/Leads/[leadType]/[id]` */
  leadType: CrmLeadType;
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
};

function normalizeVerificationTag(lead: ApiLead): "verified" | "unverified" | undefined {
  const vs = String(lead.verificationStatus ?? "").trim().toLowerCase();
  if (vs === "verified") return "verified";
  if (vs === "unverified") return "unverified";
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

/** Same fields the list uses for “owner”; includes `username` when name/fullName missing. */
export function crmLeadAssigneeLabel(lead: ApiLead): string {
  const a = lead.assignee ?? lead.salesOwner;
  if (!a) return "";
  if (typeof a === "string") return a.trim();
  const o = a as { name?: string; fullName?: string; username?: string };
  return String(o.name ?? o.fullName ?? o.username ?? "").trim();
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
  if (t === "formlead" || t === "glead" || t === "mlead" || t === "addlead" || t === "websitelead") {
    return t;
  }
  return fallback;
}

/** Map API entity to the existing Leads table row shape. */
export function mapApiLeadToRow(
  lead: ApiLead,
  sourceLeadType: CrmLeadType,
  orderedPipelineStages: string[] = []
): LeadRowModel {
  const st = lead.stage;
  const statusLabel =
    st?.milestoneSubStage?.trim() ||
    st?.milestoneStage?.trim() ||
    st?.substage?.substage?.trim() ||
    undefined;

  const ms = st?.milestoneStage?.trim();
  const prog = computeMilestoneProgress(ms, orderedPipelineStages);
  const fallbackJourney =
    (st?.milestoneStageCategory ?? st?.milestoneStage ?? "PIPELINE").trim() || "PIPELINE";
  const journeyStage =
    orderedPipelineStages.length > 0 ? prog.stageLabel : fallbackJourney.toUpperCase();

  return {
    id: String(lead.id ?? ""),
    leadType: asCrmLeadType(lead.leadType, sourceLeadType),
    name: leadDisplayName(lead),
    company: companyFallback(lead),
    statusLabel,
    verificationTag: normalizeVerificationTag(lead),
    reinquiry: hasReinquiry(lead),
    journey: {
      stage: journeyStage,
      progressLabel: orderedPipelineStages.length > 0 ? prog.progressLabel : "—",
      progressPct: orderedPipelineStages.length > 0 ? prog.pct : 0,
    },
    owner: { name: assigneeName(lead) },
    engagement: {
      time: formatRelativeTime(lead.updatedAt),
      action: "Updated",
      tone: "ok",
    },
    actionIcon: "bolt",
  };
}
