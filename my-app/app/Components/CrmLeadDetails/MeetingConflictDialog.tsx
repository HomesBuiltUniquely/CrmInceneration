"use client";

import { useEffect, useRef, useState } from "react";
import type { AppointmentRow } from "@/lib/appointment-client";
import { cn } from "@/lib/cn";

export type MeetingConflictChoice =
  | { action: "reschedule"; appointmentId: number }
  | { action: "cancel_and_new"; appointmentId: number }
  | { action: "create_anyway" };

type Props = {
  open: boolean;
  existingMeetings: AppointmentRow[];
  onChoice: (choice: MeetingConflictChoice) => void;
  onClose: () => void;
  busy?: boolean;
};

/* ─── tiny helpers ──────────────────────────────────────────────────── */

function humanMeetingType(raw?: string | null) {
  if (!raw) return null;
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSlot(startTime?: string | null, endTime?: string | null) {
  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return iso;
    }
  };
  if (startTime && endTime) return `${fmt(startTime)} – ${fmt(endTime)}`;
  if (startTime) return fmt(startTime);
  return null;
}

/* ─── sub-components ────────────────────────────────────────────────── */

function WarningIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function RescheduleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/* meeting card shown in the dialog */
function ExistingMeetingCard({
  row,
  selected,
  selectable,
  onClick,
}: {
  row: AppointmentRow;
  selected?: boolean;
  selectable?: boolean;
  onClick?: () => void;
}) {
  const slot = formatSlot(row.startTime, row.endTime);
  const typeLabel = humanMeetingType(row.meetingType);

  return (
    <div
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={selectable ? (e) => e.key === "Enter" && onClick?.() : undefined}
      className={cn(
        "rounded-xl border p-3.5 transition-all",
        selectable && "cursor-pointer",
        selected
          ? "border-[var(--crm-accent)] bg-[var(--crm-accent-soft)] ring-1 ring-[var(--crm-accent-ring)]"
          : "border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] hover:border-[var(--crm-border-strong)]",
      )}
    >
      <div className="flex items-start gap-3">
        {/* icon */}
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px]",
            selected
              ? "bg-[var(--crm-accent-soft)] text-[var(--crm-accent)]"
              : "bg-[var(--crm-surface)] text-[var(--crm-text-muted)] border border-[var(--crm-border)]",
          )}
        >
          <CalendarIcon />
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          {row.designerName ? (
            <p className="text-[12px] font-semibold text-[var(--crm-text-primary)]">
              {row.designerName}
            </p>
          ) : null}

          {slot ? (
            <p className="text-[11px] text-[var(--crm-text-muted)] leading-relaxed">{slot}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {typeLabel ? (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                  selected
                    ? "border-[var(--crm-accent)] bg-[var(--crm-accent-soft)] text-[var(--crm-accent)]"
                    : "border-[var(--crm-border)] bg-[var(--crm-surface)] text-[var(--crm-text-muted)]",
                )}
              >
                {typeLabel}
              </span>
            ) : null}
            {row.id != null ? (
              <span className="text-[10px] text-[var(--crm-text-muted)]">
                #{row.id}
              </span>
            ) : null}
          </div>
        </div>

        {selected && selectable && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--crm-accent)] text-white text-[10px] font-bold">
            ✓
          </span>
        )}
      </div>
    </div>
  );
}

/* action button card */
function ActionCard({
  icon,
  title,
  description,
  variant,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  variant: "success" | "danger" | "neutral";
  disabled?: boolean;
  onClick: () => void;
}) {
  const variantStyles = {
    success: {
      icon: "bg-[var(--crm-success-bg)] text-[var(--crm-success)]",
      hover: "hover:border-[var(--crm-success)] hover:bg-[var(--crm-success-bg)]",
      hoverTitle: "group-hover:text-[var(--crm-success-text)]",
    },
    danger: {
      icon: "bg-[var(--crm-danger-bg)] text-[var(--crm-danger)]",
      hover: "hover:border-[var(--crm-danger)] hover:bg-[var(--crm-danger-bg)]",
      hoverTitle: "group-hover:text-[var(--crm-danger-text)]",
    },
    neutral: {
      icon: "bg-[var(--crm-neutral-bg)] text-[var(--crm-neutral)]",
      hover: "hover:border-[var(--crm-border-strong)] hover:bg-[var(--crm-surface-subtle)]",
      hoverTitle: "group-hover:text-[var(--crm-text-secondary)]",
    },
  }[variant];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex w-full items-start gap-3.5 rounded-xl border border-[var(--crm-border)]",
        "bg-[var(--crm-surface)] px-4 py-3.5 text-left transition-all",
        variantStyles.hover,
        "disabled:cursor-not-allowed disabled:opacity-40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--crm-accent-ring)]",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          variantStyles.icon,
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[13px] font-semibold text-[var(--crm-text-primary)] transition-colors",
            variantStyles.hoverTitle,
          )}
        >
          {title}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--crm-text-muted)]">
          {description}
        </p>
      </div>
      <svg
        viewBox="0 0 16 16"
        className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--crm-text-muted)] opacity-0 transition-opacity group-hover:opacity-100"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m6 3 5 5-5 5" />
      </svg>
    </button>
  );
}

