import { NextResponse } from "next/server";
import { BASE_URL } from "@/lib/base-url";

function crmPipelineUrl(role?: string): string {
  const q = new URLSearchParams({ nested: "true" });
  const r = role?.trim();
  if (r) q.set("role", r);
  return `${BASE_URL}/Leads/crm-pipeline?${q.toString()}`;
}

/** Optional legacy milestone microservice (often not running locally → avoid 500). */
const COUNT_URL =
  process.env.MILESTONE_COUNT_URL ?? "http://localhost:9090/Milestone/count";
const SUB_STATUS_URL =
  process.env.MILESTONE_SUB_STATUS_URL ?? "http://localhost:9090/Milestone/sub-status";

type MilestoneCountMap = Record<string, number>;
type SubStatusMapping = {
  stage: string;
  stageCategory: string;
  subStageName: string;
};

function normalizeCounts(data: unknown): MilestoneCountMap {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  return Object.entries(data).reduce<MilestoneCountMap>((result, [key, value]) => {
    if (typeof value === "number") {
      result[key] = value;
    }

    return result;
  }, {});
}

function normalizeSubStatuses(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data.reduce<string[]>((result, item) => {
      if (typeof item === "string" && item.trim().length > 0) {
        result.push(item.trim());
        return result;
      }

      if (!item || typeof item !== "object") {
        return result;
      }

      const candidate =
        ("subStatus" in item && typeof item.subStatus === "string" && item.subStatus) ||
        ("status" in item && typeof item.status === "string" && item.status) ||
        ("label" in item && typeof item.label === "string" && item.label) ||
        ("name" in item && typeof item.name === "string" && item.name) ||
        "";

      if (candidate.trim().length > 0) {
        result.push(candidate.trim());
      }

      return result;
    }, []);
  }

  if (data && typeof data === "object") {
    return Object.values(data).reduce<string[]>((result, value) => {
      if (typeof value === "string" && value.trim().length > 0) {
        result.push(value.trim());
      }

      return result;
    }, []);
  }

  return [];
}

function normalizeSubStatusMappings(data: unknown): SubStatusMapping[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const seen = new Set<string>();
  const result: SubStatusMapping[] = [];

  for (const item of data) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const stage =
      ("stage" in item && typeof item.stage === "string" && item.stage.trim()) ||
      ("stageName" in item && typeof item.stageName === "string" && item.stageName.trim()) ||
      ("stage_name" in item && typeof item.stage_name === "string" && item.stage_name.trim()) ||
      "";
    const stageCategory =
      ("stageCategory" in item &&
        typeof item.stageCategory === "string" &&
        item.stageCategory.trim()) ||
      ("stagecategory" in item &&
        typeof item.stagecategory === "string" &&
        item.stagecategory.trim()) ||
      ("stage_category" in item &&
        typeof item.stage_category === "string" &&
        item.stage_category.trim()) ||
      ("category" in item && typeof item.category === "string" && item.category.trim()) ||
      "";
    const subStageName =
      ("subStageName" in item &&
        typeof item.subStageName === "string" &&
        item.subStageName.trim()) ||
      ("substageName" in item &&
        typeof item.substageName === "string" &&
        item.substageName.trim()) ||
      ("sub_stage_name" in item &&
        typeof item.sub_stage_name === "string" &&
        item.sub_stage_name.trim()) ||
      ("subStatus" in item && typeof item.subStatus === "string" && item.subStatus.trim()) ||
      ("sub_status" in item && typeof item.sub_status === "string" && item.sub_status.trim()) ||
      "";

    if (!subStageName) {
      continue;
    }

    const key = `${stage}|${stageCategory}|${subStageName}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({
      stage,
      stageCategory,
      subStageName,
    });
  }

  return result;
}

function normalizeMappingsFromPipeline(data: unknown): SubStatusMapping[] {
  if (!data || typeof data !== "object" || !("entries" in data) || !Array.isArray(data.entries)) {
    return [];
  }

  const seen = new Set<string>();
  const result: SubStatusMapping[] = [];

  for (const item of data.entries) {
    if (!item || typeof item !== "object") continue;
    const stage =
      ("stage" in item && typeof item.stage === "string" && item.stage.trim()) || "";
    const stageCategory =
      ("stageCategory" in item &&
        typeof item.stageCategory === "string" &&
        item.stageCategory.trim()) ||
      "";
    const subStageName =
      ("subStageName" in item &&
        typeof item.subStageName === "string" &&
        item.subStageName.trim()) ||
      "";

    if (!subStageName) continue;

    const key = `${stage}|${stageCategory}|${subStageName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ stage, stageCategory, subStageName });
  }

  return result;
}

