import type { CrmNestedStage, CrmPipelineEntry } from "@/types/crm-pipeline";
import { normalizeStageKey } from "@/lib/milestone-progress";
import { presalesAllowedForwardStages } from "@/lib/presales-milestone";

/** Sales CRM pipeline order (matches Hub `/Leads/crm-pipeline` nested stages). */
const SALES_PIPELINE_ORDER = [
  "Fresh Lead",
  "Discovery",
  "Connection",
  "Experience & Design",
  "Decision",
  "Closed",
] as const;

export function salesAllowedForwardStages(currentStage: string): string[] {
  const canonical = normalizeSalesMilestoneStageForPipeline(currentStage);
  const key = normalizeStageKey(canonical);
  const idx = SALES_PIPELINE_ORDER.findIndex((s) => normalizeStageKey(s) === key);
  if (idx < 0) return [];
  if (idx >= SALES_PIPELINE_ORDER.length - 1) {
    return [SALES_PIPELINE_ORDER[idx]!];
  }
  return [SALES_PIPELINE_ORDER[idx + 1]!];
}

/** Map API / UI variants to canonical sales pipeline stage names. */
export function normalizeSalesMilestoneStageForPipeline(stage: string): string {
  const key = normalizeStageKey(stage);
  if (!key || key === "fresh" || key === "fresh lead" || key === "fresh leads") {
    return "Fresh Lead";
  }
  const match = SALES_PIPELINE_ORDER.find((s) => normalizeStageKey(s) === key);
  return match ?? stage.trim();
}

function looksLikeFreshLeadMilestone(
  stage: string,
  category: string,
  subStage: string,
): boolean {
  for (const value of [stage, category, subStage]) {
    const key = normalizeStageKey(value);
    if (key === "fresh lead" || key === "fresh leads" || key === "fresh") {
      return true;
    }
  }
  return false;
}

/** Resolve sales Complete Task stage (Fresh Lead when milestone is empty but lead is still fresh). */
export function resolveSalesCompleteTaskStage(args: {
  milestoneStage: string;
  milestoneCategory?: string;
  milestoneSubStage?: string;
  nested?: CrmNestedStage[];
}): string {
  const stage = args.milestoneStage.trim();
  if (stage) return normalizeSalesMilestoneStageForPipeline(stage);
  if (
    looksLikeFreshLeadMilestone(
      "",
      args.milestoneCategory ?? "",
      args.milestoneSubStage ?? "",
    )
  ) {
    return "Fresh Lead";
  }
  const inferred = inferSalesStageFromNested(
    args.nested ?? [],
    args.milestoneSubStage ?? "",
  );
  if (inferred.trim()) return normalizeSalesMilestoneStageForPipeline(inferred);
  return "Fresh Lead";
}

const PRESALES_STAGE_KEYS = new Set([
  "fresh data",
  "data discovery",
  "data conversion",
]);

/** True for presales top-level pipeline stages (not sales `Discovery`). */
export function isPresalesTopLevelStage(stage: string): boolean {
  return PRESALES_STAGE_KEYS.has(normalizeStageKey(stage));
}

function filterToPresalesStages(rows: CompleteTaskMapping[]): CompleteTaskMapping[] {
  return dedupeMappings(rows.filter((r) => isPresalesTopLevelStage(r.stage)));
}

export type CompleteTaskMapping = {
  stage: string;
  stageCategory: string;
  subStageName: string;
};

function stripSubStageParenthetical(subStageName: string): string {
  return subStageName.replace(/\s*\([^)]+\)\s*$/i, "").trim();
}

function pipelineMappingSortKey(
  stage: string,
  stageCategory: string,
  subStageName: string,
): string {
  return `${normalizeStageKey(stage)}|${normalizeStageKey(stageCategory)}|${normalizeStageKey(subStageName)}`;
}

/**
 * Sort flat mappings to match Hub `crm-pipeline` nested order:
 * milestone stage → category → substage sequence (not A–Z).
 */
