"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle, FieldLabel, Input, Textarea, Select, Chip, Button } from "./ui";
import type { Lead } from "@/lib/data";
import { BUDGET_OPTIONS, LANGUAGE_OPTIONS, LEAD_SOURCES } from "@/lib/data";
import { isExperienceDesignQuoteSentStage } from "@/lib/quote-email-stage";
import { shouldShowDesignQaLink } from "@/lib/lead-design-qa-visibility";
import { useGlobalNotifier } from "../Shared/GlobalNotifier";

function meetingTypeDisplay(value: string): string {
  const raw = value.trim();
  if (!raw) return "—";
  const key = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (key === "SHOWROOM_VISIT") return "Showroom Visit";
  if (key === "VIRTUAL_MEETING") return "Virtual Meeting";
  if (key === "SITE_VISIT") return "Site Visit";
  return raw;
}

const DESIGN_QA_BASE_URL = "https://design.hubinterior.com/DesignQA?id=";
const DESIGN_QA_STATE_KEY_PREFIX = "crm_designqa_state_";

type DesignQaState = {
  active: boolean;
  version: number;
  lastTrigger: string;
};

function isDiscoveryStage(lead: Lead): boolean {
  const normalizeLabel = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, " ");
  const milestoneStage = normalizeLabel(lead.stageBlock?.milestoneStage ?? "");
  const legacyStage = normalizeLabel(lead.stageBlock?.stage ?? "");
  return milestoneStage.includes("discovery") || legacyStage.includes("discovery");
}

function buildDesignQaLink(lead: Lead, version: number): string | null {
  const businessLeadId = (lead.leadId ?? "").trim();
  if (!businessLeadId) return null;
  const base = `${DESIGN_QA_BASE_URL}${encodeURIComponent(businessLeadId)}`;
  if (version <= 0) return base;
  return `${base}&v=${version}`;
}

type Props = {
  lead: Lead;
  /** When set, fields are controlled and edits merge into parent state (API detail page). */
  onLeadChange?: (patch: Partial<Lead>) => void;
  /** Save callback for Additional Information section when user clicks Done. */
  onAdditionalInfoSave?: () => void | Promise<void>;
  /** Logs `POST …/activity` with CALL then opens dialer — API lead details only. */
  onLogCall?: () => void | Promise<void>;
  /** Optional activity hook for Design QA link copy tracking. */
  onDesignQaLinkCopied?: (link: string) => void | Promise<void>;
  /** Quote email (`POST /v1/quote/send`) — only on API-backed lead details. */
  quoteExtras?: {
    subject: string;
    body: string;
    onSubjectChange: (v: string) => void;
    onBodyChange: (v: string) => void;
    onSendQuote: () => void | Promise<void>;
    quoteSending: boolean;
    quotePersisting?: boolean;
    quoteLinkPersistError?: string;
    onRetrySaveQuoteLink?: () => void | Promise<void>;
  };
};

