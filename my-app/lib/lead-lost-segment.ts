import { crmLeadAssigneeAliasNorms, readSalesStageFieldsFromLead, type ApiLead } from "@/lib/leads-filter";
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
  const sales = readSalesStageFieldsFromLead(lead);
  const categoryRaw = sales.milestoneStageCategory;
  const stage = sales.milestoneStage.trim().toLowerCase().replace(/\s+/g, " ");
  if (!categoryRaw && !stage) return null;

  const cat = categoryRaw.trim().toLowerCase().replace(/\s+/g, " ");
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

/** Any lead on a LOST milestone category/path (broader than segment bucket). */
export function isLostPathLead(lead: ApiLead): boolean {
  const sales = readSalesStageFieldsFromLead(lead);
  if (isLostCategory(sales.milestoneStageCategory)) return true;
  const st = lead.stage;
  const presalesCategory = String(
    st?.presalesMilestoneCategory ?? lead.presalesMilestoneCategory ?? "",
  ).trim();
  if (isLostCategory(presalesCategory)) return true;
  const stage = sales.milestoneStage.trim().toLowerCase().replace(/\s+/g, " ");
  const cat = sales.milestoneStageCategory.trim().toLowerCase().replace(/\s+/g, " ");
  return /\blost\b/.test(`${cat} ${stage}`.trim());
}

/**
 * Lost-path leads stay hidden on the default inbox.
 * Show them when the user is searching, on lost insight tiles, filtering a lost
 * milestone, or applying any list filter (date / type / stage / assignee / etc.)
 * so filtered totals match visible rows.
 */
export function shouldShowLostPathLeadsInTable(args: {
  searchActive: boolean;
  insightTableMode: string | null;
  milestoneStageCategory: string;
  milestoneSubStage: string;
  /** Toolbar date, lead type, stage, assignee, reinquiry, etc. */
  listFiltersActive?: boolean;
}): boolean {
  if (args.searchActive) return true;
  if (args.listFiltersActive) return true;
  if (args.insightTableMode === "lostQuoteSent" || args.insightTableMode === "quoteSent") {
    return true;
  }
  if (isLostSegmentInsightMode(args.insightTableMode)) return true;
  const filterText = `${args.milestoneStageCategory} ${args.milestoneSubStage}`.trim();
  if (isLostCategory(args.milestoneStageCategory) || /\blost\b/i.test(filterText)) {
    return true;
  }
  return false;
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
