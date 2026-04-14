"use client";

import { LeadSourceTag, MonoTag } from "./ui";
import type { Lead } from "@/lib/data";

export default function LeadHeader({
  lead,
  onCompleteTask,
  salesClosureHref,
  createdTimelineOptions = [],
  createdTimelineLoading = false,
}: {
  lead: Lead;
  onCompleteTask: () => void;
  /** §12 Hub Sales Closure — shown when Closer + Booking Done (opens new tab). */
  salesClosureHref?: string | null;
  createdTimelineOptions?: Array<{ value: string; label: string }>;
  createdTimelineLoading?: boolean;
}) {
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
        <div className="flex items-center gap-3 flex-wrap">
          <MonoTag>{lead.customerId}</MonoTag>
          <LeadSourceTag primary={lead.leadSource} extras={lead.additionalLeadSourcesList} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-800">
            <span>🕐</span>
            <span>Created {lead.createdAt}</span>
          </span>
        </div>
        <div className="mt-2">
          <select
            className="w-full max-w-[350px] rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--crm-text-secondary)] outline-none transition focus:border-[var(--crm-accent)] focus:ring-2 focus:ring-[var(--crm-accent-soft)]"
            defaultValue=""
            disabled={createdTimelineLoading || createdTimelineOptions.length === 0}
            aria-label="Lead created timeline"
          >
            <option value="" disabled>
              {createdTimelineLoading ? "Loading timeline..." : "Lead created"}
            </option>
            {createdTimelineOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
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

        {salesClosureHref ? (
          <a
            href={salesClosureHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-2.5 text-[13px] font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100"
          >
            <span aria-hidden>🔗</span>
            Sales closure
          </a>
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
