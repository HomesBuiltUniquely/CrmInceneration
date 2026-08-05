"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

type Props = {
  label: string;
  /** ISO `YYYY-MM-DD` (empty = none). */
  value: string;
  onChange: (nextYmd: string) => void;
  disabled?: boolean;
  /** ISO min bound (inclusive). */
  min?: string;
  /** ISO max bound (inclusive). */
  max?: string;
  id?: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseYmd(value: string): { year: number; month: number; day: number } | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function ymdToDisplay(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return "";
  return `${pad2(p.day)}-${pad2(p.month)}-${p.year}`;
}

/** Accepts `dd-mm-yyyy` / `dd/mm/yyyy` / `yyyy-mm-dd`. */
function parseDisplayOrIso(raw: string): string | null {
  const t = raw.trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return parseYmd(t) ? t : null;
  }
  const m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(t);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const ymd = toYmd(year, month, day);
  return parseYmd(ymd) ? ymd : null;
}

function todayYmd(): string {
  const d = new Date();
  return toYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Monday = 0 … Sunday = 6 */
function mondayIndex(year: number, month: number, day: number): number {
  const js = new Date(year, month - 1, day).getDay(); // 0 Sun
  return (js + 6) % 7;
}

type Cell = {
  day: number;
  ymd: string;
  inMonth: boolean;
};

function buildMonthGrid(year: number, month: number): Cell[] {
  const cells: Cell[] = [];
  const firstDow = mondayIndex(year, month, 1);
  const dim = daysInMonth(year, month);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevDim = daysInMonth(prevYear, prevMonth);

  for (let i = 0; i < firstDow; i++) {
    const day = prevDim - firstDow + 1 + i;
    cells.push({
      day,
      ymd: toYmd(prevYear, prevMonth, day),
      inMonth: false,
    });
  }

  for (let day = 1; day <= dim; day++) {
    cells.push({ day, ymd: toYmd(year, month, day), inMonth: true });
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  let nextDay = 1;
  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({
      day: nextDay,
      ymd: toYmd(nextYear, nextMonth, nextDay),
      inMonth: false,
    });
    nextDay += 1;
    if (cells.length >= 42) break;
  }
  return cells;
}

function isBefore(a: string, b: string): boolean {
  return a < b;
}

function isAfter(a: string, b: string): boolean {
  return a > b;
}

/**
 * CRM custom day picker — no browser/Chrome date UI.
 * Value is always ISO `YYYY-MM-DD` for Hub query params; UI shows `dd-mm-yyyy`.
 */
export default function CrmDatePickerField({
  label,
  value,
  onChange,
  disabled = false,
  min,
  max,
  id,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => ymdToDisplay(value));
  const [monthPickOpen, setMonthPickOpen] = useState(false);
  const seed = parseYmd(value) ?? parseYmd(todayYmd())!;
  const [viewYear, setViewYear] = useState(seed.year);
  const [viewMonth, setViewMonth] = useState(seed.month);

  useEffect(() => {
    setText(ymdToDisplay(value));
    const p = parseYmd(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setMonthPickOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setMonthPickOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setMonthPickOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const cells = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );
  const today = todayYmd();
  const title = `${MONTH_NAMES[viewMonth - 1]}, ${viewYear}`;

  const shiftMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
    setMonthPickOpen(false);
  };

  const isDisabledDay = (ymd: string) => {
    if (min && isBefore(ymd, min)) return true;
    if (max && isAfter(ymd, max)) return true;
    return false;
  };

  const selectYmd = (ymd: string) => {
    if (isDisabledDay(ymd)) return;
    onChange(ymd);
    setText(ymdToDisplay(ymd));
    setOpen(false);
    setMonthPickOpen(false);
  };

  const commitText = () => {
    const parsed = parseDisplayOrIso(text);
    if (parsed === null) {
      setText(ymdToDisplay(value));
      return;
    }
    if (parsed === "") {
      onChange("");
      setText("");
      return;
    }
    if (isDisabledDay(parsed)) {
      setText(ymdToDisplay(value));
      return;
    }
    onChange(parsed);
    setText(ymdToDisplay(parsed));
  };

  const years = useMemo(() => {
    const base = new Date().getFullYear();
    const list: number[] = [];
    for (let y = base - 8; y <= base + 2; y++) list.push(y);
    if (!list.includes(viewYear)) list.push(viewYear);
    return list.sort((a, b) => a - b);
  }, [viewYear]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <label
        className={`group flex min-h-[42px] flex-col justify-center gap-0.5 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-input-bg,var(--crm-surface))] px-2.5 py-1.5 transition-all ${
          disabled
            ? "cursor-not-allowed opacity-55"
            : open
              ? "border-[var(--crm-accent-ring)] ring-2 ring-[var(--crm-accent-soft)]"
              : "hover:border-[var(--crm-border-strong)] hover:bg-[var(--crm-surface)] focus-within:border-[var(--crm-accent-ring)] focus-within:ring-2 focus-within:ring-[var(--crm-accent-soft)]"
        }`}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--crm-text-muted)]">
          {label}
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd-mm-yyyy"
          disabled={disabled}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => {
            if (!disabled) setOpen(true);
          }}
          onClick={() => {
            if (!disabled) setOpen(true);
          }}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitText();
              setOpen(false);
            }
          }}
          className="w-full bg-transparent text-[12px] font-semibold text-[var(--crm-text-primary)] placeholder:font-medium placeholder:text-[var(--crm-text-muted)] focus:outline-none disabled:cursor-not-allowed"
        />
      </label>

      {open && !disabled ? (
        <div
          role="dialog"
          aria-label={`${label} calendar`}
          onMouseDown={(e) => {
            // Keep input focus so day click isn't cancelled by blur commit.
            e.preventDefault();
          }}
          className="absolute left-0 z-50 mt-1.5 w-[min(280px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-black/5"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
            <div className="relative min-w-0">
              <button
                type="button"
                onClick={() => setMonthPickOpen((v) => !v)}
                className="inline-flex max-w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-[13px] font-semibold text-slate-800 hover:bg-slate-50"
              >
                <span className="truncate">{title}</span>
                <svg
                  className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${monthPickOpen ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {monthPickOpen ? (
                <div className="absolute left-0 top-full z-10 mt-1 max-h-48 w-44 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-md">
                  {years.map((y) =>
                    MONTH_NAMES.map((name, idx) => {
                      const m = idx + 1;
                      const selected = y === viewYear && m === viewMonth;
                      return (
                        <button
                          key={`${y}-${m}`}
                          type="button"
                          onClick={() => {
                            setViewYear(y);
                            setViewMonth(m);
                            setMonthPickOpen(false);
                          }}
                          className={`block w-full px-3 py-1.5 text-left text-[12px] ${
                            selected
                              ? "bg-sky-50 font-semibold text-sky-800"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {name}, {y}
                        </button>
                      );
                    }),
                  )}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
                className="flex h-5 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M2 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
                className="flex h-5 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          <div className="px-2.5 pb-2 pt-2">
            <div className="mb-1 grid grid-cols-7 text-center">
              {WEEKDAY_LABELS.map((w) => (
                <span key={w} className="py-0.5 text-[11px] font-bold text-slate-800">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5 text-center">
              {cells.map((cell) => {
                const selected = value === cell.ymd;
                const isToday = cell.ymd === today;
                const blocked = isDisabledDay(cell.ymd);
                return (
                  <button
                    key={`${cell.ymd}-${cell.inMonth ? "in" : "out"}`}
                    type="button"
                    disabled={blocked}
                    onClick={() => selectYmd(cell.ymd)}
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-md text-[12px] transition-colors ${
                      selected
                        ? "border border-sky-600 bg-sky-500 font-bold text-white shadow-sm"
                        : blocked
                          ? "cursor-not-allowed text-slate-300"
                          : !cell.inMonth
                            ? "text-slate-300 hover:bg-slate-50 hover:text-slate-500"
                            : isToday
                              ? "font-semibold text-sky-700 hover:bg-sky-50"
                              : "font-medium text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setText("");
                setOpen(false);
                setMonthPickOpen(false);
              }}
              className="text-[12px] font-semibold text-sky-600 hover:text-sky-800"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                const t = todayYmd();
                if (!isDisabledDay(t)) selectYmd(t);
              }}
              className="text-[12px] font-semibold text-sky-600 hover:text-sky-800"
            >
              Today
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