export function sortMappingsByNestedPipelineOrder(
  nested: CrmNestedStage[] | undefined,
  mappings: CompleteTaskMapping[],
): CompleteTaskMapping[] {
  if (!nested?.length || mappings.length === 0) return mappings;

  const orderIndex = new Map<string, number>();
  let idx = 0;

  const register = (stage: string, stageCategory: string, subStageName: string) => {
    const sub = subStageName.trim();
    if (!sub) return;
    const keys = [pipelineMappingSortKey(stage, stageCategory, sub)];
    const base = stripSubStageParenthetical(sub);
    if (base && base !== sub) {
      keys.push(pipelineMappingSortKey(stage, stageCategory, base));
    }
    for (const key of keys) {
      if (!orderIndex.has(key)) orderIndex.set(key, idx);
    }
    idx += 1;
  };

  for (const node of nested) {
    const stage = node.stage.trim();
    if (!stage) continue;
    for (const cat of node.categories ?? []) {
      const stageCategory = (
        cat.stageCategory ??
        (cat as { categoryName?: string }).categoryName ??
        ""
      ).trim();
      for (const sub of cat.subStages ?? []) {
        register(stage, stageCategory, String(sub).trim());
      }
    }
  }

  const lookup = (row: CompleteTaskMapping): number => {
    const stage = row.stage.trim();
    const stageCategory = row.stageCategory.trim();
    const sub = row.subStageName.trim();
    const candidates = [
      pipelineMappingSortKey(stage, stageCategory, sub),
      pipelineMappingSortKey(
        stage,
        stageCategory,
        stripSubStageParenthetical(sub),
      ),
    ];
    for (const key of candidates) {
      const found = orderIndex.get(key);
      if (found !== undefined) return found;
    }
    return Number.MAX_SAFE_INTEGER;
  };

  return [...mappings].sort((a, b) => lookup(a) - lookup(b));
}

