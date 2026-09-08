import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { pipelineRoleForWorkspace } from "@/lib/crm-workspace";
import { crmLeadTopLevelStage, type ApiLead } from "@/lib/leads-filter";
import type { CrmNestedStage, CrmPipelineResponse } from "@/types/crm-pipeline";

export type SubStatusMapping = {
  stage: string;
  stageCategory: string;
  subStageName: string;
};

export type FunnelStagePathBreakdown = {
  wonTotal: number;
  lostTotal: number;
  holdTotal: number;
  wonSubstages: Array<{ title: string; count: number }>;
  lostSubstages: Array<{ title: string; count: number }>;
  holdSubstages: Array<{ title: string; count: number }>;
};

export type FunnelStagePathDataMap = Record<string, FunnelStagePathBreakdown>;

export type InsightsAlignedDropReasons = {
  total: number;
  items: Array<{ reason: string; count: number; percent: number }>;
};

const CRM_STAGE_NAMES = [
  "Fresh Lead",
  "Discovery",
  "Connection",
  "Experience & Design",
  "Decision",
  "Closed",
] as const;

/** Funnel bar order for Insights Sales Funnel (current-in-stage inventory). */
export const INSIGHTS_FUNNEL_STAGE_DEFS = [
  { stageKey: "fresh_lead", stageLabel: "Fresh Lead", phaseLabel: "Fresh Lead" },
  { stageKey: "discovery", stageLabel: "Discovery", phaseLabel: "Discovery" },
  { stageKey: "connection", stageLabel: "Connection", phaseLabel: "Connection" },
  {
    stageKey: "exp_design",
    stageLabel: "Exp & Design",
    phaseLabel: "Experience & Design",
  },
  { stageKey: "decision", stageLabel: "Decision", phaseLabel: "Decision" },
  { stageKey: "closed", stageLabel: "Closed", phaseLabel: "Closed" },
] as const;

/**
 * Build sales funnel bars from Journey-heatmap style milestone inventory
 * (leads *currently* in each milestone — never total pool as Fresh Lead).
 */
export function buildAlignedSalesFunnelStages(
  milestoneCounts: Record<string, number>,
  valuesByKey?: Record<string, number> | null,
): Array<{
  stageKey: string;
  stageLabel: string;
  count: number;
  countLabel: string;
  value: number;
  conversionPercent: number;
}> {
  const total = INSIGHTS_FUNNEL_STAGE_DEFS.reduce(
    (sum, d) => sum + (Number(milestoneCounts[d.phaseLabel] ?? 0) || 0),
    0,
  );

  return INSIGHTS_FUNNEL_STAGE_DEFS.map((d) => {
    const count = Number(milestoneCounts[d.phaseLabel] ?? 0) || 0;
    const value =
      valuesByKey?.[d.stageKey] ??
      valuesByKey?.[d.stageLabel] ??
      valuesByKey?.[d.phaseLabel] ??
      0;
    return {
      stageKey: d.stageKey,
      stageLabel: d.stageLabel,
      count,
      countLabel: "Leads",
      value,
      conversionPercent: total > 0 ? (count / total) * 100 : 0,
    };
  });
}

/** Hub often omits Fresh Lead — guarantee the bar exists for inventory display. */
export function ensureFreshLeadInSalesFunnel<
  T extends { stageKey?: string; stageLabel?: string; count?: number },
>(stages: T[]): T[] {
  if (!Array.isArray(stages) || stages.length === 0) {
    return buildAlignedSalesFunnelStages({}) as unknown as T[];
  }
  const hasFresh = stages.some((s) => {
    const k = resolveFunnelCanonicalKey(String(s.stageKey || s.stageLabel || ""));
    return k === "fresh_lead";
  });
  if (hasFresh) return stages;
  const fresh = {
    stageKey: "fresh_lead",
    stageLabel: "Fresh Lead",
    count: 0,
    countLabel: "Leads",
    value: 0,
    conversionPercent: 0,
  } as unknown as T;
  // After Total synthetic is not here — these are milestone stages only
  return [fresh, ...stages];
}


