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
  const stages = new Set(nested.map((n) => n.stage.trim()).filter(Boolean));
  return [...stages].sort((a, b) => a.localeCompare(b));
}

export function milestoneCategoryOptionsForStage(
  nested: CrmNestedStage[],
  stage: string,
): string[] {
  if (!stage.trim()) return [];
  const node = nestedStageForSelection(nested, stage);
  if (!node) return [];
  const cats = node.categories.map((c) => c.stageCategory.trim()).filter(Boolean);
  return [...new Set(cats)].sort((a, b) => a.localeCompare(b));
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
  return [...cat.subStages].sort((a, b) => a.localeCompare(b));
}
