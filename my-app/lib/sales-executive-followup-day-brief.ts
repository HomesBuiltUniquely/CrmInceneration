import type { ApiLead } from "@/lib/leads-filter";
import { parseLeadSortTimestamp } from "@/lib/leads-filter";
import {
  assigneeAliasNorms,
  computeFollowUpInsightCounts,
  filterLeadsForInsightMode,
  matchesFollowUpMilestoneSegment,
  normalizeInsightCountOpts,
  readEffectiveFollowUpDateRaw,
  type InsightCountOpts,
} from "@/lib/lead-follow-up-insights";
import {
  isFollowUpDueLocalToday,
  isFollowUpOverdueLocal,
  parseFollowUpTimestampMs,
} from "@/lib/follow-up-date";
import { salesInsightCountLeads } from "@/lib/sales-admin-insight-tiles";
import {
  defaultLeadsVerificationStatus,
  filterLeadsForClientWorkspaceInbox,
} from "@/lib/crm-workspace";

export type FollowUpBriefRow = {
  leadKey: string;
  timeLabel: string;
  name: string;
  stageLabel: string;
  segment: "active" | "closure";
  followUpMs: number;
  timePastDue: boolean;
};

export type MorningFollowUpBrief = {
  kind: "morning";
  totalDue: number;
  followupsActive: number;
  followupsClosure: number;
  overdueTotal: number;
  overdueActive: number;
  overdueClosure: number;
  firstUp: FollowUpBriefRow[];
};

export type EveningFollowUpBrief = {
  kind: "evening";
  totalDue: number;
  completed: number;
  left: number;
  olderOverdueCleared: number;
  pendingRows: FollowUpBriefRow[];
};

export type FollowUpDaySnapshotItem = {
  leadKey: string;
  followUpMs: number;
  wasOverdue: boolean;
  segment: "active" | "closure";
  display: {
    name: string;
    timeLabel: string;
    stageLabel: string;
  };
};

export type FollowUpDaySnapshot = {
  capturedAt: string;
  totalDue: number;
  overdueAtCapture: number;
  items: FollowUpDaySnapshotItem[];
};

export type SeFollowUpViewerContext = {
  displayName: string;
  aliasNorms: string[];
  userId: number;
};

export function stableFollowUpLeadKey(lead: ApiLead): string {
  const lt =
    String(lead.leadType ?? "formlead")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "formlead";
  const id = String(lead.id ?? "").trim();
  return `${lt}:${id}`;
}

function readLeadCustomerName(lead: ApiLead): string {
  const r = lead as Record<string, unknown>;
  const named = String(
    lead.customerName ?? r.customerName ?? r.clientName ?? r.leadName ?? r.name ?? "",
  ).trim();
  return named || "Customer";
}

function readStageLabel(lead: ApiLead): string {
  const st = lead.stage;
  if (st && typeof st === "object" && !Array.isArray(st)) {
    const block = st as { milestoneStage?: string; milestoneSubStage?: string; subStage?: string };
    const ms = String(block.milestoneStage ?? "").trim();
    const ss = String(block.milestoneSubStage ?? block.subStage ?? "").trim();
    if (ms && ss) return `${ms} · ${ss}`;
    if (ms) return ms;
    if (ss) return ss;
  }
  return "Follow-up";
}

export function formatFollowUpTimeLabel(
  raw: string,
  now = new Date(),
): { label: string; pastDue: boolean } {
  const ms = parseFollowUpTimestampMs(raw);
  if (ms === null) return { label: "—", pastDue: false };
  const label = new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const pastDue = ms < now.getTime() && isFollowUpDueLocalToday(raw, now);
  return { label, pastDue };
}

function seInsightOpts(currentUserName: string): InsightCountOpts {
  return normalizeInsightCountOpts({
    viewerRole: "SALES_EXECUTIVE",
    currentUserName: currentUserName,
    managerTeamNames: [],
    leadView: "default",
  });
}

function leadStableIdentifier(lead: ApiLead): string {
  const row = lead as Record<string, unknown>;
  const fromFields = String(
    row.leadId ?? row.lead_identifier ?? row.leadIdentifier ?? row.uniqueId ?? "",
  ).trim();
  if (fromFields) return fromFields.toLowerCase();
  if (lead.id !== undefined && lead.id !== null) return String(lead.id);
  return "";
}

export function dedupeLeadsByStableId(leads: ApiLead[]): ApiLead[] {
  const byId = new Map<string, ApiLead>();
  let noIdSeq = 0;
  for (const lead of leads) {
    const id = leadStableIdentifier(lead);
    const key = id || `__noid_${noIdSeq++}`;
    const existing = byId.get(key);
    if (!existing || parseLeadSortTimestamp(lead) >= parseLeadSortTimestamp(existing)) {
      byId.set(key, lead);
    }
  }
  return [...byId.values()];
}

export function leadAssignedToSalesExecutive(
  lead: ApiLead,
  userId: number,
  meAliasNorms: Set<string>,
): boolean {
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
    if (idCandidates.some((v) => Number(v ?? 0) === Number(userId))) return true;
  }
  if (meAliasNorms.size === 0) return false;
  const aliases = assigneeAliasNorms(lead);
  for (const meAlias of meAliasNorms) {
    if (aliases.has(meAlias)) return true;
  }
  return false;
}

