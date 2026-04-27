import type {
  CrmNestedStage,
  CrmPipelineEntry,
  CrmPipelineResponse,
  MilestonePathItem,
} from "@/types/crm-pipeline";
import { BASE_URL } from "@/lib/base-url";

type FetchCrmPipelineOptions = {
  nested?: boolean;
  forCompleteTask?: boolean;
  currentStage?: string;
};

export async function fetchCrmPipeline(
  options: boolean | FetchCrmPipelineOptions = true
): Promise<CrmPipelineResponse> {
  const opts: FetchCrmPipelineOptions =
    typeof options === "boolean" ? { nested: options } : options;
  const q = new URLSearchParams();
  if (opts.nested !== false) q.set("nested", "true");
  if (opts.forCompleteTask) q.set("forCompleteTask", "true");
  if (opts.currentStage?.trim()) q.set("currentStage", opts.currentStage.trim());
  const qs = q.toString();
  const suffix = qs ? `?${qs}` : "";
  const urls = [
    `${BASE_URL}/v1/Leads/crm-pipeline${suffix}`,
    `${BASE_URL}/Leads/crm-pipeline${suffix}`,
  ];
  let lastStatus = 0;
  for (const url of urls) {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) return res.json();
    lastStatus = res.status;
  }
  throw new Error(`CRM pipeline failed: HTTP ${lastStatus || 502}`);
}

export function normalizeStage(s: string) {
  return s.trim().toLowerCase();
}

export function isWonCategory(stageCategory: string) {
  return /\bwon\b/i.test(stageCategory);
}

export function isLostCategory(stageCategory: string) {
  return /\blost\b/i.test(stageCategory);
}

function countMatching(
  entries: CrmPipelineEntry[],
  stage: string,
  stageCategory: string,
  subStageName: string
) {
  const ns = normalizeStage(stage);
  const nc = stageCategory.trim();
  const nsub = subStageName.trim();
  return entries.filter(
    (e) =>
      normalizeStage(e.stage) === ns &&
      e.stageCategory.trim() === nc &&
      e.subStageName.trim() === nsub
  ).length;
}

function stageTotal(entries: CrmPipelineEntry[], stage: string) {
  const ns = normalizeStage(stage);
  return entries.filter((e) => normalizeStage(e.stage) === ns).length;
}

export type MilestoneStage = {
  stage: string;
  /** Uppercase label for the chevron */
  label: string;
  count: number;
};

const STAGE_SUBTITLE: Record<string, string> = {
  discovery: "Initial Engagement Phase",
  qualification: "Qualify fit & intent",
  decision: "Evaluation & alignment",
  booking: "Commitment & scheduling",
  closure: "Final outcome",
};

function subtitleForStage(stage: string) {
  return STAGE_SUBTITLE[normalizeStage(stage)] ?? "Pipeline stage";
}

const ACCENTS: NonNullable<MilestonePathItem["leftAccent"]>[] = [
  "neutral",
  "warning",
  "neutral",
  "success",
];

function cardsFromNestedCategories(
  entries: CrmPipelineEntry[],
  stage: string,
  nestedStage: CrmNestedStage | undefined,
  pickCategory: (cat: string) => boolean
): MilestonePathItem[] {
  if (!nestedStage) return [];

  const cards: MilestonePathItem[] = [];
  let accentIdx = 0;

  for (const cat of nestedStage.categories) {
    if (!pickCategory(cat.stageCategory)) continue;
    for (const sub of cat.subStages) {
      const value = countMatching(entries, stage, cat.stageCategory, sub);
      const leftAccent = ACCENTS[accentIdx % ACCENTS.length];
      accentIdx += 1;
      const tone =
        pickCategory(cat.stageCategory) && /\bqualified\b/i.test(sub) ? "success" : undefined;
      cards.push({
        title: sub.toUpperCase(),
        subtitle: value > 0 ? undefined : "—",
        value,
        leftAccent,
        tone,
      });
    }
  }

  return cards;
}

/** When nested tree is missing for a stage, build cards from flat entries only. */
function fallbackCardsFromEntries(
  entries: CrmPipelineEntry[],
  stage: string,
  pickCategory: (cat: string) => boolean
): MilestonePathItem[] {
  const ns = normalizeStage(stage);
  const map = new Map<string, number>();
  for (const e of entries) {
    if (normalizeStage(e.stage) !== ns) continue;
    if (!pickCategory(e.stageCategory)) continue;
    const k = e.subStageName.trim();
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  let i = 0;
  return [...map.entries()].map(([name, value]) => ({
    title: name.toUpperCase(),
    value,
    leftAccent: ACCENTS[i++ % ACCENTS.length] as MilestonePathItem["leftAccent"],
  }));
}

export function buildMilestoneStages(
  entries: CrmPipelineEntry[],
  nested: CrmNestedStage[] | undefined
): MilestoneStage[] {
  const order =
    nested?.map((n) => n.stage) ??
    [...new Set(entries.map((e) => e.stage))].sort((a, b) => a.localeCompare(b));

  return order.map((stage) => ({
    stage,
    label: stage.toUpperCase(),
    count: stageTotal(entries, stage),
  }));
}

export function getNestedForStage(
  nested: CrmNestedStage[] | undefined,
  stage: string
): CrmNestedStage | undefined {
  const ns = normalizeStage(stage);
  return nested?.find((n) => normalizeStage(n.stage) === ns);
}

export function buildPathsForStage(
  entries: CrmPipelineEntry[],
  nested: CrmNestedStage[] | undefined,
  selectedStage: string
) {
  const nestedStage = getNestedForStage(nested, selectedStage);
  let won = cardsFromNestedCategories(entries, selectedStage, nestedStage, isWonCategory);
  let lost = cardsFromNestedCategories(entries, selectedStage, nestedStage, isLostCategory);

  if (won.length === 0) {
    won = fallbackCardsFromEntries(entries, selectedStage, isWonCategory);
  }
  if (lost.length === 0) {
    lost = fallbackCardsFromEntries(entries, selectedStage, isLostCategory);
  }

  const wonTotal = won.reduce((s, c) => s + (typeof c.value === "number" ? c.value : 0), 0);
  const lostTotal = lost.reduce((s, c) => s + (typeof c.value === "number" ? c.value : 0), 0);

  return {
    stageTitle: selectedStage,
    stageSubtitle: subtitleForStage(selectedStage),
    totalActiveLeads: stageTotal(entries, selectedStage),
    wonTotal: wonTotal || 0,
    lostTotal: lostTotal || 0,
    wonItems: won,
    lostItems: lost,
  };
}
