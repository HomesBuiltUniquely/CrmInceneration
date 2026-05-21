import type { CrmNestedStage, CrmPipelineEntry } from "@/types/crm-pipeline";
import { normalizeStageKey } from "@/lib/milestone-progress";
import { presalesAllowedForwardStages } from "@/lib/presales-milestone";

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
  const fromNested = flattenPresalesNestedCatalog(args.nested ?? []);
  if (fromNested.length > 0) return fromNested;
  return filterToPresalesStages(entriesToMappings(args.entries ?? []));
}

/**
 * Presales: limit to current top-level stage + allowed forward stages, and within the
 * current stage only the active substage and the next substage in the same category.
 */
export function filterPresalesCompleteTaskMappings(
  mappings: CompleteTaskMapping[],
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
  for (const row of mappings) {
    const stageKey = normalizeStageKey(row.stage);
    if (!allowedStageKeys.has(stageKey)) continue;

    if (stageKey !== curStageKey) {
      out.push(row);
      continue;
    }

    if (!curSubKey) {
      const catKey = normalizeStageKey(row.stageCategory);
      const already = out.some(
        (r) =>
          normalizeStageKey(r.stage) === stageKey &&
          normalizeStageKey(r.stageCategory) === catKey,
      );
      if (!already) out.push(row);
      continue;
    }

    if (curCatKey && normalizeStageKey(row.stageCategory) !== curCatKey) {
      continue;
    }

    out.push(row);
  }

  if (!curSubKey || out.length === 0) {
    return dedupeMappings(out);
  }

  const byCategory = new Map<string, CompleteTaskMapping[]>();
  for (const row of out) {
    if (normalizeStageKey(row.stage) !== curStageKey) continue;
    const cat = normalizeStageKey(row.stageCategory);
    const list = byCategory.get(cat) ?? [];
    list.push(row);
    byCategory.set(cat, list);
  }

  const trimmed: CompleteTaskMapping[] = [];
  for (const row of out) {
    if (normalizeStageKey(row.stage) !== curStageKey) {
      trimmed.push(row);
      continue;
    }
    const cat = normalizeStageKey(row.stageCategory);
    const subs = byCategory.get(cat) ?? [];
    const idx = subs.findIndex(
      (s) => normalizeStageKey(s.subStageName) === curSubKey,
    );
    if (idx < 0) {
      trimmed.push(row);
      continue;
    }
    const subKey = normalizeStageKey(row.subStageName);
    const keep =
      subKey === curSubKey ||
      (idx + 1 < subs.length &&
        normalizeStageKey(subs[idx + 1].subStageName) === subKey);
    if (keep) trimmed.push(row);
  }

  return dedupeMappings(trimmed.length > 0 ? trimmed : out);
}

/** Build forward-only options when Hub `forCompleteTask` returns no presales rows. */
export function buildPresalesCompleteTaskMappingsFromNested(
  nested: CrmNestedStage[],
  currentStage: string,
  currentCategory: string,
  currentSubStage: string,
): CompleteTaskMapping[] {
  const curStageKey = normalizeStageKey(currentStage);
  const curCatKey = normalizeStageKey(currentCategory);
  const curSubKey = normalizeStageKey(currentSubStage);
  const forwardNames = presalesAllowedForwardStages(currentStage);
  const allowedStageKeys = new Set([
    curStageKey,
    ...forwardNames.map((s) => normalizeStageKey(s)),
  ]);

  const out: CompleteTaskMapping[] = [];

  for (const node of nested) {
    const stage = node.stage.trim();
    if (!stage) continue;
    const stageKey = normalizeStageKey(stage);
    if (!allowedStageKeys.has(stageKey)) continue;

    const isCurrent = stageKey === curStageKey;
    const isForward = !isCurrent;

    for (const cat of node.categories ?? []) {
      const stageCategory = cat.stageCategory.trim();
      const subs = (cat.subStages ?? []).map((s) => s.trim()).filter(Boolean);
      if (!subs.length) continue;

      if (isForward) {
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

/**
 * Sales-aligned: `forCompleteTask=true` rows are authoritative (current + next substages).
 * Do not union full-pipeline rows for the current stage — that exposes every substage name.
 */
export function resolveCompleteTaskMappings(args: {
  completeTaskEntries: CrmPipelineEntry[];
  nested?: CrmNestedStage[];
  presalesMode: boolean;
  currentStage: string;
  currentCategory?: string;
  currentSubStage?: string;
  /**
   * When false, presales `forCompleteTask` rows from Hub are used as-is (backend filters current + next).
   * When true, apply client-side forward filter (fallback full `nested=true` catalog only).
   */
  applyPresalesClientFilter?: boolean;
}): CompleteTaskMapping[] {
  let mappings = entriesToMappings(args.completeTaskEntries);

  const shouldClientFilter =
    args.presalesMode && mappings.length > 0 && args.applyPresalesClientFilter !== false;

  if (shouldClientFilter) {
    mappings = filterPresalesCompleteTaskMappings(
      mappings,
      args.currentStage,
      args.currentCategory ?? "",
      args.currentSubStage ?? "",
    );
  }

  if (mappings.length > 0) return filterToPresalesStages(mappings);

  if (args.presalesMode && (args.nested?.length ?? 0) > 0) {
    const catalog = flattenPresalesNestedCatalog(args.nested ?? []);
    if (catalog.length > 0) return catalog;
    return buildPresalesCompleteTaskMappingsFromNested(
      args.nested ?? [],
      args.currentStage,
      args.currentCategory ?? "",
      args.currentSubStage ?? "",
    );
  }

  return [];
}
