export type CrmPipelineEntry = {
  stage: string;
  stageCategory: string;
  subStageName: string;
};

export type CrmNestedCategory = {
  stageCategory: string;
  subStages: string[];
};

export type CrmNestedStage = {
  stage: string;
  categories: CrmNestedCategory[];
};

export type CrmPipelineResponse = {
  entries: CrmPipelineEntry[];
  nested?: CrmNestedStage[];
};

export type PresalesPipelineStage = {
  stageName: string;
  categories: {
    categoryName: string;
    subStages: string[];
  }[];
};

/** Cards in Won / Lost columns (matches `MilestonePaths` StatCard). */
export type MilestonePathItem = {
  title: string;
  subtitle?: string;
  value: number | string;
  tone?: "neutral" | "success" | "danger";
  leftAccent?: "success" | "warning" | "danger" | "neutral";
};
