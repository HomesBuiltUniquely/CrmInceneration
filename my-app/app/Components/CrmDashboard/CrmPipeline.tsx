"use client";

import { useCallback, useEffect, useState } from "react";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import type { DashboardFilterState } from "./LeadFilters";
import {
  buildMilestoneStages,
  fetchCrmPipeline,
  type MilestoneStage,
} from "@/lib/crm-pipeline";
import type { ApiLead, SpringPage } from "@/lib/leads-filter";
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

function stageFromLead(lead: ApiLead): string {
  return String(lead.stage?.milestoneStage ?? "").trim();
}

function subStageFromLead(lead: ApiLead): string {
  return String(lead.stage?.milestoneSubStage ?? "").trim();
}

function buildLeadsQuery(filters: DashboardFilterState, assignee?: string) {
  const q = new URLSearchParams();
  q.set("mergeAll", "1");
  q.set("page", "0");
  q.set("size", "500");
  q.set("sort", "updatedAt,desc");
  q.set("leadType", "all");
  const effectiveAssignee = (assignee ?? filters.assignee).trim();
  if (effectiveAssignee) q.set("assignee", effectiveAssignee);
  if (filters.dateFrom) q.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) q.set("dateTo", filters.dateTo);
  if (filters.milestoneStage) q.set("milestoneStage", filters.milestoneStage);
  if (filters.milestoneStageCategory) q.set("milestoneStageCategory", filters.milestoneStageCategory);
  if (filters.milestoneSubStage) q.set("milestoneSubStage", filters.milestoneSubStage);
  return q;
}

async function fetchDashboardLeads(filters: DashboardFilterState): Promise<ApiLead[]> {
  const assignees = [...new Set((filters.assignees ?? []).map((x) => x.trim()).filter(Boolean))];
  const leadsById = new Map<string, ApiLead>();
  const requests =
    assignees.length > 0 ? assignees.map((assignee) => buildLeadsQuery(filters, assignee)) : [buildLeadsQuery(filters)];
  for (const query of requests) {
    const res = await fetch(`/api/crm/leads?${query.toString()}`, {
      cache: "no-store",
      credentials: "include",
      headers: getCrmAuthHeaders(),
    });
    if (!res.ok) continue;
    const json = (await res.json()) as SpringPage<ApiLead>;
    for (const lead of json.content ?? []) {
      const id = String(lead.id ?? "").trim();
      if (!id || leadsById.has(id)) continue;
      leadsById.set(id, lead);
    }
  }
  return [...leadsById.values()];
}

type Props = {
  filters?: DashboardFilterState;
};

export default function CrmPipeline({ filters }: Props) {
  const [data, setData] = useState<CrmPipelineResponse | null>(null);
  const [filteredLeads, setFilteredLeads] = useState<ApiLead[]>([]);
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
    assignees: [],
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
        const [pipeline, leads, subMapRes] = await Promise.all([
          fetchCrmPipeline(true),
          fetchDashboardLeads(sharedFilters),
          fetch("/api/milestone-count?resource=sub-status", {
            cache: "no-store",
            credentials: "include",
            headers: getCrmAuthHeaders(),
          }),
        ]);
        if (cancelled) return;
        setData(pipeline);
        setFilteredLeads(leads);

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
    (sharedFilters.assignees ?? []).join("|"),
    sharedFilters.dateFrom,
    sharedFilters.dateTo,
    sharedFilters.milestoneStage,
    sharedFilters.milestoneStageCategory,
    sharedFilters.milestoneSubStage,
  ]);

  const stageCounts = filteredLeads.reduce<Record<string, number>>((acc, lead) => {
    const stage = stageFromLead(lead);
    if (!stage) return acc;
    acc[stage] = (acc[stage] ?? 0) + 1;
    return acc;
  }, {});

  const stages: MilestoneStage[] = (data ? buildMilestoneStages(data.entries, data.nested) : []).map((s) => ({
    ...s,
    count: stageCounts[s.stage] ?? stageCounts[s.label] ?? 0,
  }));

  const onSelectStage = useCallback((stage: string) => {
    setSelectedStage(stage);
  }, []);

  useEffect(() => {
    if (!selectedStage) {
      setPathData(null);
      return;
    }
    const scopedLeads = filteredLeads.filter((lead) => norm(stageFromLead(lead)) === norm(selectedStage));
    const bySub = scopedLeads.reduce<Map<string, number>>((acc, lead) => {
      const sub = subStageFromLead(lead);
      if (!sub) return acc;
      const key = norm(sub);
      acc.set(key, (acc.get(key) ?? 0) + 1);
      return acc;
    }, new Map());
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
    setPathData({
      stageTitle: selectedStage,
      stageSubtitle: subtitleForStage(selectedStage),
      totalActiveLeads: scopedLeads.length,
      wonTotal,
      lostTotal,
      wonItems,
      lostItems,
    });
  }, [
    selectedStage,
    filteredLeads,
    subMappings,
  ]);

  if (error) {
    return (
      <div className="xl:ml-6 xl:mt-4 rounded-xl border border-[var(--crm-danger)] bg-[var(--crm-danger-bg)] px-4 py-3 text-sm text-[var(--crm-danger-text)]">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="xl:ml-6 xl:mt-4 text-sm text-[var(--crm-text-muted)]" aria-live="polite">
        Loading pipeline…
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="xl:ml-6 xl:mt-4 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-4 py-3 text-sm text-[var(--crm-text-secondary)]">
        No pipeline stages returned. Check <code className="rounded bg-[var(--crm-surface)] px-1">/Leads/crm-pipeline?nested=true</code>.
      </div>
    );
  }

  if (!selectedStage || !pathData) {
    return (
      <div className="xl:ml-6 xl:mt-4 text-sm text-[var(--crm-text-muted)]" aria-live="polite">
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
