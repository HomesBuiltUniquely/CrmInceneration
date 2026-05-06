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
  isDesignRefinementSchedulingSubstage,
  isMeetingCancelledSubstage,
  isMeetingScheduleSubstage,
  meetingSchedulePanelTitle,
  requiresResoneField,
} from "@/lib/milestone-substage-map";
import {
  leadPropertyGateErrorMessage,
  missingLeadPropertyGateFields,
  requiresLeadPropertyGateForCompleteTask,
} from "@/lib/milestone-advance-gates";
import { Button, FieldLabel, Input, Select, Textarea } from "./ui";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type SubStatusMapping = {
  stage: string;
  stageCategory: string;
  subStageName: string;
};
type FeedbackOption = {
  label: string;
  stage: string;
  stageCategory: string;
  subStageName: string;
};

const MEETING_TYPE_OPTIONS = [
  { label: "Showroom Visit", value: "SHOWROOM_VISIT" },
  { label: "Virtual Meeting", value: "VIRTUAL_MEETING" },
  { label: "Site Visit", value: "SITE_VISIT" },
] as const;

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

function getTodayStartDateTimeLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T00:00`;
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
    meetingType?: "SHOWROOM_VISIT" | "VIRTUAL_MEETING" | "SITE_VISIT";
  };
};

export default function CompleteTaskModal({
  lead,
  open,
  onClose,
  onSave,
  onApiComplete,
  onPhoneCall,
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
}) {
  const defaultNextCallDate = useMemo(() => {
    return toDateTimeLocalValue(lead.followUpDate);
  }, [lead.followUpDate]);

  const [nextCallDate, setNextCallDate] = useState(defaultNextCallDate);
  const [feedback, setFeedback] = useState(lead.status);
  const [status, setStatus] = useState("");
  const [path, setPath] = useState("");
  const [note, setNote] = useState("");
  const [feedbackMappings, setFeedbackMappings] = useState<SubStatusMapping[]>(
    [],
  );
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [apiBusy, setApiBusy] = useState(false);
  const [apiError, setApiError] = useState("");
  const [gatePopupMessage, setGatePopupMessage] = useState("");
  const [meetingDesigner, setMeetingDesigner] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [meetingType, setMeetingType] = useState("");
  const [designerOptions, setDesignerOptions] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlotRow[]>([]);
  const [designersLoading, setDesignersLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const minNextCallDate = getTodayStartDateTimeLocal();

  const minAppointmentDate = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  const scheduleMode = Boolean(
    onApiComplete && isMeetingScheduleSubstage(feedback),
  );
  const cancelMode = Boolean(
    onApiComplete && isMeetingCancelledSubstage(feedback),
  );

  /** Hide the Budget / Property notes / Configuration hint once all three are filled on the lead. */
  const showLeadPropertyGateFooterHint = useMemo(
    () => missingLeadPropertyGateFields(lead).length > 0,
    [lead.budget, lead.propertyNotes, lead.configuration],
  );

  useEffect(() => {
    if (!open) {
      setGatePopupMessage("");
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
    setMeetingType("");
    setAvailableSlots([]);
    setCancelConfirmed(false);
    setApiError("");
    setGatePopupMessage("");
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
        const currentStage = (
          lead.stageBlock?.milestoneStage ??
          lead.status ??
          ""
        ).trim();

        try {
          const pipeline = await fetchCrmPipeline({
            nested: true,
            forCompleteTask: true,
            currentStage,
          });
          mappings = pipeline.entries.map((e) => ({
            stage: e.stage,
            stageCategory: e.stageCategory,
            subStageName: e.subStageName,
          }));
        } catch (pipelineError) {
          // Fallback to existing milestone endpoint only if complete-task
          // filtered endpoint is not reachable.
          const response = await fetch(
            "/api/milestone-count?resource=sub-status",
            {
              method: "GET",
              cache: "no-store",
            },
          );

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
          setFeedbackError(
            error instanceof Error
              ? error.message
              : "Could not load feedback options",
          );
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
  }, [lead.stageBlock?.milestoneStage, lead.status, open]);

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
    if (
      !open ||
      !scheduleMode ||
      !meetingDesigner.trim() ||
      !appointmentDate.trim()
    ) {
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
        setSelectedSlotId((prev) =>
          rows.some((r) => r.slotId === prev && r.available !== false)
            ? prev
            : "",
        );
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

  const feedbackOptions = useMemo<FeedbackOption[]>(() => {
    const seen = new Set<string>();
    const rows: FeedbackOption[] = [];
    for (const m of feedbackMappings) {
      const stage = m.stage.trim();
      const stageCategory = m.stageCategory.trim();
      const subStageName = m.subStageName.trim();
      if (!stage) continue;
      const label = subStageName || stage;
      const key = `${stage}||${stageCategory}||${label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ label, stage, stageCategory, subStageName });
    }
    return rows;
  }, [feedbackMappings]);
  const feedbackSelectEnabled = !feedbackLoading && feedbackOptions.length > 0;
  useEffect(() => {
    const selected = feedbackOptions.find((m) => m.label === feedback);
    if (selected) {
      if (status !== selected.stage) setStatus(selected.stage);
      if (path !== selected.stageCategory) setPath(selected.stageCategory);
      return;
    }
    if (!feedback.trim()) {
      if (status) setStatus("");
      if (path) setPath("");
    }
  }, [feedback, feedbackOptions, path, status]);
  const reasonRequired = requiresResoneField(path, feedback);
  const nextCallDateMissing =
    !scheduleMode &&
    !cancelMode &&
    !reasonRequired &&
    nextCallDate.trim().length === 0;
  const resoneMissing = Boolean(
    onApiComplete && reasonRequired && lostReason.trim().length === 0,
  );
  const noteMissing = note.trim().length === 0;
  const feedbackMissing = feedback.trim().length === 0;
  const meetingFieldsMissing =
    scheduleMode &&
    (!meetingDesigner.trim() ||
      !appointmentDate.trim() ||
      !selectedSlotId.trim() ||
      !meetingType.trim());
  const emailMissingForMeeting = scheduleMode && !isValidEmail(lead.email);
  const designerEmailMissingForMeeting =
    scheduleMode && !isValidEmail(lead.designerEmail || "");

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
      setApiError(
        "Add a valid customer email on the lead (Lead tab) before scheduling.",
      );
      return;
    }

    // Previously we blocked saving when the designer's design-preference email
    // was missing. That prevented the Save flow from calling the API and
    // sending emails. We now allow the save to proceed so the server/client
    // email-sending logic can run; if the designer email exists it will be
    // used to send the Design QA email, otherwise it will be skipped and we
    // show a non-blocking warning below (see UI render).

    if (scheduleMode && meetingFieldsMissing) {
      setApiError("Select designer, date, and an available slot.");
      return;
    }

    const selectedSlot = availableSlots.find(
      (s) => s.slotId === selectedSlotId,
    );
    if (scheduleMode && selectedSlot && selectedSlot.available === false) {
      setApiError("This slot is not available. Pick another slot.");
      return;
    }

    const needsLeadPropertyGate = requiresLeadPropertyGateForCompleteTask({
      currentMilestoneStage: lead.stageBlock?.milestoneStage,
      currentMilestoneSubStage: lead.stageBlock?.milestoneSubStage,
      currentMilestoneStageCategory: lead.stageBlock?.milestoneStageCategory,
      currentStatus: lead.status,
      newMilestoneStage: status,
      newStageCategory: path,
      cancelMode,
    });
    if (needsLeadPropertyGate) {
      const missing = missingLeadPropertyGateFields(lead);
      if (missing.length > 0) {
        const toConnection = status.trim().toLowerCase() === "connection";
        const popupMessage = toConnection
          ? "Fill all the details (Budget, Property notes, Configuration) before you update the milestone to Connection."
          : leadPropertyGateErrorMessage(missing);
        setApiError(popupMessage);
        setGatePopupMessage(popupMessage);
        return;
      }
    }

    if (resoneMissing) {
      setApiError(
        "Reason (resone) is required for LOST or this closure substage.",
      );
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
                meetingType: meetingType.trim() as
                  | "SHOWROOM_VISIT"
                  | "VIRTUAL_MEETING"
                  | "SITE_VISIT",
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
                  {lead.customerId}{" "}
                  <span className="px-1 text-slate-400">·</span> Lead note
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
                  <FieldLabel
                    required={!scheduleMode && !cancelMode && !reasonRequired}
                  >
                    Next call date
                  </FieldLabel>
                  {!scheduleMode && !cancelMode && !reasonRequired ? (
                    <span className="text-[12px] text-[var(--crm-danger)]">
                      required
                    </span>
                  ) : (
                    <span className="text-[12px] text-[var(--crm-text-muted)]">
                      optional
                    </span>
                  )}
                </div>

                <Input
                  type="datetime-local"
                  min={minNextCallDate}
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
                    ? isDesignRefinementSchedulingSubstage(feedback)
                      ? "For refinement meetings, the Hub appointment time will be used as follow-up."
                      : "For Meeting Scheduled / Rescheduled (and fix-appointment scheduling), the Hub appointment time will be used as follow-up."
                    : "Click the field to open calendar and time picker."}
                </p>
                {showErrors && nextCallDateMissing && (
                  <p className="mt-1 text-[12px] text-red-500">
                    Next call date is required unless a reason (resone) applies
                    below (LOST / closure substages) or you use meeting
                    scheduling only.
                  </p>
                )}
              </div>

              {/* Status */}
              <div>
                <FieldLabel>Status</FieldLabel>
                <Input
                  value={status}
                  readOnly
                  placeholder="Auto from feedback"
                  className="h-[42px] rounded-[12px] bg-[var(--crm-input-bg)] text-[14px] opacity-85"
                />
              </div>

              {/* Path */}
              <div>
                <FieldLabel>Path</FieldLabel>
                <Input
                  value={path}
                  readOnly
                  placeholder="Auto from feedback"
                  className="h-[42px] rounded-[12px] bg-[var(--crm-input-bg)] text-[14px] opacity-85"
                />
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
                    !feedbackSelectEnabled
                      ? "opacity-60 cursor-not-allowed"
                      : "",
                  ].join(" ")}
                >
                  <option value="">
                    {feedbackSelectEnabled
                      ? "Select feedback"
                      : "Wait..."}
                  </option>
                  {feedbackOptions.map((option) => (
                    <option
                      key={`${option.stage}-${option.stageCategory}-${option.label}`}
                      value={option.label}
                    >
                      {option.label}
                    </option>
                  ))}
                </Select>

                {feedbackLoading && (
                  <p className="mt-1 text-[12px] text-[var(--crm-text-muted)]">
                    Loading feedback options...
                  </p>
                )}
                {feedbackError && (
                  <p className="mt-1 text-[12px] text-amber-600">
                    Using current status because sub-status list could not be
                    loaded.
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
                  <p className="text-[13px] font-semibold text-[var(--crm-text-primary)]">
                    {meetingSchedulePanelTitle(feedback)}
                  </p>
                  <p className="text-[11px] text-[var(--crm-text-muted)]">
                    Pick designer, date, and slot. Hub creates the booking; description uses:
                    Meeting with [Lead type] - Lead ID: [id].
                  </p>
                  {isDesignRefinementSchedulingSubstage(feedback) ? (
                    <p className="text-[11px] text-[var(--crm-text-muted)]">
                      Same flow as the first meeting. The server does{" "}
                      <strong className="font-medium text-[var(--crm-text-secondary)]">not</strong>{" "}
                      send a second Style Discovery (Design QA) invitation to the customer.
                      Calendar sync and internal participant emails may still apply when the
                      appointment is created or updated.
                    </p>
                  ) : (
                    <p className="text-[11px] text-[var(--crm-text-muted)]">
                      When you move into{" "}
                      <strong className="font-medium text-[var(--crm-text-secondary)]">
                        Meeting Scheduled
                      </strong>
                      , the server may email the customer the Style Discovery link if their email
                      is set. Creating the appointment can also notify sales/designer participants and
                      sync Google Calendar when configured.
                    </p>
                  )}
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
                      <option value="">
                        {designersLoading
                          ? "Loading designers…"
                          : "Select designer"}
                      </option>
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
                    <FieldLabel required>Meeting type</FieldLabel>
                    <Select
                      value={meetingType}
                      onChange={(e) => setMeetingType(e.target.value)}
                      className="h-[42px] rounded-[12px] bg-[var(--crm-input-bg)] text-[14px]"
                    >
                      <option value="">Select meeting type</option>
                      {MEETING_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
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
                    Required for LOST paths and for: Project cancelled after
                    token / after booking, Refund processed.
                  </p>
                  <Textarea
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    placeholder="Enter reason for LOST or closure substage…"
                    className={[
                      "mt-2 w-full min-h-[88px] rounded-[14px] bg-[var(--crm-input-bg)]",
                      showErrors && resoneMissing
                        ? "border border-red-500"
                        : "",
                    ].join(" ")}
                  />
                  {showErrors && resoneMissing ? (
                    <p className="mt-1 text-[12px] text-red-500">
                      Reason is required for this feedback.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {cancelMode ? (
                <div className="rounded-[14px] border border-amber-200/80 bg-amber-50/90 dark:border-amber-900/50 dark:bg-amber-950/40 p-3.5">
                  <p className="text-[12px] font-semibold text-amber-900 dark:text-amber-100">
                    Cancel meeting
                  </p>
                  <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200/90">
                    This updates the lead to the cancellation milestone. The backend may email the
                    customer and remove the Hub appointment when the substage is saved as{" "}
                    &quot;Meeting Cancelled&quot; or &quot;Meeting Cancelled/Paused&quot;.
                  </p>
                  <label className="mt-3 flex cursor-pointer items-start gap-2 text-[12px] text-[var(--crm-text-primary)]">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-[var(--crm-accent)]"
                      checked={cancelConfirmed}
                      onChange={(e) => setCancelConfirmed(e.target.checked)}
                    />
                    <span>
                      I confirm cancelling this meeting for this lead.
                    </span>
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
                    showErrors && noteMissing
                      ? "border-red-500 bg-red-100"
                      : "",
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

          {onApiComplete && showLeadPropertyGateFooterHint ? (
            <p className="border-t border-[var(--crm-border)] px-4 py-2 text-[11px] leading-snug text-[var(--crm-text-muted)] md:px-5">
              For{" "}
              <strong className="font-semibold text-[var(--crm-text-secondary)]">Discovery</strong> →{" "}
              <strong className="font-semibold text-[var(--crm-text-secondary)]">Connection</strong>, fill{" "}
              <strong className="font-semibold text-[var(--crm-text-secondary)]">Budget</strong>,{" "}
              <strong className="font-semibold text-[var(--crm-text-secondary)]">Property notes</strong>, and{" "}
              <strong className="font-semibold text-[var(--crm-text-secondary)]">Configuration</strong> on the Lead tab (all required).
            </p>
          ) : null}

          {apiError ? (
            <p className="border-t border-[var(--crm-border)] bg-[var(--crm-danger-bg)] px-4 py-2 text-[12px] text-[var(--crm-danger-text)] md:px-5">
              {apiError}
            </p>
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
              className="h-[40px] rounded-[12px] border border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)] px-5 text-[13px] font-medium text-[var(--crm-accent)] shadow-none transition-all duration-150 hover:-translate-y-px hover:brightness-105"
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
              {apiBusy ? "Saving..." : "Save note"}
            </Button>
          </div>
        </div>
      </div>

      {gatePopupMessage ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="milestone-gate-popup-title"
          onClick={() => setGatePopupMessage("")}
        >
          <div
            className="w-full max-w-md rounded-[18px] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5 shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="milestone-gate-popup-title"
              className="text-[15px] font-semibold text-[var(--crm-text-primary)]"
            >
              Required details missing
            </h3>
            <p className="mt-2 text-[13px] text-[var(--crm-text-secondary)]">
              {gatePopupMessage}
            </p>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="primary"
                onClick={() => setGatePopupMessage("")}
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