export function postProcessSalesExecutiveFollowUpPool(
  rawLeads: ApiLead[],
  viewer: SeFollowUpViewerContext,
): ApiLead[] {
  const verificationStatus = defaultLeadsVerificationStatus(
    "sales",
    undefined,
    "SALES_EXECUTIVE",
  );
  let leads = filterLeadsForClientWorkspaceInbox(rawLeads, "sales", verificationStatus);
  const meNorms = new Set(viewer.aliasNorms);
  leads = leads.filter((lead) =>
    leadAssignedToSalesExecutive(lead, viewer.userId, meNorms),
  );
  leads = dedupeLeadsByStableId(leads);
  return salesInsightCountLeads(leads);
}

export function filterLeadsDueTodayAll(
  leads: ApiLead[],
  currentUserName: string,
): ApiLead[] {
  return filterLeadsForInsightMode(leads, "followUpToday", seInsightOpts(currentUserName));
}

function rowFromLead(lead: ApiLead, now = new Date()): FollowUpBriefRow {
  const fu = readEffectiveFollowUpDateRaw(lead);
  const { label, pastDue } = formatFollowUpTimeLabel(fu, now);
  const segment = matchesFollowUpMilestoneSegment(lead, "closure") ? "closure" : "active";
  return {
    leadKey: stableFollowUpLeadKey(lead),
    timeLabel: label,
    name: readLeadCustomerName(lead),
    stageLabel: readStageLabel(lead),
    segment,
    followUpMs: parseFollowUpTimestampMs(fu) ?? Number.MAX_SAFE_INTEGER,
    timePastDue: pastDue,
  };
}

export function buildSnapshotFromDueTodayLeads(
  dueToday: ApiLead[],
  now = new Date(),
): FollowUpDaySnapshot {
  const items: FollowUpDaySnapshotItem[] = dueToday.map((lead) => {
    const fu = readEffectiveFollowUpDateRaw(lead);
    const row = rowFromLead(lead, now);
    return {
      leadKey: row.leadKey,
      followUpMs: row.followUpMs,
      wasOverdue: isFollowUpOverdueLocal(fu, now),
      segment: row.segment,
      display: {
        name: row.name,
        timeLabel: row.timeLabel,
        stageLabel: row.stageLabel,
      },
    };
  });
  return {
    capturedAt: now.toISOString(),
    totalDue: items.length,
    overdueAtCapture: items.filter((i) => i.wasOverdue).length,
    items,
  };
}

export function buildMorningFollowUpBrief(
  leads: ApiLead[],
  currentUserName: string,
  now = new Date(),
  previewLimit = 5,
): MorningFollowUpBrief {
  const opts = seInsightOpts(currentUserName);
  const counts = computeFollowUpInsightCounts(leads, opts);
  const dueToday = filterLeadsDueTodayAll(leads, currentUserName).sort(
    (a, b) =>
      (parseFollowUpTimestampMs(readEffectiveFollowUpDateRaw(a)) ?? 0) -
      (parseFollowUpTimestampMs(readEffectiveFollowUpDateRaw(b)) ?? 0),
  );
  const firstUp = dueToday.slice(0, previewLimit).map((lead) => rowFromLead(lead, now));
  return {
    kind: "morning",
    totalDue: counts.followupsActive + counts.followupsClosure,
    followupsActive: counts.followupsActive,
    followupsClosure: counts.followupsClosure,
    overdueTotal: counts.overdueActive + counts.overdueClosure,
    overdueActive: counts.overdueActive,
    overdueClosure: counts.overdueClosure,
    firstUp,
  };
}

export function buildEveningFollowUpBrief(
  leads: ApiLead[],
  currentUserName: string,
  snapshot: FollowUpDaySnapshot,
  now = new Date(),
  previewLimit = 8,
): EveningFollowUpBrief {
  const leadByKey = new Map(leads.map((l) => [stableFollowUpLeadKey(l), l]));
  let completed = 0;
  let left = 0;
  let olderOverdueCleared = 0;
  const pendingLeads: ApiLead[] = [];

  for (const item of snapshot.items) {
    const lead = leadByKey.get(item.leadKey);
    if (!lead) {
      completed += 1;
      if (item.wasOverdue) olderOverdueCleared += 1;
      continue;
    }
    const fu = readEffectiveFollowUpDateRaw(lead);
    const stillDue = isFollowUpDueLocalToday(fu, now);
    if (stillDue) {
      left += 1;
      pendingLeads.push(lead);
    } else {
      completed += 1;
      if (item.wasOverdue) olderOverdueCleared += 1;
    }
  }

  pendingLeads.sort(
    (a, b) =>
      (parseFollowUpTimestampMs(readEffectiveFollowUpDateRaw(a)) ?? 0) -
      (parseFollowUpTimestampMs(readEffectiveFollowUpDateRaw(b)) ?? 0),
  );

  return {
    kind: "evening",
    totalDue: snapshot.totalDue,
    completed,
    left,
    olderOverdueCleared,
    pendingRows: pendingLeads.slice(0, previewLimit).map((lead) => rowFromLead(lead, now)),
  };
}

export function viewerContextFromAuthUser(
  user: Record<string, unknown>,
): SeFollowUpViewerContext {
  const displayName = String(
    user.fullName ?? user.name ?? user.username ?? user.displayName ?? "",
  ).trim();
  const username = String(user.username ?? user.loginUsername ?? "").trim();
  const userId = Number(user.id ?? user.userId ?? 0);
  const norm = (s: string) => s.trim().toLowerCase();
  const aliasNorms = [
    ...new Set(
      [displayName, username, String(user.id ?? "").trim(), String(user.email ?? "").trim()]
        .map(norm)
        .filter(Boolean),
    ),
  ];
  return {
    displayName: displayName || username,
    aliasNorms,
    userId: Number.isFinite(userId) ? userId : 0,
  };
}