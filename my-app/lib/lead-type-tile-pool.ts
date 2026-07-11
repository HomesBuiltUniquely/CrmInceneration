import type { CrmWorkspace } from "@/lib/crm-workspace";
import { defaultVerificationForLeadTypeFilter } from "@/lib/crm-workspace";
import type { AdminLeadsFilterInput, AdminLeadsHeatmapData } from "@/lib/admin-leads-api";
import type { CrmLeadType, LeadSourceCounts } from "@/lib/leads-filter";
import { CRM_LEAD_TYPES } from "@/lib/leads-filter";
import { emptyLeadSourceCounts } from "@/lib/primary-source-leads";

export type LeadTypeCountPool = "sales" | "presales" | "total";

export type LeadTypeSourceTile = {
  label: string;
  leadTypeKey: CrmLeadType | "all" | "ivr_call";
};

export const ADMIN_SOURCE_LEAD_TYPE_TILES: LeadTypeSourceTile[] = [
  { label: "External Lead", leadTypeKey: "formlead" },
  { label: "Google Ads", leadTypeKey: "glead" },
  { label: "Meta Ads", leadTypeKey: "mlead" },
  { label: "Add Lead", leadTypeKey: "addlead" },
  { label: "IVR Call", leadTypeKey: "ivr_call" },
  { label: "Website Lead", leadTypeKey: "websitelead" },
  { label: "Walk-in Lead", leadTypeKey: "walkinlead" },
  { label: "WhatsApp", leadTypeKey: "whatsapplead" },
];

const DEDICATED_POOL_LEAD_TYPES: CrmLeadType[] = ["walkinlead", "whatsapplead"];

export type CrossPoolLeadTypeCounts = {
  sales: LeadSourceCounts;
  presales: LeadSourceCounts;
};

/** Shared toolbar filters when loading sales + presales heatmaps for Lead Types tiles. */
export type CrossPoolHeatmapSharedFilters = {
  search: string;
  assignee: string;
  dateFrom: string;
  dateTo: string;
  dateField: string;
  crmMonthWindow: string;
  summaryLeadType: string;
  verificationStatusProp: string;
  reinquiry: string;
  roleKey: string;
  viewerWorkspace: CrmWorkspace;
};

/** Each assignee pool uses its own verification default — not the viewer CRM tab default. */
export function verificationForCrossPoolHeatmap(
  targetWorkspace: CrmWorkspace,
  shared: CrossPoolHeatmapSharedFilters,
): string {
  if (shared.summaryLeadType === "verified") return "verified";
  const explicit = shared.verificationStatusProp.trim();
  if (explicit && targetWorkspace === shared.viewerWorkspace) return explicit;
  return defaultVerificationForLeadTypeFilter(
    shared.summaryLeadType,
    targetWorkspace,
    "",
    shared.roleKey,
  );
}

export function buildCrossPoolHeatmapFilterInput(
  targetWorkspace: CrmWorkspace,
  shared: CrossPoolHeatmapSharedFilters,
): AdminLeadsFilterInput {
  return {
    workspace: targetWorkspace,
    search: shared.search,
    assignee: shared.assignee,
    dateFrom: shared.dateFrom,
    dateTo: shared.dateTo,
    dateField: shared.dateField,
    crmMonthWindow: shared.crmMonthWindow,
    verificationStatus: verificationForCrossPoolHeatmap(targetWorkspace, shared),
    reinquiry: targetWorkspace === "presales" ? shared.reinquiry : "",
    milestoneStage: "",
    milestoneStageCategory: "",
    milestoneSubStage: "",
    leadType: shared.summaryLeadType,
  };
}

export function pickLeadTypeCountsFromHeatmap(data: AdminLeadsHeatmapData): LeadSourceCounts {
  const primary =
    data.leadTypeCountsPrimaryUnique?.all > 0
      ? { ...data.leadTypeCountsPrimaryUnique }
      : { ...data.leadTypeCounts };

  // Walk-in / WhatsApp are workspace-scoped on `leadTypeCounts` after pool augment.
  for (const leadType of DEDICATED_POOL_LEAD_TYPES) {
    const scoped = Number(data.leadTypeCounts[leadType] ?? 0);
    const prev = Number(primary[leadType] ?? 0);
    if (scoped === prev) continue;
    primary.all = Number(primary.all ?? 0) + (scoped - prev);
    primary[leadType] = scoped;
  }

  return primary;
}

export function mergeLeadSourceCounts(a: LeadSourceCounts, b: LeadSourceCounts): LeadSourceCounts {
  const out = emptyLeadSourceCounts();
  for (const t of CRM_LEAD_TYPES) {
    out[t] = Number(a[t] ?? 0) + Number(b[t] ?? 0);
  }
  out.all = Number(a.all ?? 0) + Number(b.all ?? 0);
  return out;
}

export function leadSourceCountsForPool(
  pool: LeadTypeCountPool,
  crossPool: CrossPoolLeadTypeCounts | null | undefined,
  fallback: LeadSourceCounts,
): LeadSourceCounts {
  if (!crossPool) return fallback;
  if (pool === "sales") return crossPool.sales;
  if (pool === "presales") return crossPool.presales;
  return mergeLeadSourceCounts(crossPool.sales, crossPool.presales);
}

export function defaultLeadTypeCountPool(workspace: CrmWorkspace): LeadTypeCountPool {
  return workspace === "presales" ? "presales" : "sales";
}

/** Click-to-filter only when pool matches current CRM workspace (or Total). */
export function leadTypeTileClickFiltersTable(
  pool: LeadTypeCountPool,
  workspace: CrmWorkspace,
): boolean {
  if (pool === "total") return true;
  if (workspace === "sales") return pool === "sales";
  if (workspace === "presales") return pool === "presales";
  return false;
}