/* ─── main dialog ───────────────────────────────────────────────────── */

export default function MeetingConflictDialog({
  open,
  existingMeetings,
  onChoice,
  onClose,
  busy = false,
}: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  /* auto-select first meeting */
  useEffect(() => {
    if (open && existingMeetings.length > 0 && existingMeetings[0].id != null) {
      setSelectedId(existingMeetings[0].id!);
    }
  }, [open, existingMeetings]);

  /* Esc to close */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const activeId = selectedId ?? existingMeetings[0]?.id ?? null;
  const hasValidId = activeId != null;
  const multiSelect = existingMeetings.length > 1;
  const count = existingMeetings.length;

  return (
    /* backdrop */
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[120] flex items-center justify-center px-3 py-6"
      style={{ background: "var(--crm-overlay)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
      onClick={onClose}
    >
      {/* panel */}
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-[500px] overflow-hidden rounded-2xl",
          "border border-[var(--crm-border)] bg-[var(--crm-surface)]",
          "shadow-[var(--crm-shadow-lg)]",
          "animate-fade-up",
        )}
      >
        {/* ── Header ── */}
        <div className="flex items-start gap-3 border-b border-[var(--crm-border)] px-5 py-4">
          {/* warning badge */}
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: "var(--crm-warning-bg)",
              color: "var(--crm-warning-text)",
              border: "1px solid var(--crm-warning-border)",
            }}
          >
            <WarningIcon />
          </span>

          <div className="min-w-0 flex-1">
            <h2
              id="conflict-dialog-title"
              className="text-[15px] font-bold leading-snug text-[var(--crm-text-primary)]"
            >
              Meeting Already Scheduled
            </h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--crm-text-muted)]">
              This lead already has{" "}
              <span className="font-semibold" style={{ color: "var(--crm-warning-text)" }}>
                {count === 1 ? "1 upcoming meeting" : `${count} upcoming meetings`}
              </span>
              . Choose how to proceed.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              "text-[var(--crm-text-muted)] transition-colors",
              "hover:bg-[var(--crm-surface-subtle)] hover:text-[var(--crm-text-primary)]",
            )}
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── Existing Meeting(s) ── */}
        <div className="px-5 pt-4 pb-2">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--crm-text-muted)]">
            Existing Upcoming Meeting{count > 1 ? "s" : ""}
          </p>
          <div className="space-y-2">
            {existingMeetings.slice(0, 3).map((row) => (
              <ExistingMeetingCard
                key={row.id ?? String(row.startTime)}
                row={row}
                selected={activeId === row.id}
                selectable={multiSelect}
                onClick={
                  multiSelect && row.id != null
                    ? () => setSelectedId(row.id!)
                    : undefined
                }
              />
            ))}
          </div>
          {multiSelect && (
            <p className="mt-1.5 text-[10px] text-[var(--crm-text-muted)]">
              Tap a meeting above to select it before choosing an action.
            </p>
          )}
        </div>

        {/* ── Divider ── */}
        <div className="mx-5 my-3 border-t border-[var(--crm-border)]" />

        {/* ── Action Choices ── */}
        <div className="px-5 pb-4 space-y-2">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--crm-text-muted)]">
            What would you like to do?
          </p>

          <ActionCard
            icon={<RescheduleIcon />}
            title="Reschedule Existing Meeting"
            description="Update the existing booking's date/time. The activity history will log this as a reschedule."
            variant="success"
            disabled={busy || !hasValidId}
            onClick={() => {
              if (!hasValidId) return;
              onChoice({ action: "reschedule", appointmentId: activeId! });
            }}
          />

          <ActionCard
            icon={<CancelIcon />}
            title="Cancel Existing & Schedule New"
            description="The existing meeting is cancelled first, then the scheduling form opens for a fresh booking."
            variant="danger"
            disabled={busy || !hasValidId}
            onClick={() => {
              if (!hasValidId) return;
              onChoice({ action: "cancel_and_new", appointmentId: activeId! });
            }}
          />

          <ActionCard
            icon={<PlusIcon />}
            title="Schedule New Anyway"
            description="Skip this check and open the scheduling form directly. Both meetings will remain active."
            variant="neutral"
            disabled={busy}
            onClick={() => onChoice({ action: "create_anyway" })}
          />
        </div>

        {/* ── Footer note ── */}
        <div
          className="flex items-center gap-2 border-t border-[var(--crm-border)] px-5 py-3"
          style={{ background: "var(--crm-surface-subtle)" }}
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 shrink-0 text-[var(--crm-text-muted)]"
            fill="currentColor"
            aria-hidden
          >
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm0 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm0 2.75a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5zm0 3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 7.25z" />
          </svg>
          <p className="text-[10px] text-[var(--crm-text-muted)]">
            All actions are recorded in this lead's{" "}
            <span className="font-semibold text-[var(--crm-text-secondary)]">Activity History</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
