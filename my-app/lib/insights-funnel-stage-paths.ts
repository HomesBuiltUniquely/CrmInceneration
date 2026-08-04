import { crmLeadTopLevelStage, type ApiLead } from "@/lib/leads-filter";

export type SubStatusMapping = {
  stage: string;
  stageCategory: string;
  subStageName: string;
};

export type FunnelStagePathBreakdown = {
  wonTotal: number;
  lostTotal: number;
  wonSubstages: Array<{ title: string; count: number }>;
  lostSubstages: Array<{ title: string; count: number }>;
};

export type FunnelStagePathDataMap = Record<string, FunnelStagePathBreakdown>;

const CRM_STAGE_NAMES = [
  "Discovery",
  "Connection",
  "Experience & Design",
  "Decision",
  "Closed",
] as const;

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function isWonCategory(s: string): boolean {
  return /\bwon\b/i.test(s);
}

function isLostCategory(s: string): boolean {
  return /\blost\b/i.test(s);
}

/** Map funnel stage key / label to canonical bucket used in Insights funnel bars. */
export function resolveFunnelCanonicalKey(stageKeyOrLabel: string): string {
  const key = norm(stageKeyOrLabel);
  if (key.includes("fresh") || key.includes("new lead") || key.includes("received")) {
    return "fresh_lead";
  }
  if (key.includes("discovery") || key.includes("discover")) return "discovery";
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

function buildPathBreakdownForStage(
  leads: ApiLead[],
  subMappings: SubStatusMapping[],
  selectedStage: string,
): FunnelStagePathBreakdown {
  const scopedLeads = leads.filter(
    (lead) => norm(crmLeadTopLevelStage(lead)) === norm(selectedStage),
  );

  const bySub = scopedLeads.reduce<Map<string, number>>((acc, lead) => {
    const sub = subStageFromLead(lead);
    if (!sub) return acc;
    const key = norm(sub);
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map());

  const wonSubstages: Array<{ title: string; count: number }> = [];
  const lostSubstages: Array<{ title: string; count: number }> = [];

  for (const m of subMappings) {
    if (norm(m.stage) !== norm(selectedStage)) continue;

    const subName = (m.subStageName || "").trim();
    if (!subName) continue;

    const count = bySub.get(norm(subName)) ?? 0;
    const isWon = isWonCategory(m.stageCategory) || norm(subName) === "renovation";
    const isLost = isLostCategory(m.stageCategory) && !isWon;
    if (!isWon && !isLost) continue;

    const item = { title: subName, count };
    if (isWon) {
      if (!wonSubstages.some((x) => norm(x.title) === norm(subName))) {
        wonSubstages.push(item);
      }
    } else if (isLost) {
      if (!lostSubstages.some((x) => norm(x.title) === norm(subName))) {
        lostSubstages.push(item);
      }
    }
  }

  const wonTotal = wonSubstages.reduce((s, i) => s + i.count, 0);
  const lostTotal = lostSubstages.reduce((s, i) => s + i.count, 0);

  return {
    wonTotal,
    lostTotal,
    wonSubstages,
    lostSubstages,
  };
}

/**
 * Won/Lost path totals and substage counts per funnel stage — same rules as `CrmPipeline` /
 * `MilestonePaths` on the sales dashboard.
 */
export function buildInsightsFunnelStagePathData(
  leads: ApiLead[],
  rawSubMappings: SubStatusMapping[],
): FunnelStagePathDataMap {
  const subMappings = effectiveSubMappings(rawSubMappings ?? []);
  const out: FunnelStagePathDataMap = {};

  for (const stageName of CRM_STAGE_NAMES) {
    const key = canonicalKeyFromCrmStageName(stageName);
    out[key] = buildPathBreakdownForStage(leads, subMappings, stageName);
  }

  return out;
}