function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/**
 * Drop Reason Analysis from the same lost substages as Sales Funnel drill-down
 * (so Fake/Spam etc. match the Lost Path popup exactly).
 */
export function buildDropReasonsFromFunnelStagePaths(
  stagePathData: FunnelStagePathDataMap,
): InsightsAlignedDropReasons {
  const byReason = new Map<string, { reason: string; count: number }>();

  for (const breakdown of Object.values(stagePathData)) {
    for (const item of breakdown?.lostSubstages ?? []) {
      const title = String(item.title ?? "").trim();
      const count = Number(item.count) || 0;
      if (!title || count <= 0) continue;
      const key = norm(title);
      const existing = byReason.get(key);
      if (existing) {
        existing.count += count;
      } else {
        byReason.set(key, { reason: title, count });
      }
    }
  }

  const items = [...byReason.values()].sort(
    (a, b) => b.count - a.count || a.reason.localeCompare(b.reason),
  );
  const total = items.reduce((sum, row) => sum + row.count, 0);

  return {
    total,
    items: items.map((row) => ({
      reason: row.reason,
      count: row.count,
      percent: total > 0 ? (row.count / total) * 100 : 0,
    })),
  };
}

function isWonCategory(s: string): boolean {
  return /\bwon\b/i.test(s);
}

function isLostCategory(s: string): boolean {
  return /\blost\b/i.test(s);
}

/** Hold path: substage or category labels containing "Hold" (not Won/Lost categories). */
export function isHoldPathLabel(subStageName: string, stageCategory = ""): boolean {
  const sub = (subStageName ?? "").trim();
  const cat = (stageCategory ?? "").trim();
  if (/\bhold\b/i.test(sub)) return true;
  if (/\bhold\b/i.test(cat) && !isWonCategory(cat) && !isLostCategory(cat)) return true;
  return false;
}

function emptyPathBreakdown(): FunnelStagePathBreakdown {
  return {
    wonTotal: 0,
    lostTotal: 0,
    holdTotal: 0,
    wonSubstages: [],
    lostSubstages: [],
    holdSubstages: [],
  };
}

/** Map funnel stage key / label to canonical bucket used in Insights funnel bars.
 * Hub checkpoint map (Passages / Cohort / Current align):
 * Fresh Lead → fresh_lead · Discovery → discovery ·
 * Connection | Meeting Scheduled → connection ·
 * Meeting Successful | Quote Sent → exp_design ·
 * Literal Decision only → decision · Closed Won → closed
 */
export function resolveFunnelCanonicalKey(stageKeyOrLabel: string): string {
  const key = norm(stageKeyOrLabel);
  if (key === "total") return "total";
  if (key.includes("fresh") || key.includes("new lead") || key.includes("received")) {
    return "fresh_lead";
  }
  if (key.includes("discovery") || key.includes("discover")) return "discovery";
  // Before generic "meeting" / decision — Hub fixed map.
  if (key.includes("meeting scheduled")) return "connection";
  if (
    key.includes("meeting successful") ||
    key.includes("quote sent") ||
    key === "quote_sent"
  ) {
    return "exp_design";
  }
  if (key.includes("connection") || key.includes("connect")) return "connection";
  if (key.includes("experience") || (key.includes("exp") && key.includes("design"))) {
    return "exp_design";
  }
  if (key.includes("design") && !key.includes("fresh")) return "exp_design";
  if (key.includes("decision")) return "decision";
  if (key.includes("closed") || key.includes("booking") || key.includes("won")) return "closed";
  return key.replace(/\s+/g, "_");
}

function canonicalKeyFromCrmStageName(stageName: string): string {
  return resolveFunnelCanonicalKey(stageName);
}

function subStageFromLead(lead: ApiLead): string {
  return String(lead.stage?.milestoneSubStage ?? "").trim();
}