function flattenNestedMappings(data: unknown): SubStatusMapping[] {
  if (!data || typeof data !== "object" || !("nested" in data)) {
    return [];
  }
  const nested = (data as { nested?: unknown }).nested;
  if (!Array.isArray(nested)) return [];

  const seen = new Set<string>();
  const result: SubStatusMapping[] = [];

  for (const node of nested) {
    if (!node || typeof node !== "object") continue;
    const stage =
      ("stage" in node && typeof node.stage === "string" && node.stage.trim()) || "";
    const categories =
      "categories" in node && Array.isArray(node.categories) ? node.categories : [];
    for (const cat of categories) {
      if (!cat || typeof cat !== "object") continue;
      const stageCategory =
        ("stageCategory" in cat &&
          typeof cat.stageCategory === "string" &&
          cat.stageCategory.trim()) ||
        ("categoryName" in cat &&
          typeof cat.categoryName === "string" &&
          cat.categoryName.trim()) ||
        "";
      const subStages =
        "subStages" in cat && Array.isArray(cat.subStages)
          ? cat.subStages
          : "substages" in cat && Array.isArray(cat.substages)
            ? cat.substages
            : [];
      for (const sub of subStages) {
        const subStageName = typeof sub === "string" ? sub.trim() : "";
        if (!subStageName) continue;
        const key = `${stage}|${stageCategory}|${subStageName}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ stage, stageCategory, subStageName });
      }
    }
  }

  return result;
}

function pipelineToMappings(data: unknown): SubStatusMapping[] {
  const fromEntries = normalizeMappingsFromPipeline(data);
  if (fromEntries.length > 0) return fromEntries;
  return flattenNestedMappings(data);
}

function mergeSubStatusMappings(
  primary: SubStatusMapping[],
  extra: SubStatusMapping[],
): SubStatusMapping[] {
  const seen = new Set<string>();
  const result: SubStatusMapping[] = [];
  for (const m of [...primary, ...extra]) {
    const key = `${m.stage}|${m.stageCategory}|${m.subStageName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(m);
  }
  return result;
}

async function fetchPipelineMappings(role?: string): Promise<SubStatusMapping[]> {
  const pipelineResponse = await fetch(crmPipelineUrl(role), {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!pipelineResponse.ok) return [];
  const pipelineRaw: unknown = await pipelineResponse.json();
  return pipelineToMappings(pipelineRaw);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");
  const pipelineRole = (searchParams.get("role") ?? "").trim();
  const isSubStatusRequest = resource === "sub-status";
  const backendUrl = isSubStatusRequest ? SUB_STATUS_URL : COUNT_URL;

  try {
    const response = await fetch(backendUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`upstream ${response.status}`);
    }

    const rawText = await response.text();
    let rawData: unknown;
    try {
      rawData = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new Error("invalid json");
    }

    if (isSubStatusRequest) {
      let mappings = normalizeSubStatusMappings(rawData);

      if (pipelineRole) {
        try {
          const pipelineMappings = await fetchPipelineMappings(pipelineRole);
          if (pipelineMappings.length > 0) {
            mappings = mergeSubStatusMappings(mappings, pipelineMappings);
          }
        } catch {
          // ignore
        }
      } else if (mappings.length === 0) {
        try {
          mappings = await fetchPipelineMappings();
        } catch {
          // ignore
        }
      }

      const subStatuses = [
        ...new Set([
          ...normalizeSubStatuses(rawData),
          ...mappings.map((m) => m.subStageName).filter(Boolean),
        ]),
      ];
      return NextResponse.json({ subStatuses, mappings });
    }

    const counts = normalizeCounts(rawData);
    return NextResponse.json({ counts });
  } catch {
    /** Legacy :9090 down or not JSON — degrade gracefully so the Leads page still loads. */
    if (isSubStatusRequest) {
      try {
        const mappings = await fetchPipelineMappings(pipelineRole || undefined);
        const subStatuses = mappings.map((m) => m.subStageName);
        return NextResponse.json({ subStatuses, mappings });
      } catch {
        return NextResponse.json({ subStatuses: [], mappings: [] });
      }
    }
    return NextResponse.json({ counts: {} });
  }
}
