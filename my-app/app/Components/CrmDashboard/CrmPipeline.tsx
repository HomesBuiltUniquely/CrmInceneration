"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildMilestoneStages,
  buildPathsForStage,
  fetchCrmPipeline,
  type MilestoneStage,
} from "@/lib/crm-pipeline";
import type { CrmPipelineResponse } from "@/types/crm-pipeline";
import Milestones from "./Milestones";
import MilestonePaths from "./MilestonePaths";

export default function CrmPipeline() {
  const [data, setData] = useState<CrmPipelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCrmPipeline(true)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        const stages = buildMilestoneStages(res.entries, res.nested);
        const first = stages[0]?.stage ?? null;
        setSelectedStage((prev) => {
          if (prev && stages.some((s) => s.stage === prev)) return prev;
          return first;
        });
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message ?? "Failed to load pipeline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stages: MilestoneStage[] = data
    ? buildMilestoneStages(data.entries, data.nested)
    : [];

  const onSelectStage = useCallback((stage: string) => {
    setSelectedStage(stage);
  }, []);

  const paths =
    data && selectedStage
      ? buildPathsForStage(data.entries, data.nested, selectedStage)
      : null;

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

  if (!selectedStage || !paths) {
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
        stageTitle={paths.stageTitle}
        stageSubtitle={paths.stageSubtitle}
        totalActiveLeads={paths.totalActiveLeads}
        wonTotal={paths.wonTotal}
        lostTotal={paths.lostTotal}
        wonItems={paths.wonItems}
        lostItems={paths.lostItems}
      />
    </>
  );
}