function effectiveSubMappings(subMappings: SubStatusMapping[]): SubStatusMapping[] {
  const effective = [...subMappings];
  if (!effective.some((m) => norm(m.subStageName) === "renovation")) {
    let insertIdx = effective.length;
    for (let i = 0; i < effective.length; i++) {
      if (norm(effective[i].stage) === "discovery") {
        insertIdx = i + 1;
      }
    }
    effective.splice(insertIdx, 0, {
      stage: "Discovery",
      stageCategory: "Discovery Won",
      subStageName: "Renovation",
    });
  }
  return effective;
}

function mappingsFromNested(nested: CrmNestedStage[] | undefined): SubStatusMapping[] {
  if (!nested?.length) return [];
  const out: SubStatusMapping[] = [];
  const seen = new Set<string>();
  for (const node of nested) {
    const stage = (node.stage || "").trim();
    for (const cat of node.categories ?? []) {
      const stageCategory = (cat.stageCategory || "").trim();
      for (const sub of cat.subStages ?? []) {
        const subStageName = String(sub || "").trim();
        if (!subStageName) continue;
        const key = `${norm(stage)}|${norm(stageCategory)}|${norm(subStageName)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ stage, stageCategory, subStageName });
      }
    }
  }
  return out;
}

function mergeMappings(...lists: SubStatusMapping[][]): SubStatusMapping[] {
  const out: SubStatusMapping[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const m of list) {
      const key = `${norm(m.stage)}|${norm(m.stageCategory)}|${norm(m.subStageName)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(m);
    }
  }
  return out;
}

function lookupSubCount(bySub: Map<string, number>, subName: string): number {
  const key = norm(subName);
  if (!key) return 0;
  const exact = bySub.get(key);
  if (exact != null) return exact;

  // Loose match when Hub label differs slightly (punctuation / parentheticals)
  let best = 0;
  for (const [hubKey, count] of bySub) {
    if (!count) continue;
    if (hubKey === key) return count;
    if (hubKey.includes(key) || key.includes(hubKey)) {
      best = Math.max(best, count);
      continue;
    }
    const hubCore = hubKey.replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    const localCore = key.replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    if (hubCore && localCore && (hubCore === localCore || hubCore.includes(localCore) || localCore.includes(hubCore))) {
      best = Math.max(best, count);
    }
  }
  return best;
}

function stagesMatch(mappingStage: string, selectedStage: string): boolean {
  if (norm(mappingStage) === norm(selectedStage)) return true;
  return resolveFunnelCanonicalKey(mappingStage) === resolveFunnelCanonicalKey(selectedStage);
}

function buildPathBreakdownForStage(
  bySub: Map<string, number>,
  subMappings: SubStatusMapping[],
  selectedStage: string,
): FunnelStagePathBreakdown {
  const wonSubstages: Array<{ title: string; count: number }> = [];
  const lostSubstages: Array<{ title: string; count: number }> = [];
  const holdSubstages: Array<{ title: string; count: number }> = [];

  for (const m of subMappings) {
    if (!stagesMatch(m.stage, selectedStage)) continue;

    const subName = (m.subStageName || "").trim();
    if (!subName) continue;

    const count = lookupSubCount(bySub, subName);
    const isHold = isHoldPathLabel(subName, m.stageCategory);
    const isWon =
      !isHold && (isWonCategory(m.stageCategory) || norm(subName) === "renovation");
    const isLost = !isHold && isLostCategory(m.stageCategory) && !isWon;
    if (!isWon && !isLost && !isHold) continue;

    const item = { title: subName, count };
    if (isHold) {
      if (!holdSubstages.some((x) => norm(x.title) === norm(subName))) {
        holdSubstages.push(item);
      }
    } else if (isWon) {
      if (!wonSubstages.some((x) => norm(x.title) === norm(subName))) {
        wonSubstages.push(item);
      }
    } else if (isLost) {
      if (!lostSubstages.some((x) => norm(x.title) === norm(subName))) {
        lostSubstages.push(item);
      }
    }
  }

  // No invented Hold rows: only pipeline mapping Hold category/substage under this milestone.

  return {
    wonTotal: wonSubstages.reduce((s, i) => s + i.count, 0),
    lostTotal: lostSubstages.reduce((s, i) => s + i.count, 0),
    holdTotal: holdSubstages.reduce((s, i) => s + i.count, 0),
    wonSubstages,
    lostSubstages,
    holdSubstages,
  };
}

const FALLBACK_SUBSTAGES: Record<
  string,
  { won: string[]; lost: string[]; hold: string[] }
> = {
  discovery: {
    won: [
      "No Immediate Requirement",
      "Follow Up Later (Discovery)",
      "Call Back Request (Discovery)",
      "RNR Call Back (Discovery)",
      "Renovation",
    ],
    lost: [
      "Fake / Spam Lead",
      "Qualifications Constraint",
      "Unable to Reach – Multiple Attempts RNR",
      "Non Serviceable Area",
      "Wrong Number",
      "Appointment Requested, No Response",
    ],
    hold: [], // Hold only from pipeline mappings — never invent
  },
  connection: {
    won: [
      "Meeting Scheduled",
      "Meeting Rescheduled",
      "Design Refinement Round (Revisit)",
      "Fix Appointment",
    ],
    lost: [
      "Meeting Cancelled/Paused",
      "Connection Lost - Unreachable",
      "Connection Lost - Not Interested",
    ],
    hold: [],
  },
  exp_design: {
    won: ["Proposal Shared", "Quotation Shared", "Presentation Completed"],
    lost: ["Budget Out", "Competitor Chosen", "Design Mismatch"],
    hold: [],
  },
  decision: {
    won: ["Final Negotiation", "Contract Shared"],
    lost: ["Decision Lost - Budget", "Decision Lost - Postponed"],
    hold: [],
  },
  closed: {
    won: ["Booking Done", "Token Done"],
    lost: [
      "Project Cancelled After Token",
      "Project Cancelled After Booking",
      "Refund Processed",
    ],
    hold: [],
  },
};

function applyFallbackCatalog(map: FunnelStagePathDataMap, bySub: Map<string, number>) {
  for (const [key, catalog] of Object.entries(FALLBACK_SUBSTAGES)) {
    const existing = map[key] ?? emptyPathBreakdown();
    const won = [...existing.wonSubstages];
    const lost = [...existing.lostSubstages];
    // Hold: never invent from static catalog — only Hub pipeline mappings
    // (already present in existing.holdSubstages from buildPathBreakdownForStage).
    const hold = existing.holdSubstages.map((h) => ({
      title: h.title,
      count: lookupSubCount(bySub, h.title),
    }));
    for (const title of catalog.won) {
      if (!won.some((x) => norm(x.title) === norm(title))) {
        won.push({ title, count: lookupSubCount(bySub, title) });
      }
    }
    for (const title of catalog.lost) {
      if (!lost.some((x) => norm(x.title) === norm(title))) {
        lost.push({ title, count: lookupSubCount(bySub, title) });
      }
    }
    map[key] = {
      wonTotal: won.reduce((s, i) => s + i.count, 0),
      lostTotal: lost.reduce((s, i) => s + i.count, 0),
      holdTotal: hold.reduce((s, i) => s + i.count, 0),
      wonSubstages: won,
      lostSubstages: lost,
      holdSubstages: hold,
    };
  }
  return map;
}

/** True when pipeline catalog defines Hold category/substage under this funnel stage. */
export function funnelStageHasHoldPath(
  path: FunnelStagePathBreakdown | undefined | null,
): boolean {
  return Boolean(path?.holdSubstages && path.holdSubstages.length > 0);
}

type HubHoldPathStage = {
  holdTotal?: number;
  substages?: Array<{ title?: string; subStageKey?: string; count?: number }>;
};

/**
 * Prefer Hub `holdPathByStage` over client Hold heuristics when dashboard has it.
 */
export function mergeHubHoldPathByStage(
  map: FunnelStagePathDataMap,
  holdPathByStage: Record<string, HubHoldPathStage> | null | undefined,
): FunnelStagePathDataMap {
  if (!holdPathByStage || Object.keys(holdPathByStage).length === 0) return map;
  const out: FunnelStagePathDataMap = { ...map };
  for (const [rawKey, hub] of Object.entries(holdPathByStage)) {
    const key = resolveFunnelCanonicalKey(rawKey);
    const existing = out[key] ?? emptyPathBreakdown();
    const holdSubstages = (hub.substages ?? []).map((s) => ({
      title: (s.title || s.subStageKey || "").trim(),
      count: Number(s.count) || 0,
    })).filter((s) => s.title);
    const holdTotal =
      hub.holdTotal != null && Number.isFinite(Number(hub.holdTotal))
        ? Number(hub.holdTotal)
        : holdSubstages.reduce((sum, row) => sum + row.count, 0);
    out[key] = {
      ...existing,
      holdTotal,
      holdSubstages,
    };
  }
  return out;
}

/** Build won/lost path map from Hub pre-aggregated substage counts (fast path). */
export function buildInsightsFunnelStagePathDataFromCounts(
  bySubStage: Map<string, number> | Record<string, number>,
  rawSubMappings: SubStatusMapping[],
): FunnelStagePathDataMap {
  const bySub =
    bySubStage instanceof Map
      ? bySubStage
      : new Map(Object.entries(bySubStage).map(([k, v]) => [norm(k), Number(v) || 0]));

  const subMappings = effectiveSubMappings(rawSubMappings ?? []);
  const out: FunnelStagePathDataMap = {};

  for (const stageName of CRM_STAGE_NAMES) {
    const key = canonicalKeyFromCrmStageName(stageName);
    out[key] = buildPathBreakdownForStage(bySub, subMappings, stageName);
  }

  return applyFallbackCatalog(out, bySub);
}

/**
 * Won/Lost path totals from lead rows (slower; used only as refinement fallback).
 */
export function buildInsightsFunnelStagePathData(
  leads: ApiLead[],
  rawSubMappings: SubStatusMapping[],
): FunnelStagePathDataMap {
  const subMappings = effectiveSubMappings(rawSubMappings ?? []);
  const out: FunnelStagePathDataMap = {};

  for (const stageName of CRM_STAGE_NAMES) {
    const key = canonicalKeyFromCrmStageName(stageName);
    const scopedLeads = leads.filter(
      (lead) =>
        stagesMatch(crmLeadTopLevelStage(lead), stageName) ||
        resolveFunnelCanonicalKey(crmLeadTopLevelStage(lead)) === key,
    );
    const bySub = scopedLeads.reduce<Map<string, number>>((acc, lead) => {
      const sub = subStageFromLead(lead);
      if (!sub) return acc;
      const k = norm(sub);
      acc.set(k, (acc.get(k) ?? 0) + 1);
      return acc;
    }, new Map());
    out[key] = buildPathBreakdownForStage(bySub, subMappings, stageName);
  }

  return out;
}

export type FetchInsightsFunnelStagePathOpts = {
  dateFrom?: string | null;
  dateTo?: string | null;
  /** Assignee display names for filtered counts */
  assignees?: string[];
};

type MilestoneCountsResponse = {
  countsByMilestoneSubStage?: Array<{ key: string; count: number }>;
};

function countsMapFromResponse(json: MilestoneCountsResponse | null): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of json?.countsByMilestoneSubStage ?? []) {
    const key = norm(row.key);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + (Number(row.count) || 0));
  }
  return map;
}

