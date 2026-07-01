"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { fetchDesignQaForLead } from "@/lib/design-qa-client";
import { V2_BTN_GHOST_ICON, V2_BTN_SECONDARY } from "./lead-detail-v2-motion";

type DesignQaAnswer = {
  question?: string;
  optionLabel?: string;
  selectedId?: number;
  selectedText?: string;
  imageUrl?: string;
};

type DesignQaSubmission = {
  id?: number | string;
  createdAt?: string;
  answers?: DesignQaAnswer[];
};

function asSubmissions(data: unknown): DesignQaSubmission[] {
  if (!Array.isArray(data)) return [];
  const rows = data as DesignQaSubmission[];
  return [...rows].sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });
}

function formatSubmissionDate(value?: string): string {
  if (!value?.trim()) return "Submitted";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Submitted";
  return dt.toLocaleString();
}

function getCenteredPanelPosition(panelWidth: number, panelHeight: number) {
  const x = (window.innerWidth - panelWidth) / 2;
  const y = (window.innerHeight - panelHeight) / 2;
  return clampPanelPosition(x, y, panelWidth, panelHeight);
}

function clampPanelPosition(
  x: number,
  y: number,
  panelWidth: number,
  panelHeight: number,
) {
  const margin = 8;
  return {
    x: Math.min(Math.max(margin, x), window.innerWidth - panelWidth - margin),
    y: Math.min(Math.max(margin, y), window.innerHeight - panelHeight - margin),
  };
}

