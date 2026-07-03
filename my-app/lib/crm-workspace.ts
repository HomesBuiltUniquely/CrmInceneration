import { normalizeRole } from "@/lib/auth/api";
import {
  assigneeRoleFromLead,
  isPresalesAssigneeRole,
  isSalesAssigneeRole,
} from "@/lib/assignment-reassign";
import {
  readSalesStageFieldsFromLead,
  SALES_POOL_NO_MILESTONE,
  salesPoolMilestoneStage,
  type ApiLead,
} from "@/lib/leads-filter";
import { normalizeStageKey } from "@/lib/milestone-progress";
import type { MilestoneFilterQuery } from "@/lib/presales-milestone";
import { presalesTopLevelStage, readPresalesMilestoneFromLead } from "@/lib/presales-milestone";
import { isAdminRole } from "@/lib/roleUtils";
import type { QuickAccessParentItem } from "@/app/Components/Shared/QuickAccessSidebar";
import {
  dashboardSidebarSections,
  presalesWorkspaceSidebarSections,
  salesWorkspaceSidebarSections,
} from "@/app/Components/Shared/sidebar-data";

/** CRM area split: sales pipeline vs presales pipeline (routes + dashboards). */
export type CrmWorkspace = "sales" | "presales";

export function workspaceFromPathname(pathname: string): CrmWorkspace {
  const p = (pathname ?? "").trim().toLowerCase();
  if (p === "/presales-leads" || p.startsWith("/presales-leads/")) return "presales";
  if (p === "/presales-dashboard" || p.startsWith("/presales-dashboard/")) return "presales";
  return "sales";
}

export function isPresalesPath(pathname: string): boolean {
  return workspaceFromPathname(pathname) === "presales";
}

export function pipelineRoleForWorkspace(workspace: CrmWorkspace): string {
  return workspace === "presales" ? "PRESALES_EXECUTIVE" : "SALES_EXECUTIVE";
}

export function milestoneFilterQueryForWorkspace(
  workspace: CrmWorkspace,
  stage: string,
  category: string,
  subStage: string,
): MilestoneFilterQuery {
  const out: MilestoneFilterQuery = {};
  if (!stage.trim() && !category.trim() && !subStage.trim()) return out;
  if (workspace === "presales") {
    if (stage.trim()) out.presalesMilestoneStage = stage.trim();
    if (category.trim()) out.presalesMilestoneCategory = category.trim();
    if (subStage.trim()) out.presalesMilestoneSubStage = subStage.trim();
    return out;
  }
  if (stage.trim()) out.milestoneStage = stage.trim();
  if (category.trim()) out.milestoneStageCategory = category.trim();
  if (subStage.trim()) out.milestoneSubStage = subStage.trim();
  return out;
}

export function appendWorkspaceMilestoneFilterQuery(
  qs: URLSearchParams,
  workspace: CrmWorkspace,
  stage: string,
  category: string,
  subStage: string,
): void {
  const mapped = milestoneFilterQueryForWorkspace(workspace, stage, category, subStage);
  for (const [key, value] of Object.entries(mapped)) {
    if (value?.trim()) qs.set(key, value.trim());
  }
}

export function isSalesPoolNoMilestoneFilter(stage: string): boolean {
  const s = stage.trim();
  if (!s) return false;
  return normalizeStageKey(s) === normalizeStageKey(SALES_POOL_NO_MILESTONE);
}

/** Same rules as Journey Phase Heatmap (`crmLeadTopLevelStage` / `presalesTopLevelStage`). */
export function leadMatchesWorkspaceMilestoneFilter(
  lead: ApiLead,
  workspace: CrmWorkspace,
  stage: string,
  category: string,
  subStage: string,
): boolean {
  const st = stage.trim();
  const cat = category.trim();
  const sub = subStage.trim();
  if (!st && !cat && !sub) return true;

  if (workspace === "presales") {
    const ps = readPresalesMilestoneFromLead(lead);
    const top = presalesTopLevelStage(lead);
    if (st && normalizeStageKey(top) !== normalizeStageKey(st)) return false;
    if (cat && normalizeStageKey(ps.category) !== normalizeStageKey(cat)) return false;
    if (sub && normalizeStageKey(ps.subStage) !== normalizeStageKey(sub)) return false;
    return true;
  }

  const poolStage = salesPoolMilestoneStage(lead);
  const { milestoneStageCategory: rawCat, milestoneSubStage: rawSub } =
    readSalesStageFieldsFromLead(lead);

  if (st) {
    if (isSalesPoolNoMilestoneFilter(st)) {
      if (poolStage.trim() !== "") return false;
      if (cat.trim() && rawCat.trim()) return false;
      if (sub.trim() && rawSub.trim()) return false;
      return true;
    }
    const want = normalizeStageKey(st);
    if (normalizeStageKey(poolStage) !== want) return false;
  }
  if (cat && normalizeStageKey(rawCat) !== normalizeStageKey(cat)) return false;
  if (sub && normalizeStageKey(rawSub) !== normalizeStageKey(sub)) return false;
  return true;
}