function dedupeMappings(rows: CompleteTaskMapping[]): CompleteTaskMapping[] {
  const seen = new Set<string>();
  const out: CompleteTaskMapping[] = [];
  for (const row of rows) {
    const stage = row.stage.trim();
    const stageCategory = row.stageCategory.trim();
    const subStageName = row.subStageName.trim();
    if (!stage || !subStageName) continue;
    const key = `${normalizeStageKey(stage)}||${normalizeStageKey(stageCategory)}||${normalizeStageKey(subStageName)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ stage, stageCategory, subStageName });
  }
  return out;
}

export function entriesToMappings(entries: CrmPipelineEntry[]): CompleteTaskMapping[] {
  return dedupeMappings(
    entries.map((e) => ({
      stage: String(e.stage ?? "").trim(),
      stageCategory: String(e.stageCategory ?? "").trim(),
      subStageName: String(e.subStageName ?? "").trim(),
    })),
  );
}

/** All substages under Fresh Data, Data Discovery, and Data Conversion (full presales catalog). */
export function flattenPresalesNestedCatalog(
  nested: CrmNestedStage[],
): CompleteTaskMapping[] {
  const out: CompleteTaskMapping[] = [];
  for (const node of nested) {
    const stage = node.stage.trim();
    if (!stage || !isPresalesTopLevelStage(stage)) continue;
    for (const cat of node.categories ?? []) {
      const stageCategory = cat.stageCategory.trim();
      for (const sub of cat.subStages ?? []) {
        const subStageName = String(sub).trim();
        if (!subStageName) continue;
        out.push({ stage, stageCategory, subStageName });
      }
    }
  }
  return filterToPresalesStages(out);
}

export function presalesCatalogFromPipelineResponse(args: {
  entries?: CrmPipelineEntry[];
  nested?: CrmNestedStage[];
}): CompleteTaskMapping[] {
  const nested = args.nested ?? [];
  const fromNested = flattenPresalesNestedCatalog(nested);
  if (fromNested.length > 0) {
    return sortMappingsByNestedPipelineOrder(nested, fromNested);
  }
  const fromEntries = filterToPresalesStages(entriesToMappings(args.entries ?? []));
  return sortMappingsByNestedPipelineOrder(nested, fromEntries);
}

function allowedCompleteTaskStageKeys(
  currentStage: string,
  forwardStagesFor: (stage: string) => string[],
): Set<string> {
  const keys = new Set<string>();
  const cur = normalizeStageKey(currentStage);
  if (cur) keys.add(cur);
  for (const s of forwardStagesFor(currentStage)) {
    const k = normalizeStageKey(s);
    if (k) keys.add(k);
  }
  return keys;
}

/**
 * Complete Task UX: all substages (every path/category) for the current milestone
 * and all substages for the next allowed milestone(s).
 */
export function flattenSubstagesForCurrentAndNextStages(
  nested: CrmNestedStage[],
  currentStage: string,
  forwardStagesFor: (stage: string) => string[],
  skipStage?: (stage: string) => boolean,
): CompleteTaskMapping[] {
  const allowed = allowedCompleteTaskStageKeys(currentStage, forwardStagesFor);
  if (allowed.size === 0) return [];

  const out: CompleteTaskMapping[] = [];
  for (const node of nested) {
    const stage = node.stage.trim();
    if (!stage || skipStage?.(stage)) continue;
    if (!allowed.has(normalizeStageKey(stage))) continue;
    for (const cat of node.categories ?? []) {
      const stageCategory = cat.stageCategory.trim();
      for (const sub of cat.subStages ?? []) {
        const subStageName = String(sub).trim();
        if (!subStageName) continue;
        out.push({ stage, stageCategory, subStageName });
      }
    }
  }
  return dedupeMappings(out);
}

export function filterToCurrentAndNextStageMappings(
  mappings: CompleteTaskMapping[],
  currentStage: string,
  forwardStagesFor: (stage: string) => string[],
): CompleteTaskMapping[] {
  const allowed = allowedCompleteTaskStageKeys(currentStage, forwardStagesFor);
  return dedupeMappings(
    mappings.filter((row) => allowed.has(normalizeStageKey(row.stage))),
  );
}

export function filterPresalesCompleteTaskMappings(
  mappings: CompleteTaskMapping[],
  currentStage: string,
): CompleteTaskMapping[] {
  return filterToPresalesStages(
    filterToCurrentAndNextStageMappings(mappings, currentStage, presalesAllowedForwardStages),
  );
}

export function filterSalesCompleteTaskMappings(
  mappings: CompleteTaskMapping[],
  currentStage: string,
): CompleteTaskMapping[] {
  return filterToCurrentAndNextStageMappings(
    mappings,
    currentStage,
    salesAllowedForwardStages,
  );
}

/** Resolve sales top-level stage when `milestoneStage` is missing but substage exists in pipeline nested tree. */
export function inferSalesStageFromNested(
  nested: CrmNestedStage[],
  milestoneSubStage: string,
): string {
  const subKey = normalizeStageKey(milestoneSubStage);
  if (!subKey) return "";
  for (const node of nested) {
    const stage = node.stage.trim();
    if (!stage || isPresalesTopLevelStage(stage)) continue;
    for (const cat of node.categories ?? []) {
      for (const sub of cat.subStages ?? []) {
        if (normalizeStageKey(String(sub)) === subKey) return stage;
      }
    }
  }
  return "";
}

/** Presales fallback: current + next stage; within current stage only current + next substage in path. */
function buildPresalesForwardCompleteTaskMappingsFromNested(
  nested: CrmNestedStage[],
  currentStage: string,
  currentCategory: string,
  currentSubStage: string,
): CompleteTaskMapping[] {
  const curStageKey = normalizeStageKey(currentStage);
  const curCatKey = normalizeStageKey(currentCategory);
  const curSubKey = normalizeStageKey(currentSubStage);
  const allowedStageKeys = new Set([
    curStageKey,
    ...presalesAllowedForwardStages(currentStage).map((s) => normalizeStageKey(s)),
  ]);

  const out: CompleteTaskMapping[] = [];

  for (const node of nested) {
    const stage = node.stage.trim();
    if (!stage || !isPresalesTopLevelStage(stage)) continue;
    const stageKey = normalizeStageKey(stage);
    if (!allowedStageKeys.has(stageKey)) continue;

    const isCurrent = stageKey === curStageKey;

    for (const cat of node.categories ?? []) {
      const stageCategory = cat.stageCategory.trim();
      const subs = (cat.subStages ?? []).map((s) => s.trim()).filter(Boolean);
      if (!subs.length) continue;

      if (!isCurrent) {
        out.push({ stage, stageCategory, subStageName: subs[0] });
        continue;
      }

      if (curSubKey) {
        const catMatches = !curCatKey || normalizeStageKey(stageCategory) === curCatKey;
        if (!catMatches) continue;
        const idx = subs.findIndex((s) => normalizeStageKey(s) === curSubKey);
        if (idx >= 0) {
          out.push({ stage, stageCategory, subStageName: subs[idx] });
          if (subs[idx + 1]) {
            out.push({ stage, stageCategory, subStageName: subs[idx + 1] });
          }
        }
        continue;
      }

      out.push({ stage, stageCategory, subStageName: subs[0] });
    }
  }

  return dedupeMappings(out);
}

export function buildPresalesCompleteTaskMappingsFromNested(
  nested: CrmNestedStage[],
  currentStage: string,
  currentCategory: string,
  currentSubStage: string,
): CompleteTaskMapping[] {
  return buildPresalesForwardCompleteTaskMappingsFromNested(
    nested,
    currentStage,
    currentCategory,
    currentSubStage,
  );
}

export function buildSalesCompleteTaskMappingsFromNested(
  nested: CrmNestedStage[],
  currentStage: string,
): CompleteTaskMapping[] {
  return flattenSubstagesForCurrentAndNextStages(
    nested,
    currentStage,
    salesAllowedForwardStages,
    (stage) => isPresalesTopLevelStage(stage),
  );
}

/**
 * Sales Complete Task: all substages for current milestone + all substages for next milestone(s).
 * Presales: full catalog (all Fresh Data / Data Discovery / Data Conversion substages), then forward-only fallback.
 */
export function resolveCompleteTaskMappings(args: {
  completeTaskEntries: CrmPipelineEntry[];
  nested?: CrmNestedStage[];
  presalesMode: boolean;
  currentStage: string;
  currentCategory?: string;
  currentSubStage?: string;
  applyPresalesClientFilter?: boolean;
}): CompleteTaskMapping[] {
  void args.applyPresalesClientFilter;

  const nested = args.nested ?? [];

  if (args.presalesMode) {
    const fullCatalog = presalesCatalogFromPipelineResponse({
      entries: args.completeTaskEntries,
      nested,
    });
    if (fullCatalog.length > 0) return fullCatalog;

    if (nested.length > 0 && args.currentStage.trim()) {
      return sortMappingsByNestedPipelineOrder(
        nested,
        buildPresalesCompleteTaskMappingsFromNested(
          nested,
          args.currentStage,
          args.currentCategory ?? "",
          args.currentSubStage ?? "",
        ),
      );
    }
    return [];
  }

  const salesStage = resolveSalesCompleteTaskStage({
    milestoneStage: args.currentStage,
    milestoneCategory: args.currentCategory,
    milestoneSubStage: args.currentSubStage,
    nested,
  });

  if (!salesStage.trim()) return [];

  // Hub `forCompleteTask` may return two hops (e.g. Discovery + Connection on Fresh Lead).
  // Client enforces exactly current milestone + one next milestone only.
  if (args.completeTaskEntries.length > 0) {
    const fromEntries = filterSalesCompleteTaskMappings(
      entriesToMappings(args.completeTaskEntries),
      salesStage,
    );
    if (fromEntries.length > 0) {
      return sortMappingsByNestedPipelineOrder(nested, fromEntries);
    }
  }

  if (nested.length > 0) {
    const fromNested = flattenSubstagesForCurrentAndNextStages(
      nested,
      salesStage,
      salesAllowedForwardStages,
      (stage) => isPresalesTopLevelStage(stage),
    );
    if (fromNested.length > 0) {
      return sortMappingsByNestedPipelineOrder(nested, fromNested);
    }
  }

  return [];
}
