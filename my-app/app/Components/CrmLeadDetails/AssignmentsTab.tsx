"use client";

import { Card, CardTitle, FieldLabel, Input } from "./ui";
import type { Lead } from "@/lib/data";

type Props = {
  lead: Lead;
  onLeadChange?: (patch: Partial<Lead>) => void;
};

export default function AssignmentsTab({ lead, onLeadChange }: Props) {
  return (
    <div className="animate-fade-up delay-3">
      <Card>
        <CardTitle icon="🎯" color="purple">Assignment Details</CardTitle>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div>
            <FieldLabel>Designer Name</FieldLabel>
            <Input
              placeholder="Assign designer..."
              value={lead.designerName}
              readOnly
            />
          </div>
          <div>
            <FieldLabel>Assignee</FieldLabel>
            <Input
              value={lead.assignee}
              readOnly
            />
          </div>
          <div>
            <FieldLabel>Status</FieldLabel>
            <Input value={lead.status || "—"} readOnly />
            <p className="mt-1 text-[11px] text-[var(--crm-text-muted)]">
              Mapped from selected feedback/milestone flow.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
