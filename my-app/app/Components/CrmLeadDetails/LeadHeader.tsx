"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LeadSourceTag, MonoTag } from "./ui";
import type { Lead } from "@/lib/data";
import { formatCrmDateTime, parseCrmDateTime } from "@/lib/date-time-format";

function WonTrophyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M6 4h12v2a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 14v4M15 14v4M8 22h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M4 6H2v1a3 3 0 0 0 3 3h1M20 6h2v1a3 3 0 0 1-3 3h-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 4v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function LeadHeader({
  lead,
  onCompleteTask,
  onOpenStageRollback,
  canStageRollback = false,
  onCallClosed,
  showCallClosed = false,
  onOpenSalesClosure,
  showSalesClosure = false,
  salesClosureLoading = false,
  createdTimelineOptions = [],
  createdTimelineLoading = false,
  createdTimelineValue = "",
  onCreatedTimelineChange,
  onGetQuote,
  quoteFetching = false,
  showGetQuote = false,
}: {
  lead: Lead;
  onCompleteTask: () => void;
  onOpenStageRollback?: () => void;
  canStageRollback?: boolean;
  onCallClosed?: () => void;
  showCallClosed?: boolean;
  onOpenSalesClosure?: () => void;
  showSalesClosure?: boolean;
  salesClosureLoading?: boolean;
  createdTimelineOptions?: Array<{ value: string; label: string; fullLabel?: string }>;
  createdTimelineLoading?: boolean;
  createdTimelineValue?: string;
  onCreatedTimelineChange?: (value: string) => void;
  onGetQuote?: () => void;
  quoteFetching?: boolean;
  showGetQuote?: boolean;
}) {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const timelineWrapRef = useRef<HTMLDivElement | null>(null);
  const selectedTimeline = useMemo(
    () => createdTimelineOptions.find((x) => x.value === createdTimelineValue) ?? null,
    [createdTimelineOptions, createdTimelineValue]
  );
  const firstCallAt = useMemo(() => {
    if (lead.firstCallAt?.trim()) {
      return formatCrmDateTime(lead.firstCallAt.trim());
    }
    const callRows = lead.activities.filter((a) => a.type === "call");
    if (callRows.length === 0) return "";
    const sorted = [...callRows].sort((a, b) => {
      const at = parseCrmDateTime(a.createdAtIso ?? a.timestamp)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bt = parseCrmDateTime(b.createdAtIso ?? b.timestamp)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return at - bt;
    });
    return formatCrmDateTime(sorted[0]?.createdAtIso ?? sorted[0]?.timestamp);
  }, [lead.activities, lead.firstCallAt]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!timelineWrapRef.current) return;
      if (!timelineWrapRef.current.contains(event.target as Node)) {
        setTimelineOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div className="relative mb-6 flex flex-wrap items-center gap-5 overflow-hidden rounded-[24px] border border-[var(--crm-border)] bg-[var(--crm-surface)] px-7 py-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] animate-fade-up delay-1">
      {/* Left accent bar */}
      <div className="absolute bottom-0 left-0 top-0 w-1 rounded-l-[24px] bg-gradient-to-b from-[#38bdf8] to-[#2dd4bf]" />

      {/* Avatar */}
      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] text-2xl font-bold text-[var(--crm-accent)]">
        {lead.name.charAt(0)}
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[22px] font-bold tracking-[-0.4px] text-[var(--crm-text-primary)]">
            {lead.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <MonoTag>{lead.customerId}</MonoTag>
          <LeadSourceTag primary={lead.leadSource} extras={lead.additionalLeadSourcesList} />
          <span className="inline-flex h-6 items-center rounded-full border border-sky-200 bg-sky-50 px-3 text-[11px] font-semibold text-sky-800">
            <span>🕐</span>
            <span>Created {lead.createdAt}</span>
          </span>
          {firstCallAt ? (
            <span className="inline-flex h-6 items-center rounded-full border border-violet-200 bg-violet-50 px-3 text-[11px] font-semibold text-violet-800">
              <span>📞</span>
              <span>First Call {firstCallAt}</span>
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <span className="inline-flex h-6 items-center rounded-full border border-black/25 bg-amber-50 px-3 text-[11px] font-semibold text-amber-800">
            <span>
              Stage: {lead.stageBlock?.milestoneStage?.trim() || "—"}
            </span>
          </span>
          <span className="inline-flex h-6 items-center rounded-full border border-black/25 bg-amber-50 px-3 text-[11px] font-semibold text-amber-800">
            <span>
              Sub-stage: {lead.stageBlock?.milestoneSubStage?.trim() || "—"}
            </span>
          </span>
        </div>
        <div className="mt-2" ref={timelineWrapRef}>
          <button
            type="button"
            className="inline-flex w-full max-w-[420px] items-center justify-between gap-2 rounded-xl border border-black/20 bg-slate-100 px-3 py-2 text-[12px] font-medium text-black/75 outline-none transition hover:bg-slate-200 focus:border-black/30 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={createdTimelineLoading || createdTimelineOptions.length === 0}
            aria-haspopup="listbox"
            aria-expanded={timelineOpen}
            aria-label="Lead created timeline"
            title={selectedTimeline?.fullLabel ?? undefined}
            onClick={() => setTimelineOpen((v) => !v)}
          >
            <span className="truncate whitespace-nowrap overflow-hidden text-left">
              {createdTimelineLoading ? "Loading timeline..." : selectedTimeline?.label ?? "Lead created"}
            </span>
            <span aria-hidden className="text-[10px]">
              {timelineOpen ? "▲" : "▼"}
            </span>
          </button>
          {timelineOpen ? (
            <div
              role="listbox"
              className="mt-1 w-full max-w-[520px] overflow-y-auto rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-1 shadow-lg max-h-56"
            >
              {createdTimelineOptions.map((item) => {
                const isSelected = item.value === createdTimelineValue;
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`block w-full rounded-lg px-2.5 py-2 text-left text-[12px] whitespace-nowrap overflow-hidden text-ellipsis ${
                      isSelected
                        ? "bg-[var(--crm-accent-soft)] text-[var(--crm-accent)]"
                        : "text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface-subtle)]"
                    }`}
                    title={item.fullLabel ?? item.label}
                    onClick={() => {
                      onCreatedTimelineChange?.(item.value);
                      setTimelineOpen(false);
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* Right: Assignee + CTA */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Assignee badge */}
        <div className="flex items-center gap-2 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 text-[13px] font-semibold text-[var(--crm-text-primary)]">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-violet-400 text-[10px] font-bold text-white">
            {lead.assignee
              .split(/\s+/)
              .filter(Boolean)
              .map((w) => w[0])
              .join("") || "—"}
          </div>
          {lead.assignee}
        </div>

        {showSalesClosure && onOpenSalesClosure ? (
          <button
            type="button"
            onClick={onOpenSalesClosure}
            disabled={salesClosureLoading}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-2.5 text-[13px] font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span aria-hidden>🔗</span>
            {salesClosureLoading ? "Opening..." : "Sales closure"}
          </button>
        ) : null}
        {canStageRollback ? (
          <button
            type="button"
            onClick={onOpenStageRollback}
            className="inline-flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100"
          >
            <span aria-hidden>↩</span>
            Stage Rollback
          </button>
        ) : null}

        {showCallClosed && onCallClosed ? (
          <button
            type="button"
            onClick={onCallClosed}
            aria-label="Closed — Won / Booking Done and Sales Closure"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 shadow-sm transition duration-200 hover:border-emerald-200/80 hover:bg-emerald-50/60 hover:text-emerald-900 hover:shadow-[0_8px_22px_rgba(16,185,129,0.12)] active:scale-[0.99]"
          >
            <WonTrophyIcon className="h-[18px] w-[18px] shrink-0 text-amber-600" />
            Closed
          </button>
        ) : null}

        {showGetQuote && onGetQuote ? (
          <button
            type="button"
            onClick={onGetQuote}
            disabled={quoteFetching}
            className="inline-flex items-center gap-2 rounded-2xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-[13px] font-semibold text-violet-900 shadow-sm transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-hidden>🔎</span>
            {quoteFetching ? "Getting Quote..." : "Get Quote"}
          </button>
        ) : null}

        {/* Complete Task */}
        <button
          onClick={onCompleteTask}
          className="group relative inline-flex cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(37,99,235,0.28)]"
        >
          <span className="absolute inset-0 bg-[linear-gradient(120deg,transparent_10%,rgba(255,255,255,0.24)_45%,transparent_80%)] translate-x-[-140%] transition-transform duration-700 group-hover:translate-x-[140%]" />
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/18 text-[19px] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-white/25 backdrop-blur-sm">
            <span className="translate-y-[-0.5px]">📝</span>
          </span>
          <span className="relative tracking-[0.1px]">Complete Task</span>
        </button>
      </div>
    </div>
  );
}
