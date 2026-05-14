import { crmLeadAssigneeLabel, type ApiLead } from "@/lib/leads-filter";
import {
  isFollowUpDueLocalToday,
  isFollowUpOverdueLocal,
} from "@/lib/follow-up-date";
import { isLostCategory } from "@/lib/crm-pipeline";


/**
 * True when this lead's current stage should NEVER appear in overdue or follow-up
 * lists because no future call is needed:
 *   • LOST path category (any stage — Discovery Lost, Connection Lost, etc.)
 *   • Closed → Closed Won → Booking Done (Booking)  ← lead is now a customer
 *   • Closed → Closed Won → Token Done              ← lead is now a customer
 */
function isNoFollowUpLead(lead: ApiLead): boolean {
  const cat   = String(lead.stage?.milestoneStageCategory ?? "").trim();
  if (isLostCategory(cat)) return true;

  const stage = String(lead.stage?.milestoneStage ?? "").trim();
  const sub   = String(lead.stage?.milestoneSubStage ?? "").trim();
  if (
    stage === "Closed" &&
    cat   === "Closed Won" &&
    (sub === "Booking Done (Booking)" || sub === "Token Done")
  ) {
    return true;
  }
  return false;
}

export function readFollowUpDateRaw(lead: ApiLead): string {
  const r = lead as Record<string, unknown>;
  return String(
    (lead as ApiLead & { followUpDate?: unknown }).followUpDate ??
      r.followUpDate ??
      r.FollowUpDate ??
      "",
  ).trim();
}

export function readLeadCreatedAtRaw(lead: ApiLead): string {
  const r = lead as Record<string, unknown>;
  return String(
    lead.createdAt ??
      lead.createdDate ??
      lead.leadDate ??
      lead.createdOn ??
      r.createdAt ??
      r.createdDate ??
      r.leadDate ??
      r.createdOn ??
      "",
  ).trim();
}

export function isFirstCallDelayedLead(
  lead: ApiLead,
  nowMs = Date.now(),
  thresholdMs = 60 * 60 * 1000,
): boolean {
  const firstCallAt = String((lead.firstCallAt ?? "") as string).trim();
  if (firstCallAt) return false;
  const createdRaw = readLeadCreatedAtRaw(lead);
  if (!createdRaw) return false;
  const createdTs = Date.parse(createdRaw);
  if (Number.isNaN(createdTs)) return false;
  return nowMs - createdTs >= thresholdMs;
}

/** Normalized assignee tokens (name / fullName / username / string assignee) for matching team lists and self. */
export function assigneeAliasNorms(lead: ApiLead): Set<string> {
  const out = new Set<string>();
  const add = (s: string) => {
    const n = s.trim().toLowerCase();
    if (n) out.add(n);
  };
  const a = lead.assignee ?? lead.salesOwner;
  if (!a) return out;
  if (typeof a === "string") {
    add(a);
    return out;
  }
  const o = a as { name?: string; fullName?: string; username?: string };
  add(String(o.name ?? ""));
  add(String(o.fullName ?? ""));
  add(String(o.username ?? ""));
  add(crmLeadAssigneeLabel(lead));
  return out;
}

function leadAssignedToSelf(lead: ApiLead, meNorm: string): boolean {
  if (!meNorm) return false;
  return assigneeAliasNorms(lead).has(meNorm);
}

/** True when this lead’s assignee is one of the manager’s team executives (any alias matches). */
function leadAssignedToTeamMember(lead: ApiLead, teamNorms: Set<string>): boolean {
  if (teamNorms.size === 0) return false;
  for (const alias of assigneeAliasNorms(lead)) {
    if (teamNorms.has(alias)) return true;
  }
  return false;
}

/** For "Follow Ups Today": split the grid/heatmap by primary milestone stage. */
export type FollowUpMilestoneSegment = "active" | "closure";

export type InsightCountOpts = {
  viewerRole: string;
  currentUserName: string;
  managerTeamNames: string[];
  leadView: "default" | "my" | "team";
  dateFrom?: string;
  dateTo?: string;
};

function isCalledLead(lead: ApiLead): boolean {
  return String((lead.firstCallAt ?? "") as string).trim().length > 0;
}

function inDateRangeByField(
  value: string,
  from?: string,
  to?: string,
): boolean {
  if (!from && !to) return true;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return false;
  const dayMs = 24 * 60 * 60 * 1000;
  if (from) {
    const fromTs = Date.parse(`${from}T00:00:00`);
    if (!Number.isNaN(fromTs) && ts < fromTs) return false;
  }
  if (to) {
    const toTs = Date.parse(`${to}T00:00:00`) + dayMs - 1;
    if (!Number.isNaN(toTs) && ts > toTs) return false;
  }
  return true;
}

