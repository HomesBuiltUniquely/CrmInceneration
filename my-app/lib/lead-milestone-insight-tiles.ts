import type { ApiLead } from "@/lib/leads-filter";
import {
  assigneeAliasNorms,
  readMilestoneStageNorm,
  type InsightCountOpts,
} from "@/lib/lead-follow-up-insights";

function normLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function readLeadMilestoneSubStage(lead: ApiLead): string {
  const st = lead.stage;
  const r = lead as Record<string, unknown>;
  return String(
    st?.milestoneSubStage ?? st?.substage?.substage ?? r.status ?? r.subStage ?? "",
  ).trim();
}

export function readLeadMilestoneStageCategory(lead: ApiLead): string {
  return String(lead.stage?.milestoneStageCategory ?? "").trim();
}

function readLeadQuoteLink(lead: ApiLead): string {
  const r = lead as Record<string, unknown>;
  const df =
    lead.dynamicFields && typeof lead.dynamicFields === "object" && !Array.isArray(lead.dynamicFields)
      ? (lead.dynamicFields as Record<string, unknown>)
      : {};
  return String(r.quoteLink ?? r.quoteURL ?? r.proposalLink ?? df.quoteLink ?? "").trim();
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

/** Role + lead view scope for insight tiles (matches follow-up insight rules). */
export function leadMatchesSalesInsightScope(lead: ApiLead, opts: InsightCountOpts): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  const me = norm(opts.currentUserName);
  const teamSet = new Set(opts.managerTeamNames.map(norm));
  const role = opts.viewerRole;

  if (role === "SALES_EXECUTIVE") return leadAssignedToSelf(lead, me);
  if (role === "SALES_MANAGER") {
    if (opts.leadView === "team") return leadAssignedToTeamMember(lead, teamSet);
    if (opts.leadView === "my") return leadAssignedToSelf(lead, me);
    return true;
  }
  return true;
}

export function isMeetingScheduledSubStage(lead: ApiLead): boolean {
  return normLabel(readLeadMilestoneSubStage(lead)) === "meeting scheduled";
}

export function isMeetingRescheduledSubStage(lead: ApiLead): boolean {
  return normLabel(readLeadMilestoneSubStage(lead)) === "meeting rescheduled";
}

export function isMeetingCancelledSubStage(lead: ApiLead): boolean {
  const sub = normLabel(readLeadMilestoneSubStage(lead));
  return (
    sub === "meeting cancelled" ||
    sub === "meeting cancelled/paused" ||
    sub.includes("meeting cancelled")
  );
}

/** Meeting done milestone (stage, category, or post-meeting substages). */
export function isMeetingDoneMilestone(lead: ApiLead): boolean {
  const stage = normLabel(readMilestoneStageNorm(lead));
  const category = normLabel(readLeadMilestoneStageCategory(lead));
  const sub = normLabel(readLeadMilestoneSubStage(lead));

  if (stage.includes("meeting done") || category.includes("meeting done")) return true;
  if (sub.includes("meeting successful") || sub === "meeting successful") return true;
  if (sub.includes("md but quote") || sub.includes("quote pending")) return true;
  if (sub.includes("quote sent")) return true;
  return false;
}

export function isQuotePendingSubStage(lead: ApiLead): boolean {
  const sub = normLabel(readLeadMilestoneSubStage(lead));
  return sub.includes("quote pending") || sub.includes("md but quote pending");
}

/** Quote sent: meeting completed successfully — quote shared or MEETING SUCCESSFUL substage. */
export function isQuoteSentLead(lead: ApiLead): boolean {
  if (isQuotePendingSubStage(lead)) return false;
  const sub = normLabel(readLeadMilestoneSubStage(lead));
  if (sub.includes("meeting successful")) return true;
  if (readLeadQuoteLink(lead)) return true;
  return /\bquote\s*sent\b/.test(sub);
}

/**
 * Quote due: explicit pending substage only (e.g. "MD but Quote pending",
 * "Meeting Done but Quote Pending") — not "Meeting Successful".
 */
export function isQuoteDueLead(lead: ApiLead): boolean {
  return isQuotePendingSubStage(lead);
}

export type MilestoneTileCounts = {
  meetingScheduled: number;
  meetingRescheduled: number;
  meetingCancelled: number;
  quoteSent: number;
  quoteDue: number;
};

export function computeMilestoneTileCounts(
  leads: ApiLead[],
  opts: InsightCountOpts,
): MilestoneTileCounts {
  const counts: MilestoneTileCounts = {
    meetingScheduled: 0,
    meetingRescheduled: 0,
    meetingCancelled: 0,
    quoteSent: 0,
    quoteDue: 0,
  };

  for (const lead of leads) {
    if (!leadMatchesSalesInsightScope(lead, opts)) continue;
    if (isMeetingScheduledSubStage(lead)) counts.meetingScheduled += 1;
    if (isMeetingRescheduledSubStage(lead)) counts.meetingRescheduled += 1;
    if (isMeetingCancelledSubStage(lead)) counts.meetingCancelled += 1;
    if (isQuoteSentLead(lead)) counts.quoteSent += 1;
    if (isQuoteDueLead(lead)) counts.quoteDue += 1;
  }

  return counts;
}

export type MilestoneInsightMode =
  | "meetingScheduled"
  | "meetingRescheduled"
  | "meetingCancelled"
  | "quoteSent"
  | "quoteDue";

export function filterLeadsForMilestoneInsightMode(
  leads: ApiLead[],
  mode: MilestoneInsightMode,
  opts: InsightCountOpts,
): ApiLead[] {
  return leads.filter((lead) => {
    if (!leadMatchesSalesInsightScope(lead, opts)) return false;
    switch (mode) {
      case "meetingScheduled":
        return isMeetingScheduledSubStage(lead);
      case "meetingRescheduled":
        return isMeetingRescheduledSubStage(lead);
      case "meetingCancelled":
        return isMeetingCancelledSubStage(lead);
      case "quoteSent":
        return isQuoteSentLead(lead);
      case "quoteDue":
        return isQuoteDueLead(lead);
      default:
        return true;
    }
  });
}
