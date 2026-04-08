"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiLead, SpringPage } from "@/lib/leads-filter";
import { asCrmLeadType, mapApiLeadToRow } from "@/lib/leads-filter";
import { fetchCrmPipeline } from "@/lib/crm-pipeline";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import LeadsTable from "./LeadsTable";
import LeadsToolbar from "./LeadsToolbar";

type Props = {
  search: string;
  leadType: string;
  sort: string;
  assignee: string;
  dateFrom: string;
  dateTo: string;
  milestoneStage: string;
  milestoneStageCategory: string;
  milestoneSubStage: string;
  onLeadTypeChange: (next: string) => void;
  onSortChange: (next: string) => void;
  onAssigneeChange: (next: string) => void;
  onDateFromChange: (next: string) => void;
  onDateToChange: (next: string) => void;
  onMilestoneStageChange: (next: string) => void;
  onMilestoneStageCategoryChange: (next: string) => void;
  onMilestoneSubStageChange: (next: string) => void;
};

type SubStatusResp = {
  mappings?: Array<{ stage: string; stageCategory: string; subStageName: string }>;
};

async function fetchMergedPage(
  page: number,
  size: number,
  leadType: string,
  sort: string,
  search: string,
  assignee: string,
  dateFrom: string,
  dateTo: string,
  milestoneStage: string,
  milestoneStageCategory: string,
  milestoneSubStage: string
): Promise<SpringPage<ApiLead>> {
  const qs = new URLSearchParams();
  qs.set("mergeAll", "1");
  qs.set("page", String(page));
  qs.set("size", String(size));
  qs.set("sort", sort);
  qs.set("leadType", leadType);
  if (search.trim()) qs.set("search", search.trim());
  if (assignee.trim()) qs.set("assignee", assignee.trim());
  if (dateFrom.trim()) qs.set("dateFrom", dateFrom.trim());
  if (dateTo.trim()) qs.set("dateTo", dateTo.trim());
  if (milestoneStage.trim()) qs.set("milestoneStage", milestoneStage.trim());
  if (milestoneStageCategory.trim()) qs.set("milestoneStageCategory", milestoneStageCategory.trim());
  if (milestoneSubStage.trim()) qs.set("milestoneSubStage", milestoneSubStage.trim());

  const res = await fetch(
    `/api/crm/leads?${qs.toString()}`,
    { cache: "no-store", credentials: "include", headers: getCrmAuthHeaders() }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchFilterOptions(): Promise<{
  assignees: string[];
  stages: string[];
  categories: string[];
  subStages: string[];
}> {
  const [leadsRes, subRes] = await Promise.all([
    fetch("/api/crm/leads?mergeAll=1&page=0&size=250&sort=updatedAt,desc", {
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

  const assignees = new Set<string>();
  if (leadsRes.ok) {
    const leads = (await leadsRes.json()) as SpringPage<ApiLead>;
    for (const lead of leads.content ?? []) {
      const a = typeof lead.assignee === "string" ? lead.assignee : lead.assignee?.name;
      const t = (a ?? "").trim();
      if (t) assignees.add(t);
    }
  }

  const stages = new Set<string>();
  const categories = new Set<string>();
  const subStages = new Set<string>();
  if (subRes.ok) {
    const data = (await subRes.json()) as SubStatusResp;
    for (const m of data.mappings ?? []) {
      const s = (m.stage ?? "").trim();
      const c = (m.stageCategory ?? "").trim();
      const sub = (m.subStageName ?? "").trim();
      if (s) stages.add(s);
      if (c) categories.add(c);
      if (sub) subStages.add(sub);
    }
  }

  return {
    assignees: [...assignees].sort((a, b) => a.localeCompare(b)),
    stages: [...stages].sort((a, b) => a.localeCompare(b)),
    categories: [...categories].sort((a, b) => a.localeCompare(b)),
    subStages: [...subStages].sort((a, b) => a.localeCompare(b)),
  };
}

export default function LeadsDataSection({
  search,
  leadType,
  sort,
  assignee,
  dateFrom,
  dateTo,
  milestoneStage,
  milestoneStageCategory,
  milestoneSubStage,
  onLeadTypeChange,
  onSortChange,
  onAssigneeChange,
  onDateFromChange,
  onDateToChange,
  onMilestoneStageChange,
  onMilestoneStageCategoryChange,
  onMilestoneSubStageChange,
}: Props) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SpringPage<ApiLead> | null>(null);
  const [stageOrder, setStageOrder] = useState<string[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [assigneeOptions, setAssigneeOptions] = useState<string[]>([]);
  const [milestoneStageOptions, setMilestoneStageOptions] = useState<string[]>([]);
  const [milestoneStageCategoryOptions, setMilestoneStageCategoryOptions] = useState<string[]>([]);
  const [milestoneSubStageOptions, setMilestoneSubStageOptions] = useState<string[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [assignee, dateFrom, dateTo, leadType, milestoneStage, milestoneStageCategory, milestoneSubStage, sort, debouncedSearch]);

  useEffect(() => {
    setPage(0);
  }, [size]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const p = await fetchCrmPipeline(true);
        const order = p.nested?.map((n) => n.stage.trim()).filter(Boolean) ?? [];
        if (!cancelled) setStageOrder(order);
      } catch {
        if (!cancelled) setStageOrder([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const o = await fetchFilterOptions();
        if (cancelled) return;
        setAssigneeOptions(o.assignees);
        setMilestoneStageOptions(o.stages);
        setMilestoneStageCategoryOptions(o.categories);
        setMilestoneSubStageOptions(o.subStages);
      } catch {
        if (cancelled) return;
        setAssigneeOptions([]);
        setMilestoneStageOptions([]);
        setMilestoneStageCategoryOptions([]);
        setMilestoneSubStageOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await fetchMergedPage(
        page,
        size,
        leadType,
        sort,
        debouncedSearch,
        assignee,
        dateFrom,
        dateTo,
        milestoneStage,
        milestoneStageCategory,
        milestoneSubStage
      );
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leads");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [assignee, dateFrom, dateTo, debouncedSearch, leadType, milestoneStage, milestoneStageCategory, milestoneSubStage, page, size, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const content = data?.content ?? [];
  const rows = content.map((lead) =>
    mapApiLeadToRow(lead, asCrmLeadType(lead.leadType, "formlead"), stageOrder)
  );
  const total = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const start = total === 0 ? 0 : page * size + 1;
  const end = Math.min(total, page * size + content.length);

  return (
    <>
      <LeadsToolbar
        rangeStart={start}
        rangeEnd={end}
        totalCount={total}
        loading={loading}
        leadType={leadType}
        sort={sort}
        assignee={assignee}
        dateFrom={dateFrom}
        dateTo={dateTo}
        milestoneStage={milestoneStage}
        milestoneStageCategory={milestoneStageCategory}
        milestoneSubStage={milestoneSubStage}
        assigneeOptions={assigneeOptions}
        milestoneStageOptions={milestoneStageOptions}
        milestoneStageCategoryOptions={milestoneStageCategoryOptions}
        milestoneSubStageOptions={milestoneSubStageOptions}
        onLeadTypeChange={onLeadTypeChange}
        onSortChange={onSortChange}
        onAssigneeChange={onAssigneeChange}
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
        onMilestoneStageChange={onMilestoneStageChange}
        onMilestoneStageCategoryChange={onMilestoneStageCategoryChange}
        onMilestoneSubStageChange={onMilestoneSubStageChange}
      />
      {error ? (
        <div className="mx-auto mt-2 max-w-[1200px] px-6 text-[12px] text-rose-600">
          {error}
          {process.env.NODE_ENV === "development" ? (
            <span className="mt-1 block text-slate-500">
              Set <code className="rounded bg-slate-100 px-1">CRM_DEV_BEARER_TOKEN</code> in{" "}
              <code className="rounded bg-slate-100 px-1">.env.local</code> or store a token in{" "}
              <code className="rounded bg-slate-100 px-1">localStorage</code> as{" "}
              <code className="rounded bg-slate-100 px-1">crm_token</code> (login) or{" "}
              <code className="rounded bg-slate-100 px-1">access_token</code>.
            </span>
          ) : null}
        </div>
      ) : null}
      <LeadsTable
        rows={rows}
        loading={loading}
        page={page}
        totalPages={totalPages}
        pageSize={size}
        onPageChange={(next) => setPage(Math.max(0, Math.min(totalPages - 1, next)))}
        onPageSizeChange={(nextSize) => setSize(nextSize)}
      />
    </>
  );
}
