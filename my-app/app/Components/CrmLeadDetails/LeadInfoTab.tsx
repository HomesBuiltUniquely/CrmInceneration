"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle, FieldLabel, Input, Textarea, Select, Chip, Button } from "./ui";
import type { Lead } from "@/lib/data";
import { LANGUAGE_OPTIONS, LEAD_SOURCES, MEETING_TYPES } from "@/lib/data";
import { isExperienceDesignQuoteSentStage } from "@/lib/quote-email-stage";

type Props = {
  lead: Lead;
  /** When set, fields are controlled and edits merge into parent state (API detail page). */
  onLeadChange?: (patch: Partial<Lead>) => void;
  /** Logs `POST …/activity` with CALL then opens dialer — API lead details only. */
  onLogCall?: () => void | Promise<void>;
  /** Quote email (`POST /v1/quote/send`) — only on API-backed lead details. */
  quoteExtras?: {
    subject: string;
    body: string;
    onSubjectChange: (v: string) => void;
    onBodyChange: (v: string) => void;
    onSendQuote: () => void | Promise<void>;
    quoteSending: boolean;
  };
};

export default function LeadInfoTab({ lead, onLeadChange, onLogCall, quoteExtras }: Props) {
  const c = onLeadChange;
  const quoteEligible =
    Boolean(c && quoteExtras && isExperienceDesignQuoteSentStage(lead));
  const [quoteOpen, setQuoteOpen] = useState(false);

  useEffect(() => {
    if (!quoteEligible) setQuoteOpen(false);
  }, [quoteEligible]);

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
            <div className={c && onLogCall ? "col-span-2 sm:col-span-1" : ""}>
              <FieldLabel>Phone</FieldLabel>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
                <Input
                  className="min-w-0 flex-1"
                  {...(c
                    ? { value: lead.phone, onChange: (e) => c({ phone: e.target.value }) }
                    : { defaultValue: lead.phone })}
                />
                {c && onLogCall ? (
                  <button
                    type="button"
                    disabled={!lead.phone?.trim()}
                    onClick={() => {
                      void (async () => {
                        try {
                          await onLogCall();
                        } catch {
                          /* still dial */
                        }
                        const n = lead.phone.replace(/\s+/g, "");
                        if (n) window.location.href = `tel:${n}`;
                      })();
                    }}
                    className="inline-flex h-[42px] shrink-0 items-center justify-center gap-2 rounded-xl border border-[#5e933f] bg-[#e5efd8] px-4 text-[13px] font-semibold text-[#2d6b2e] transition hover:bg-[#ddeac9] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 shrink-0 fill-none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.63 2.63a2 2 0 0 1-.45 2.11L8 9.91a16 16 0 0 0 6.09 6.09l1.45-1.29a2 2 0 0 1 2.11-.45c.85.3 1.73.51 2.63.63A2 2 0 0 1 22 16.92Z" />
                    </svg>
                    Call
                  </button>
                ) : null}
              </div>
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

          {quoteEligible ? (
            <div className="mt-4 border-t border-[var(--crm-border)] pt-4">
              <button
                type="button"
                onClick={() => setQuoteOpen((v) => !v)}
                aria-expanded={quoteOpen}
                className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-[var(--crm-surface)] px-5 py-2.5 text-[13px] font-semibold tracking-tight text-slate-800 shadow-sm transition hover:bg-[var(--crm-surface-subtle)] dark:border-[var(--crm-border-strong)] dark:text-[var(--crm-text-primary)]"
              >
                <span className="text-[15px] leading-none" aria-hidden>
                  ✦
                </span>
                Quote Sent
              </button>
              <p className="mt-2 text-[11px] text-[var(--crm-text-muted)]">
                Shown when milestone is <strong className="text-[var(--crm-text-secondary)]">Experience and Design</strong> and
                feedback is <strong className="text-[var(--crm-text-secondary)]">Quote Sent</strong>. Use Complete Task to save that stage first.
              </p>

              {quoteOpen && quoteExtras ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <FieldLabel>Quote link</FieldLabel>
                    <Input
                      placeholder="https://… (PDF or proposal URL)"
                      value={lead.quoteLink ?? ""}
                      onChange={(e) => c?.({ quoteLink: e.target.value })}
                      className="mt-1.5"
                    />
                    <p className="mt-1 text-[11px] text-[var(--crm-text-muted)]">
                      Save other lead fields with Save Changes if needed, then send.
                    </p>
                  </div>
                  <div className="space-y-3 rounded-[14px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3.5">
                    <p className="text-[12px] font-semibold text-[var(--crm-text-primary)]">Send quote email</p>
                    <div>
                      <FieldLabel>Email subject</FieldLabel>
                      <Input
                        value={quoteExtras.subject}
                        onChange={(e) => quoteExtras.onSubjectChange(e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <FieldLabel>Email body</FieldLabel>
                      <Textarea
                        value={quoteExtras.body}
                        onChange={(e) => quoteExtras.onBodyChange(e.target.value)}
                        className="mt-1.5 min-h-[72px]"
                        placeholder="Message shown in the email…"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      disabled={quoteExtras.quoteSending}
                      onClick={() => void quoteExtras.onSendQuote()}
                    >
                      {quoteExtras.quoteSending ? "Sending…" : "Send quote email"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
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
