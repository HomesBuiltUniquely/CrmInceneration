"use client";

import { useCallback, useEffect, useState } from "react";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import type { DashboardFilterState } from "./LeadFilters";
import {
  buildMilestoneStages,
  fetchCrmPipeline,
  type MilestoneStage,
} from "@/lib/crm-pipeline";
import type { CrmMilestoneCountsApiResponse } from "@/lib/crm-milestone-counts";
import type { MilestonePathItem } from "@/types/crm-pipeline";
import type { CrmPipelineResponse } from "@/types/crm-pipeline";
import Milestones from "./Milestones";
import MilestonePaths from "./MilestonePaths";

type SubStatusMappingsResp = {
  mappings?: Array<{ stage: string; stageCategory: string; subStageName: string }>;
};

function norm(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

function isWonCategory(s: string) {
  return /\bwon\b/i.test(s);
}

function isLostCategory(s: string) {
  return /\blost\b/i.test(s);
}

function subtitleForStage(stage: string) {
  const key = norm(stage);
  if (key === "discovery") return "Initial Engagement Phase";
  if (key === "connection") return "Connect and qualify";
  if (key === "experience & design") return "Design exploration phase";
  if (key === "decision") return "Evaluation and close plan";
  if (key === "closed") return "Finalized outcomes";
  return "Pipeline stage";
}

function leftAccent(i: number): MilestonePathItem["leftAccent"] {
  const order: MilestonePathItem["leftAccent"][] = ["neutral", "warning", "success", "danger"];
  return order[i % order.length]!;
}

type Props = {
  filters?: DashboardFilterState;
};

export default function CrmPipeline({ filters }: Props) {
  const [data, setData] = useState<CrmPipelineResponse | null>(null);
  const [baseCounts, setBaseCounts] = useState<Record<string, number>>({});
  const [subMappings, setSubMappings] = useState<SubStatusMappingsResp["mappings"]>([]);
  const [pathData, setPathData] = useState<{
    stageTitle: string;
    stageSubtitle: string;
    totalActiveLeads: number;
    wonTotal: number;
    lostTotal: number;
    wonItems: MilestonePathItem[];
    lostItems: MilestonePathItem[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const sharedFilters = filters ?? {
    assignee: "",
    milestoneStage: "",
    milestoneStageCategory: "",
    milestoneSubStage: "",
    dateFrom: "",
    dateTo: "",
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const baseQ = new URLSearchParams();
        baseQ.set("leadType", "all");
        if (sharedFilters.assignee) baseQ.set("assignee", sharedFilters.assignee);
        if (sharedFilters.dateFrom) baseQ.set("dateFrom", sharedFilters.dateFrom);
        if (sharedFilters.dateTo) baseQ.set("dateTo", sharedFilters.dateTo);
        if (sharedFilters.milestoneStageCategory) baseQ.set("milestoneStageCategory", sharedFilters.milestoneStageCategory);
        if (sharedFilters.milestoneSubStage) baseQ.set("milestoneSubStage", sharedFilters.milestoneSubStage);

        const [pipeline, countsRes, subMapRes] = await Promise.all([
          fetchCrmPipeline(true),
          fetch(`/api/crm/crm-milestone-counts-filtered?${baseQ.toString()}`, {
            cache: "no-store",
            credentials: "include",
            headers: getCrmAuthHeaders(),
          }),
          fetch("/api/milestone-count?resource=sub-status", {
            cache: "no-store",
            credentials: "include",
            headers: getCrmAuthHeaders(),
          }),
        ]);
        if (cancelled) return;
        setData(pipeline);

        if (countsRes.ok) {
          const countsJson = (await countsRes.json()) as CrmMilestoneCountsApiResponse;
          const m: Record<string, number> = {};
          for (const row of countsJson.countsByMilestoneStage ?? []) {
            m[row.key] = row.count;
          }
          setBaseCounts(m);
        } else {
          setBaseCounts({});
        }

        if (subMapRes.ok) {
          const mapJson = (await subMapRes.json()) as SubStatusMappingsResp;
          setSubMappings(mapJson.mappings ?? []);
        } else {
          setSubMappings([]);
        }

        const stages = buildMilestoneStages(pipeline.entries, pipeline.nested);
        const first = stages[0]?.stage ?? null;
        setSelectedStage((prev) => {
          if (prev && stages.some((s) => s.stage === prev)) return prev;
          return first;
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load pipeline");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    sharedFilters.assignee,
    sharedFilters.dateFrom,
    sharedFilters.dateTo,
    sharedFilters.milestoneStageCategory,
    sharedFilters.milestoneSubStage,
  ]);

  const stages: MilestoneStage[] = (data ? buildMilestoneStages(data.entries, data.nested) : []).map((s) => ({
    ...s,
    count: baseCounts[s.stage] ?? baseCounts[s.label] ?? s.count,
  }));

  const onSelectStage = useCallback((stage: string) => {
    setSelectedStage(stage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!selectedStage) {
      setPathData(null);
      return;
    }
    void (async () => {
      try {
        const q = new URLSearchParams();
        q.set("milestoneStage", selectedStage);
        q.set("leadType", "all");
        if (sharedFilters.assignee) q.set("assignee", sharedFilters.assignee);
        if (sharedFilters.dateFrom) q.set("dateFrom", sharedFilters.dateFrom);
        if (sharedFilters.dateTo) q.set("dateTo", sharedFilters.dateTo);
        if (sharedFilters.milestoneStageCategory) q.set("milestoneStageCategory", sharedFilters.milestoneStageCategory);
        if (sharedFilters.milestoneSubStage) q.set("milestoneSubStage", sharedFilters.milestoneSubStage);
        const res = await fetch(`/api/crm/crm-milestone-counts-filtered?${q.toString()}`, {
          cache: "no-store",
          credentials: "include",
          headers: getCrmAuthHeaders(),
        });
        if (!res.ok) throw new Error(`Stage counts HTTP ${res.status}`);
        const json = (await res.json()) as CrmMilestoneCountsApiResponse;

        const stageCount =
          json.countsByMilestoneStage?.find((r) => norm(r.key) === norm(selectedStage))?.count ?? 0;
        const bySub = new Map<string, number>();
        for (const row of json.countsByMilestoneSubStage ?? []) {
          bySub.set(norm(row.key), row.count);
        }

        const wonItems: MilestonePathItem[] = [];
        const lostItems: MilestonePathItem[] = [];
        let wi = 0;
        let li = 0;
        for (const m of subMappings ?? []) {
          if (norm(m.stage) !== norm(selectedStage)) continue;
          const count = bySub.get(norm(m.subStageName)) ?? 0;
          const item: MilestonePathItem = {
            title: m.subStageName.toUpperCase(),
            value: count,
            leftAccent: isWonCategory(m.stageCategory) ? leftAccent(wi++) : leftAccent(li++),
          };
          if (isWonCategory(m.stageCategory)) wonItems.push(item);
          if (isLostCategory(m.stageCategory)) lostItems.push(item);
        }

        const wonTotal = wonItems.reduce((s, i) => s + (typeof i.value === "number" ? i.value : 0), 0);
        const lostTotal = lostItems.reduce((s, i) => s + (typeof i.value === "number" ? i.value : 0), 0);

        if (!cancelled) {
          setPathData({
            stageTitle: selectedStage,
            stageSubtitle: subtitleForStage(selectedStage),
            totalActiveLeads: stageCount,
            wonTotal,
            lostTotal,
            wonItems,
            lostItems,
          });
        }
      } catch {
        if (!cancelled) {
          setPathData({
            stageTitle: selectedStage,
            stageSubtitle: subtitleForStage(selectedStage),
            totalActiveLeads: 0,
            wonTotal: 0,
            lostTotal: 0,
            wonItems: [],
            lostItems: [],
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    selectedStage,
    sharedFilters.assignee,
    sharedFilters.dateFrom,
    sharedFilters.dateTo,
    sharedFilters.milestoneStageCategory,
    sharedFilters.milestoneSubStage,
    subMappings,
  ]);

  if (error) {
    return (
      <div className="xl:ml-6 xl:mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="xl:ml-6 xl:mt-4 text-sm text-slate-500" aria-live="polite">
        Loading pipeline…
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="xl:ml-6 xl:mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        No pipeline stages returned. Check <code className="rounded bg-white px-1">/Leads/crm-pipeline?nested=true</code>.
      </div>
    );
  }

  if (!selectedStage || !pathData) {
    return (
      <div className="xl:ml-6 xl:mt-4 text-sm text-slate-500" aria-live="polite">
        Loading pipeline…
      </div>
    );
  }

  return (
    <>
      <Milestones
        stages={stages}
        selectedStage={selectedStage}
        onSelectStage={onSelectStage}
      />
      <MilestonePaths
        stageTitle={pathData.stageTitle}
        stageSubtitle={pathData.stageSubtitle}
        totalActiveLeads={pathData.totalActiveLeads}
        wonTotal={pathData.wonTotal}
        lostTotal={pathData.lostTotal}
        wonItems={pathData.wonItems}
        lostItems={pathData.lostItems}
      />
    </>
  );
}
