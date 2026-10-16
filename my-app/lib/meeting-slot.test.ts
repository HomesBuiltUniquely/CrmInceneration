import assert from "node:assert/strict";
import test from "node:test";
import {
  blankToEmpty,
  getSlotMode,
  groupMeetingsByDayHour,
  type SlotMeeting,
} from "./meeting-slot";

function meeting(partial: Partial<SlotMeeting> & Pick<SlotMeeting, "id">): SlotMeeting {
  return {
    date: "2026-10-14",
    startMin: 16 * 60,
    customer: "Lead",
    ...partial,
  };
}

test("getSlotMode thresholds", () => {
  assert.equal(getSlotMode(0), "single");
  assert.equal(getSlotMode(1), "single");
  assert.equal(getSlotMode(2), "compact");
  assert.equal(getSlotMode(4), "compact");
  assert.equal(getSlotMode(5), "count");
  assert.equal(getSlotMode(20), "count");
});

test("empty list groups to nothing", () => {
  assert.deepEqual(groupMeetingsByDayHour([]), {});
});

test("one meeting stays on its local day and hour", () => {
  const grouped = groupMeetingsByDayHour([meeting({ id: "a", startMin: 16 * 60 + 15, customer: "Gokul" })]);
  assert.deepEqual(Object.keys(grouped), ["2026-10-14"]);
  assert.equal(grouped["2026-10-14"][16]?.length, 1);
  assert.equal(grouped["2026-10-14"][16][0].customer, "Gokul");
});

test("two and four meetings share one hour bucket sorted by time then name", () => {
  const grouped = groupMeetingsByDayHour([
    meeting({ id: "z", startMin: 16 * 60, customer: "Zara" }),
    meeting({ id: "a", startMin: 16 * 60, customer: "Anil" }),
    meeting({ id: "b", startMin: 16 * 60 + 20, customer: "Bina" }),
    meeting({ id: "c", startMin: 15 * 60, customer: "Early" }),
  ]);
  assert.deepEqual(
    grouped["2026-10-14"][16].map((item) => item.customer),
    ["Anil", "Zara", "Bina"],
  );
  assert.equal(grouped["2026-10-14"][15].length, 1);
});

test("five and twenty meetings stay in the same hour", () => {
  const five = Array.from({ length: 5 }, (_, index) => meeting({ id: `f${index}`, customer: `C${index}` }));
  const twenty = Array.from({ length: 20 }, (_, index) => meeting({ id: `t${index}`, customer: `T${index}`, startMin: 9 * 60 }));
  assert.equal(groupMeetingsByDayHour(five)["2026-10-14"][16].length, 5);
  assert.equal(groupMeetingsByDayHour(twenty)["2026-10-14"][9].length, 20);
});

test("missing fields stay blank and do not become the word undefined", () => {
  const grouped = groupMeetingsByDayHour([
    meeting({ id: "m", customer: undefined, designer: undefined, phone: "undefined", status: undefined, value: undefined, meetingType: "—" }),
  ]);
  const row = grouped["2026-10-14"][16][0];
  assert.equal(blankToEmpty(row.customer), "");
  assert.equal(blankToEmpty(row.designer), "");
  assert.equal(blankToEmpty(row.phone), "");
  assert.equal(blankToEmpty(row.meetingType), "");
  assert.equal(blankToEmpty(row.status), "");
});

test("timezone boundary uses the local date key and local minutes", () => {
  const grouped = groupMeetingsByDayHour([
    meeting({ id: "midnight", date: "2026-10-14", startMin: 30, customer: "Early" }),
    meeting({ id: "late", date: "2026-10-14", startMin: 23 * 60 + 15, customer: "Late" }),
    meeting({ id: "bad-day", date: "14 Oct 2026", startMin: 60, customer: "Skip" }),
    meeting({ id: "bad-hour", date: "2026-10-14", startMin: 24 * 60, customer: "Skip" }),
    meeting({ id: "nan", date: "2026-10-14", startMin: Number.NaN, customer: "Skip" }),
  ]);
  assert.equal(grouped["2026-10-14"][0][0].id, "midnight");
  assert.equal(grouped["2026-10-14"][23][0].id, "late");
  assert.equal(grouped["2026-10-13"], undefined);
  assert.equal(grouped["2026-10-15"], undefined);
  assert.equal(Object.keys(grouped["2026-10-14"]).sort().join(","), "0,23");
});
