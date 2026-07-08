"use client";

import { useEffect, useRef, useState } from "react";
import {
  BOOKING_SUBMITTED_BY_ROLE_OPTIONS,
  bookingDealFilterSummary,
  DEFAULT_BOOKING_DEAL_FILTERS,
  isBookingDealFilterActive,
  type BookingDealFilterState,
  type BookingSubmittedByRole,
} from "@/lib/booking-token-deal-filters";

type Props = {
  value: BookingDealFilterState;
  onChange: (next: BookingDealFilterState) => void;
  /** Hide role/assignee filters for sales executives (Hub scopes to self). */
  showHierarchyFilters?: boolean;
};

export default function BookingTokenDealFilterPanel({
  value,
  onChange,
  showHierarchyFilters = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BookingDealFilterState>(value);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setDraft(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const active = isBookingDealFilterActive(value);

  const apply = () => {
    onChange(draft);
    setOpen(false);
  };

  const clear = () => {
    onChange(DEFAULT_BOOKING_DEAL_FILTERS);
    setDraft(DEFAULT_BOOKING_DEAL_FILTERS);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`bt-btn bt-btn-toolbar ${active ? "bt-btn-toolbar-active" : ""}`}
      >
        <span aria-hidden>▾</span>
        Deals
        {active ? (
          <span className="max-w-[160px] truncate rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-white">
            {bookingDealFilterSummary(value)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Filter deals by role and assignee"
          className="absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--bt-border)] bg-white shadow-xl"
        >
          <div className="border-b border-[var(--bt-border)] bg-slate-50/80 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--bt-muted)]">
              Deal filters
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--bt-text)]">
              Filter by who submitted or who owns the lead
            </p>
          </div>

          <div className="space-y-3 p-4">
            {showHierarchyFilters ? (
              <>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--bt-muted)]">
                    Submitted by role
                  </span>
                  <select
                    value={draft.submittedByRole}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        submittedByRole: event.target.value as BookingSubmittedByRole,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-[var(--bt-border)] bg-white px-2 py-1.5 text-[13px] text-[var(--bt-text)]"
                  >
                    {BOOKING_SUBMITTED_BY_ROLE_OPTIONS.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--bt-muted)]">
                    Lead assignee
                  </span>
                  <input
                    type="text"
                    value={draft.assignee}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, assignee: event.target.value }))
                    }
                    placeholder="e.g. Rahul"
                    className="mt-1 w-full rounded-md border border-[var(--bt-border)] bg-white px-2 py-1.5 text-[13px] text-[var(--bt-text)]"
                  />
                </label>
              </>
            ) : null}

            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--bt-border)] px-3 py-2.5 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={draft.pendingCancellationsOnly}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    pendingCancellationsOnly: event.target.checked,
                  }))
                }
                className="mt-0.5"
              />
              <span>
                <span className="block text-[12px] font-semibold text-[var(--bt-text)]">
                  Pending cancellations only
                </span>
                <span className="text-[11px] text-[var(--bt-muted)]">
                  Approval queue — deals awaiting manager decision
                </span>
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[var(--bt-border)] bg-white px-3 py-3">
            <button type="button" onClick={clear} className="bt-btn bt-btn-modal bt-btn-modal-ghost">
              Clear
            </button>
            <button type="button" onClick={apply} className="bt-btn bt-btn-modal bt-btn-modal-primary">
              Apply filter
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
