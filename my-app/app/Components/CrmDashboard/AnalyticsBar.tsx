/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { DashboardFilterState } from "./LeadFilters";

type Props = {
  filters?: DashboardFilterState;
};

function toQueryString(filters?: DashboardFilterState): string {
  const q = new URLSearchParams();
  if (!filters) return q.toString();
  if (filters.assignee.trim()) q.set("assignee", filters.assignee.trim());
  if ((filters.assignees ?? []).length > 0) q.set("assignees", (filters.assignees ?? []).join(","));
  if (filters.milestoneStage.trim()) q.set("milestoneStage", filters.milestoneStage.trim());
  if (filters.milestoneStageCategory.trim()) q.set("milestoneStageCategory", filters.milestoneStageCategory.trim());
  if (filters.milestoneSubStage.trim()) q.set("milestoneSubStage", filters.milestoneSubStage.trim());
  if (filters.dateFrom.trim()) q.set("dateFrom", filters.dateFrom.trim());
  if (filters.dateTo.trim()) q.set("dateTo", filters.dateTo.trim());
  return q.toString();
}

export default function AnalyticsBar({ filters }: Props) {
  const [overallConversion, setOverallConversion] = useState<number | null>(null);
  const [leadToMeeting, setLeadToMeeting] = useState<number | null>(null);
  const [totalPipelineValueInr, setTotalPipelineValueInr] = useState<number | null>(null);

  const queryString = useMemo(() => toQueryString(filters), [filters]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/crm/dashboard-metrics${queryString ? `?${queryString}` : ""}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Metrics HTTP ${res.status}`);
        const json = (await res.json()) as {
          overallConversion?: number;
          leadToMeeting?: number;
          totalPipelineValueInr?: number;
        };
        if (cancelled) return;
        setOverallConversion(Number.isFinite(json.overallConversion) ? Number(json.overallConversion) : 0);
        setLeadToMeeting(Number.isFinite(json.leadToMeeting) ? Number(json.leadToMeeting) : 0);
        setTotalPipelineValueInr(Number.isFinite(json.totalPipelineValueInr) ? Number(json.totalPipelineValueInr) : 0);
      } catch {
        if (!cancelled) {
          setOverallConversion(0);
          setLeadToMeeting(0);
          setTotalPipelineValueInr(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const conversionLabel = `${(overallConversion ?? 0).toFixed(1)}%`;
  const leadToMeetingLabel = `${(leadToMeeting ?? 0).toFixed(1)}%`;
  const totalPipelineLakhs = (totalPipelineValueInr ?? 0) / 100000;
  const totalPipelineLabel = `${totalPipelineLakhs.toFixed(1).replace(/\.0$/, "")}L INR`;
  const targetExceeded = totalPipelineLakhs >= 45;

  return (
    <main className="xl:mx-6 xl:mt-8 xl:w-[calc(100%-3rem)] xl:min-w-0">
        <div className="xl:flex xl:w-full xl:gap-4">
            <div className="xl:flex-1 xl:min-w-0 xl:h-25 xl:bg-[var(--crm-surface)] xl:rounded-2xl xl:shadow-[var(--crm-shadow-sm)] xl:border xl:border-[var(--crm-border)] xl:flex xl:justify-between xl:relative">
                <div>
                <h1 className="xl:font-bold xl:text-[13px] xl:text-[var(--crm-accent)] xl:p-3">OVERALL CONVERSION</h1>
                <h1 className="xl:font-bold xl:text-[24px] xl:pl-4 xl:mt-3 xl:text-[var(--crm-text-primary)]">{conversionLabel}</h1>
                </div>
                <div>
                    <img src="/increase.png" alt="Description" width={50} height={50} className="xl:absolute xl:right-6 xl:bottom-4" />
                </div>

            </div>  
            <div className="xl:flex-1 xl:min-w-0 xl:h-25 xl:bg-[var(--crm-surface)] xl:rounded-2xl xl:shadow-[var(--crm-shadow-sm)] xl:border xl:border-[var(--crm-border)] xl:flex xl:justify-between xl:relative">
                <div>
                <h1 className="xl:font-bold xl:text-[13px] xl:text-[var(--crm-accent)] xl:p-3">LEAD-TO-MEETING</h1>
                <h1 className="xl:font-bold xl:text-[24px] xl:pl-4 xl:mt-3 xl:text-[var(--crm-text-primary)]">{leadToMeetingLabel}</h1>
                </div>

            </div> 
            <div className="xl:flex-1 xl:min-w-0 xl:h-25 xl:bg-[var(--crm-surface)] xl:rounded-2xl xl:shadow-[var(--crm-shadow-sm)] xl:border xl:border-[var(--crm-border)] xl:flex xl:justify-between xl:relative">
                <div>
                <h1 className="xl:font-bold xl:text-[13px] xl:text-[var(--crm-accent)] xl:p-3">TOTAL PIPELINE VALUE</h1>
                <h1 className="xl:font-bold xl:text-[22px] xl:pl-4 xl:mt-3 xl:text-[var(--crm-text-primary)]">{totalPipelineLabel}</h1>
                </div>
                <div>
                    <div
                      className={`xl:text-[10px] xl:absolute xl:right-6 xl:bottom-4 xl:w-25 xl:h-5 xl:rounded-4xl xl:font-bold xl:pt-0.5 xl:pl-2.5 xl:text-center ${
                        targetExceeded
                          ? "xl:bg-[var(--crm-success-bg)] xl:text-[var(--crm-success-text)]"
                          : "xl:bg-[var(--crm-surface-subtle)] xl:text-[var(--crm-text-muted)]"
                      }`}
                    >
                      {targetExceeded ? "Target Exceeded" : "Below Target"}
                    </div>
                </div>

            </div> 
        </div>
    </main>
  );
}
    