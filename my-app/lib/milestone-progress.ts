/** Match pipeline `milestoneStage` to ordered top-level stages from `/Leads/crm-pipeline` `nested[].stage`. */

export function normalizeStageKey(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Progress bar: current step index in pipeline order (1-based) / total stages.
 * `milestoneStage` comes from `lead.stage.milestoneStage` on list/detail API.
 */
export function computeMilestoneProgress(
  milestoneStage: string | null | undefined,
  orderedStages: string[]
): { pct: number; progressLabel: string; stageLabel: string } {
  if (!orderedStages.length) {
    return { pct: 0, progressLabel: "—", stageLabel: "—" };
  }
  const m = milestoneStage?.trim();
  if (!m) {
    return { pct: 0, progressLabel: `0/${orderedStages.length}`, stageLabel: "—" };
  }
  const idx = orderedStages.findIndex((s) => normalizeStageKey(s) === normalizeStageKey(m));
  if (idx < 0) {
    return {
      pct: 0,
      progressLabel: `—/${orderedStages.length}`,
      stageLabel: m.toUpperCase(),
    };
  }
  const step = idx + 1;
  const total = orderedStages.length;
  const pct = Math.round((step / total) * 100);
  return {
    pct,
    progressLabel: `${step}/${total}`,
    stageLabel: orderedStages[idx]!.toUpperCase(),
  };
}
