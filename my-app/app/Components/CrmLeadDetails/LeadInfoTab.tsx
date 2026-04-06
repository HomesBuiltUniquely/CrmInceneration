"use client";

import { Card, CardTitle, FieldLabel, Input, Textarea, Select, Chip, Button } from "./ui";
import type { Lead } from "@/lib/data";
import { LANGUAGE_OPTIONS, LEAD_SOURCES, MEETING_TYPES } from "@/lib/data";

type Props = {
  lead: Lead;
  /** When set, fields are controlled and edits merge into parent state (API detail page). */
  onLeadChange?: (patch: Partial<Lead>) => void;
};

export default function LeadInfoTab({ lead, onLeadChange }: Props) {
  const c = onLeadChange;

  return (
    <div className="space-y-5 animate-fade-up delay-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardTitle icon="👤" color="blue">Contact Details</CardTitle>

          <div className="mb-4">
            <FieldLabel>Full Name</FieldLabel>
            <Input
              placeholder="Customer name"
              {...(c
                ? { value: lead.name, onChange: (e) => c({ name: e.target.value }) }
                : { defaultValue: lead.name })}
            />
          </div>

          <div className="mb-4">
            <FieldLabel required>Email Address</FieldLabel>
            <Input
              type="email"
              placeholder="Not provided — add email"
              missing={!lead.email}
              {...(c
                ? { value: lead.email, onChange: (e) => c({ email: e.target.value }) }
                : { defaultValue: lead.email })}
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
              <Input
                {...(c
                  ? { value: lead.phone, onChange: (e) => c({ phone: e.target.value }) }
                  : { defaultValue: lead.phone })}
              />
            </div>
            <div>
              <FieldLabel>Alternate Phone</FieldLabel>
              <Input
                placeholder="—"
                {...(c
                  ? { value: lead.altPhone, onChange: (e) => c({ altPhone: e.target.value }) }
                  : { defaultValue: lead.altPhone })}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle icon="🏠" color="orange">Property Details</CardTitle>

          <div className="grid grid-cols-2 gap-3.5 mb-4">
            <div>
              <FieldLabel>Pincode</FieldLabel>
              <Input
                {...(c
                  ? { value: lead.pincode, onChange: (e) => c({ pincode: e.target.value }) }
                  : { defaultValue: lead.pincode })}
              />
            </div>
            <div>
              <FieldLabel>Configuration</FieldLabel>
              <Input
                {...(c
                  ? { value: lead.configuration, onChange: (e) => c({ configuration: e.target.value }) }
                  : { defaultValue: lead.configuration })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 mb-4">
            <div>
              <FieldLabel>Floor Plan</FieldLabel>
              <Input
                {...(c
                  ? { value: lead.floorPlan, onChange: (e) => c({ floorPlan: e.target.value }) }
                  : { defaultValue: lead.floorPlan })}
              />
            </div>
            <div>
              <FieldLabel>Possession Date</FieldLabel>
              <Input
                {...(c
                  ? { value: lead.possessionDate, onChange: (e) => c({ possessionDate: e.target.value }) }
                  : { defaultValue: lead.possessionDate })}
              />
            </div>
          </div>

          <div>
            <FieldLabel>Property Location</FieldLabel>
            <Input
              {...(c
                ? {
                    value: lead.propertyLocation,
                    onChange: (e) => c({ propertyLocation: e.target.value }),
                  }
                : { defaultValue: lead.propertyLocation })}
            />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
              <Input
                placeholder="e.g. 45L"
                {...(c
                  ? { value: lead.budget, onChange: (e) => c({ budget: e.target.value }) }
                  : { defaultValue: lead.budget })}
              />
            </div>
            <div>
              <FieldLabel>Language Preferred</FieldLabel>
              <Select
                {...(c
                  ? { value: lead.language, onChange: (e) => c({ language: e.target.value }) }
                  : { defaultValue: lead.language })}
              >
                {LANGUAGE_OPTIONS.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 mb-4">
            <div>
              <FieldLabel>Lead Source</FieldLabel>
              <Select
                {...(c
                  ? { value: lead.leadSource, onChange: (e) => c({ leadSource: e.target.value }) }
                  : { defaultValue: lead.leadSource })}
              >
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel>Meeting Type</FieldLabel>
              <Select
                {...(c
                  ? { value: lead.meetingType, onChange: (e) => c({ meetingType: e.target.value }) }
                  : { defaultValue: lead.meetingType })}
              >
                {MEETING_TYPES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <FieldLabel>Property Notes</FieldLabel>
            <Textarea
              placeholder="Add extra property notes..."
              {...(c
                ? {
                    value: lead.propertyNotes,
                    onChange: (e) => c({ propertyNotes: e.target.value }),
                  }
                : { defaultValue: lead.propertyNotes })}
            />
          </div>
        </Card>

        <Card>
          <CardTitle icon="✦" color="purple">Requirements & Schedule</CardTitle>

          <div className="mb-4">
            <FieldLabel>Requirements</FieldLabel>
            <div className="mt-1.5">
              {lead.requirements.map((r) => (
                <Chip key={r}>{r}</Chip>
              ))}
              <button
                type="button"
                className="mr-1.5 mb-1.5 inline-flex cursor-pointer items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-[11.5px] font-medium text-blue-300 transition-all hover:bg-blue-500/15"
              >
                + Add
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 mb-4">
            <div>
              <FieldLabel>Meeting Date</FieldLabel>
              <Input
                {...(c
                  ? { value: lead.meetingDate, onChange: (e) => c({ meetingDate: e.target.value }) }
                  : { defaultValue: lead.meetingDate })}
              />
            </div>
            <div>
              <FieldLabel>Venue</FieldLabel>
              <Input
                {...(c
                  ? { value: lead.meetingVenue, onChange: (e) => c({ meetingVenue: e.target.value }) }
                  : { defaultValue: lead.meetingVenue })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <FieldLabel>Follow Up Date</FieldLabel>
              <Input
                {...(c
                  ? { value: lead.followUpDate, onChange: (e) => c({ followUpDate: e.target.value }) }
                  : { defaultValue: lead.followUpDate })}
              />
            </div>
            <div>
              <FieldLabel>Agent Name</FieldLabel>
              <Input
                {...(c
                  ? { value: lead.agentName, onChange: (e) => c({ agentName: e.target.value }) }
                  : { defaultValue: lead.agentName })}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
