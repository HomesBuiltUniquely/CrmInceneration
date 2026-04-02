"use client";

import { Card, CardTitle, FieldLabel, Input, Textarea, Select, Chip, Button } from "./ui";
import type { Lead } from "@/lib/data";
import { LANGUAGE_OPTIONS, LEAD_SOURCES, MEETING_TYPES } from "@/lib/data";

export default function LeadInfoTab({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-5 animate-fade-up delay-3">
      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Contact Details */}
        <Card>
          <CardTitle icon="👤" color="blue">Contact Details</CardTitle>

          <div className="mb-4">
            <FieldLabel>Full Name</FieldLabel>
            <Input defaultValue={lead.name} placeholder="Customer name" />
          </div>

          <div className="mb-4">
            <FieldLabel required>Email Address</FieldLabel>
            <Input
              type="email"
              defaultValue={lead.email}
              placeholder="Not provided — add email"
              missing={!lead.email}
            />
            {!lead.email && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-300">
                ⚠ Email missing — required for follow-up communications
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <FieldLabel>Phone</FieldLabel>
              <Input defaultValue={lead.phone} />
            </div>
            <div>
              <FieldLabel>Alternate Phone</FieldLabel>
              <Input defaultValue={lead.altPhone} placeholder="—" />
            </div>
          </div>
        </Card>

        {/* Property Info */}
        <Card>
          <CardTitle icon="🏠" color="orange">Property Details</CardTitle>

          <div className="grid grid-cols-2 gap-3.5 mb-4">
            <div>
              <FieldLabel>Pincode</FieldLabel>
              <Input defaultValue={lead.pincode} />
            </div>
            <div>
              <FieldLabel>Configuration</FieldLabel>
              <Input defaultValue={lead.configuration} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 mb-4">
            <div>
              <FieldLabel>Floor Plan</FieldLabel>
              <Input defaultValue={lead.floorPlan} />
            </div>
            <div>
              <FieldLabel>Possession Date</FieldLabel>
              <Input defaultValue={lead.possessionDate} />
            </div>
          </div>

          <div>
            <FieldLabel>Property Location</FieldLabel>
            <Input defaultValue={lead.propertyLocation} />
          </div>
        </Card>

      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Additional Info */}
        <Card>
          <CardTitle
            icon="📋"
            color="green"
            action={<Button variant="ghost" className="!py-1 !px-3 !text-[11px]">✎ Update</Button>}
          >
            Additional Information
          </CardTitle>

          <div className="grid grid-cols-2 gap-3.5 mb-4">
            <div>
              <FieldLabel>Budget</FieldLabel>
              <Input defaultValue={lead.budget} placeholder="e.g. 45L" />
            </div>
            <div>
              <FieldLabel>Language Preferred</FieldLabel>
              <Select defaultValue={lead.language}>
                {LANGUAGE_OPTIONS.map((language) => <option key={language}>{language}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 mb-4">
            <div>
              <FieldLabel>Lead Source</FieldLabel>
              <Select defaultValue={lead.leadSource}>
                {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel>Meeting Type</FieldLabel>
              <Select defaultValue={lead.meetingType}>
                {MEETING_TYPES.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </div>
          </div>

          <div>
            <FieldLabel>Property Notes</FieldLabel>
            <Textarea defaultValue={lead.propertyNotes} placeholder="Add extra property notes..." />
          </div>
        </Card>

        {/* Requirements & Schedule */}
        <Card>
          <CardTitle icon="✦" color="purple">Requirements & Schedule</CardTitle>

          <div className="mb-4">
            <FieldLabel>Requirements</FieldLabel>
            <div className="mt-1.5">
              {lead.requirements.map((r) => (
                <Chip key={r}>{r}</Chip>
              ))}
              <button className="mr-1.5 mb-1.5 inline-flex cursor-pointer items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-[11.5px] font-medium text-blue-300 transition-all hover:bg-blue-500/15">
                + Add
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 mb-4">
            <div>
              <FieldLabel>Meeting Date</FieldLabel>
              <Input defaultValue={lead.meetingDate} />
            </div>
            <div>
              <FieldLabel>Venue</FieldLabel>
              <Input defaultValue={lead.meetingVenue} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <FieldLabel>Follow Up Date</FieldLabel>
              <Input defaultValue={lead.followUpDate} />
            </div>
            <div>
              <FieldLabel>Agent Name</FieldLabel>
              <Input defaultValue={lead.agentName} />
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
}