export function readMilestoneStageNorm(lead: ApiLead): string {
  const st = lead.stage;
  const raw =
    typeof st === "object" && st && "milestoneStage" in st
      ? String((st as { milestoneStage?: string | null }).milestoneStage ?? "")
      : "";
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function isActiveMilestoneNorm(n: string): boolean {
  return n === "discovery" || n === "connection";
}

function isClosureMilestoneNorm(n: string): boolean {
  if (!n) return false;
  if (n === "experience & design" || n === "experience and design") return true;
  if (n.includes("experience") && n.includes("design")) return true;
  if (n === "decision") return true;
  if (n === "closed" || n.startsWith("closed")) return true;
  return false;
}

/**
 * Active = Discovery + Connection. Closure = Experience & Design, Decision, Closed (and typical "Closed …" variants).
 * Unknown / empty milestone counts as Active so follow-ups are not dropped.
 */
export function matchesFollowUpMilestoneSegment(
  lead: ApiLead,
  segment: FollowUpMilestoneSegment,
): boolean {
  const n = readMilestoneStageNorm(lead);
  if (!n) return segment === "active";
  const closure = isClosureMilestoneNorm(n);
  const active = isActiveMilestoneNorm(n);
  if (segment === "closure") return closure;
  if (closure) return false;
  if (active) return true;
  return true;
}

/**
 * Row-level counts from a loaded sample (same caveat as legacy: based on fetched leads only).
 */
function bumpFollowUpsTodaySplit(
  lead: ApiLead,
  fu: string,
  followupsActive: { n: number },
  followupsClosure: { n: number },
) {
  if (!isFollowUpDueLocalToday(fu)) return;
  if (matchesFollowUpMilestoneSegment(lead, "active")) followupsActive.n += 1;
  if (matchesFollowUpMilestoneSegment(lead, "closure")) followupsClosure.n += 1;
}

export function computeFollowUpInsightCounts(
  leads: ApiLead[],
  opts: InsightCountOpts,
): {
  followup: number;
  followups: number;
  followupsActive: number;
  followupsClosure: number;
  overdue: number;
  overdueActive: number;
  overdueClosure: number;
  callDelayed: number;
  totalCalls: number;
  team: number;
} {
  const norm = (s: string) => s.trim().toLowerCase();
  const me = norm(opts.currentUserName);
  const teamSet = new Set(opts.managerTeamNames.map(norm));

  let followup = 0;
  let followups = 0;
  let followupsActive = { n: 0 };
  let followupsClosure = { n: 0 };
  let overdue = 0;
  let overdueActive = 0;
  let overdueClosure = 0;
  let callDelayed = 0;
  let totalCalls = 0;
  let team = 0;

  for (const lead of leads) {
    const fu = readFollowUpDateRaw(lead);

    if (opts.viewerRole === "SALES_EXECUTIVE") {
      if (leadAssignedToSelf(lead, me)) {
        const firstCallAt = String((lead.firstCallAt ?? "") as string).trim();
        if (
          firstCallAt &&
          inDateRangeByField(firstCallAt, opts.dateFrom, opts.dateTo)
        ) {
          totalCalls += 1;
        }
        if (isFirstCallDelayedLead(lead)) {
          callDelayed += 1;
        }
        if (isFollowUpOverdueLocal(fu) && !isNoFollowUpLead(lead)) {
          overdue += 1;
          if (matchesFollowUpMilestoneSegment(lead, "active")) overdueActive += 1;
          if (matchesFollowUpMilestoneSegment(lead, "closure")) overdueClosure += 1;
        }
        if (isFollowUpDueLocalToday(fu)) {
          followup += 1;
          bumpFollowUpsTodaySplit(lead, fu, followupsActive, followupsClosure);
        }
      }
    }

    if (opts.viewerRole === "SALES_MANAGER") {
      if (opts.leadView === "team") {
        if (leadAssignedToTeamMember(lead, teamSet)) {
          team += 1;
          const firstCallAt = String((lead.firstCallAt ?? "") as string).trim();
          if (
            firstCallAt &&
            inDateRangeByField(firstCallAt, opts.dateFrom, opts.dateTo)
          ) {
            totalCalls += 1;
          }
          if (isFirstCallDelayedLead(lead)) {
            callDelayed += 1;
          }
          if (isFollowUpOverdueLocal(fu) && !isNoFollowUpLead(lead)) {
            overdue += 1;
            if (matchesFollowUpMilestoneSegment(lead, "active")) overdueActive += 1;
            if (matchesFollowUpMilestoneSegment(lead, "closure")) overdueClosure += 1;
          }
          if (isFollowUpDueLocalToday(fu)) {
            followups += 1;
            bumpFollowUpsTodaySplit(lead, fu, followupsActive, followupsClosure);
          }
        }
      } else if (opts.leadView === "my") {
        if (leadAssignedToSelf(lead, me)) {
          const firstCallAt = String((lead.firstCallAt ?? "") as string).trim();
          if (
            firstCallAt &&
            inDateRangeByField(firstCallAt, opts.dateFrom, opts.dateTo)
          ) {
            totalCalls += 1;
          }
          if (isFirstCallDelayedLead(lead)) {
            callDelayed += 1;
          }
          if (isFollowUpOverdueLocal(fu) && !isNoFollowUpLead(lead)) {
            overdue += 1;
            if (matchesFollowUpMilestoneSegment(lead, "active")) overdueActive += 1;
            if (matchesFollowUpMilestoneSegment(lead, "closure")) overdueClosure += 1;
          }
          if (isFollowUpDueLocalToday(fu)) {
            followups += 1;
            bumpFollowUpsTodaySplit(lead, fu, followupsActive, followupsClosure);
          }
        }
      } else {
        const firstCallAt = String((lead.firstCallAt ?? "") as string).trim();
        if (
          firstCallAt &&
          inDateRangeByField(firstCallAt, opts.dateFrom, opts.dateTo)
        ) {
          totalCalls += 1;
        }
        if (isFirstCallDelayedLead(lead)) {
          callDelayed += 1;
        }
        if (isFollowUpOverdueLocal(fu) && !isNoFollowUpLead(lead)) {
          overdue += 1;
          if (matchesFollowUpMilestoneSegment(lead, "active")) overdueActive += 1;
          if (matchesFollowUpMilestoneSegment(lead, "closure")) overdueClosure += 1;
        }
        if (isFollowUpDueLocalToday(fu)) {
          followups += 1;
          bumpFollowUpsTodaySplit(lead, fu, followupsActive, followupsClosure);
        }
      }
    }
  }

  const fa = followupsActive.n;
  const fc = followupsClosure.n;
  return {
    followup,
    followups,
    followupsActive: fa,
    followupsClosure: fc,
    overdue,
    overdueActive,
    overdueClosure,
    callDelayed,
    totalCalls,
    team,
  };
}

export type InsightTableMode =
  | null
  | "followUpActive"
  | "followUpClosure"
  | "overdue"
  | "overdueActive"
  | "overdueClosure"
  | "callDelayed"
  | "totalCalls"
  | "teamLeads";

export function filterLeadsForInsightMode(
  leads: ApiLead[],
  mode: InsightTableMode,
  opts: InsightCountOpts,
): ApiLead[] {
  if (!mode) return leads;
  const norm = (s: string) => s.trim().toLowerCase();
  const me = norm(opts.currentUserName);
  const teamSet = new Set(opts.managerTeamNames.map(norm));

  if (mode === "teamLeads") {
    if (opts.viewerRole !== "SALES_MANAGER") return leads;
    if (teamSet.size === 0) return [];
    return leads.filter((lead) => {
      if (leadAssignedToSelf(lead, me)) return false;
      return leadAssignedToTeamMember(lead, teamSet);
    });
  }

  return leads.filter((lead) => {
    const fu = readFollowUpDateRaw(lead);
    const firstCallAt = String((lead.firstCallAt ?? "") as string).trim();

    if (mode === "totalCalls") {
      if (!isCalledLead(lead)) return false;
      if (!inDateRangeByField(firstCallAt, opts.dateFrom, opts.dateTo)) {
        return false;
      }
      if (opts.viewerRole === "SALES_EXECUTIVE") return leadAssignedToSelf(lead, me);
      if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "team")
        return leadAssignedToTeamMember(lead, teamSet);
      if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "my")
        return leadAssignedToSelf(lead, me);
      return true;
    }

    if (mode === "callDelayed") {
      if (!isFirstCallDelayedLead(lead)) return false;
      if (opts.viewerRole === "SALES_EXECUTIVE") return leadAssignedToSelf(lead, me);
      if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "team")
        return leadAssignedToTeamMember(lead, teamSet);
      if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "my")
        return leadAssignedToSelf(lead, me);
      return true;
    }

    if (mode === "followUpActive" || mode === "followUpClosure") {
      const segment: FollowUpMilestoneSegment = mode === "followUpActive" ? "active" : "closure";
      if (!isFollowUpDueLocalToday(fu)) return false;
      let assigneeOk = true;
      if (opts.viewerRole === "SALES_EXECUTIVE") assigneeOk = leadAssignedToSelf(lead, me);
      else if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "team")
        assigneeOk = leadAssignedToTeamMember(lead, teamSet);
      else if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "my") assigneeOk = leadAssignedToSelf(lead, me);
      if (!assigneeOk) return false;
      if (!matchesFollowUpMilestoneSegment(lead, segment)) return false;
      return true;
    }

    if (mode === "overdue" || mode === "overdueActive" || mode === "overdueClosure") {
      if (!isFollowUpOverdueLocal(fu) || isNoFollowUpLead(lead)) return false;
      if (opts.viewerRole === "SALES_EXECUTIVE") return leadAssignedToSelf(lead, me);
      if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "team")
        return (
          leadAssignedToTeamMember(lead, teamSet) &&
          (mode === "overdue"
            ? true
            : matchesFollowUpMilestoneSegment(
                lead,
                mode === "overdueActive" ? "active" : "closure",
              ))
        );
      if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "my")
        return (
          leadAssignedToSelf(lead, me) &&
          (mode === "overdue"
            ? true
            : matchesFollowUpMilestoneSegment(
                lead,
                mode === "overdueActive" ? "active" : "closure",
              ))
        );
      return mode === "overdue"
        ? true
        : matchesFollowUpMilestoneSegment(
            lead,
            mode === "overdueActive" ? "active" : "closure",
          );
    }

    return true;
  });
}
