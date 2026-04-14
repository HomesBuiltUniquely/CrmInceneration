"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lead } from "@/lib/data";
import {
  fetchActiveDesigners,
  fetchAvailableSlots,
  type AvailableSlotRow,
} from "@/lib/appointment-client";
import { fetchCrmPipeline } from "@/lib/crm-pipeline";
import {
  isMeetingCancelledSubstage,
  isMeetingScheduleSubstage,
  requiresResoneField,
} from "@/lib/milestone-substage-map";
import { shouldOpenQuoteSentPanelInCompleteTask } from "@/lib/quote-email-stage";
import { Button, FieldLabel, Input, Select, Textarea } from "./ui";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type SubStatusMapping = {
  stage: string;
  stageCategory: string;
  subStageName: string;
};

function toDateTimeLocalValue(value: string) {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(`${value} 11:00 AM`);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  const hours = String(parsedDate.getHours()).padStart(2, "0");
  const minutes = String(parsedDate.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export type CompleteTaskApiPayload = {
  feedback: string;
  milestoneStage: string;
  milestoneStageCategory: string;
  note: string;
  /** ISO-ish datetime for follow-up; empty when using `meetingAppointment` (server derives from slot). */
  nextCallDateLocal: string;
  /** Sent as `resone` on PUT when path category is LOST. */
  lostReason?: string;
  meetingAppointment?: {
    designerName: string;
    date: string;
    slotId: string;
  };
};

export default function CompleteTaskModal({
  lead,
  open,
  onClose,
  onSave,
  onApiComplete,
  onPhoneCall,
  quoteInline,
}: {
  lead: Lead;
  open: boolean;
  onClose: () => void;
  /** Legacy: local-only status update */
  onSave?: (status: string) => void;
  /** CRM API: PUT details + POST note */
  onApiComplete?: (payload: CompleteTaskApiPayload) => Promise<void>;
  /** Log `POST …/activity` with type CALL before opening the dialer. */
  onPhoneCall?: () => void | Promise<void>;
  /** Quote Sent popup when Status = Experience & Design + Feedback = Quote Sent. */
  quoteInline?: {
    quoteLink: string;
    onQuoteLinkChange: (v: string) => void;
    subject: string;
    onSubjectChange: (v: string) => void;
    body: string;
    onBodyChange: (v: string) => void;
    onSend: () => void | Promise<void>;
    sending: boolean;
  };
}) {
  const defaultNextCallDate = useMemo(() => {
    return toDateTimeLocalValue(lead.followUpDate);
  }, [lead.followUpDate]);

  const [nextCallDate, setNextCallDate] = useState(defaultNextCallDate);
  const [feedback, setFeedback] = useState(lead.status);
  const [status, setStatus] = useState("");
  const [path, setPath] = useState("");
  const [note, setNote] = useState("");
  const [feedbackMappings, setFeedbackMappings] = useState<SubStatusMapping[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [apiBusy, setApiBusy] = useState(false);
  const [apiError, setApiError] = useState("");
  const [meetingDesigner, setMeetingDesigner] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [designerOptions, setDesignerOptions] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlotRow[]>([]);
  const [designersLoading, setDesignersLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [quotePopupDismissed, setQuotePopupDismissed] = useState(false);

  const minAppointmentDate = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  const scheduleMode = Boolean(onApiComplete && isMeetingScheduleSubstage(feedback));
  const cancelMode = Boolean(onApiComplete && isMeetingCancelledSubstage(feedback));

  const quotePopupOpen =
    Boolean(
      quoteInline &&
        onApiComplete &&
        shouldOpenQuoteSentPanelInCompleteTask(status, feedback) &&
        !quotePopupDismissed
    );

  useEffect(() => {
    if (!shouldOpenQuoteSentPanelInCompleteTask(status, feedback)) {
      setQuotePopupDismissed(false);
    }
  }, [status, feedback]);

  useEffect(() => {
    if (!open) {
      setQuotePopupDismissed(false);
      return;
    }

    setNextCallDate(defaultNextCallDate);
    setFeedback(lead.status);
    setStatus("");
    setPath("");
    setNote("");
    setFeedbackMappings([]);
    setShowErrors(false);
    setMeetingDesigner("");
    setAppointmentDate("");
    setSelectedSlotId("");
    setAvailableSlots([]);
    setCancelConfirmed(false);
    setApiError("");
    setLostReason(lead.lostReason?.trim() ?? "");
  }, [defaultNextCallDate, lead.lostReason, lead.status, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function loadSubStatuses() {
      setFeedbackLoading(true);
      setFeedbackError("");

      try {
        let mappings: SubStatusMapping[] = [];

        try {
          const pipeline = await fetchCrmPipeline(true);
          mappings = pipeline.entries.map((e) => ({
            stage: e.stage,
            stageCategory: e.stageCategory,
            subStageName: e.subStageName,
          }));
        } catch (pipelineError) {
          // Fallback to existing milestone endpoint if pipeline is not reachable.
          const response = await fetch("/api/milestone-count?resource=sub-status", {
            method: "GET",
            cache: "no-store",
          });

          if (!response.ok) {
            throw new Error(`Request failed with ${response.status}`);
          }

          const data: { mappings?: SubStatusMapping[] } = await response.json();
          mappings = Array.isArray(data.mappings) ? data.mappings : [];
          if (mappings.length === 0) {
            throw pipelineError;
          }
        }

        if (!cancelled) {
          setFeedbackMappings(mappings);
          setFeedback("");
          setStatus("");
          setPath("");
        }
      } catch (error) {
        if (!cancelled) {
          setFeedbackError(error instanceof Error ? error.message : "Could not load feedback options");
          setFeedbackMappings([]);
          setFeedback("");
          setStatus("");
          setPath("");
        }
      } finally {
        if (!cancelled) {
          setFeedbackLoading(false);
        }
      }
    }

    loadSubStatuses();

    return () => {
      cancelled = true;
    };
  }, [lead.status, open]);

  useEffect(() => {
    if (!open || !scheduleMode) {
      return;
    }
    let cancelled = false;
    setDesignersLoading(true);
    void fetchActiveDesigners()
      .then((names) => {
        if (!cancelled) setDesignerOptions(names);
      })
      .catch(() => {
        if (!cancelled) setDesignerOptions([]);
      })
      .finally(() => {
        if (!cancelled) setDesignersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, scheduleMode]);

  useEffect(() => {
    if (!open || !scheduleMode || !meetingDesigner.trim() || !appointmentDate.trim()) {
      setAvailableSlots([]);
      setSelectedSlotId("");
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    void fetchAvailableSlots(appointmentDate.trim(), meetingDesigner.trim())
      .then((res) => {
        if (cancelled) return;
        const rows = res.availableSlots ?? [];
        setAvailableSlots(rows);
        setSelectedSlotId((prev) => (rows.some((r) => r.slotId === prev && r.available !== false) ? prev : ""));
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableSlots([]);
          setSelectedSlotId("");
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentDate, meetingDesigner, open, scheduleMode]);

  const feedbackEnabled = nextCallDate.trim().length > 0 || Boolean(onApiComplete);
  const statusEnabled = feedbackEnabled && !feedbackLoading;
  const pathEnabled = statusEnabled && status.trim().length > 0;
  const feedbackSelectEnabled = pathEnabled && path.trim().length > 0;
  const statusOptions = useMemo(
    () =>
      Array.from(new Set(feedbackMappings.map((m) => m.stage.trim()))).filter(
        (value) => value.length > 0
      ),
    [feedbackMappings]
  );
  const pathOptions = useMemo(
    () =>
      Array.from(
        new Set(
          feedbackMappings
            .filter((m) => m.stage === status)
            .map((m) => m.stageCategory.trim())
        )
      ).filter((value) => value.length > 0),
    [feedbackMappings, status]
  );
  const feedbackOptions = useMemo(
    () =>
      Array.from(
        new Set(
          feedbackMappings
            .filter((m) => m.stage === status && m.stageCategory === path)
            .map((m) => m.subStageName.trim())
        )
      ).filter((value) => value.length > 0),
    [feedbackMappings, path, status]
  );
  const reasonRequired = requiresResoneField(path, feedback);
  const nextCallDateMissing =
    !scheduleMode && !cancelMode && !reasonRequired && nextCallDate.trim().length === 0;
  const resoneMissing = Boolean(onApiComplete && reasonRequired && lostReason.trim().length === 0);
  const noteMissing = note.trim().length === 0;
  const feedbackMissing = feedback.trim().length === 0;
  const meetingFieldsMissing =
    scheduleMode &&
    (!meetingDesigner.trim() || !appointmentDate.trim() || !selectedSlotId.trim());
  const emailMissingForMeeting = scheduleMode && !isValidEmail(lead.email);

  if (!open) {
    return null;
  }

  const handleSave = async () => {
    setShowErrors(true);

    if (cancelMode && !cancelConfirmed) {
      setApiError("Please confirm meeting cancellation below.");
      return;
    }

    if (scheduleMode && emailMissingForMeeting) {
      setApiError("Add a valid customer email on the lead (Lead tab) before scheduling.");
      return;
    }

    if (scheduleMode && designerEmailMissingForMeeting) {
      setApiError(
        "Add design preference email for the designer (Assignments tab) — used for Google/Meet copy and Design QA.",
      );
      return;
    }

    if (scheduleMode && meetingFieldsMissing) {
      setApiError("Select designer, date, and an available slot.");
      return;
    }

    const selectedSlot = availableSlots.find((s) => s.slotId === selectedSlotId);
    if (scheduleMode && selectedSlot && selectedSlot.available === false) {
      setApiError("This slot is not available. Pick another slot.");
      return;
    }

    if (resoneMissing) {
      setApiError("Reason (resone) is required for LOST or this closure substage.");
      return;
    }

    if (nextCallDateMissing || noteMissing || feedbackMissing) {
      return;
    }

    if (onApiComplete) {
      setApiBusy(true);
      setApiError("");
      try {
        await onApiComplete({
          feedback,
          milestoneStage: status,
          milestoneStageCategory: path,
          note,
          nextCallDateLocal: scheduleMode ? "" : nextCallDate,
          lostReason: reasonRequired ? lostReason.trim() : undefined,
          meetingAppointment: scheduleMode
            ? {
                designerName: meetingDesigner.trim(),
                date: appointmentDate.trim(),
                slotId: selectedSlotId.trim(),
              }
            : undefined,
        });
        onClose();
      } catch (e) {
        setApiError(e instanceof Error ? e.message : "Could not save");
      } finally {
        setApiBusy(false);
      }
      return;
    }

    onSave?.(feedback);
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-[2px]">
      <div className="w-full max-w-[560px] max-h-[85vh] overflow-y-auto rounded-[18px] border border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--crm-border)] px-4 py-4 md:px-4">
          <div className="flex min-w-0 items-start gap-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[var(--crm-accent-soft)] text-[var(--crm-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 fill-none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 4h3a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h3" />
                <path d="M9 12.75 16.5 5.25a2.12 2.12 0 1 1 3 3L12 15.75 8 16l.25-4Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-[12px] font-semibold tracking-[-0.02em] text-[var(--crm-text-primary)] md:text-[18px]">
                Add note
              </h2>
              <p className="mt-0.5 text-[12px] text-[var(--crm-text-muted)] md:text-[12px]">
                {lead.customerId} <span className="px-1 text-slate-400">·</span>{" "}
                Lead note
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] text-[var(--crm-text-muted)] transition hover:border-[var(--crm-border-strong)] hover:text-[var(--crm-text-primary)]"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 md:px-6 md:py-5">
          <div className="rounded-[18px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3.5 md:p-4">
            <FieldLabel>PHONE NUMBER</FieldLabel>
            <div className="mt-2 flex gap-2.5">
              <Input
                value={lead.phone}
                readOnly
                className="h-[48px] rounded-[14px] border-[var(--crm-border)] bg-[var(--crm-input-bg)] px-4 text-[15px] font-medium tracking-[0.02em] text-[var(--crm-text-primary)]"
              />
              <button
                type="button"
                disabled={!lead.phone?.trim()}
                onClick={() => {
                  void (async () => {
                    try {
                      await onPhoneCall?.();
                    } catch {
                      /* still open dialer */
                    }
                    const n = lead.phone.replace(/\s+/g, "");
                    if (n) window.location.href = `tel:${n}`;
                  })();
                }}
                className="inline-flex h-[48px] shrink-0 items-center justify-center gap-2 rounded-[14px] border border-[#5e933f] bg-[#e5efd8] px-4 text-[14px] font-medium text-[#2d6b2e] transition hover:bg-[#ddeac9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 fill-none"
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
            </div>
            <div className="mt-3 rounded-[14px] border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3.5 py-2.5 text-[12px] text-[var(--crm-text-muted)]">
              <div className="flex items-start gap-2.5">
                <svg
                  viewBox="0 0 24 24"
                  className="mt-0.5 h-4 w-4 shrink-0 fill-none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
                <p>
                  After calling, update feedback and next call date before
                  saving.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {/* Next Call Date */}
            <div>
              <div className=" flex items-center gap-2">
                <FieldLabel required={!scheduleMode && !cancelMode && !reasonRequired}>Next call date</FieldLabel>
                {!scheduleMode && !cancelMode && !reasonRequired ? (
                  <span className="text-[12px] text-[var(--crm-danger)]">required</span>
                ) : (
                  <span className="text-[12px] text-[var(--crm-text-muted)]">optional</span>
                )}
              </div>

              <Input
                type="datetime-local"
                value={nextCallDate}
                onChange={(e) => setNextCallDate(e.target.value)}
                onClick={(event) => {
                  const input = event.currentTarget as HTMLInputElement & {
                    showPicker?: () => void;
                  };
                  input.showPicker?.();
                }}
                missing={showErrors && nextCallDateMissing && !reasonRequired}
                className="h-[42px] rounded-[12px] bg-[var(--crm-input-bg)] text-[14px]"
              />

              <p className="mt-1 text-[12px] text-[var(--crm-text-muted)]">
                {scheduleMode
                  ? "For Meeting Scheduled / Rescheduled, the Hub appointment time will be used as follow-up."
                  : "Click the field to open calendar and time picker."}
              </p>
              {showErrors && nextCallDateMissing && (
                <p className="mt-1 text-[12px] text-red-500">
                  Next call date is required unless a reason (resone) applies below (LOST / closure substages) or you use meeting scheduling only.
                </p>
              )}
            </div>

            {/* Status */}
            <div>
              <FieldLabel>Status</FieldLabel>
              <Select
                value={status}
                onChange={(e) => {
                  const nextStatus = e.target.value;
                  setStatus(nextStatus);
                  setPath("");
                  setFeedback("");
                }}
                disabled={!statusEnabled}
                className={[
                  "h-[42px] rounded-[12px] bg-[var(--crm-input-bg)] text-[14px]",
                  !statusEnabled ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                <option value="">
                  {!statusEnabled
                    ? "Wait…"
                    : !onApiComplete && !feedbackEnabled
                      ? "Select next call date first"
                      : "Select status"}
                </option>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>

            {/* Path */}
            <div>
              <FieldLabel>Path</FieldLabel>
              <Select
                value={path}
                onChange={(e) => {
                  setPath(e.target.value);
                  setFeedback("");
                }}
                disabled={!pathEnabled}
                className={[
                  "h-[42px] rounded-[12px] bg-[var(--crm-input-bg)] text-[14px]",
                  !pathEnabled ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                <option value="">{pathEnabled ? "Select path" : "Select status first"}</option>
                {pathOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>

            {/* Feedback */}
            <div>
              <FieldLabel required>Feedback</FieldLabel>
              <Select
                value={feedback}
                onChange={(e) => {
                  setFeedback(e.target.value);
                }}
                disabled={!feedbackSelectEnabled}
                className={[
                  "h-[42px] rounded-[12px] bg-[var(--crm-input-bg)] text-[14px]",
                  !feedbackSelectEnabled ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                <option value="">{feedbackSelectEnabled ? "Select feedback" : "Select path first"}</option>
                {feedbackOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>

              {feedbackLoading && (
                <p className="mt-1 text-[12px] text-[var(--crm-text-muted)]">
                  Loading feedback options...
                </p>
              )}
              {!onApiComplete && !feedbackEnabled && (
                <p className="mt-1 text-[12px] text-red-500">
                  Please select next call date first
                </p>
              )}
              {feedbackError && (
                <p className="mt-1 text-[12px] text-amber-600">
                  Using current status because sub-status list could not be loaded.
                </p>
              )}
              {showErrors && feedbackMissing && (
                <p className="mt-1 text-[12px] text-red-500">
                  Feedback is required.
                </p>
              )}
            </div>

            {scheduleMode ? (
              <div className="rounded-[14px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3.5 space-y-3">
                <p className="text-[13px] font-semibold text-[var(--crm-text-primary)]">Hub meeting (Connection)</p>
                <p className="text-[11px] text-[var(--crm-text-muted)]">
                  Pick designer, date, and slot. Hub creates the booking; description uses: Meeting with [Lead type] - Lead ID: [id].
                </p>
                <p className="text-[11px] text-[var(--crm-text-muted)]">
                  After the meeting is fixed, Hub typically sends <strong className="font-medium text-[var(--crm-text-secondary)]">two</strong> emails:{" "}
                  <span className="text-[var(--crm-text-secondary)]">(1) Google Calendar / Meet</span> to the customer (lead email) and participants, and{" "}
                  <span className="text-[var(--crm-text-secondary)]">(2) Design QA</span> to the designer channel configured by Hub.
                </p>
                <div>
                  <FieldLabel required>Designer</FieldLabel>
                  <Select
                    value={meetingDesigner}
                    onChange={(e) => {
                      setMeetingDesigner(e.target.value);
                      setSelectedSlotId("");
                    }}
                    disabled={designersLoading}
                    className="h-[42px] rounded-[12px] bg-[var(--crm-input-bg)] text-[14px]"
                  >
                    <option value="">{designersLoading ? "Loading designers…" : "Select designer"}</option>
                    {designerOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel required>Date</FieldLabel>
                  <Input
                    type="date"
                    min={minAppointmentDate}
                    value={appointmentDate}
                    onChange={(e) => {
                      setAppointmentDate(e.target.value);
                      setSelectedSlotId("");
                    }}
                    className="h-[42px] rounded-[12px] bg-[var(--crm-input-bg)] text-[14px]"
                  />
                </div>
                <div>
                  <FieldLabel required>Slot</FieldLabel>
                  <Select
                    value={selectedSlotId}
                    onChange={(e) => setSelectedSlotId(e.target.value)}
                    disabled={slotsLoading || !availableSlots.length}
                    className="h-[42px] rounded-[12px] bg-[var(--crm-input-bg)] text-[14px]"
                  >
                    <option value="">
                      {slotsLoading
                        ? "Loading slots…"
                        : !meetingDesigner.trim() || !appointmentDate.trim()
                          ? "Select designer and date"
                          : availableSlots.length === 0
                            ? "No slots"
                            : "Select slot"}
                    </option>
                    {availableSlots
                      .filter((s) => s.available !== false)
                      .map((s) => (
                        <option key={s.slotId} value={s.slotId}>
                          {s.displayName ?? s.slotId}
                          {s.startTime ? ` (${s.startTime})` : ""}
                        </option>
                      ))}
                  </Select>
                </div>
                {scheduleMode && showErrors && emailMissingForMeeting ? (
                  <p className="text-[12px] text-rose-600">
                    Add a valid customer email on the Lead tab.
                  </p>
                ) : null}
              </div>
            ) : null}

            {onApiComplete && reasonRequired ? (
              <div>
                <FieldLabel required>Reason (resone)</FieldLabel>
                <p className="mt-1 text-[11px] text-[var(--crm-text-muted)]">
                  Required for LOST paths and for: Project cancelled after token / after booking, Refund processed.
                </p>
                <Textarea
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  placeholder="Enter reason for LOST or closure substage…"
                  className={[
                    "mt-2 w-full min-h-[88px] rounded-[14px] bg-[var(--crm-input-bg)]",
                    showErrors && resoneMissing ? "border border-red-500" : "",
                  ].join(" ")}
                />
                {showErrors && resoneMissing ? (
                  <p className="mt-1 text-[12px] text-red-500">Reason is required for this feedback.</p>
                ) : null}
              </div>
            ) : null}

            {cancelMode ? (
              <div className="rounded-[14px] border border-amber-200/80 bg-amber-50/90 dark:border-amber-900/50 dark:bg-amber-950/40 p-3.5">
                <p className="text-[12px] font-semibold text-amber-900 dark:text-amber-100">
                  Cancel meeting
                </p>
                <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200/90">
                  This updates the lead to the cancellation milestone. The backend may email the customer and remove the Hub
                  appointment when the substage is saved as &quot;Meeting Cancelled&quot;.
                </p>
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-[12px] text-[var(--crm-text-primary)]">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[var(--crm-accent)]"
                    checked={cancelConfirmed}
                    onChange={(e) => setCancelConfirmed(e.target.checked)}
                  />
                  <span>I confirm cancelling this meeting for this lead.</span>
                </label>
              </div>
            ) : null}

            {/* Note */}
            <div>
              <FieldLabel required>Note</FieldLabel>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Enter your note here..."
                className={[
                  "mt-2 w-full min-h-[110px] rounded-[14px] bg-[var(--crm-input-bg)]",
                  showErrors && noteMissing ? "border-red-500 bg-red-100" : "",
                ].join(" ")}
              />
              {showErrors && noteMissing && (
                <p className="mt-1 text-[12px] text-red-500">
                  Note is required.
                </p>
              )}
            </div>
          </div>
        </div>

        {apiError ? (
          <p className="border-t border-[var(--crm-border)] bg-[var(--crm-danger-bg)] px-4 py-2 text-[12px] text-[var(--crm-danger-text)] md:px-5">{apiError}</p>
        ) : null}
        <div className="flex flex-col-reverse items-stretch justify-end gap-2 border-t border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-4 py-3 md:flex-row md:px-5">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={apiBusy}
            className="h-[40px] rounded-[12px] border-[var(--crm-border)] bg-[var(--crm-surface)] px-5 text-[13px] font-medium text-[var(--crm-text-primary)] hover:border-[var(--crm-border-strong)]"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            disabled={apiBusy}
            className="h-[40px] rounded-[12px] border border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)] px-5 text-[13px] font-medium text-[var(--crm-accent)] shadow-none hover:translate-y-0"
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 fill-none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                <path d="M17 21v-8H7v8" />
                <path d="M7 3v5h8" />
              </svg>
            }
          >
            Save note
          </Button>
        </div>
      </div>
    </div>

    {quotePopupOpen && quoteInline ? (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-sent-popup-title"
        onClick={() => setQuotePopupDismissed(true)}
      >
        <div
          className="w-full max-w-md rounded-[18px] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5 shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3
                id="quote-sent-popup-title"
                className="text-[15px] font-semibold text-[var(--crm-text-primary)]"
              >
                Quote Sent
              </h3>
              <p className="mt-1 text-[11px] text-[var(--crm-text-muted)]">
                Experience &amp; Design — add link and send quote email, or close and continue your note.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setQuotePopupDismissed(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] text-[var(--crm-text-muted)] hover:text-[var(--crm-text-primary)]"
              aria-label="Close quote panel"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <FieldLabel>Quote link</FieldLabel>
              <Input
                value={quoteInline.quoteLink}
                onChange={(e) => quoteInline.onQuoteLinkChange(e.target.value)}
                placeholder="https://… (PDF or proposal URL)"
                className="mt-1.5"
              />
            </div>
            <div className="rounded-[14px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3.5 space-y-3">
              <p className="text-[12px] font-semibold text-[var(--crm-text-primary)]">Send quote email</p>
              <div>
                <FieldLabel>Email subject</FieldLabel>
                <Input
                  value={quoteInline.subject}
                  onChange={(e) => quoteInline.onSubjectChange(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <FieldLabel>Email body</FieldLabel>
                <Textarea
                  value={quoteInline.body}
                  onChange={(e) => quoteInline.onBodyChange(e.target.value)}
                  className="mt-1.5 min-h-[72px]"
                  placeholder="Message shown in the email…"
                />
              </div>
              <Button
                type="button"
                variant="primary"
                disabled={quoteInline.sending}
                onClick={() => void quoteInline.onSend()}
              >
                {quoteInline.sending ? "Sending…" : "Send quote email"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
