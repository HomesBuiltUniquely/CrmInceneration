import { normalizeStage } from "@/lib/crm-pipeline";
import type { CrmNestedStage } from "@/types/crm-pipeline";

export function nestedStageForSelection(
  nested: CrmNestedStage[],
  selectedStage: string,
): CrmNestedStage | undefined {
  const key = normalizeStage(selectedStage);
  return nested.find((n) => normalizeStage(n.stage) === key);
}

export function milestoneStageOptionsFromNested(nested: CrmNestedStage[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of nested) {
    const stage = n.stage.trim();
    if (!stage) continue;
    const key = normalizeStage(stage);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(stage);
  }
  return out;
}

export function milestoneCategoryOptionsForStage(
  nested: CrmNestedStage[],
  stage: string,
): string[] {
  if (!stage.trim()) return [];
  const node = nestedStageForSelection(nested, stage);
  if (!node) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of node.categories) {
    const cat = c.stageCategory.trim();
    if (!cat) continue;
    const key = cat.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cat);
  }
  return out;
}

export function milestoneSubStageOptionsForCategory(
  nested: CrmNestedStage[],
  stage: string,
  category: string,
): string[] {
  if (!stage.trim() || !category.trim()) return [];
  const node = nestedStageForSelection(nested, stage);
  if (!node) return [];
  const cat = node.categories.find(
    (c) => c.stageCategory.trim() === category.trim(),
  );
  if (!cat) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const sub of cat.subStages) {
    const s = sub.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}
