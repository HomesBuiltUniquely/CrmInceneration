"use client";

import { Card, CardTitle, FieldLabel, Input, Select } from "./ui";
import type { Lead } from "@/lib/data";

export default function AssignmentsTab({ lead }: { lead: Lead }) {
  return (
    <div className="animate-fade-up delay-3">
      <Card>
        <CardTitle icon="🎯" color="purple">Assignment Details</CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <FieldLabel>Designer Name</FieldLabel>
            <Input defaultValue={lead.designerName} placeholder="Assign designer..." />
          </div>
          <div>
            <FieldLabel>Assignee</FieldLabel>
            <Input defaultValue={lead.assignee} />
          </div>
          <div>
            <FieldLabel>Status</FieldLabel>
            <Select defaultValue={lead.status}>
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
