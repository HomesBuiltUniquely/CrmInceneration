import assert from "node:assert/strict";
import test from "node:test";
import { followUpModalTitle, firstNameFromDisplayName } from "./se-followup-modal-titles";

test("modal titles are time-neutral", () => {
  assert.equal(
    followUpModalTitle("morning", "Rahul"),
    "Hi, Rahul — today's follow-ups",
  );
  assert.equal(
    followUpModalTitle("evening", "Rahul"),
    "Hi, Rahul — today's follow-up report",
  );
  assert.ok(!followUpModalTitle("morning", "Rahul").toLowerCase().includes("good"));
});

test("firstNameFromDisplayName", () => {
  assert.equal(firstNameFromDisplayName("Meghana Rao"), "Meghana");
  assert.equal(firstNameFromDisplayName(""), "");
});