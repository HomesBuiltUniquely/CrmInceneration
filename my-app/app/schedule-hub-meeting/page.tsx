"use client";

import { useState } from "react";
import ScheduleHubMeetingModal, {
  type ScheduleHubMeetingConfirmPayload,
} from "@/app/Components/CrmLeadDetails/ScheduleHubMeetingModal";
import { Button } from "@/app/Components/CrmLeadDetails/ui";

export default function ScheduleHubMeetingPreviewPage() {
  const [open, setOpen] = useState(true);
  const [lastPayload, setLastPayload] = useState<ScheduleHubMeetingConfirmPayload | null>(null);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--crm-app-bg)] p-6"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
    >
      <p className="text-[14px] text-[var(--crm-text-muted)]">Schedule Hub Meeting — UI preview</p>
      {lastPayload ? (
        <pre className="max-w-xl overflow-auto rounded-lg border border-[var(--crm-border)] bg-white p-3 text-[11px]">
          {JSON.stringify(lastPayload, null, 2)}
        </pre>
      ) : null}
      <Button variant="primary" onClick={() => setOpen(true)}>
        Open Schedule Hub Meeting
      </Button>
      <ScheduleHubMeetingModal
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={async (payload) => {
          setLastPayload(payload);
          setOpen(false);
        }}
        leadCustomerName="Satish"
        leadDisplayId="BLR-A0374"
        status="Connection"
        path="Connection Won"
        feedback="Meeting Scheduled"
        hubMeetingPanelTitle="Hub meeting (Connection)"
        initialNote="Customer prefers showroom visit in the morning."
        minDate={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
