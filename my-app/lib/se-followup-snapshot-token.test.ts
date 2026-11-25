import assert from "node:assert/strict";
import test from "node:test";
import {
  signFollowUpSnapshotToken,
  verifyFollowUpSnapshotToken,
} from "./se-followup-snapshot-token";

test("snapshot token round-trip and tamper rejection", () => {
  const payload = {
    userId: 42,
    dateKey: "2026-11-25",
    capturedAt: new Date().toISOString(),
    totalDue: 2,
    overdueAtCapture: 0,
    items: [
      {
        leadKey: "formlead:1",
        followUpMs: 1,
        wasOverdue: false,
        segment: "active" as const,
        display: { name: "A", timeLabel: "10 am", stageLabel: "Discovery" },
      },
    ],
  };
  const token = signFollowUpSnapshotToken(payload);
  const ok = verifyFollowUpSnapshotToken(token, 42, "2026-11-25");
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.snapshot.totalDue, 2);

  const badUser = verifyFollowUpSnapshotToken(token, 99, "2026-11-25");
  assert.equal(badUser.ok, false);

  const tampered = token.replace(/.$/, "x");
  const badSig = verifyFollowUpSnapshotToken(tampered, 42, "2026-11-25");
  assert.equal(badSig.ok, false);
});