import type { NotificationItem } from "@/app/Components/Notification/Notify";

export type CrmInboxRow = {
  id: number;
  event_id?: string;
  lead_identifier?: string;
  lead_name?: string;
  notification_type?: string;
  notification_action?: string;
  payload?: Record<string, unknown>;
  created_at?: string;
  read_at?: string | null;
};

function tagFromRow(row: CrmInboxRow): string {
  const type = String(row.notification_type ?? "").toUpperCase();
  const action = String(row.notification_action ?? "").toUpperCase();
  if (type === "LEAD") return "lead";
  if (type === "BOOKING" || type === "PAYMENT") return "booking";
  if (type === "MEETING") {
    if (action === "SUCCESS") return "meeting";
    if (action === "CANCELLED" || action === "CANCELLATION") return "meeting";
    return "meeting";
  }
  return type.toLowerCase() || "meeting";
}

function buildTitle(row: CrmInboxRow): string {
  const type = String(row.notification_type ?? "").toUpperCase();
  const action = String(row.notification_action ?? "").toUpperCase();
  const lead = row.lead_name?.trim() || row.lead_identifier?.trim() || "Lead";
  const p = row.payload ?? {};
  const assignee = String(p.assigned_to ?? p.assignedTo ?? "").trim();

  if (type === "LEAD" && action === "CREATED") {
    return assignee
      ? `New lead ${lead} assigned to ${assignee}`
      : `New lead ${lead}`;
  }
  if (type === "MEETING") {
    const verb =
      action === "RESCHEDULED"
        ? "rescheduled"
        : action === "CANCELLED"
          ? "cancelled"
          : action === "SUCCESS"
            ? "completed"
            : "scheduled";
    return assignee
      ? `Meeting ${verb} — ${lead} (${assignee})`
      : `Meeting ${verb} — ${lead}`;
  }
  if (type === "BOOKING" || type === "PAYMENT") {
    const pt = String(p.payment_type ?? p.paymentType ?? "payment");
    return `Booking update — ${lead} (${pt})`;
  }
  return `${type} ${action} — ${lead}`;
}

function buildDescription(row: CrmInboxRow): string | undefined {
  const p = row.payload ?? {};
  const parts: string[] = [];
  const md = String(p.meeting_date ?? p.meetingDate ?? "").trim();
  const slot = String(p.slot ?? "").trim();
  if (md) parts.push(md);
  if (slot) parts.push(slot);
  if (parts.length === 0 && row.created_at) {
    try {
      const d = new Date(row.created_at);
      parts.push(d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }));
    } catch {
      parts.push(row.created_at);
    }
  }
  return parts.length ? parts.join(" · ") : undefined;
}

export function mapInboxRowToNotificationItem(row: CrmInboxRow): NotificationItem {
  const id = String(row.id);
  const leadIdentifier = (row.lead_identifier ?? "").trim() || undefined;
  const read = row.read_at != null && row.read_at !== "";
  return {
    id,
    title: buildTitle(row),
    description: buildDescription(row),
    timestamp: row.created_at ?? "",
    read,
    tag: tagFromRow(row),
    ...(leadIdentifier ? { leadIdentifier } : {}),
  };
}

export function parseInboxListPayload(payload: unknown): CrmInboxRow[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  return data as CrmInboxRow[];
}