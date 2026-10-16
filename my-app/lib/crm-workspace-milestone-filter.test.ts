import assert from "node:assert/strict";
import test from "node:test";
import type { ApiLead } from "./leads-filter";
import { leadMatchesWorkspaceMilestoneFilter } from "./crm-workspace";

function leadWithMilestone(args: {
  stage?: string;
  category?: string;
  subStage?: string;
}): ApiLead {
  return {
    leadType: "glead",
    stage: {
      milestoneStage: args.stage ?? "",
      milestoneStageCategory: args.category ?? "",
      milestoneSubStage: args.subStage ?? "",
    },
  } as ApiLead;
}

test("matches RNR when Hub omits parenthetical suffix", () => {
  const lead = leadWithMilestone({
    stage: "Discovery",
    category: "Discovery Won",
    subStage: "RNR Call Back",
  });
  assert.equal(
    leadMatchesWorkspaceMilestoneFilter(
      lead,
      "sales",
      "Discovery",
      "Discovery Won",
      "RNR Call Back (Discovery)",
    ),
    true,
  );
});

test("matches when Hub stores stage as Discovery Won", () => {
  const lead = leadWithMilestone({
    stage: "Discovery Won",
    category: "",
    subStage: "RNR Call Back (Discovery)",
  });
  assert.equal(
    leadMatchesWorkspaceMilestoneFilter(
      lead,
      "sales",
      "Discovery",
      "Discovery Won",
      "RNR Call Back (Discovery)",
    ),
    true,
  );
});

test("matches uppercase Hub substage labels", () => {
  const lead = leadWithMilestone({
    stage: "Discovery",
    category: "Discovery Won",
    subStage: "RNR CALL BACK",
  });
  assert.equal(
    leadMatchesWorkspaceMilestoneFilter(
      lead,
      "sales",
      "Discovery",
      "Discovery Won",
      "RNR Call Back (Discovery)",
    ),
    true,
  );
});

test("does not match a different journey stage", () => {
  const lead = leadWithMilestone({
    stage: "Connection",
    category: "Connection Won",
    subStage: "Meeting Scheduled",
  });
  assert.equal(
    leadMatchesWorkspaceMilestoneFilter(
      lead,
      "sales",
      "Discovery",
      "Discovery Won",
      "RNR Call Back (Discovery)",
    ),
    false,
  );
});
