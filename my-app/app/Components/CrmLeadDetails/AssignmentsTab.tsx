"use client";

import { Card, CardTitle, FieldLabel, Input, Select } from "./ui";
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
            <Select
              value={lead.status}
              disabled
            >
              <option>Requirement Received</option>
              <option>Active / RNR</option>
              <option>Initial Stage / Fresh Leads</option>
              <option>Site Visit Scheduled</option>
              <option>Proposal Sent</option>
              <option>Won</option>
              <option>Lost</option>
            </Select>
          </div>
        </div>
      </Card>
    </div>
  );
}
