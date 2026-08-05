"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  disabled?: boolean;
  fullWidth?: boolean;
  /** Header subtitle under “Date Range Filter”. */
  subtitle?: string;
};

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseYmd(value: string): { year: number; month: number; day: number } | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.exec(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function toYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function InsightsDateFilterPopover({
  value,
  onChange,
  disabled = false,
  fullWidth = false,
  subtitle = "Filter insights by specific period",
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BookingDateFilterState>(value);
  const rootRef = useRef<HTMLDivElement>(null);

  // Today ISO date
  const todayYmd = useMemo(() => {
    const d = new Date();
    return toYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }, []);

  // Viewport month for the calendar widget
  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => {
    const parsed = parseYmd(value.customFrom || value.customTo || todayYmd);
    return parsed ? { year: parsed.year, month: parsed.month } : { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  });

  useEffect(() => {
    if (!open) {
      setDraft(value);
      const parsed = parseYmd(value.customFrom || value.customTo || todayYmd);
      if (parsed) {
        setViewMonth({ year: parsed.year, month: parsed.month });
      }
    }
  }, [open, value, todayYmd]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

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
    if (preset !== "custom") {
      const next: BookingDateFilterState = {
        preset,
        customFrom: "",
        customTo: "",
      };
      setDraft(next);
      onChange(next);
      setOpen(false);
    } else {
      setDraft((prev) => ({
        ...prev,
        preset: "custom",
      }));
    }
  };

  const handleAllTime = () => {
    onChange(DEFAULT_BOOKING_DATE_FILTER);
    setDraft(DEFAULT_BOOKING_DATE_FILTER);
    setOpen(false);
  };

  const monthTitle = useMemo(() => {
    return new Date(viewMonth.year, viewMonth.month - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [viewMonth.month, viewMonth.year]);

  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(viewMonth.year, viewMonth.month - 1, 1).getDay();
    const daysInMonth = new Date(viewMonth.year, viewMonth.month, 0).getDate();
    const cells: Array<{ day: number | null; ymd: string }> = [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ day: null, ymd: "" });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({
        day,
        ymd: toYmd(viewMonth.year, viewMonth.month, day),
      });
    }
    return cells;
  }, [viewMonth.month, viewMonth.year]);

  const shiftMonth = (delta: number) => {
    setViewMonth((prev) => {
      const date = new Date(prev.year, prev.month - 1 + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() + 1 };
    });
  };

  const handleCellClick = (ymd: string) => {
    if (!ymd) return;
    if (!draft.customFrom || (draft.customFrom && draft.customTo)) {
      // Start a new range selection
      setDraft((prev) => ({
        ...prev,
        preset: "custom",
        customFrom: ymd,
        customTo: "",
      }));
    } else {
      // Complete range selection
      if (ymd < draft.customFrom) {
        setDraft((prev) => ({
          ...prev,
          preset: "custom",
          customFrom: ymd,
          customTo: prev.customFrom,
        }));
      } else {
        setDraft((prev) => ({
          ...prev,
          preset: "custom",
          customTo: ymd,
        }));
      }
    }
  };

  const applyCustomRange = () => {
    if (draft.preset === "custom" && !draft.customFrom && !draft.customTo) {
      onChange(DEFAULT_BOOKING_DATE_FILTER);
    } else {
      onChange(draft);
    }
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`relative text-left ${fullWidth ? "block w-full" : "inline-block"}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`group inline-flex h-10 items-center justify-between gap-2.5 rounded-xl border px-3.5 text-xs font-semibold shadow-xs transition-all focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-55 ${
          fullWidth ? "w-full" : ""
        } ${
          disabled
            ? "border-gray-200 bg-gray-50 text-gray-500"
            : active
              ? "border-indigo-500 bg-indigo-50/80 text-indigo-900 shadow-indigo-100"
              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <svg
            className={`h-4 w-4 shrink-0 transition-colors ${
              active ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-600"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className={`truncate ${fullWidth ? "min-w-0 flex-1 text-left" : "max-w-[150px] sm:max-w-[200px]"}`}>
            {active ? bookingDateFilterSummary(value) : "All Time"}
          </span>
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-200 ${
            open ? "rotate-180 text-indigo-600" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !disabled ? (
        <div
          role="dialog"
          aria-label="Select date range"
          className="absolute left-0 z-50 mt-2 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl ring-1 ring-black/5 animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-slate-50/90 px-4 py-3">
            <div>
              <p className="text-xs font-bold text-gray-900">Date Range Filter</p>
              <p className="text-[11px] text-gray-500">{subtitle}</p>
            </div>
            {active ? (
              <button
                type="button"
                onClick={handleAllTime}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                Reset
              </button>
            ) : null}
          </div>

          <div className="p-3.5">
            {/* Quick Presets Grid */}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={handleAllTime}
                className={`rounded-lg px-2.5 py-1.5 text-left transition-all ${
                  draft.preset === "all"
                    ? "bg-indigo-600 font-semibold text-white shadow-xs"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                <p className="text-[11px] font-medium">All Time</p>
              </button>

              {BOOKING_DATE_PRESETS.map((p) => {
                const selected = draft.preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectPreset(p.id)}
                    className={`rounded-lg px-2.5 py-1.5 text-left transition-all ${
                      selected
                        ? "bg-indigo-600 font-semibold text-white shadow-xs"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <p className="text-[11px] font-medium">{p.label}</p>
                  </button>
                );
              })}
            </div>

            {/* Custom Interactive Calendar Widget */}
            {draft.preset === "custom" ? (
              <div className="mt-3.5 rounded-xl border border-gray-200 bg-slate-50/50 p-3">
                {/* Month Navigator */}
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 shadow-2xs"
                  >
                    ‹
                  </button>
                  <span className="text-xs font-bold text-gray-800">{monthTitle}</span>
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 shadow-2xs"
                  >
                    ›
                  </button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 text-center mb-1">
                  {WEEKDAY_LABELS.map((w) => (
                    <span key={w} className="text-[10px] font-bold text-gray-400">
                      {w}
                    </span>
                  ))}
                </div>

                {/* Calendar cell grid */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {calendarCells.map((cell, idx) => {
                    if (!cell.day) {
                      return <div key={`empty-${idx}`} className="h-7 w-full" />;
                    }
                    const isFrom = draft.customFrom === cell.ymd;
                    const isTo = draft.customTo === cell.ymd;
                    const isInRange =
                      draft.customFrom &&
                      draft.customTo &&
                      cell.ymd >= draft.customFrom &&
                      cell.ymd <= draft.customTo;
                    const isToday = cell.ymd === todayYmd;

                    return (
                      <button
                        key={cell.ymd}
                        type="button"
                        onClick={() => handleCellClick(cell.ymd)}
                        className={`h-7 w-full rounded-md text-[11px] font-medium transition-all ${
                          isFrom || isTo
                            ? "bg-indigo-600 text-white font-bold shadow-xs"
                            : isInRange
                            ? "bg-indigo-100 text-indigo-900 font-semibold"
                            : isToday
                            ? "bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold"
                            : "text-gray-700 hover:bg-gray-200/70"
                        }`}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>

                {/* Range Summary & Inputs */}
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-200/80 pt-2.5">
                  <div>
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">From</span>
                    <input
                      type="date"
                      value={draft.customFrom}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, customFrom: e.target.value }))
                      }
                      className="mt-0.5 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-800"
                    />
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">To</span>
                    <input
                      type="date"
                      value={draft.customTo}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, customTo: e.target.value }))
                      }
                      className="mt-0.5 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-800"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/70 px-3.5 py-2.5">
            <button
              type="button"
              onClick={handleAllTime}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200/60 hover:text-gray-800 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={applyCustomRange}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
            >
              Apply Filter
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
