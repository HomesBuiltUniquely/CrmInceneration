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
import { crmLeadTopLevelStage } from "@/lib/leads-filter";
import { presalesTopLevelStage } from "@/lib/presales-milestone";
import {
  appendWorkspaceMilestoneFilterQuery,
  pipelineRoleForWorkspace,
  type CrmWorkspace,
} from "@/lib/crm-workspace";
import type { MilestonePathItem } from "@/types/crm-pipeline";
import type { CrmPipelineResponse } from "@/types/crm-pipeline";
import { setEffectiveNewCrmDateRange } from "@/lib/new-crm-cutoff";
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

function subtitleForStage(stage: string, workspace: CrmWorkspace) {
  const key = norm(stage);
  if (workspace === "presales") {
    if (key === "fresh data") return "New presales intake";
    if (key === "data discovery") return "Qualification & outreach";
    if (key === "data conversion") return "Ready for verify / handoff";
    return "Presales pipeline stage";
  }
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

function stageFromLead(lead: ApiLead, workspace: CrmWorkspace): string {
  return workspace === "presales"
    ? presalesTopLevelStage(lead).trim()
    : crmLeadTopLevelStage(lead).trim();
}

function subStageFromLead(lead: ApiLead): string {
  return String(lead.stage?.milestoneSubStage ?? "").trim();
}

function buildLeadsQuery(
  filters: DashboardFilterState,
  workspace: CrmWorkspace,
  assignee?: string,
) {
  const q = new URLSearchParams();
  q.set("mergeAll", "1");
  q.set("milestoneScope", "crm");
  q.set("page", "0");
  q.set("size", "500");
  q.set("sort", "updatedAt,desc");
  q.set("leadType", "all");
  const effectiveAssignee = (assignee ?? filters.assignee).trim();
  if (effectiveAssignee) q.set("assignee", effectiveAssignee);
  setEffectiveNewCrmDateRange(q, filters.dateFrom, filters.dateTo);
  appendWorkspaceMilestoneFilterQuery(
    q,
    workspace,
    filters.milestoneStage,
    filters.milestoneStageCategory,
    filters.milestoneSubStage,
  );
  q.set("verificationStatus", workspace === "presales" ? "unverified" : "verified");
  return q;
}

async function fetchDashboardLeads(
  filters: DashboardFilterState,
  workspace: CrmWorkspace,
): Promise<ApiLead[]> {
  const fetchAllPages = async (query: URLSearchParams): Promise<ApiLead[]> => {
    const fetchPage = async (page: number) => {
      const pagedQuery = new URLSearchParams(query);
      pagedQuery.set("page", String(page));
      const res = await fetch(`/api/crm/leads?${pagedQuery.toString()}`, {
        cache: "no-store",
        credentials: "include",
        headers: getCrmAuthHeaders(),
      });
      if (!res.ok) return null;
      return (await res.json()) as SpringPage<ApiLead>;
    };

    const firstPage = await fetchPage(0);
    if (!firstPage) return [];
    const allLeads = Array.isArray(firstPage.content) ? [...firstPage.content] : [];
    const totalPages = Math.max(1, Number(firstPage.totalPages ?? 1));
    if (totalPages > 1) {
      const rest = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, idx) => fetchPage(idx + 1)),
      );
      for (const page of rest) {
        if (!page) continue;
        allLeads.push(...(Array.isArray(page.content) ? page.content : []));
      }
    }
    return allLeads;
  };

  const assignees = [...new Set((filters.assignees ?? []).map((x) => x.trim()).filter(Boolean))];
  const leadsById = new Map<string, ApiLead>();
  const requests =
    assignees.length > 0
      ? assignees.map((assignee) => buildLeadsQuery(filters, workspace, assignee))
      : [buildLeadsQuery(filters, workspace)];
  for (const query of requests) {
    const leads = await fetchAllPages(query);
    for (const lead of leads) {
      const id = String(lead.id ?? "").trim();
      if (!id || leadsById.has(id)) continue;
      leadsById.set(id, lead);
    }
  }
  return [...leadsById.values()];
}

type Props = {
  filters?: DashboardFilterState;
  workspace?: CrmWorkspace;
};

export default function CrmPipeline({ filters, workspace = "sales" }: Props) {
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
        const pipelineRole = pipelineRoleForWorkspace(workspace);
        const [salesPipeline, leads, subMapRes] = await Promise.all([
          fetchCrmPipeline({ nested: true, role: pipelineRole }),
          fetchDashboardLeads(sharedFilters, workspace),
          fetch("/api/milestone-count?resource=sub-status", {
            cache: "no-store",
            credentials: "include",
            headers: getCrmAuthHeaders(),
          }),
        ]);
        if (cancelled) return;
        setData(salesPipeline);
        setFilteredLeads(leads);

        if (subMapRes.ok) {
          const mapJson = (await subMapRes.json()) as SubStatusMappingsResp;
          setSubMappings(mapJson.mappings ?? []);
        } else {
          setSubMappings([]);
        }

        const stages = buildMilestoneStages(salesPipeline.entries, salesPipeline.nested);
        setSelectedStage((prev) => {
          if (prev && stages.some((s) => s.stage === prev)) return prev;
          return "Total Leads";
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
    workspace,
  ]);

  const stageCounts = filteredLeads.reduce<Record<string, number>>((acc, lead) => {
    const stage = stageFromLead(lead, workspace);
    if (!stage) return acc;
    acc[stage] = (acc[stage] ?? 0) + 1;
    return acc;
  }, {});

  const baseStages: MilestoneStage[] = (data ? buildMilestoneStages(data.entries, data.nested) : []).map((s) => ({
    ...s,
    count: stageCounts[s.stage] ?? stageCounts[s.label] ?? 0,
  }));

  const totalLeads = baseStages.reduce((sum, s) => sum + s.count, 0);

  const stages: MilestoneStage[] = [
    { stage: "Total Leads", label: "Total Leads", count: totalLeads },
    ...baseStages,
  ];

  const onSelectStage = useCallback((stage: string) => {
    setSelectedStage(stage);
  }, []);

  useEffect(() => {
    if (!selectedStage) {
      setPathData(null);
      return;
    }

    const isTotalLeads = norm(selectedStage) === "total leads";
    const scopedLeads = isTotalLeads
      ? filteredLeads
      : filteredLeads.filter(
          (lead) => norm(stageFromLead(lead, workspace)) === norm(selectedStage),
        );
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
      if (!isTotalLeads && norm(m.stage) !== norm(selectedStage)) continue;
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
      stageSubtitle: isTotalLeads
        ? "All stages combined"
        : subtitleForStage(selectedStage, workspace),
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
    workspace,
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
