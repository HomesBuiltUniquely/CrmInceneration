"use client";

import { Card, CardTitle, FieldLabel, Input, Select } from "./ui";
import type { Lead } from "@/lib/data";

type Props = {
  lead: Lead;
  onLeadChange?: (patch: Partial<Lead>) => void;
};

export default function AssignmentsTab({ lead, onLeadChange }: Props) {
  const c = onLeadChange;

  return (
    <div className="animate-fade-up delay-3">
      <Card>
        <CardTitle icon="🎯" color="purple">Assignment Details</CardTitle>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <FieldLabel>Designer Name</FieldLabel>
            <Input
              placeholder="Assign designer..."
              {...(c
                ? {
                    value: lead.designerName,
                    onChange: (e) => c({ designerName: e.target.value }),
                  }
                : { defaultValue: lead.designerName })}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-1">
            <FieldLabel>Design preference email</FieldLabel>
            <Input
              type="email"
              placeholder="Designer email for meeting + Design QA notices"
              {...(c
                ? {
                    value: lead.designerEmail ?? "",
                    onChange: (e) => c({ designerEmail: e.target.value }),
                  }
                : { defaultValue: lead.designerEmail ?? "" })}
            />
            <p className="mt-1.5 text-[11px] text-[var(--crm-text-muted)]">
              Same designer mailbox Hub uses after a Connection-stage meeting is fixed: Google Meet / Calendar mail plus Design QA mail.
            </p>
          </div>
          <div>
            <FieldLabel>Assignee</FieldLabel>
            <Input
              {...(c
                ? {
                    value: lead.assignee,
                    onChange: (e) => c({ assignee: e.target.value }),
                  }
                : { defaultValue: lead.assignee })}
            />
          </div>
          <div>
            <FieldLabel>Status</FieldLabel>
            <Select
              {...(c
                ? {
                    value: lead.status,
                    onChange: (e) => c({ status: e.target.value }),
                  }
                : { defaultValue: lead.status })}
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
