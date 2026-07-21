"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatBookingDateLabel,
  isValidBookingDateValue,
  readBookingDate,
  todayBookingDateValue,
  writeBookingDate,
} from "@/lib/booking-done-payment-storage";

type Props = {
  leadType: string;
  leadId: string;
  onBookingDateChange?: () => void;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseYmd(value: string): { year: number; month: number; day: number } | null {
  if (!isValidBookingDateValue(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function toYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export default function BookingDateSection({
  leadType,
  leadId,
  onBookingDateChange,
}: Props) {
  const todayYmd = todayBookingDateValue();
  const [selectedYmd, setSelectedYmd] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const parsed = parseYmd(todayYmd);
    return parsed ? { year: parsed.year, month: parsed.month } : { year: 2026, month: 1 };
  });

  useEffect(() => {
    const stored = readBookingDate(leadType, leadId);
    const initial = stored || todayYmd;
    setSelectedYmd(initial);
    if (!stored) {
      writeBookingDate(leadType, leadId, initial);
      onBookingDateChange?.();
    }
    const parsed = parseYmd(initial);
    if (parsed) {
      setViewMonth({ year: parsed.year, month: parsed.month });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init per lead open
  }, [leadId, leadType, todayYmd]);

  const selectDate = (ymd: string) => {
    if (!isValidBookingDateValue(ymd)) return;
    setSelectedYmd(ymd);
    writeBookingDate(leadType, leadId, ymd);
    onBookingDateChange?.();
    const parsed = parseYmd(ymd);
    if (parsed) {
      setViewMonth({ year: parsed.year, month: parsed.month });
    }
    setCalendarOpen(false);
  };

  const monthTitle = useMemo(
    () =>
      new Date(viewMonth.year, viewMonth.month - 1, 1).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      }),
    [viewMonth.month, viewMonth.year],
  );

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

  const selectedLabel = formatBookingDateLabel(selectedYmd) || "Select booking date";

  return (
    <section className="mt-4 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span
            className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#ecfdf5] text-[15px] text-[#047857]"
            aria-hidden
          >
            📅
          </span>
          <div>
            <p className="text-[15px] font-bold text-[#0f172a]">Booking Date</p>
            <p className="mt-1 max-w-md text-[13px] text-[#64748b]">
              Choose the date this booking is recorded for. This is saved with the handoff.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => selectDate(todayYmd)}
          className="shrink-0 rounded-full border border-[#bbf7d0] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#047857] transition hover:bg-[#ecfdf5]"
        >
          Today
        </button>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#94a3b8]">
          Selected date
        </p>
        <button
          type="button"
          onClick={() => setCalendarOpen((open) => !open)}
          className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl border border-[#d6dce6] bg-white px-4 py-3 text-left transition hover:border-[#86efac] hover:bg-[#f0fdf4] focus:outline-none focus:ring-2 focus:ring-[#bbf7d0]"
          aria-expanded={calendarOpen}
          aria-haspopup="dialog"
        >
          <span>
            <span className="block text-[16px] font-bold text-[#0f172a]">{selectedLabel}</span>
            {selectedYmd ? (
              <span className="mt-0.5 block text-[11px] font-medium text-[#64748b]">
                {selectedYmd}
              </span>
            ) : null}
          </span>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#ecfdf5] text-[#047857]">
            {calendarOpen ? "▴" : "▾"}
          </span>
        </button>
      </div>

      {calendarOpen ? (
        <div
          className="mt-3 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm"
          role="dialog"
          aria-label="Choose booking date"
        >
          <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
            <button
              type="button"
              onClick={() => setViewMonth((prev) => shiftMonth(prev.year, prev.month, -1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] hover:bg-[#ecfdf5] hover:text-[#047857]"
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className="text-[13px] font-bold text-[#0f172a]">{monthTitle}</p>
            <button
              type="button"
              onClick={() => setViewMonth((prev) => shiftMonth(prev.year, prev.month, 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#475569] hover:bg-[#ecfdf5] hover:text-[#047857]"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 px-2 pt-2 text-center text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label} className="py-1">
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 p-2 pb-3">
            {calendarCells.map((cell, index) => {
              if (cell.day == null) {
                return <span key={`empty-${index}`} className="h-9" aria-hidden />;
              }
              const isSelected = cell.ymd === selectedYmd;
              const isToday = cell.ymd === todayYmd;
              return (
                <button
                  key={cell.ymd}
                  type="button"
                  onClick={() => selectDate(cell.ymd)}
                  className={`flex h-9 w-full items-center justify-center rounded-lg text-[13px] font-semibold transition ${
                    isSelected
                      ? "bg-[#16a34a] text-white shadow-sm"
                      : isToday
                        ? "border border-[#bbf7d0] bg-[#ecfdf5] text-[#047857] hover:bg-[#dcfce7]"
                        : "text-[#334155] hover:bg-[#f1f5f9]"
                  }`}
                  aria-pressed={isSelected}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
