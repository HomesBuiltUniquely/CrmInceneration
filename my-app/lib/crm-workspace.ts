import { normalizeRole } from "@/lib/auth/api";
import {
  assigneeRoleFromLead,
  isPresalesAssigneeRole,
  isSalesAssigneeRole,
} from "@/lib/assignment-reassign";
import {
  crmLeadTopLevelStage,
  readSalesStageFieldsFromLead,
  SALES_POOL_NO_MILESTONE,
  salesPoolMilestoneStage,
  isCrmLeadVerified,
  isCrmLeadVerificationUnknown,
  type ApiLead,
} from "@/lib/leads-filter";
import { isLostCategory, isWonCategory } from "@/lib/crm-pipeline";
import { normalizeStageKey } from "@/lib/milestone-progress";
import { pipelineSubStageLabel } from "@/lib/milestone-substage-map";
import type { MilestoneFilterQuery } from "@/lib/presales-milestone";
import { presalesTopLevelStage, readPresalesMilestoneFromLead } from "@/lib/presales-milestone";
import { isAdminRole } from "@/lib/roleUtils";
import type { QuickAccessParentItem } from "@/app/Components/Shared/QuickAccessSidebar";
import {
  dashboardSidebarSections,
  presalesWorkspaceSidebarSections,
  salesWorkspaceSidebarSections,
} from "@/app/Components/Shared/sidebar-data";

/** Local copy of journey phase canonicalization — avoid importing admin-leads-api (cycle). */
function canonicalSalesPhaseKey(raw: string): string {
  const key = normalizeStageKey(raw);
  if (!key || key === "null" || key === "undefined" || key === "none" || key === "n/a" || key === "na") {
    return "fresh lead";
  }
  if (key.includes("no milestone") || key === "unassigned" || key === "initial stage" || key === "initial") {
    return "fresh lead";
  }
  if (key.includes("closed") || key.includes("close")) return "closed";
  if (key.includes("fresh")) return "fresh lead";
  if (key.includes("discover")) return "discovery";
  if (key.includes("meeting scheduled") || key.includes("connect")) return "connection";
  if (key.includes("meeting successful") || key.includes("quote sent") || key.includes("experience") || key.includes("design")) {
    return "experience & design";
  }
  if (key.includes("decision")) return "decision";
  return key;
}

