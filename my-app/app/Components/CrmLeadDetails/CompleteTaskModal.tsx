"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lead } from "@/lib/data";
import { fetchCrmPipeline } from "@/lib/crm-pipeline";
import { Button, FieldLabel, Input, Select, Textarea } from "./ui";

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
  nextCallDateLocal: string;
};

export default function CompleteTaskModal({
  lead,
  open,
  onClose,
  onSave,
  onApiComplete,
}: {
  lead: Lead;
  open: boolean;
  onClose: () => void;
  /** Legacy: local-only status update */
  onSave?: (status: string) => void;
  /** CRM API: PUT details + POST note */
  onApiComplete?: (payload: CompleteTaskApiPayload) => Promise<void>;
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

  useEffect(() => {
    if (!open) {
      return;
    }

    setNextCallDate(defaultNextCallDate);
    setFeedback(lead.status);
    setStatus("");
    setPath("");
    setNote("");
    setFeedbackMappings([]);
    setShowErrors(false);
  }, [defaultNextCallDate, lead.status, open]);

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

  const feedbackEnabled = nextCallDate.trim().length > 0;
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
  const nextCallDateMissing = nextCallDate.trim().length === 0;
  const noteMissing = note.trim().length === 0;
  const feedbackMissing = feedback.trim().length === 0;

  if (!open) {
    return null;
  }

  const handleSave = async () => {
    setShowErrors(true);

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
          nextCallDateLocal: nextCallDate,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-[2px]">
      <div className="w-full max-w-[560px] max-h-[85vh] overflow-y-auto rounded-[18px] border border-[#d9d4c9] bg-[#fcfbf7] shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#d8d3c8] px-4 py-4 md:px-4">
          <div className="flex min-w-0 items-start gap-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#d9e7fb] text-[#3569b4] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
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
              <h2 className="text-[12px] font-semibold tracking-[-0.02em] text-slate-900 md:text-[18px]">
                Add note
              </h2>
              <p className="mt-0.5 text-[12px] text-slate-600 md:text-[12px]">
                {lead.customerId} <span className="px-1 text-slate-400">·</span>{" "}
                Lead note
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border border-[#d8d3c8] bg-[#f5f2ea] text-slate-500 transition hover:bg-white hover:text-slate-700"
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
          <div className="rounded-[18px] border border-[#d6d1c6] bg-[#f4f1e8] p-3.5 md:p-4">
            <FieldLabel>PHONE NUMBER</FieldLabel>
            <div className="mt-2 flex gap-2.5">
              <Input
                value={lead.phone}
                readOnly
                className="h-[48px] rounded-[14px] border-[#bfbdb4] bg-white px-4 text-[15px] font-medium tracking-[0.02em] text-slate-900"
              />
              <a
                href={`tel:${lead.phone}`}
                className="inline-flex h-[48px] shrink-0 items-center justify-center gap-2 rounded-[14px] border border-[#5e933f] bg-[#e5efd8] px-4 text-[14px] font-medium text-[#2d6b2e] transition hover:bg-[#ddeac9]"
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
              </a>
            </div>
            <div className="mt-3 rounded-[14px] border border-[#a67d2c] bg-[#f8efd8] px-3.5 py-2.5 text-[12px] text-[#7b5a16]">
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
                <FieldLabel required>Next call date</FieldLabel>
                <span className="text-[12px] text-[#9e3d34]">required</span>
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
                missing={showErrors && nextCallDateMissing}
                className="h-[42px] rounded-[12px] bg-[#f4f1e8] text-[14px]"
              />

              <p className="mt-1 text-[12px] text-slate-500">
                Click the field to open calendar and time picker.
              </p>
              {showErrors && nextCallDateMissing && (
                <p className="mt-1 text-[12px] text-red-500">
                  Next call date is required.
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
                  "h-[42px] rounded-[12px] bg-[#f4f1e8] text-[14px]",
                  !statusEnabled ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                <option value="">{statusEnabled ? "Select status" : "Select next call date first"}</option>
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
                  "h-[42px] rounded-[12px] bg-[#f4f1e8] text-[14px]",
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
                  " h-[42px] rounded-[12px] bg-[#f4f1e8] text-[14px]",
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
                <p className="mt-1 text-[12px] text-slate-500">
                  Loading feedback options...
                </p>
              )}
              {!feedbackEnabled && (
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

            {/* Note */}
            <div>
              <FieldLabel required>Note</FieldLabel>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Enter your note here..."
                className={[
                  "mt-2 w-full min-h-[110px] rounded-[14px] bg-[#f4f1e8]",
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
          <p className="border-t border-[#d8d3c8] bg-rose-50 px-4 py-2 text-[12px] text-rose-700 md:px-5">{apiError}</p>
        ) : null}
        <div className="flex flex-col-reverse items-stretch justify-end gap-2 border-t border-[#d8d3c8] bg-[#f4f1e8] px-4 py-3 md:flex-row md:px-5">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={apiBusy}
            className="h-[40px] rounded-[12px] border-[#c4c0b7] bg-white px-5 text-[13px] font-medium text-slate-700 hover:bg-[#faf8f2]"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSave()}
            disabled={apiBusy}
            className="h-[40px] rounded-[12px] border border-[#5a8fe8] bg-[#dce8fc] px-5 text-[13px] font-medium text-[#346ac0] shadow-none hover:translate-y-0 hover:bg-[#cdddfb]"
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
  );
}
