"use client";

import { useRouter } from "next/navigation";
import { requestLeadDetailOverlayClose } from "@/lib/lead-detail-overlay-close";

export default function TopBar({
  designQaOpen,
  onToggleDesignQa,
  /** Popup/overlay already has a circular X — hide duplicate Close control. */
  hideCloseButton = false,
}: {
  designQaOpen?: boolean;
  onToggleDesignQa?: () => void;
  hideCloseButton?: boolean;
}) {
  const router = useRouter();
  const handleClose = () => {
    // Prefer overlay close when hosted in CrmFullscreenOverlayModal.
    requestLeadDetailOverlayClose();
    if (typeof window !== "undefined" && window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    router.back();
  };

  return (
    <div
      className={`mb-8 flex items-center justify-between animate-fade-up ${
        hideCloseButton ? "pr-12" : ""
      }`}
    >
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

      {/* Actions — icon-only close (no "Close" label); omit when overlay owns the X */}
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
        {!hideCloseButton ? (
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            title="Close"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--crm-border-strong)] bg-[var(--crm-surface)] text-[var(--crm-text-secondary)] shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:bg-[var(--crm-surface-subtle)] hover:text-[var(--crm-text-primary)] hover:shadow-[0_6px_14px_rgba(15,23,42,0.12)]"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
