/** CRM `/v1/leads/filter` + merged list helpers (Project-ERP contract). */

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
  customerName?: string;
  companyName?: string;
  email?: string;
  assignee?: string | { name?: string; fullName?: string };
  salesOwner?: string | { name?: string; fullName?: string };
  updatedAt?: string;
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

function assigneeName(lead: ApiLead): string {
  const a = lead.assignee ?? lead.salesOwner;
  if (!a) return "—";
  if (typeof a === "string") return a;
  return a.name ?? a.fullName ?? "—";
}

function leadDisplayName(lead: ApiLead): string {
  return (
    lead.name ??
    lead.customerName ??
    lead.email ??
    (lead.id !== undefined ? `Lead ${lead.id}` : "—")
  );
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
export function mapApiLeadToRow(lead: ApiLead, sourceLeadType: CrmLeadType): LeadRowModel {
  const st = lead.stage;
  const statusLabel =
    st?.milestoneSubStage?.trim() ||
    st?.milestoneStage?.trim() ||
    st?.substage?.substage?.trim() ||
    undefined;
  const journeyStage =
    (st?.milestoneStageCategory ?? st?.milestoneStage ?? "PIPELINE").trim() || "PIPELINE";

  return {
    id: String(lead.id ?? ""),
    leadType: asCrmLeadType(lead.leadType, sourceLeadType),
    name: leadDisplayName(lead),
    company: companyFallback(lead),
    statusLabel,
    journey: {
      stage: journeyStage.toUpperCase(),
      progressLabel: "—",
      progressPct: 0,
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