export default function LeadInfoTab({
  lead,
  onLeadChange,
  onAdditionalInfoSave,
  onLogCall,
  onDesignQaLinkCopied,
  quoteExtras,
}: Props) {
  const c = onLeadChange;
  const { notifySuccess, notifyError } = useGlobalNotifier();
  const [additionalInfoEditable, setAdditionalInfoEditable] = useState(false);
  const quoteEligible =
    Boolean(c && quoteExtras && isExperienceDesignQuoteSentStage(lead));
  const [designQaState, setDesignQaState] = useState<DesignQaState>({
    active: false,
    version: 0,
    lastTrigger: "",
  });
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [lockedIdentityFields, setLockedIdentityFields] = useState({
    name: false,
    email: false,
    phone: false,
    pincode: false,
  });

  useEffect(() => {
    if (!quoteEligible) setQuoteOpen(false);
  }, [quoteEligible]);

  useEffect(() => {
    setLockedIdentityFields({
      // Lock only if backend already had a value for this lead.
      name: Boolean((lead.name ?? "").trim()),
      email: Boolean((lead.email ?? "").trim()),
      phone: Boolean((lead.phone ?? "").trim()),
      pincode: Boolean((lead.pincode ?? "").trim()),
    });
  }, [lead.id]);

  useEffect(() => {
    const storageKey = `${DESIGN_QA_STATE_KEY_PREFIX}${lead.id}`;
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setDesignQaState({ active: false, version: 0, lastTrigger: "" });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<DesignQaState>;
      setDesignQaState({
        active: Boolean(parsed.active),
        version:
          typeof parsed.version === "number" && Number.isFinite(parsed.version)
            ? parsed.version
            : 0,
        lastTrigger: typeof parsed.lastTrigger === "string" ? parsed.lastTrigger : "",
      });
    } catch {
      setDesignQaState({ active: false, version: 0, lastTrigger: "" });
    }
  }, [lead.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = `${DESIGN_QA_STATE_KEY_PREFIX}${lead.id}`;
    if (isDiscoveryStage(lead)) {
      const next = { active: false, version: 0, lastTrigger: "" };
      setDesignQaState(next);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return;
    }
    const meetingNow = shouldShowDesignQaLink(lead);
    if (!meetingNow) return;
    const trigger = [
      lead.stageBlock?.milestoneStage ?? "",
      lead.stageBlock?.milestoneSubStage ?? "",
      lead.status ?? "",
    ]
      .map((s) => s.trim())
      .join("|");
    setDesignQaState((prev) => {
      const shouldBumpVersion = !prev.active || prev.lastTrigger !== trigger;
      const next: DesignQaState = {
        active: true,
        version: shouldBumpVersion ? prev.version + 1 : prev.version,
        lastTrigger: trigger,
      };
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }, [lead]);

  /** Backend `designQaLink` when persisted / computed on GET; else client fallback while Meeting Scheduled + leadId. */
  const apiDesignQaLink = (lead.designQaLink ?? "").trim();
  const computedDesignQaLink =
    !apiDesignQaLink && shouldShowDesignQaLink(lead) && !isDiscoveryStage(lead)
      ? buildDesignQaLink(lead, designQaState.version)
      : null;
  const designQaLink = apiDesignQaLink || computedDesignQaLink;
  const [additionalInfoSaving, setAdditionalInfoSaving] = useState(false);
  const normalizedBudget = lead.budget?.trim() ?? "";
  const budgetOptions = normalizedBudget && !BUDGET_OPTIONS.includes(normalizedBudget)
    ? [normalizedBudget, ...BUDGET_OPTIONS]
    : BUDGET_OPTIONS;

  const handleAdditionalInfoToggle = async () => {
    if (!additionalInfoEditable) {
      setAdditionalInfoEditable(true);
      return;
    }
    if (!onAdditionalInfoSave) {
      setAdditionalInfoEditable(false);
      return;
    }
    try {
      setAdditionalInfoSaving(true);
      await onAdditionalInfoSave();
      setAdditionalInfoEditable(false);
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Could not save additional info.");
    } finally {
      setAdditionalInfoSaving(false);
    }
  };

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
                ? {
                    value: lead.name,
                    onChange: (e) => c({ name: e.target.value }),
                    readOnly: lockedIdentityFields.name,
                  }
                : { defaultValue: lead.name, readOnly: lockedIdentityFields.name })}
            />
          </div>

          <div className="mb-4">
            <FieldLabel required>Email Address</FieldLabel>
            <Input
              type="email"
              placeholder="Not provided — add email"
              missing={!lead.email}
              {...(c
                ? {
                    value: lead.email,
                    onChange: (e) => c({ email: e.target.value }),
                    readOnly: lockedIdentityFields.email,
                  }
                : { defaultValue: lead.email, readOnly: lockedIdentityFields.email })}
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
              <div className="mt-1.5">
                <Input
                  className="min-w-0"
                  {...(c
                    ? {
                        value: lead.phone,
                        onChange: (e) => c({ phone: e.target.value }),
                        readOnly: lockedIdentityFields.phone,
                      }
                    : { defaultValue: lead.phone, readOnly: lockedIdentityFields.phone })}
                />
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
                  ? {
                      value: lead.pincode,
                      onChange: (e) => c({ pincode: e.target.value }),
                      readOnly: lockedIdentityFields.pincode,
                    }
                  : { defaultValue: lead.pincode, readOnly: lockedIdentityFields.pincode })}
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
            action={
              <Button
                variant="ghost"
                className="!py-1 !px-3 !text-[11px]"
                onClick={() => void handleAdditionalInfoToggle()}
                disabled={additionalInfoSaving}
              >
                {additionalInfoSaving
                  ? "Saving..."
                  : additionalInfoEditable
                    ? "Done"
                    : "✎ Update"}
              </Button>
            }
          >
            Additional Information
          </CardTitle>

          <div className="grid grid-cols-2 gap-3.5 mb-4">
            <div>
              <FieldLabel>Budget</FieldLabel>
              <Select
                {...(c
                  ? { value: lead.budget, onChange: (e) => c({ budget: e.target.value }) }
                  : { defaultValue: lead.budget })}
                disabled={!additionalInfoEditable}
              >
                <option value="">Select Budget</option>
                {budgetOptions.map((budget) => (
                  <option key={budget} value={budget}>
                    {budget}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel>Language Preferred</FieldLabel>
              <Select
                {...(c
                  ? { value: lead.language, onChange: (e) => c({ language: e.target.value }) }
                  : { defaultValue: lead.language })}
                disabled={!additionalInfoEditable}
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
                disabled={!additionalInfoEditable}
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
              <Input value={meetingTypeDisplay(lead.meetingType)} readOnly />
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
              readOnly={!additionalInfoEditable}
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
                Meeting Successful
              </button>
              <p className="mt-2 text-[11px] text-[var(--crm-text-muted)]">
                Shown when milestone is <strong className="text-[var(--crm-text-secondary)]">Experience and Design</strong> and
                feedback is <strong className="text-[var(--crm-text-secondary)]">MEETING SUCCESSFUL</strong>. Use Complete Task to save that stage first.
              </p>

              {quoteOpen && quoteExtras ? (
                <div className="mt-4">
                  <div>
                    <FieldLabel>Quote link</FieldLabel>
                    <div className="mt-1.5 flex gap-2">
                      <Input
                        placeholder="https://… (PDF or proposal URL)"
                        value={lead.quoteLink ?? ""}
                        readOnly
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="primary"
                        disabled={quoteExtras.quoteSending || quoteExtras.quotePersisting}
                        onClick={() => void quoteExtras.onSendQuote()}
                      >
                        {quoteExtras.quoteSending ? "Sending…" : "Send"}
                      </Button>
                    </div>
                    {quoteExtras.quoteLinkPersistError ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <p className="text-[11px] text-amber-600">
                          Quote generated, but saving quote link failed. Please retry.
                        </p>
                        {quoteExtras.onRetrySaveQuoteLink ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="!h-7 !px-2.5 !py-0 text-[11px]"
                            disabled={quoteExtras.quotePersisting}
                            onClick={() => void quoteExtras.onRetrySaveQuoteLink?.()}
                          >
                            {quoteExtras.quotePersisting ? "Retrying..." : "Retry Save Quote Link"}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="mt-1 text-[11px] text-[var(--crm-text-muted)]">
                      Auto-mapped quote link (read-only). Use Send to email quote.
                    </p>
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

          {designQaLink ? (
            <div className="mt-3.5">
              <FieldLabel>
                Design QA Link
                {apiDesignQaLink ? (
                  <span className="ml-1.5 font-normal normal-case text-[var(--crm-text-muted)]">
                    (read-only, from CRM)
                  </span>
                ) : null}
              </FieldLabel>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Input
                  value={designQaLink}
                  readOnly
                  className="h-[34px] min-w-0 flex-1 px-2.5 text-[11px]"
                />
                <button
                  type="button"
                  aria-label="Copy Design QA Link"
                  className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] text-[var(--crm-text-primary)] transition hover:bg-[var(--crm-surface)]"
                  onClick={() => {
                    void (async () => {
                      try {
                        await navigator.clipboard.writeText(designQaLink);
                        notifySuccess("Design QA Link copied");
                        await onDesignQaLinkCopied?.(designQaLink);
                      } catch {
                        notifyError("Unable to copy link. Please copy manually.");
                      }
                    })();
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 fill-none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="9" y="9" width="11" height="11" rx="2" />
                    <rect x="4" y="4" width="11" height="11" rx="2" />
                  </svg>
                </button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
