import { crmLeadAssigneeAliasNorms, readLeadUpdatedAtRaw, type ApiLead } from "@/lib/leads-filter";
import { isCrmLeadReinquiry } from "@/lib/lead-source-utils";
import {
  isFollowUpDueLocalToday,
  isFollowUpOverdueLocal,
  resolveEffectiveFollowUpDateRaw,
} from "@/lib/follow-up-date";
import { filterLeadsForMilestoneInsightMode } from "@/lib/lead-milestone-insight-tiles";
import {
  filterLeadsForLostSegmentMode,
  isLostSegmentInsightMode,
  isLostSegmentLead,
  type LostSegmentMode,
} from "@/lib/lead-lost-segment";

export function readFollowUpDateRaw(lead: ApiLead): string {
  const r = lead as Record<string, unknown>;
  return String(
    (lead as ApiLead & { followUpDate?: unknown }).followUpDate ??
      r.followUpDate ??
      r.FollowUpDate ??
      "",
  ).trim();
}

/** Explicit follow-up, or enquiry/created date when intake has none yet. */
export function readEffectiveFollowUpDateRaw(lead: ApiLead): string {
  const r = lead as Record<string, unknown>;
  return resolveEffectiveFollowUpDateRaw(readFollowUpDateRaw(lead), readLeadCreatedAtRaw(lead), {
    isReinquiry: isCrmLeadReinquiry({
      additionalLeadSources: lead.additionalLeadSources,
      leadType: lead.leadType,
      leadSource: r.leadSource,
      LeadSource: r.LeadSource,
      source: r.source,
    }),
    updatedRaw: readLeadUpdatedAtRaw(lead),
  });
}

export function readLeadCreatedAtRaw(lead: ApiLead): string {
  const r = lead as Record<string, unknown>;
  const df =
    lead.dynamicFields && typeof lead.dynamicFields === "object" && !Array.isArray(lead.dynamicFields)
      ? (lead.dynamicFields as Record<string, unknown>)
      : {};
  const candidates = [
    lead.createdAt,
    lead.createdDate,
    lead.leadDate,
    lead.createdOn,
    r.createdAt,
    r.created_at,
    r.createdDate,
    r.created_date,
    r.leadDate,
    r.lead_date,
    r.createdOn,
    r.created_on,
    r.walkInDate,
    r.walk_in_date,
    r.walkinDate,
    r.visitDate,
    r.visit_date,
    df.createdAt,
    df.created_at,
    df.createdDate,
    df.walkInDate,
    df.walk_in_date,
  ];
  for (const value of candidates) {
    const s = String(value ?? "").trim();
    if (s) return s;
  }
  return "";
}

export function readMeetingDateRaw(lead: ApiLead): string {
  const r = lead as Record<string, unknown>;
  const df =
    lead.dynamicFields && typeof lead.dynamicFields === "object" && !Array.isArray(lead.dynamicFields)
      ? (lead.dynamicFields as Record<string, unknown>)
      : {};
  const candidates = [
    lead.meetingDate,
    r.meetingDate,
    r.meeting_date,
    r.siteVisitDate,
    r.site_visit_date,
    df.meetingDate,
    df.meeting_date,
  ];
  for (const value of candidates) {
    const s = String(value ?? "").trim();
    if (s) return s;
  }
  return "";
}

/**
 * Date string used for BFF local range checks (WhatsApp / walk-in), matching Hub `dateField`.
 * Defaults to created (with updatedAt fallback) when field is omitted / "created".
 */