/** Collapse "RNR Call Back (Discovery)" / punctuation so Hub labels match toolbar picks. */
function milestoneLabelCore(value: string): string {
  return normalizeStageKey(value)
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function salesMilestoneStagesMatch(filterStage: string, leadTop: string, leadRawStage: string): boolean {
  const want = normalizeStageKey(filterStage);
  if (!want) return true;
  const top = normalizeStageKey(leadTop);
  const raw = normalizeStageKey(leadRawStage);
  if (top === want || raw === want) return true;
  // Hub often stores stage as "Discovery Won" / "Discovery Lost" while toolbar picks "Discovery".
  if (canonicalSalesPhaseKey(leadTop) === canonicalSalesPhaseKey(filterStage)) return true;
  if (canonicalSalesPhaseKey(leadRawStage) === canonicalSalesPhaseKey(filterStage)) return true;
  if (raw.startsWith(`${want} `) || raw.startsWith(`${want}-`)) return true;
  return false;
}

function salesMilestoneCategoriesMatch(
  filterCategory: string,
  leadCategory: string,
  leadRawStage: string,
): boolean {
  const want = normalizeStageKey(filterCategory);
  if (!want) return true;
  const have = normalizeStageKey(leadCategory);
  const rawStage = normalizeStageKey(leadRawStage);
  if (have === want || rawStage === want) return true;
  const wantParent = want.replace(/\b(won|lost|hold)\b/g, " ").replace(/\s+/g, " ").trim();
  const haveHay = `${have} ${rawStage}`.trim();
  // "Discovery Won" vs lead category "Won" / stage "Discovery Won" (same parent stage).
  if (isWonCategory(filterCategory) && (isWonCategory(leadCategory) || isWonCategory(leadRawStage))) {
    if (!wantParent || haveHay.includes(wantParent)) return true;
  }
  if (isLostCategory(filterCategory) && (isLostCategory(leadCategory) || isLostCategory(leadRawStage))) {
    if (!wantParent || haveHay.includes(wantParent)) return true;
  }
  const wantCore = milestoneLabelCore(filterCategory);
  const haveCore = milestoneLabelCore(leadCategory || leadRawStage);
  if (wantCore && haveCore && (wantCore === haveCore || wantCore.includes(haveCore) || haveCore.includes(wantCore))) {
    return true;
  }
  return false;
}

function salesMilestoneSubStagesMatch(filterSub: string, leadSub: string): boolean {
  const want = normalizeStageKey(filterSub);
  if (!want) return true;
  const have = normalizeStageKey(leadSub);
  if (!have) return false;
  if (have === want) return true;
  const wantLabel = normalizeStageKey(pipelineSubStageLabel(filterSub));
  const haveLabel = normalizeStageKey(pipelineSubStageLabel(leadSub));
  if (wantLabel && haveLabel && wantLabel === haveLabel) return true;
  const wantCore = milestoneLabelCore(filterSub);
  const haveCore = milestoneLabelCore(leadSub);
  if (wantCore && haveCore && (wantCore === haveCore || wantCore.includes(haveCore) || haveCore.includes(wantCore))) {
    return true;
  }
  return false;
}

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

/** Fresh Lead UI includes blank milestone (same as Insights / crmLeadTopLevelStage). */
export function isFreshLeadStageLabel(stage: string): boolean {
  const key = normalizeStageKey(stage);
  return key === "fresh lead" || key === "fresh leads" || /^fresh\s+leads?$/.test(key);
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
  /**
   * Do not send Fresh Lead alone to Hub — Hub exact match drops blank milestone rows.
   * Client filters with crmLeadTopLevelStage (blank → Fresh Lead).
   */
  if (isFreshLeadStageLabel(stage) && !category.trim() && !subStage.trim()) {
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

/**
 * Toolbar Stage / Category / Sub Stage filter for sales + presales.
 * Sales matching is intentionally loose: Hub often stores
 * `RNR Call Back` while the toolbar sends `RNR Call Back (Discovery)`,
 * and stage may be `Discovery Won` while the toolbar picks `Discovery`.
 * Exact-only compare caused SM/SE Total Leads 0 on valid sub-stage filters.
 */
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
    if (sub && !salesMilestoneSubStagesMatch(sub, ps.subStage)) return false;
    return true;
  }

  const {
    milestoneStage: rawStage,
    milestoneStageCategory: rawCat,
    milestoneSubStage: rawSub,
  } = readSalesStageFieldsFromLead(lead);

  if (st) {
    if (isSalesPoolNoMilestoneFilter(st)) {
      const poolStage = salesPoolMilestoneStage(lead);
      if (poolStage.trim() !== "") return false;
      if (cat.trim() && rawCat.trim()) return false;
      if (sub.trim() && rawSub.trim()) return false;
      return true;
    }
    // Blank milestone → Fresh Lead (Insights / heatmap / journey column).
    const top = crmLeadTopLevelStage(lead);
    if (!salesMilestoneStagesMatch(st, top, rawStage)) return false;
  }
  if (cat && !salesMilestoneCategoriesMatch(cat, rawCat, rawStage)) return false;
  if (sub && !salesMilestoneSubStagesMatch(sub, rawSub)) return false;
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

/**
 * Discovery+ CRM journey — not Fresh intake.
 * Older Hub rows (e.g. Connection after inactive-SE reassign) often omit `assigneeRole`
 * and `verificationStatus`; `assigneeRoleFromLead` then defaults them to PRESALES and the
 * sales inbox filter silently drops them from Lead/Opp/Total (Razi 133 vs Hub 154).
 */
function isCrmOpenSalesJourneyPastIntake(lead: ApiLead): boolean {
  const key = normalizeStageKey(crmLeadTopLevelStage(lead) || "");
  if (
    key === "discovery" ||
    key === "connection" ||
    key === "experience & design" ||
    key === "decision" ||
    key === "closed"
  ) {
    return true;
  }
  // Lost-path rows with odd stage labels still belong in the sales journey inventory.
  const { milestoneStage, milestoneStageCategory, milestoneSubStage } =
    readSalesStageFieldsFromLead(lead);
  return /\blost\b/i.test(
    `${milestoneStageCategory} ${milestoneStage} ${milestoneSubStage}`.trim(),
  );
}

/** Dedicated walk-in / WhatsApp are not in admin assignee rows — bucket by assignee pool. */
export function leadBelongsToAdminWorkspacePool(lead: ApiLead, workspace: CrmWorkspace): boolean {
  const role = assigneeRoleFromLead(lead);
  if (workspace === "presales") return isPresalesAssigneeRole(role);
  if (isSalesAssigneeRole(role)) return true;
  // Keep Hub CRM-open journey rows even when assigneeRole/verification meta is missing.
  return isCrmOpenSalesJourneyPastIntake(lead);
}

export function filterLeadsForAdminWorkspacePool(
  leads: ApiLead[],
  workspace: CrmWorkspace,
): ApiLead[] {
  return leads.filter((lead) => leadBelongsToAdminWorkspacePool(lead, workspace));
}

/** Sales `/Leads` for manager/exec — verified sales-pool rows only (drops presales inbox). */
export function filterLeadsForSalesClientInbox(
  leads: ApiLead[],
  verificationStatus = "",
): ApiLead[] {
  const pool = filterLeadsForAdminWorkspacePool(leads, "sales");
  const vs = verificationStatus.trim().toLowerCase();
  if (vs === "unverified") {
    return pool.filter((lead) => !isCrmLeadVerified(lead));
  }
  if (vs === "verified" || !vs) {
    return pool.filter(
      (lead) =>
        isCrmLeadVerified(lead) ||
        // Missing verification fields ≠ unverified intake — keep CRM-open Discovery+.
        (isCrmLeadVerificationUnknown(lead) && isCrmOpenSalesJourneyPastIntake(lead)),
    );
  }
  return pool;
}

/** Presales `/presales-leads` client inbox — presales-pool rows with optional verification tab. */
export function filterLeadsForPresalesClientInbox(
  leads: ApiLead[],
  verificationStatus = "",
): ApiLead[] {
  let pool = filterLeadsForAdminWorkspacePool(leads, "presales");
  const vs = verificationStatus.trim().toLowerCase();
  if (vs === "verified") pool = pool.filter((lead) => isCrmLeadVerified(lead));
  if (vs === "unverified") pool = pool.filter((lead) => !isCrmLeadVerified(lead));
  return pool;
}

export function filterLeadsForClientWorkspaceInbox(
  leads: ApiLead[],
  workspace: CrmWorkspace,
  verificationStatus = "",
): ApiLead[] {
  if (workspace === "presales") {
    return filterLeadsForPresalesClientInbox(leads, verificationStatus);
  }
  return filterLeadsForSalesClientInbox(leads, verificationStatus);
}

/** Client-scoped roles on `/Leads` (not admin pool APIs). */
export function usesClientWorkspaceInboxFilter(
  workspace: CrmWorkspace,
  viewerRole: string,
): boolean {
  const role = normalizeRole(viewerRole);
  if (workspace === "sales") {
    return (
      role === "SALES_MANAGER" ||
      role === "MANAGER" ||
      role === "SALES_EXECUTIVE"
    );
  }
  return false;
}

/** Walk-in / WhatsApp use Hub filter or dedicated list — not admin assignee pool rows. */
export function isDedicatedFilterLeadType(leadType: string): boolean {
  const lt = leadType.trim().toLowerCase();
  return lt === "walkinlead" || lt === "whatsapplead";
}

/**
 * Per-source verification default when user picks a lead-type tile.
 *
 * WhatsApp dual path (pincode auto-verify):
 * - Pin present → VERIFIED + sales (sales workspace → `verified`)
 * - Pin missing → UNVERIFIED + presales (presales workspace → `unverified`)
 * - Admins need both buckets so pin and no-pin rows stay visible → no default filter.
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
  if (lt === "ivr_call" || lt === "ivrlead") {
    return defaultLeadsVerificationStatus(workspace, explicit, viewerRole);
  }
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
