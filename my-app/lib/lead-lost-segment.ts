import { crmLeadAssigneeAliasNorms, type ApiLead } from "@/lib/leads-filter";
import { isLostCategory } from "@/lib/crm-pipeline";
import type { InsightCountOpts } from "@/lib/lead-follow-up-insights";

function readMilestoneStageNorm(lead: ApiLead): string {
  const st = lead.stage;
  const raw =
    typeof st === "object" && st && "milestoneStage" in st
      ? String((st as { milestoneStage?: string | null }).milestoneStage ?? "")
      : "";
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function assigneeAliasNorms(lead: ApiLead): Set<string> {
  return crmLeadAssigneeAliasNorms(lead);
}

export type LostSegmentMode =
  | "lostDiscovery"
  | "lostConnection"
  | "lostExperienceDesign"
  | "lostDecision"
  | "lostClosed";

export const LOST_SEGMENT_TILES: { mode: LostSegmentMode; label: string }[] = [
  { mode: "lostDiscovery", label: "Discovery Lost" },
  { mode: "lostConnection", label: "Connection Lost" },
  { mode: "lostExperienceDesign", label: "Experience & Design Lost" },
  { mode: "lostDecision", label: "Decision Lost" },
  { mode: "lostClosed", label: "Closed Lost" },
];

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function readMilestoneStageCategoryNorm(lead: ApiLead): string {
  const st = lead.stage;
  const raw =
    typeof st === "object" && st && "milestoneStageCategory" in st
      ? String((st as { milestoneStageCategory?: string | null }).milestoneStageCategory ?? "")
      : "";
  return norm(raw);
}

/** Classify a lead into one of the five lost-segment buckets (or null). */
export function classifyLostSegment(lead: ApiLead): LostSegmentMode | null {
  const categoryRaw = String(lead.stage?.milestoneStageCategory ?? "").trim();
  if (!categoryRaw && !readMilestoneStageNorm(lead)) return null;

  const cat = readMilestoneStageCategoryNorm(lead);
  const stage = readMilestoneStageNorm(lead);
  const combined = `${cat} ${stage}`.trim();

  if (!isLostCategory(categoryRaw) && !/\blost\b/.test(combined)) {
    return null;
  }

  const isExperienceDesign =
    (cat.includes("experience") && cat.includes("design")) ||
    stage === "experience & design" ||
    stage === "experience and design" ||
    (stage.includes("experience") && stage.includes("design"));

  if (cat.includes("closed") && cat.includes("lost")) return "lostClosed";
  if (stage === "closed" || stage.startsWith("closed")) {
    if (cat.includes("lost") || isLostCategory(categoryRaw)) return "lostClosed";
  }

  if (cat.includes("decision") && cat.includes("lost")) return "lostDecision";
  if (stage === "decision" && (cat.includes("lost") || isLostCategory(categoryRaw))) {
    return "lostDecision";
  }

  if (isExperienceDesign && (cat.includes("lost") || isLostCategory(categoryRaw))) {
    return "lostExperienceDesign";
  }

  if (cat.includes("connection") && cat.includes("lost")) return "lostConnection";
  if (stage === "connection" && (cat.includes("lost") || isLostCategory(categoryRaw))) {
    return "lostConnection";
  }

  if (cat.includes("discovery") && cat.includes("lost")) return "lostDiscovery";
  if (stage === "discovery" && (cat.includes("lost") || isLostCategory(categoryRaw))) {
    return "lostDiscovery";
  }

  return null;
}

export function isLostSegmentLead(lead: ApiLead): boolean {
  return classifyLostSegment(lead) !== null;
}

function leadAssignedToSelf(lead: ApiLead, meNorm: string): boolean {
  if (!meNorm) return false;
  return assigneeAliasNorms(lead).has(meNorm);
}

function leadAssignedToTeamMember(lead: ApiLead, teamNorms: Set<string>): boolean {
  if (teamNorms.size === 0) return false;
  for (const alias of assigneeAliasNorms(lead)) {
    if (teamNorms.has(alias)) return true;
  }
  return false;
}

function leadMatchesInsightAssigneeScope(lead: ApiLead, opts: InsightCountOpts): boolean {
  const me = norm(opts.currentUserName);
  const teamSet = new Set(opts.managerTeamNames.map(norm));
  if (opts.viewerRole === "SALES_EXECUTIVE") return leadAssignedToSelf(lead, me);
  if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "team") {
    return leadAssignedToTeamMember(lead, teamSet);
  }
  if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "my") {
    return leadAssignedToSelf(lead, me);
  }
  return true;
}

export function computeLostSegmentCounts(
  leads: ApiLead[],
  opts: InsightCountOpts,
): Record<LostSegmentMode, number> {
  const counts: Record<LostSegmentMode, number> = {
    lostDiscovery: 0,
    lostConnection: 0,
    lostExperienceDesign: 0,
    lostDecision: 0,
    lostClosed: 0,
  };
  for (const lead of leads) {
    if (!leadMatchesInsightAssigneeScope(lead, opts)) continue;
    const bucket = classifyLostSegment(lead);
    if (bucket) counts[bucket] += 1;
  }
  return counts;
}

export function filterLeadsForLostSegmentMode(
  leads: ApiLead[],
  mode: LostSegmentMode,
  opts: InsightCountOpts,
): ApiLead[] {
  return leads.filter((lead) => {
    if (!leadMatchesInsightAssigneeScope(lead, opts)) return false;
    return classifyLostSegment(lead) === mode;
  });
}

export function isLostSegmentInsightMode(
  mode: string | null | undefined,
): mode is LostSegmentMode {
  return (
    mode === "lostDiscovery" ||
    mode === "lostConnection" ||
    mode === "lostExperienceDesign" ||
    mode === "lostDecision" ||
    mode === "lostClosed"
  );
}