export function readLeadDateRawForCrmDateField(
  lead: ApiLead,
  dateField: string | null | undefined,
): string {
  const field = (dateField ?? "").trim().toLowerCase();
  if (field === "followup" || field === "follow_up") {
    return readFollowUpDateRaw(lead);
  }
  if (field === "meeting") {
    return readMeetingDateRaw(lead);
  }
  return readLeadCreatedAtRaw(lead) || String(lead.updatedAt ?? "").trim();
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

/** Normalized assignee tokens for matching team lists, filters, and self. */
export function assigneeAliasNorms(lead: ApiLead): Set<string> {
  return crmLeadAssigneeAliasNorms(lead);
}

function leadAssignedToSelf(lead: ApiLead, meNorm: string): boolean {
  if (!meNorm) return false;
  return assigneeAliasNorms(lead).has(meNorm);
}

/** SE follow-up counts — matches LeadsDataSection `leadAssignedToSelf` (user id + aliases). */
export function leadAssignedToSeInsightScope(lead: ApiLead, opts: InsightCountOpts): boolean {
  const userId = Number(opts.assigneeUserId ?? 0);
  if (Number.isFinite(userId) && userId > 0) {
    const r = lead as Record<string, unknown>;
    const assigneeObj =
      r.assignee && typeof r.assignee === "object" && !Array.isArray(r.assignee)
        ? (r.assignee as Record<string, unknown>)
        : null;
    const salesOwnerObj =
      r.salesOwner && typeof r.salesOwner === "object" && !Array.isArray(r.salesOwner)
        ? (r.salesOwner as Record<string, unknown>)
        : null;
    const idCandidates = [
      r.assigneeId,
      r.assignedToId,
      r.salesExecutiveId,
      r.salesOwnerId,
      r.userId,
      assigneeObj?.id,
      salesOwnerObj?.id,
    ];
    if (idCandidates.some((v) => Number(v ?? 0) === userId)) return true;
  }
  const me = opts.currentUserName.trim().toLowerCase();
  const aliasSet = new Set(
    [me, ...(opts.assigneeAliasNorms ?? []).map((a) => a.trim().toLowerCase())].filter(Boolean),
  );
  if (aliasSet.size === 0) return false;
  for (const alias of assigneeAliasNorms(lead)) {
    if (aliasSet.has(alias)) return true;
  }
  return false;
}

function seAssigneeOk(lead: ApiLead, opts: InsightCountOpts, me: string): boolean {
  if (opts.viewerRole.trim().toUpperCase() === "SALES_EXECUTIVE") {
    if (opts.assigneeUserId || (opts.assigneeAliasNorms?.length ?? 0) > 0) {
      return leadAssignedToSeInsightScope(lead, opts);
    }
  }
  return leadAssignedToSelf(lead, me);
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
  /** SE evening CTA: restrict to morning snapshot keys still due today. */
  pendingSnapshotLeadKeys?: ReadonlySet<string> | null;
  /** Same assignee scope as `/Leads` tiles (id + all aliases). */
  assigneeUserId?: number;
  assigneeAliasNorms?: string[];
};

/** Admin / super-admin pool tiles use full-pool manager semantics. */
export function normalizeInsightCountOpts(opts: InsightCountOpts): InsightCountOpts {
  const role = opts.viewerRole.trim().toUpperCase();
  if (role === "SALES_ADMIN" || role === "ADMIN" || role === "SUPER_ADMIN") {
    return {
      ...opts,
      viewerRole: "SALES_MANAGER",
      leadView: "default",
    };
  }
  return opts;
}

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
  optsInput: InsightCountOpts,
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
  const opts = normalizeInsightCountOpts(optsInput);
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
    const fu = readEffectiveFollowUpDateRaw(lead);

    if (opts.viewerRole === "SALES_EXECUTIVE") {
      if (seAssigneeOk(lead, opts, me)) {
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
        if (isFollowUpOverdueLocal(fu) && !isLostSegmentLead(lead)) {
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
          if (isFollowUpOverdueLocal(fu) && !isLostSegmentLead(lead)) {
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
          if (isFollowUpOverdueLocal(fu) && !isLostSegmentLead(lead)) {
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
        if (isFollowUpOverdueLocal(fu) && !isLostSegmentLead(lead)) {
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
  | "followUpToday"
  | "followUpTodayPending"
  | "overdue"
  | "overdueActive"
  | "overdueClosure"
  | "callDelayed"
  | "totalCalls"
  | "teamLeads"
  | "meetingScheduled"
  | "meetingRescheduled"
  | "meetingCancelled"
  | "quoteSent"
  | "meetingSuccessful"
  | "lostQuoteSent"
  | LostSegmentMode;

export function filterLeadsForInsightMode(
  leads: ApiLead[],
  mode: InsightTableMode,
  optsInput: InsightCountOpts,
): ApiLead[] {
  const opts = normalizeInsightCountOpts(optsInput);
  if (!mode) return leads;
  if (isLostSegmentInsightMode(mode)) {
    return filterLeadsForLostSegmentMode(leads, mode, opts);
  }
  if (
    mode === "meetingScheduled" ||
    mode === "meetingRescheduled" ||
    mode === "meetingCancelled" ||
    mode === "quoteSent" ||
    mode === "meetingSuccessful" ||
    mode === "lostQuoteSent"
  ) {
    return filterLeadsForMilestoneInsightMode(leads, mode, opts);
  }
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
    const fu = readEffectiveFollowUpDateRaw(lead);
    const firstCallAt = String((lead.firstCallAt ?? "") as string).trim();

    if (mode === "totalCalls") {
      if (!isCalledLead(lead)) return false;
      if (!inDateRangeByField(firstCallAt, opts.dateFrom, opts.dateTo)) {
        return false;
      }
      if (opts.viewerRole === "SALES_EXECUTIVE") return seAssigneeOk(lead, opts, me);
      if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "team")
        return leadAssignedToTeamMember(lead, teamSet);
      if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "my")
        return leadAssignedToSelf(lead, me);
      return true;
    }

    if (mode === "callDelayed") {
      if (!isFirstCallDelayedLead(lead)) return false;
      if (opts.viewerRole === "SALES_EXECUTIVE") return seAssigneeOk(lead, opts, me);
      if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "team")
        return leadAssignedToTeamMember(lead, teamSet);
      if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "my")
        return leadAssignedToSelf(lead, me);
      return true;
    }

    if (
      mode === "followUpActive" ||
      mode === "followUpClosure" ||
      mode === "followUpToday" ||
      mode === "followUpTodayPending"
    ) {
      if (!isFollowUpDueLocalToday(fu)) return false;
      let assigneeOk = true;
      if (opts.viewerRole === "SALES_EXECUTIVE") assigneeOk = seAssigneeOk(lead, opts, me);
      else if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "team")
        assigneeOk = leadAssignedToTeamMember(lead, teamSet);
      else if (opts.viewerRole === "SALES_MANAGER" && opts.leadView === "my") assigneeOk = leadAssignedToSelf(lead, me);
      if (!assigneeOk) return false;
      if (mode === "followUpToday") return true;
      if (mode === "followUpTodayPending") {
        const keys = opts.pendingSnapshotLeadKeys;
        if (keys && keys.size > 0) {
          const id = String((lead as ApiLead).id ?? "").trim();
          const lt = String((lead as ApiLead).leadType ?? "formlead")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "formlead";
          const leadKey = `${lt}:${id}`;
          if (!keys.has(leadKey)) return false;
        }
        return true;
      }
      const segment: FollowUpMilestoneSegment = mode === "followUpActive" ? "active" : "closure";
      if (!matchesFollowUpMilestoneSegment(lead, segment)) return false;
      return true;
    }

    if (mode === "overdue" || mode === "overdueActive" || mode === "overdueClosure") {
      if (isLostSegmentLead(lead)) return false;
      if (!isFollowUpOverdueLocal(fu)) return false;
      if (opts.viewerRole === "SALES_EXECUTIVE") return seAssigneeOk(lead, opts, me);
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
