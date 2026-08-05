"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  /**
   * `full` — Insights header (All Time + presets + Apply).
   * `rangeOnly` — leads calendar: start→end auto-applies (no Apply button).
   */
  variant?: "full" | "rangeOnly";
  /** Button label when no range selected (`rangeOnly`). */
  emptyLabel?: string;
};

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Approx popover height for flip above/below. */
const POPOVER_ESTIMATE_PX = 420;

function parseYmd(value: string): { year: number; month: number; day: number } | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.exec(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function toYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function ymdToDdMmYyyy(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return "—";
  return `${String(p.day).padStart(2, "0")}-${String(p.month).padStart(2, "0")}-${p.year}`;
}

function emptyCustomDraft(): BookingDateFilterState {
  return { preset: "custom", customFrom: "", customTo: "" };
}

export default function InsightsDateFilterPopover({
  value,
  onChange,
  disabled = false,
  fullWidth = false,
  subtitle = "Filter insights by specific period",
  variant = "full",
  emptyLabel = "Select dates",
}: Props) {
  const rangeOnly = variant === "rangeOnly";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BookingDateFilterState>(() =>
    rangeOnly && value.preset === "all" ? emptyCustomDraft() : value,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** `below` = under trigger · `above` = upper when low space below */
  const [placement, setPlacement] = useState<"below" | "above">("below");

  const todayYmd = useMemo(() => {
    const d = new Date();
    return toYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }, []);

  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => {
    const parsed = parseYmd(value.customFrom || value.customTo || todayYmd);
    return parsed
      ? { year: parsed.year, month: parsed.month }
      : { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  });

  useEffect(() => {
    if (!open) {
      if (rangeOnly) {
        if (value.customFrom || value.customTo) {
          setDraft({
            preset: "custom",
            customFrom: value.customFrom,
            customTo: value.customTo,
          });
        } else {
          setDraft(emptyCustomDraft());
        }
      } else {
        setDraft(value);
      }
      const parsed = parseYmd(value.customFrom || value.customTo || todayYmd);
      if (parsed) {
        setViewMonth({ year: parsed.year, month: parsed.month });
      }
    }
  }, [open, value, todayYmd, rangeOnly]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const updatePlacement = () => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const panelH = panelRef.current?.offsetHeight || POPOVER_ESTIMATE_PX;
    const preferAbove =
      spaceBelow < panelH + 12 && spaceAbove > spaceBelow && spaceAbove > 160;
    setPlacement(preferAbove ? "above" : "below");
  };

  useLayoutEffect(() => {
    if (!open || disabled) return;
    updatePlacement();
    // re-measure after paint (panel has real height)
    const t = window.requestAnimationFrame(() => updatePlacement());
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.cancelAnimationFrame(t);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open, disabled, rangeOnly, draft.preset]);

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

  const active = rangeOnly
    ? Boolean(value.customFrom && value.customTo)
    : isBookingDateFilterActive(value);

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

  const handleClear = () => {
    if (rangeOnly) {
      const cleared = emptyCustomDraft();
      setDraft(cleared);
      onChange(cleared);
    } else {
      onChange(DEFAULT_BOOKING_DATE_FILTER);
      setDraft(DEFAULT_BOOKING_DATE_FILTER);
    }
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

  /**
   * Range: first click = start, second = end.
   * `rangeOnly` (leads): auto-applies when both dates set — no Apply button.
   */
  const handleCellClick = (ymd: string) => {
    if (!ymd) return;

    let nextFrom = draft.customFrom;
    let nextTo = draft.customTo;

    if (!nextFrom || (nextFrom && nextTo)) {
      nextFrom = ymd;
      nextTo = "";
    } else if (ymd < nextFrom) {
      nextTo = nextFrom;
      nextFrom = ymd;
    } else {
      nextTo = ymd;
    }

    const next: BookingDateFilterState = {
      preset: "custom",
      customFrom: nextFrom,
      customTo: nextTo,
    };
    setDraft(next);

    if (rangeOnly && nextFrom && nextTo) {
      onChange(next);
      setOpen(false);
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

  const buttonSummary = (() => {
    if (rangeOnly) {
      if (value.customFrom && value.customTo) {
        return `${ymdToDdMmYyyy(value.customFrom)} → ${ymdToDdMmYyyy(value.customTo)}`;
      }
      if (value.customFrom) return `${ymdToDdMmYyyy(value.customFrom)} → …`;
      return emptyLabel;
    }
    return active ? bookingDateFilterSummary(value) : "All Time";
  })();

  const showCalendar = rangeOnly || draft.preset === "custom";

  const rangeHint =
    draft.customFrom && !draft.customTo
      ? "Now pick end date — applies automatically"
      : "Pick start date, then end date — auto applies";

  const panelPositionClass =
    placement === "above"
      ? "bottom-full left-0 mb-2 origin-bottom"
      : "top-full left-0 mt-2 origin-top";

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
          <span
            className={`truncate ${fullWidth ? "min-w-0 flex-1 text-left" : "max-w-[150px] sm:max-w-[200px]"}`}
          >
            {buttonSummary}
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
          ref={panelRef}
          role="dialog"
          aria-label="Select date range"
          className={`absolute z-50 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl ring-1 ring-black/5 ${panelPositionClass}`}
        >
          <div className="flex items-center justify-between border-b border-gray-100 bg-slate-50/90 px-4 py-3">
            <div>
              <p className="text-xs font-bold text-gray-900">Date Range Filter</p>
              <p className="text-[11px] text-gray-500">{subtitle}</p>
            </div>
            {active || (rangeOnly && (draft.customFrom || value.customFrom)) ? (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                Reset
              </button>
            ) : null}
          </div>

          <div className="p-3.5">
            {!rangeOnly ? (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={handleClear}
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
            ) : null}

            {showCalendar ? (
              <div
                className={`rounded-xl border border-gray-200 bg-white p-3 ${rangeOnly ? "" : "mt-3.5 bg-slate-50/50"}`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    aria-label="Previous month"
                  >
                    ‹
                  </button>
                  <span className="text-sm font-bold text-slate-800">{monthTitle}</span>
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    aria-label="Next month"
                  >
                    ›
                  </button>
                </div>

                <div className="mb-1 grid grid-cols-7 text-center">
                  {WEEKDAY_LABELS.map((w) => (
                    <span key={w} className="py-1 text-[10px] font-bold text-gray-400">
                      {w}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 text-center">
                  {calendarCells.map((cell, idx) => {
                    if (!cell.day) {
                      return <div key={`empty-${idx}`} className="h-8 w-full" />;
                    }
                    const isFrom = draft.customFrom === cell.ymd;
                    const isTo = draft.customTo === cell.ymd;
                    const isInRange =
                      Boolean(draft.customFrom) &&
                      Boolean(draft.customTo) &&
                      cell.ymd >= draft.customFrom &&
                      cell.ymd <= draft.customTo;
                    const isToday = cell.ymd === todayYmd;

                    return (
                      <button
                        key={cell.ymd}
                        type="button"
                        onClick={() => handleCellClick(cell.ymd)}
                        className={`h-8 w-full rounded-lg text-[12px] font-medium transition-all ${
                          isFrom || isTo
                            ? "bg-indigo-600 font-bold text-white shadow-xs"
                            : isInRange
                              ? "bg-indigo-100 font-semibold text-indigo-900"
                              : isToday
                                ? "border border-indigo-300 bg-indigo-50 font-bold text-indigo-700"
                                : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-2.5">
                  <div>
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">
                      From
                    </span>
                    <p className="mt-0.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px] font-semibold tabular-nums text-gray-800">
                      {draft.customFrom ? ymdToDdMmYyyy(draft.customFrom) : "dd-mm-yyyy"}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">
                      To
                    </span>
                    <p className="mt-0.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px] font-semibold tabular-nums text-gray-800">
                      {draft.customTo ? ymdToDdMmYyyy(draft.customTo) : "dd-mm-yyyy"}
                    </p>
                  </div>
                </div>
                {rangeOnly ? (
                  <p className="mt-2 text-center text-[10px] font-medium text-gray-400">
                    {rangeHint}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {rangeOnly ? (
            <div className="flex items-center border-t border-gray-100 bg-gray-50/70 px-3.5 py-2.5">
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-200/60 hover:text-gray-800"
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/70 px-3.5 py-2.5">
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-200/60 hover:text-gray-800"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={applyCustomRange}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700"
              >
                Apply Filter
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
