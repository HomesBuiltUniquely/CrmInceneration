import { normalizeRole } from "@/lib/auth/api";
import {
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
    if (st) {
      const want = normalizeStageKey(st);
      if (normalizeStageKey(top) !== want && normalizeStageKey(ps.stage) !== want) return false;
    }
    if (cat && normalizeStageKey(ps.category) !== normalizeStageKey(cat)) return false;
    if (sub && normalizeStageKey(ps.subStage) !== normalizeStageKey(sub)) return false;
    return true;
  }

  const poolStage = salesPoolMilestoneStage(lead);
  const rawCat = String(lead.stage?.milestoneStageCategory ?? "").trim();
  const rawSub = String(
    lead.stage?.milestoneSubStage ?? lead.stage?.substage?.substage ?? "",
  ).trim();

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
  const r = normalizeRole(viewerRole ?? "");
  if (isAdminRole(r) || r === "SALES_ADMIN") return "";
  return workspace === "sales" ? "verified" : "unverified";
}

/** Presales routes use Hub `presales-search` (JWT-scoped), not sales filter merge only. */
export function appendLeadPoolQuery(qs: URLSearchParams, workspace: CrmWorkspace): void {
  if (workspace === "presales") qs.set("leadPool", "presales");
  else qs.delete("leadPool");
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
