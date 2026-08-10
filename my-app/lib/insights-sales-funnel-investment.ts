import type { InsightsFunnelStage } from "@/lib/crm-insights-api";
import { crmLeadTopLevelStage, type ApiLead } from "@/lib/leads-filter";
import { isLostPathLead } from "@/lib/lead-lost-segment";
import { stableLeadKey } from "@/lib/insights-lead-investment";

function normStage(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Funnel depth index for reached-stage value roll-up (Fresh Lead = 0 … Closed Won = 5). */
export function salesFunnelStageIndex(lead: ApiLead): number {
  const raw = crmLeadTopLevelStage(lead);
  const key = normStage(raw);

  if (key.includes("closed") || key.includes("booking") || key.includes("token")) return 5;
  if (key.includes("decision")) return 4;
  if (key.includes("experience") || (key.includes("exp") && key.includes("design"))) return 3;
  if (key.includes("design") && !key.includes("fresh")) return 3;
  if (key.includes("connection") || key.includes("connect")) return 2;
  if (key.includes("discovery") || key.includes("discover")) return 1;
  return 0;
}

function backendStageIndex(stage: InsightsFunnelStage): number {
  const key = normStage(stage.stageKey || stage.stageLabel);
  if (key.includes("closed") || key.includes("won") || key.includes("booking")) return 5;
  if (key.includes("decision")) return 4;
  if (key.includes("exp") || key.includes("design")) return 3;
  if (key.includes("connection") || key.includes("connect")) return 2;
  if (key.includes("discovery") || key.includes("discover")) return 1;
  if (key.includes("fresh")) return 0;
  return 0;
}

/**
 * Sum Total Investment Range for leads that reached each funnel stage.
 * A lead at Decision contributes its investment to Fresh Lead through Decision.
 */
export function computeFunnelStageInvestmentTotals(
  leads: ApiLead[],
  investments: Map<string, number>,
  backendStages: InsightsFunnelStage[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const stage of backendStages) {
    totals[stage.stageKey || stage.stageLabel] = 0;
  }

  const activeLeads = leads.filter((lead) => !isLostPathLead(lead));

  for (const lead of activeLeads) {
    const amount = investments.get(stableLeadKey(lead)) ?? 0;
    if (amount <= 0) continue;
    const leadIdx = salesFunnelStageIndex(lead);

    for (const stage of backendStages) {
      const stageIdx = backendStageIndex(stage);
      if (leadIdx >= stageIdx) {
        const key = stage.stageKey || stage.stageLabel;
        totals[key] = (totals[key] ?? 0) + amount;
      }
    }
  }

  return totals;
}

/**
 * Sum investment only for leads currently sitting in each funnel stage
 * (matches Journey heatmap stage inventory, not cumulative "ever reached").
 */
export function computeFunnelCurrentStageInvestmentTotals(
  leads: ApiLead[],
  investments: Map<string, number>,
  backendStages: InsightsFunnelStage[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const stage of backendStages) {
    totals[stage.stageKey || stage.stageLabel] = 0;
  }

  // index → first backend stage key that maps to this depth
  const keyByIndex = new Map<number, string>();
  for (const stage of backendStages) {
    const idx = backendStageIndex(stage);
    if (!keyByIndex.has(idx)) {
      keyByIndex.set(idx, stage.stageKey || stage.stageLabel);
    }
  }

  for (const lead of leads) {
    const amount = investments.get(stableLeadKey(lead)) ?? 0;
    if (amount <= 0) continue;
    const leadIdx = salesFunnelStageIndex(lead);
    const key = keyByIndex.get(leadIdx);
    if (!key) continue;
    totals[key] = (totals[key] ?? 0) + amount;
  }

  return totals;
}

/** Investment for leads currently in Fresh Lead milestone only. */
export function computeFreshLeadStageInvestmentTotal(
  leads: ApiLead[],
  investments: Map<string, number>,
): number {
  return leads
    .filter((lead) => salesFunnelStageIndex(lead) === 0)
    .reduce((sum, lead) => sum + (investments.get(stableLeadKey(lead)) ?? 0), 0);
}

/**
 * Pipeline-share % (current inventory model). First stage is 100 only when it's the
 * sole stage; otherwise each stage is % of total across shown stages.
 */
export function recalcFunnelSharePercents(stages: InsightsFunnelStage[]): InsightsFunnelStage[] {
  const total = stages.reduce((s, x) => s + (Number(x.count) || 0), 0);
  return stages.map((stage) => ({
    ...stage,
    conversionPercent: total > 0 ? (stage.count / total) * 100 : 0,
  }));
}

export function recalcFunnelConversionPercents(stages: InsightsFunnelStage[]): InsightsFunnelStage[] {
  return stages.map((stage, index) => {
    const prevCount = index > 0 ? stages[index - 1]!.count : stage.count;
    const conversionPercent =
      index === 0 ? 100 : prevCount > 0 ? (stage.count / prevCount) * 100 : 0;
    return { ...stage, conversionPercent };
  });
}
