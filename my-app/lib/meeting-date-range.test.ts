import assert from "node:assert/strict";
import test from "node:test";
import { formatRangeLabel, meetingFallsInRange, resolveDatePreset, toDateKey } from "./meeting-date-range";

const today = new Date(2026, 9, 14);

test("this month is the current calendar month", () => {
  const range = resolveDatePreset("this-month", today);
  assert.ok(range);
  assert.equal(toDateKey(range.from), "2026-10-01");
  assert.equal(toDateKey(range.to), "2026-10-31");
  assert.equal(formatRangeLabel(range), "1 Oct – 31 Oct 2026");
});

test("last 3 months is today minus 90 days through today", () => {
  const range = resolveDatePreset("last-3-months", today);
  assert.ok(range);
  assert.equal(toDateKey(range.from), "2026-07-16");
  assert.equal(toDateKey(range.to), "2026-10-14");
});

test("last 6 months and last 1 year are rolling windows ending today", () => {
  const six = resolveDatePreset("last-6-months", today);
  const year = resolveDatePreset("last-1-year", today);
  assert.ok(six && year);
  assert.equal(toDateKey(six.from), "2026-04-14");
  assert.equal(toDateKey(six.to), "2026-10-14");
  assert.equal(toDateKey(year.from), "2025-10-14");
  assert.equal(toDateKey(year.to), "2026-10-14");
});

test("previous month is the full prior calendar month", () => {
  const range = resolveDatePreset("previous-month", today);
  assert.ok(range);
  assert.equal(toDateKey(range.from), "2026-09-01");
  assert.equal(toDateKey(range.to), "2026-09-30");
});

test("custom range swaps reversed dates and rejects blanks", () => {
  assert.equal(resolveDatePreset("custom", today, { from: "", to: "" }), null);
  const range = resolveDatePreset("custom", today, { from: "2026-10-20", to: "2026-10-02" });
  assert.ok(range);
  assert.equal(toDateKey(range.from), "2026-10-02");
  assert.equal(toDateKey(range.to), "2026-10-20");
  assert.equal(meetingFallsInRange("2026-10-14", range), true);
  assert.equal(meetingFallsInRange("2026-10-01", range), false);
});
