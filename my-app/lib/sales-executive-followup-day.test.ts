import assert from "node:assert/strict";
import test from "node:test";
import type { ApiLead } from "@/lib/leads-filter";
import {
  buildMorningFollowUpBrief,
  buildSnapshotFromDueTodayLeads,
  buildEveningFollowUpBrief,
  stableFollowUpLeadKey,
} from "./sales-executive-followup-day";
import { quoteForLocalDate, motivationalWeekIndex } from "./se-followup-motivational-quotes";

const baseLead = (id: string, followUp: string, milestoneStage = "Discovery"): ApiLead =>
  ({
    id,
    leadType: "formlead",
    customerName: `Customer ${id}`,
    followUpDate: followUp,
    stage: { milestoneStage },
    assignee: "Rahul",
  }) as ApiLead;

test("stableFollowUpLeadKey is stable", () => {
  assert.equal(stableFollowUpLeadKey(baseLead("12", "2026-10-14T10:00:00")), "formlead:12");
});

test("motivational quote returns non-empty string", () => {
  const q = quoteForLocalDate(new Date(2026, 0, 6));
  assert.ok(q.length > 5);
  assert.ok(motivationalWeekIndex(new Date(2026, 0, 6)) >= 0);
});

test("evening brief all left when none completed", () => {
  const today = new Date(2026, 10, 14, 18, 0, 0);
  const fuToday = "2026-11-14T10:30:00";
  const leads = [baseLead("1", fuToday), baseLead("2", fuToday)];
  const snapshot = buildSnapshotFromDueTodayLeads(leads, today);
  const evening = buildEveningFollowUpBrief(leads, "Rahul", snapshot, today);
  assert.equal(evening.completed, 0);
  assert.equal(evening.left, 2);
  assert.equal(evening.totalDue, 2);
  assert.equal(evening.pendingRows.length, 2);
});

test("evening brief counts left vs completed from snapshot", () => {
  const today = new Date(2026, 10, 14, 12, 0, 0);
  const fuToday = "2026-11-14T10:30:00";
  const fuTomorrow = "2026-11-15T10:30:00";
  const leadA = baseLead("1", fuToday);
  const leadB = baseLead("2", fuToday);
  const snapshot = buildSnapshotFromDueTodayLeads([leadA, leadB], today);
  const poolAfter = [leadA, baseLead("2", fuTomorrow)];
  const evening = buildEveningFollowUpBrief(poolAfter, "Rahul", snapshot, today);
  assert.equal(evening.totalDue, 2);
  assert.equal(evening.completed, 1);
  assert.equal(evening.left, 1);
});

test("morning brief sums active and closure due today", () => {
  const today = new Date(2026, 10, 14, 9, 0, 0);
  const fu = "2026-11-14T14:00:00";
  const leads = [
    baseLead("1", fu, "Discovery"),
    baseLead("2", fu, "Experience & Design"),
  ];
  const brief = buildMorningFollowUpBrief(leads, "Rahul", today);
  assert.equal(brief.totalDue, brief.followupsActive + brief.followupsClosure);
});