/**
 * Fast fetch for funnel substage won/lost data.
 * Uses Hub milestone-counts aggregation + pipeline catalog (no full leads download).
 */
const pathDataCache = new Map<string, { at: number; data: FunnelStagePathDataMap }>();
const PATH_CACHE_TTL_MS = 45_000;

export async function fetchInsightsFunnelStagePathData(
  opts: FetchInsightsFunnelStagePathOpts = {},
): Promise<FunnelStagePathDataMap> {
  const cacheKey = JSON.stringify({
    from: (opts.dateFrom ?? "").trim(),
    to: (opts.dateTo ?? "").trim(),
    assignees: [...(opts.assignees ?? [])].map((a) => a.trim()).filter(Boolean).sort(),
  });
  const cached = pathDataCache.get(cacheKey);
  if (cached && Date.now() - cached.at < PATH_CACHE_TTL_MS) {
    return cached.data;
  }

  const headers = getCrmAuthHeaders();
  const role = pipelineRoleForWorkspace("sales");

  const countsQs = new URLSearchParams();
  countsQs.set("verificationStatus", "verified");
  countsQs.set("leadType", "all");
  const dateFrom = (opts.dateFrom ?? "").trim();
  const dateTo = (opts.dateTo ?? "").trim();
  if (dateFrom) countsQs.set("dateFrom", dateFrom);
  if (dateTo) countsQs.set("dateTo", dateTo);

  const assignees = [...new Set((opts.assignees ?? []).map((a) => a.trim()).filter(Boolean))];
  if (assignees.length === 1) countsQs.set("assignee", assignees[0]!);
  else if (assignees.length > 1) countsQs.set("assignees", assignees.join(","));

  const subStatusQs = new URLSearchParams({ resource: "sub-status", role });

  // Catalog + counts in parallel (3 light APIs max — not full leads)
  const [countsRes, pipelineRes, subMapRes] = await Promise.all([
    fetch(`/api/crm/crm-milestone-counts-filtered?${countsQs.toString()}`, {
      cache: "no-store",
      headers,
    }).catch(() => null),
    fetch(`/api/crm/crm-pipeline?nested=true&role=${encodeURIComponent(role)}`, {
      cache: "no-store",
      headers,
    }).catch(() => null),
    fetch(`/api/milestone-count?${subStatusQs.toString()}`, {
      cache: "no-store",
      headers,
    }).catch(() => null),
  ]);

  let countsJson: MilestoneCountsResponse | null = null;
  if (countsRes?.ok) {
    try {
      countsJson = (await countsRes.json()) as MilestoneCountsResponse;
    } catch {
      countsJson = null;
    }
  }

  let bySub = countsMapFromResponse(countsJson);

  // Fallback: unfiltered total counts if filtered call empty/failed
  if (bySub.size === 0) {
    const globalRes = await fetch("/api/crm/crm-milestone-counts", {
      cache: "no-store",
      headers,
    }).catch(() => null);
    if (globalRes?.ok) {
      try {
        bySub = countsMapFromResponse((await globalRes.json()) as MilestoneCountsResponse);
      } catch {
        /* keep empty */
      }
    }
  }

  let pipelineMappings: SubStatusMapping[] = [];
  if (pipelineRes?.ok) {
    try {
      const pipeline = (await pipelineRes.json()) as CrmPipelineResponse;
      pipelineMappings = mappingsFromNested(pipeline.nested);
    } catch {
      pipelineMappings = [];
    }
  }

  let subMappings: SubStatusMapping[] = [];
  if (subMapRes?.ok) {
    try {
      const mapJson = (await subMapRes.json()) as { mappings?: SubStatusMapping[] };
      subMappings = mapJson.mappings ?? [];
    } catch {
      subMappings = [];
    }
  }

  const mappings = mergeMappings(subMappings, pipelineMappings);
  const data = buildInsightsFunnelStagePathDataFromCounts(bySub, mappings);
  pathDataCache.set(cacheKey, { at: Date.now(), data });
  return data;
}
