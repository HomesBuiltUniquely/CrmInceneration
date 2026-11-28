import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapInboxRowToNotificationItem } from "./crm-inbox-mapper";

describe("crm-inbox-mapper", () => {
  it("maps LEAD CREATED with stable numeric id", () => {
    const item = mapInboxRowToNotificationItem({
      id: 42,
      lead_identifier: "HUB-0001",
      lead_name: "Test Customer",
      notification_type: "LEAD",
      notification_action: "CREATED",
      created_at: "2026-01-01T10:00:00Z",
      read_at: null,
      payload: { assigned_to: "Alex" },
    });
    assert.equal(item.id, "42");
    assert.equal(item.read, false);
    assert.equal(item.leadIdentifier, "HUB-0001");
    assert.match(item.title, /New lead/);
  });

  it("marks read when read_at is set", () => {
    const item = mapInboxRowToNotificationItem({
      id: 1,
      notification_type: "MEETING",
      notification_action: "SCHEDULED",
      read_at: "2026-01-02T00:00:00Z",
    });
    assert.equal(item.read, true);
  });
});