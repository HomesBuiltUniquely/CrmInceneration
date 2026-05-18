"use client";

import { useRouter } from "next/navigation";

export default function TopBar({
  designQaOpen,
  onToggleDesignQa,
}: {
  designQaOpen?: boolean;
  onToggleDesignQa?: () => void;
}) {
  const router = useRouter();

  return (
    <div className="mb-8 flex items-center justify-between animate-fade-up">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4f9ef8] to-[#38d9a9] text-lg shadow-[0_16px_28px_rgba(79,158,248,0.28)]">
          🏠
        </div>
        <div>
          <div className="text-[19px] font-bold tracking-[-0.3px] text-[var(--crm-text-primary)]">
            HubInterior CRM
          </div>
          <div className="mt-px text-[11px] font-mono text-[var(--crm-text-muted)]">
            Lead Management System
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2.5">
        {onToggleDesignQa ? (
          <button
            type="button"
            onClick={onToggleDesignQa}
            aria-expanded={Boolean(designQaOpen)}
            className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-[var(--crm-surface)] px-5 py-2.5 text-[13px] font-semibold tracking-tight text-slate-800 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:bg-[var(--crm-surface-subtle)] hover:shadow-[0_6px_14px_rgba(15,23,42,0.14)] dark:border-[var(--crm-border-strong)] dark:text-[var(--crm-text-primary)]"
          >
            <span className="text-[15px] leading-none" aria-hidden>
              ✦
            </span>
            Design Preferences
          </button>
        ) : null}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-slate-800 px-5 py-2.5 text-[13px] font-semibold tracking-tight text-white shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-700 hover:shadow-[0_6px_14px_rgba(15,23,42,0.22)] dark:border-[var(--crm-border-strong)]"
        >
          <span className="text-[14px] leading-none" aria-hidden>
            ✕
          </span>
          Close
        </button>
      </div>
    </div>
  );
}
