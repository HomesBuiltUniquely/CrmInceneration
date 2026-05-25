import type { Lead } from "@/lib/data";
import type { ApiLead } from "@/lib/leads-filter";
import { isCrmLeadVerified } from "@/lib/leads-filter";
import { normalizeStageKey } from "@/lib/milestone-progress";
import { isAdminRole, isPresalesRole, isSalesRole } from "@/lib/roleUtils";

export type DisplayMilestone = {
  stage: string;
  category: string;
  subStage: string;
  isPresales: boolean;
};

/** Presales pipeline columns for list/journey progress (Fresh → Discovery → Conversion). */
export const PRESALES_PIPELINE_STAGE_ORDER = [
  "Fresh Data",
  "Data Discovery",
  "Data Conversion",
] as const;

/** Presales list rows use presales milestones until the lead is verified / handed to sales. */
export function shouldUsePresalesListDisplay(
  lead: ApiLead | Record<string, unknown>,
  userRole: string,
): boolean {
  if (!isPresalesRole(userRole)) return false;
  return !isLeadHandedOffToSales(lead);
}

/** Milestone fields shown on presales lead list rows. */
export function getListDisplayMilestone(
  lead: ApiLead | Record<string, unknown>,
  _userRole: string,
): DisplayMilestone {
  const ps = readPresalesMilestoneFromLead(lead);
  return {
    stage: ps.stage || "Fresh Data",
    category: ps.category,
    subStage: ps.subStage,
    isPresales: true,
  };
}

/** Status column label: prefer substage, then category, then top-level stage. */
export function formatPresalesListStatusLabel(display: DisplayMilestone): string | undefined {
  const sub = display.subStage.trim();
  if (sub) return sub;
  const cat = display.category.trim();
  if (cat) return cat;
  const st = display.stage.trim();
  return st || undefined;
}

function pickLeadScalar(lead: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (!(k in lead)) continue;
    const v = lead[k];
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

export function readPresalesMilestoneFromLead(lead: ApiLead | Record<string, unknown>): {
  stage: string;
  category: string;
  subStage: string;
} {
  const r = lead as Record<string, unknown>;
  const st =
    r.stage && typeof r.stage === "object" && !Array.isArray(r.stage)
      ? (r.stage as Record<string, unknown>)
      : {};
  const stage = String(
    pickLeadScalar(r, ["presalesMilestoneStage"]) ??
      st.presalesMilestoneStage ??
      "",
  ).trim();
  const category = String(
    pickLeadScalar(r, ["presalesMilestoneCategory"]) ??
      st.presalesMilestoneCategory ??
      "",
  ).trim();
  const subStage = String(
    pickLeadScalar(r, ["presalesMilestoneSubStage"]) ??
      st.presalesMilestoneSubStage ??
      "",
  ).trim();
  return { stage, category, subStage };
}

export function getDisplayMilestone(
  lead: ApiLead | Record<string, unknown>,
  userRole: string,
): DisplayMilestone {
  if (isPresalesRole(userRole)) {
    const ps = readPresalesMilestoneFromLead(lead);
    return {
      stage: ps.stage || "Fresh Data",
      category: ps.category,
      subStage: ps.subStage,
      isPresales: true,
    };
  }
  const r = lead as ApiLead;
  const st = r.stage;
  return {
    stage: String(st?.milestoneStage ?? "").trim() || "Fresh Lead",
    category: String(st?.milestoneStageCategory ?? "").trim(),
    subStage: String(st?.milestoneSubStage ?? st?.substage?.substage ?? "").trim(),
    isPresales: false,
  };
}

export function presalesTopLevelStage(lead: ApiLead): string {
  const { stage } = readPresalesMilestoneFromLead(lead);
  return stage || "Fresh Data";
}

/** Lead has been verified / assigned to sales — presales UI should not show on detail or sales dashboard. */
export function isLeadHandedOffToSales(
  lead: ApiLead | Lead | Record<string, unknown>,
): boolean {
  if (lead && typeof lead === "object" && "verified" in lead) {
    const v = (lead as Lead).verified;
    if (v === true) return true;
  }
  return isCrmLeadVerified(lead as ApiLead);
}

export function isPresalesHandedOffReadOnly(
  lead: ApiLead | Record<string, unknown>,
  userRole: string,
): boolean {
  if (!isPresalesRole(userRole)) return false;
  return isLeadHandedOffToSales(lead);
}

export function presalesAllowedForwardStages(currentStage: string): string[] {
  const key = normalizeStageKey(currentStage);
  if (key === "fresh data") {
    return ["Fresh Data", "Data Discovery", "Data Conversion"];
  }
  if (key === "data discovery") return ["Data Discovery", "Data Conversion"];
  if (key === "data conversion") return ["Data Conversion"];
  return ["Fresh Data", "Data Discovery", "Data Conversion"];
}

export function canPresalesAdvanceToStage(currentStage: string, targetStage: string): boolean {
  const allowed = presalesAllowedForwardStages(currentStage);
  return allowed.some((s) => normalizeStageKey(s) === normalizeStageKey(targetStage));
}

export type MilestoneFilterQuery = {
  milestoneStage?: string;
  milestoneStageCategory?: string;
  milestoneSubStage?: string;
  presalesMilestoneStage?: string;
  presalesMilestoneCategory?: string;
  presalesMilestoneSubStage?: string;
};

/** Map toolbar filter state to upstream query param names by role. */
export function milestoneFilterQueryForRole(
  role: string,
  stage: string,
  category: string,
  subStage: string,
): MilestoneFilterQuery {
  const out: MilestoneFilterQuery = {};
  if (!stage.trim() && !category.trim() && !subStage.trim()) return out;
  if (isPresalesRole(role)) {
    if (stage.trim()) out.presalesMilestoneStage = stage.trim();
    if (category.trim()) out.presalesMilestoneCategory = category.trim();
    if (subStage.trim()) out.presalesMilestoneSubStage = subStage.trim();
    return out;
  }
  if (isSalesRole(role) || isAdminRole(role)) {
    if (stage.trim()) out.milestoneStage = stage.trim();
    if (category.trim()) out.milestoneStageCategory = category.trim();
    if (subStage.trim()) out.milestoneSubStage = subStage.trim();
  }
  return out;
}

export function appendMilestoneFilterQuery(
  qs: URLSearchParams,
  role: string,
  stage: string,
  category: string,
  subStage: string,
): void {
  const mapped = milestoneFilterQueryForRole(role, stage, category, subStage);
  for (const [key, value] of Object.entries(mapped)) {
    if (value?.trim()) qs.set(key, value.trim());
  }
}