/** Sales inbox: verified handoff leads. Presales inbox: caller sets tab filter. */
export function defaultLeadsVerificationStatus(
  workspace: CrmWorkspace,
  explicit?: string,
  viewerRole?: string,
): string {
  if (explicit?.trim()) return explicit.trim();
  if (workspace === "sales") return "verified";
  const r = normalizeRole(viewerRole ?? "");
  if (isAdminRole(r) || r === "SALES_ADMIN") return "";
  return "unverified";
}

/** Dedicated walk-in / WhatsApp are not in admin assignee rows — bucket by assignee pool. */
export function leadBelongsToAdminWorkspacePool(lead: ApiLead, workspace: CrmWorkspace): boolean {
  const role = assigneeRoleFromLead(lead);
  return workspace === "presales" ? isPresalesAssigneeRole(role) : isSalesAssigneeRole(role);
}

export function filterLeadsForAdminWorkspacePool(
  leads: ApiLead[],
  workspace: CrmWorkspace,
): ApiLead[] {
  return leads.filter((lead) => leadBelongsToAdminWorkspacePool(lead, workspace));
}

/** Walk-in / WhatsApp use Hub filter or dedicated list — not admin assignee pool rows. */
export function isDedicatedFilterLeadType(leadType: string): boolean {
  const lt = leadType.trim().toLowerCase();
  return lt === "walkinlead" || lt === "whatsapplead";
}

/**
 * Per-source verification default when user picks a lead-type tile.
 * WhatsApp new leads are unverified — avoid sales `verified` default hiding them for admins.
 */
export function defaultVerificationForLeadTypeFilter(
  leadType: string,
  workspace: CrmWorkspace,
  explicit?: string,
  viewerRole?: string,
): string {
  if (explicit?.trim()) return explicit.trim();
  const lt = leadType.trim().toLowerCase();
  if (lt === "verified") return "verified";
  if (lt === "whatsapplead") {
    if (workspace === "presales") return "unverified";
    const r = normalizeRole(viewerRole ?? "");
    if (isAdminRole(r) || r === "SUPER_ADMIN" || r === "SALES_ADMIN") return "";
    return "verified";
  }
  return defaultLeadsVerificationStatus(workspace, explicit, viewerRole);
}

/** Presales routes use Hub `presales-search` (JWT-scoped), not sales filter merge only. */
export function appendLeadPoolQuery(qs: URLSearchParams, workspace: CrmWorkspace): void {
  if (workspace === "presales") qs.set("leadPool", "presales");
  else qs.delete("leadPool");
}

/** Lead detail UI: `?workspace=presales` + session backup from list routes. */
export const LEAD_DETAIL_WORKSPACE_QUERY = "workspace";
export const LEAD_DETAIL_WORKSPACE_SESSION_KEY = "crm_lead_detail_workspace";

export function persistLeadDetailWorkspace(workspace: CrmWorkspace): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(LEAD_DETAIL_WORKSPACE_SESSION_KEY, workspace);
}

export function readLeadDetailWorkspaceFromBrowser(): CrmWorkspace {
  if (typeof window === "undefined") return "sales";
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get(LEAD_DETAIL_WORKSPACE_QUERY)?.trim().toLowerCase();
  if (fromQuery === "presales") return "presales";
  if (fromQuery === "sales") return "sales";
  const fromSession = window.sessionStorage
    .getItem(LEAD_DETAIL_WORKSPACE_SESSION_KEY)
    ?.trim()
    .toLowerCase();
  if (fromSession === "presales") return "presales";
  return "sales";
}

export function buildLeadDetailPath(
  leadType: string,
  leadId: string,
  workspace: CrmWorkspace = "sales",
): string {
  const base = `/Leads/${encodeURIComponent(leadType)}/${encodeURIComponent(leadId)}`;
  if (workspace === "presales") {
    return `${base}?${LEAD_DETAIL_WORKSPACE_QUERY}=presales`;
  }
  return base;
}

/** SUPER_ADMIN / ADMIN see every module; others see workspace-scoped sidebar. */
export function sidebarSectionsForViewer(
  workspace: CrmWorkspace,
  role: string,
): QuickAccessParentItem[] {
  const r = normalizeRole(role);
  if (r === "SUPER_ADMIN" || r === "ADMIN" || r === "SALES_ADMIN") {
    return dashboardSidebarSections;
  }
  if (workspace === "presales") return presalesWorkspaceSidebarSections;
  return salesWorkspaceSidebarSections;
}
