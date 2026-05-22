import { normalizeRole } from "@/lib/auth/api";
import type { MilestoneFilterQuery } from "@/lib/presales-milestone";
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

/** Sales inbox: verified handoff leads. Presales inbox: caller sets tab filter. */
export function defaultLeadsVerificationStatus(
  workspace: CrmWorkspace,
  explicit?: string,
): string {
  if (explicit?.trim()) return explicit.trim();
  return workspace === "sales" ? "verified" : "unverified";
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
