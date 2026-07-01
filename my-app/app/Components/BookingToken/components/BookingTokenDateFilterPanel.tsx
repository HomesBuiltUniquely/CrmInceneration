"use client";

import { useEffect, useRef, useState } from "react";
import {
  BOOKING_DATE_PRESETS,
  bookingDateFilterSummary,
  DEFAULT_BOOKING_DATE_FILTER,
  isBookingDateFilterActive,
  type BookingDateFilterState,
  type BookingDatePresetId,
} from "@/lib/booking-token-date-filter";

type Props = {
  value: BookingDateFilterState;
  onChange: (next: BookingDateFilterState) => void;
};

export default function BookingTokenDateFilterPanel({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BookingDateFilterState>(value);
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

  const active = isBookingDateFilterActive(value);

  const selectPreset = (preset: BookingDatePresetId) => {
    setDraft((prev) => ({
      ...prev,
      preset,
      ...(preset === "custom"
        ? {}
        : { customFrom: "", customTo: "" }),
    }));
  };

  const apply = () => {
    if (draft.preset === "custom" && !draft.customFrom.trim() && !draft.customTo.trim()) {
      onChange(DEFAULT_BOOKING_DATE_FILTER);
    } else {
      onChange(draft);
    }
    setOpen(false);
  };

  const clear = () => {
    onChange(DEFAULT_BOOKING_DATE_FILTER);
    setDraft(DEFAULT_BOOKING_DATE_FILTER);
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
        Filter
        {active ? (
          <span
            className={`max-w-[140px] truncate rounded px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal ${
              active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {bookingDateFilterSummary(value)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Filter deals by date"
          className="absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--bt-border)] bg-white shadow-xl"
        >
          <div className="border-b border-[var(--bt-border)] bg-slate-50/80 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--bt-muted)]">
              Handoff date
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--bt-text)]">
              Show deals by Booking Done / handoff date
            </p>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BOOKING_DATE_PRESETS.map((preset) => {
                const selected = draft.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => selectPreset(preset.id)}
                    className={`bt-btn bt-btn-preset ${selected ? "bt-btn-preset-active" : ""}`}
                  >
                    <p
                      className={`text-[12px] font-bold ${
                        selected ? "text-white" : "text-[var(--bt-text)]"
                      }`}
                    >
                      {preset.label}
                    </p>
                    <p
                      className={`mt-0.5 text-[10px] ${
                        selected ? "text-white/80" : "text-[var(--bt-muted)]"
                      }`}
                    >
                      {preset.hint}
                    </p>
                  </button>
                );
              })}
            </div>

            {draft.preset === "custom" ? (
              <div className="mt-3 rounded-lg border border-[var(--bt-border)] bg-[#fafbfc] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--bt-muted)]">
                  Custom dates
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase text-[var(--bt-muted)]">
                      From
                    </span>
                    <input
                      type="date"
                      value={draft.customFrom}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, customFrom: event.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-[var(--bt-border)] bg-white px-2 py-1.5 text-[13px] text-[var(--bt-text)]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase text-[var(--bt-muted)]">
                      To
                    </span>
                    <input
                      type="date"
                      value={draft.customTo}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, customTo: event.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-[var(--bt-border)] bg-white px-2 py-1.5 text-[13px] text-[var(--bt-text)]"
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[var(--bt-border)] bg-white px-3 py-3">
            <button
              type="button"
              onClick={clear}
              className="bt-btn bt-btn-modal bt-btn-modal-ghost"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={apply}
              className="bt-btn bt-btn-modal bt-btn-modal-primary"
            >
              Apply filter
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
