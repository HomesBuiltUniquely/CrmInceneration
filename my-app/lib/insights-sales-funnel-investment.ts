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

/** Total investment for all active (non-lost) leads — Fresh Lead funnel bar. */
export function computeFreshLeadInvestmentTotal(
  leads: ApiLead[],
  investments: Map<string, number>,
): number {
  return leads
    .filter((lead) => !isLostPathLead(lead))
    .reduce((sum, lead) => sum + (investments.get(stableLeadKey(lead)) ?? 0), 0);
}

export function recalcFunnelConversionPercents(stages: InsightsFunnelStage[]): InsightsFunnelStage[] {
  return stages.map((stage, index) => {
    const prevCount = index > 0 ? stages[index - 1]!.count : stage.count;
    const conversionPercent =
      index === 0 ? 100 : prevCount > 0 ? (stage.count / prevCount) * 100 : 0;
    return { ...stage, conversionPercent };
  });
}