export default function DesignPreferencesWithModal({ leadId }: { leadId: string }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [open, setOpen] = useState(false);
  const [panelEntered, setPanelEntered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });

  const [data, setData] = useState<DesignQaSubmission[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const submissions = data ?? [];
  const selectedSubmission = submissions[selectedIndex] ?? submissions[0];

  useEffect(() => {
    setData(undefined);
    setError(null);
    setLoading(false);
    setSelectedIndex(0);
  }, [leadId]);

  useEffect(() => {
    if (!open) return;
    if (!leadId.trim()) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchDesignQaForLead(leadId)
      .then((response) => {
        if (cancelled) return;
        if (response === null) {
          setData(null);
          return;
        }
        setData(asSubmissions(response));
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Could not load design QA submissions.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, leadId]);

  const openPanel = () => {
    const panelWidth = Math.min(920, window.innerWidth - 32);
    const estimatedHeight = Math.min(560, window.innerHeight - 48);
    setPanelPosition(getCenteredPanelPosition(panelWidth, estimatedHeight));
    setPanelEntered(false);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    setPanelPosition(getCenteredPanelPosition(rect.width, rect.height));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelEntered(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const closePanel = useCallback(() => {
    setPanelEntered(false);
    window.setTimeout(() => setOpen(false), 280);
  }, []);

  const handleDragStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!panelRef.current || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;

    const rect = panelRef.current.getBoundingClientRect();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, []);

  const handleDragMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !panelRef.current) return;

    const rect = panelRef.current.getBoundingClientRect();
    const next = clampPanelPosition(
      event.clientX - dragOffsetRef.current.x,
      event.clientY - dragOffsetRef.current.y,
      rect.width,
      rect.height,
    );

    panelRef.current.style.left = `${next.x}px`;
    panelRef.current.style.top = `${next.y}px`;
    setPanelPosition(next);
  }, []);

  const handleDragEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closePanel]);

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-expanded={open}
        aria-label="Design Preferences"
        className={`inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-[13px] font-bold tracking-tight text-[#101828] shadow-[0_1px_2px_rgba(15,23,42,0.05)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10b981] ${
          open
            ? "border-[#101828] bg-[#f9fafb]"
            : `border-[#d5dbe5] ${V2_BTN_SECONDARY}`
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5 shrink-0 text-[#101828]"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2.5 13.4 8.6 19.5 10 13.4 11.4 12 17.5 10.6 11.4 4.5 10 10.6 8.6z" />
        </svg>
        Design Preferences
      </button>

      {open ? (
        <div
          className={`fixed inset-0 z-[90] bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 ${
            panelEntered ? "opacity-100" : "opacity-0"
          }`}
          onClick={closePanel}
          aria-hidden="true"
        />
      ) : null}

      {open ? (
        <div
          ref={panelRef}
          className={`fixed z-[95] flex max-h-[calc(100vh-6rem)] w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[#e0e5ec] bg-white shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            panelEntered ? "scale-100 opacity-100" : "scale-[0.86] opacity-0"
          }`}
          style={{ left: panelPosition.x, top: panelPosition.y }}
          role="dialog"
          aria-modal="true"
          aria-label="Design Preferences"
        >
          <div
            className={`flex items-center justify-between border-b border-[#eef1f5] px-5 py-4 select-none touch-none ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#f3f4f6] text-[#101828]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2.5 13.4 8.6 19.5 10 13.4 11.4 12 17.5 10.6 11.4 4.5 10 10.6 8.6z" />
                </svg>
              </span>
              <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#374151]">
                Design Preferences
              </h2>
              {!loading && submissions.length > 0 ? (
                <span className="rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-[10px] font-bold text-[#6b7280]">
                  {submissions.length} SUBMISSION{submissions.length === 1 ? "" : "S"}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={closePanel}
              className={`rounded-md px-2 py-1 text-[18px] leading-none text-[#9ca3af] ${V2_BTN_GHOST_ICON}`}
              aria-label="Close design preferences"
            >
              ×
            </button>
          </div>

          <p className="border-b border-[#eef1f5] px-5 py-2.5 text-[11px] text-[#9ca3af]">
            Customer-submitted Design QA answers linked to this lead.
          </p>

          {loading ? (
            <div className="p-5">
              <p className="text-[12px] text-[#9ca3af]">Loading design QA…</p>
            </div>
          ) : error ? (
            <div className="p-5">
              <p className="text-[12px] text-rose-600">
                Could not load Design QA submissions. {error}
              </p>
            </div>
          ) : !leadId.trim() ? (
            <div className="p-5">
              <p className="text-[12px] text-[#9ca3af]">Lead ID is required to load design preferences.</p>
            </div>
          ) : data === null || submissions.length === 0 ? (
            <div className="p-5">
              <p className="text-[12px] text-[#9ca3af]">No design QA record for this lead.</p>
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="min-h-0 border-b border-[#eef1f5] lg:border-b-0 lg:border-r">
                <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
                  Submissions
                </p>
                <ul className="max-h-[420px] overflow-y-auto">
                  {submissions.map((submission, index) => {
                    const answerCount = submission.answers?.length ?? 0;
                    return (
                      <li key={submission.id ?? `design-qa-${index}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedIndex(index)}
                          className={`w-full border-b border-[#f1f5f9] px-4 py-3 text-left transition ${
                            selectedIndex === index ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[12px] font-semibold text-[#111827]">
                              Submission {index + 1}
                            </p>
                            <p className="shrink-0 text-[10px] text-[#9ca3af]">
                              {formatSubmissionDate(submission.createdAt)}
                            </p>
                          </div>
                          <p className="mt-1 text-[11px] text-[#9ca3af]">
                            {answerCount} answer{answerCount === 1 ? "" : "s"}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="min-h-[280px] overflow-y-auto p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
                  Preference Detail
                </p>
                {selectedSubmission ? (
                  <div className="mt-3 space-y-2">
                    {(selectedSubmission.answers ?? []).length === 0 ? (
                      <p className="text-[12px] text-[#9ca3af]">No answers in this submission.</p>
                    ) : null}
                    {(selectedSubmission.answers ?? []).map((answer, answerIdx) => (
                      <div
                        key={`${selectedSubmission.id ?? selectedIndex}-${answerIdx}`}
                        className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3"
                      >
                        {answer.imageUrl ? (
                          <img
                            src={answer.imageUrl}
                            alt={answer.selectedText?.trim() || "Design QA answer"}
                            className="mb-2 h-28 w-28 rounded-md border border-[#e5e7eb] object-cover"
                            loading="lazy"
                          />
                        ) : null}
                        <p className="text-[12px] font-semibold text-[#111827]">
                          {answer.question?.trim() || "Question"}
                        </p>
                        <p className="mt-1 text-[11px] text-[#6b7280]">
                          {answer.optionLabel?.trim() || "Option"}:{" "}
                          <span className="font-semibold text-[#374151]">
                            {answer.selectedText?.trim() || "Not selected"}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
