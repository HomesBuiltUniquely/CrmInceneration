"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatInsightsChangePercent,
  formatInsightsInrCompact,
  type InsightsDashboard,
} from "@/lib/crm-insights-api";
import type { BookingDateFilterState } from "@/lib/booking-token-date-filter";
import type { InsightsWeekBarPoint } from "@/lib/insights-week-charts";
import { intensityFromCounts } from "@/lib/insights-week-charts";

type Props = {
  leadsOverTime: InsightsDashboard["leadsOverTime"];
  conversionTrend: InsightsDashboard["conversionTrend"];
  revenueForecast: InsightsDashboard["revenueForecast"];
  /** Same date filter as Insights header — only used for labels/copy. */
  dateFilter?: BookingDateFilterState;
  /** Month-scoped weeks with daily drill-down (FE rebuild). */
  weekBars?: InsightsWeekBarPoint[] | null;
};

function changeTone(value: number | null | undefined): string {
  const v = Number(value ?? 0);
  if (!Number.isFinite(v) || v === 0) return "text-gray-500";
  return v > 0 ? "text-green-600" : "text-red-500";
}

function changeArrow(value: number | null | undefined): string {
  const v = Number(value ?? 0);
  if (!Number.isFinite(v) || v === 0) return "";
  return v > 0 ? "↑ " : "↓ ";
}

/** Compact axis: prefer short W1…Wn from full "W1 · 1–7 Aug" labels. */
function shortChartLabel(raw: string, index: number): string {
  const label = String(raw ?? "").trim();
  if (!label) return `W${index + 1}`;
  const wPrefixed = label.match(/^w\s*(\d+)/i);
  if (wPrefixed) return `W${wPrefixed[1]}`;
  if (/week/i.test(label)) return `W${index + 1}`;
  const mon = label.match(
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{2,4})?$/i,
  );
  if (mon) {
    const abbr = mon[1]!.slice(0, 3);
    return mon[2] ? `${abbr} ${mon[2]}` : abbr;
  }
  if (/^(mon|tue|wed|thu|fri|sat|sun)/i.test(label)) {
    return label.slice(0, 3);
  }
  if (label.length <= 8) return label;
  return label.slice(0, 7);
}

function isCalendarMonthPreset(dateFilter?: BookingDateFilterState): boolean {
  return (
    dateFilter?.preset === "currentMonth" ||
    dateFilter?.preset === "previousMonth"
  );
}

function isWeekSeriesLabels(points: { label?: string }[]): boolean {
  return points.some((p) => {
    const l = String(p.label ?? "");
    return /week/i.test(l) || /^w\s*\d+/i.test(l.trim());
  });
}

type VolumeIntensity = "high" | "medium" | "low" | "none";

function barFillClass(intensity: VolumeIntensity): string {
  switch (intensity) {
    case "high":
      return "bg-emerald-500";
    case "medium":
      return "bg-amber-400";
    case "low":
      return "bg-sky-400";
    default:
      return "bg-slate-200";
  }
}

function barSoftClass(intensity: VolumeIntensity): string {
  switch (intensity) {
    case "high":
      return "bg-emerald-50 text-emerald-700 ring-emerald-100";
    case "medium":
      return "bg-amber-50 text-amber-800 ring-amber-100";
    case "low":
      return "bg-sky-50 text-sky-700 ring-sky-100";
    default:
      return "bg-slate-50 text-slate-500 ring-slate-100";
  }
}

function intensityLabel(intensity: VolumeIntensity): string {
  switch (intensity) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return "None";
  }
}

function WeekDaySheet({
  week,
  onClose,
}: {
  week: InsightsWeekBarPoint;
  onClose: () => void;
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const maxDay = Math.max(1, ...week.days.map((d) => d.count));
  const highDays = week.days.filter((d) => d.intensity === "high" && d.count > 0);
  const lowDays = week.days.filter((d) => d.intensity === "low" && d.count > 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${week.shortLabel} daily leads`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[2px] transition-opacity"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full max-w-md animate-[slideUp_0.28s_ease-out] rounded-t-[28px] border border-white/60 bg-white/95 p-5 shadow-2xl shadow-slate-900/15 backdrop-blur-xl sm:rounded-[28px] sm:p-6"
        style={{
          // lightweight keyframe without global CSS file
          animationName: "none",
        }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Daily breakdown
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              {week.shortLabel}
              <span className="ml-2 text-base font-medium text-slate-500">
                {week.rangeLabel}
              </span>
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {week.count} lead{week.count === 1 ? "" : "s"} this week · tap a day
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-95"
            aria-label="Close sheet"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${barSoftClass(week.intensity)}`}
          >
            Week · {intensityLabel(week.intensity)} volume
          </span>
          {highDays[0] ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
              Peak · {highDays[0].day} {highDays[0].monthShort}
            </span>
          ) : null}
          {lowDays[0] && week.count > 0 ? (
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-100">
              Quiet · {lowDays[0].day} {lowDays[0].monthShort}
            </span>
          ) : null}
        </div>

        <div className="mt-6 flex items-end justify-between gap-1.5 sm:gap-2">
          {week.days.map((day) => {
            const heightPx = Math.max(
              day.count > 0 ? 12 : 6,
              Math.round((day.count / maxDay) * 140),
            );
            const hovered = hoveredKey === day.dateKey;
            return (
              <button
                key={day.dateKey}
                type="button"
                className={`group flex min-w-0 flex-1 flex-col items-center rounded-2xl px-0.5 py-2 transition-all duration-200 ease-out ${
                  hovered
                    ? "bg-slate-50 scale-[1.04] shadow-md shadow-slate-200/80"
                    : "hover:bg-slate-50/80"
                }`}
                onMouseEnter={() => setHoveredKey(day.dateKey)}
                onMouseLeave={() => setHoveredKey(null)}
                onFocus={() => setHoveredKey(day.dateKey)}
                onBlur={() => setHoveredKey(null)}
              >
                <span
                  className={`mb-1.5 text-[11px] font-bold tabular-nums transition-colors ${
                    day.intensity === "high"
                      ? "text-emerald-600"
                      : day.intensity === "low" && day.count > 0
                        ? "text-sky-600"
                        : "text-slate-600"
                  }`}
                >
                  {day.count}
                </span>
                <div
                  className={`w-full max-w-[36px] rounded-full transition-all duration-200 ease-out ${barFillClass(day.intensity)} ${
                    hovered ? "opacity-100 shadow-sm" : "opacity-90"
                  }`}
                  style={{ height: `${heightPx}px` }}
                />
                <span className="mt-2 text-[10px] font-semibold text-slate-700">
                  {day.weekdayShort}
                </span>
                <span className="text-[10px] tabular-nums text-slate-400">
                  {day.day} {day.monthShort}
                </span>
                {hovered ? (
                  <span
                    className={`mt-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${barSoftClass(day.intensity)}`}
                  >
                    {intensityLabel(day.intensity)}
                  </span>
                ) : (
                  <span className="mt-1.5 h-[18px]" />
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-center text-[11px] text-slate-400">
          Green = high · Amber = medium · Blue = low
        </p>
      </div>
    </div>
  );
}

export default function InsightsSect6({
  leadsOverTime,
  conversionTrend,
  revenueForecast,
  dateFilter,
  weekBars,
}: Props) {
  const [selectedWeek, setSelectedWeek] = useState<InsightsWeekBarPoint | null>(
    null,
  );

  const leadPoints = leadsOverTime.points ?? [];
  const maxLeadCount = useMemo(() => {
    if (weekBars && weekBars.length > 0) {
      return Math.max(1, ...weekBars.map((w) => w.count), 0);
    }
    const counts = leadPoints.map((p) => Number(p.count ?? 0));
    return Math.max(1, ...counts, 0);
  }, [leadPoints, weekBars]);

  const legacyIntensities = useMemo(() => {
    if (weekBars && weekBars.length > 0) return [];
    return intensityFromCounts(leadPoints.map((p) => Number(p.count ?? 0)));
  }, [leadPoints, weekBars]);

  const conversionPoints = conversionTrend.points ?? [];

  const conversionPath = useMemo(() => {
    if (conversionPoints.length === 0) return "";
    const width = 320;
    const height = 140;
    const padX = 10;
    const padY = 20;
    const values = conversionPoints.map((p) =>
      Math.min(100, Math.max(0, Number(p.conversionPercent ?? 0))),
    );
    const min = 0;
    const max = Math.max(100, ...values);
    const span = Math.max(1, max - min);
    const step =
      conversionPoints.length === 1
        ? 0
        : (width - padX * 2) / (conversionPoints.length - 1);

    return conversionPoints
      .map((_, index) => {
        const x = padX + index * step;
        const y =
          height - padY - ((values[index]! - min) / span) * (height - padY * 2);
        return `${index === 0 ? "M" : "L"}${x} ${y}`;
      })
      .join(" ");
  }, [conversionPoints]);

  const lastConversionPoint = useMemo(() => {
    if (conversionPoints.length === 0) return null;
    const width = 320;
    const height = 140;
    const padX = 10;
    const padY = 20;
    const values = conversionPoints.map((p) =>
      Math.min(100, Math.max(0, Number(p.conversionPercent ?? 0))),
    );
    const min = 0;
    const max = Math.max(100, ...values);
    const span = Math.max(1, max - min);
    const step =
      conversionPoints.length === 1
        ? 0
        : (width - padX * 2) / (conversionPoints.length - 1);
    const index = conversionPoints.length - 1;
    const x = padX + index * step;
    const y =
      height - padY - ((values[index]! - min) / span) * (height - padY * 2);
    return { x, y };
  }, [conversionPoints]);

  const target = Number(revenueForecast?.target ?? 0) || 0;
  const actual = Number(revenueForecast?.actual ?? 0) || 0;
  const projected = Number(revenueForecast?.projected ?? 0) || 0;
  const forecastMax = Math.max(1, target, actual, projected);
  const bar = (v: number) => Math.max(8, Math.round((v / forecastMax) * 144));

  const interactive = Boolean(weekBars && weekBars.length > 0);

  return (
    <main className="px-4 lg:px-0">
      <div className="mt-10 flex justify-center pb-10">
        <div className="grid w-full max-w-[1290px] grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {/* A) Leads over time */}
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-lg xl:max-w-[400px]">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-800">Leads over time</h2>
                <p className="mt-0.5 text-[11px] font-medium leading-snug text-gray-400">
                  {isCalendarMonthPreset(dateFilter)
                    ? "Weeks of this month · color = high / med / low"
                    : "Volume in selected range · color = high / med / low"}
                </p>
                {interactive ? (
                  <p className="mt-1 text-[10px] font-medium text-emerald-600/90">
                    Tap a week for Mon–Sun breakdown
                  </p>
                ) : null}
              </div>
              <span
                className={`shrink-0 rounded-full bg-gray-50 px-2.5 py-1 text-sm font-semibold tabular-nums ${changeTone(leadsOverTime.changePercent)}`}
                title="Latest week with data vs the week before it"
              >
                {changeArrow(leadsOverTime.changePercent)}
                {formatInsightsChangePercent(leadsOverTime.changePercent)}
              </span>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> High
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> Med
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="inline-block h-2 w-2 rounded-full bg-sky-400" /> Low
              </span>
            </div>

            {interactive && weekBars ? (
              <div className="mt-1 flex h-56 items-end justify-between gap-1 sm:gap-1.5">
                {weekBars.map((week) => {
                  const heightPx = Math.max(
                    week.count > 0 ? 10 : 4,
                    Math.round((week.count / maxLeadCount) * 160),
                  );
                  return (
                    <button
                      key={week.shortLabel}
                      type="button"
                      onClick={() => setSelectedWeek(week)}
                      className="group flex min-w-0 flex-1 flex-col items-center rounded-xl py-1 transition-transform duration-200 ease-out hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 active:scale-[0.98]"
                      title={`${week.shortLabel} (${week.rangeLabel}): ${week.count} · ${intensityLabel(week.intensity)} — click for days`}
                    >
                      <span
                        className={`mb-1 text-[10px] font-bold tabular-nums ${
                          week.intensity === "high"
                            ? "text-emerald-600"
                            : week.intensity === "medium"
                              ? "text-amber-600"
                              : week.intensity === "low"
                                ? "text-sky-600"
                                : "text-slate-400"
                        }`}
                      >
                        {week.count}
                      </span>
                      <div
                        className={`w-full max-w-[40px] rounded-2xl shadow-sm transition-all duration-200 ease-out group-hover:shadow-md ${barFillClass(week.intensity)}`}
                        style={{ height: `${heightPx}px` }}
                      />
                      <span className="mt-1.5 text-center text-[10px] font-semibold tracking-wide text-slate-600 sm:text-[11px]">
                        {week.shortLabel}
                      </span>
                      <span
                        className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${barSoftClass(week.intensity)}`}
                      >
                        {intensityLabel(week.intensity)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : leadPoints.length === 0 ? (
              <p className="mt-8 text-sm text-gray-500">
                No leads-over-time points for this filter.
              </p>
            ) : (
              <div className="mt-2 flex h-56 items-end justify-between gap-1 sm:gap-1.5">
                {leadPoints.map((item, index) => {
                  const count = Number(item.count ?? 0);
                  const heightPx = Math.max(
                    count > 0 ? 8 : 4,
                    Math.round((count / maxLeadCount) * 168),
                  );
                  const intensity =
                    legacyIntensities[index] ?? ("none" as VolumeIntensity);
                  const short = shortChartLabel(item.label, index);
                  return (
                    <div
                      key={`${item.label}-${index}`}
                      className="flex min-w-0 flex-1 flex-col items-center"
                      title={`${item.label}: ${count} leads (${intensityLabel(intensity)})`}
                    >
                      <span className="mb-1 text-[10px] font-semibold tabular-nums text-gray-600">
                        {count}
                      </span>
                      <div
                        className={`w-full max-w-[40px] rounded-2xl ${barFillClass(intensity)}`}
                        style={{ height: `${heightPx}px` }}
                      />
                      <span className="mt-1.5 text-center text-[10px] font-semibold tracking-wide text-gray-600 sm:text-[11px]">
                        {short}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* B) Conversion trend */}
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-lg xl:max-w-[400px]">
            <div className="mb-5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-800">Conversion trend</h2>
                <p className="mt-0.5 text-[11px] font-medium leading-snug text-gray-400">
                  Closed ÷ leads % for each week in the range
                </p>
                {isWeekSeriesLabels(conversionPoints) ? (
                  <p className="mt-1 text-[10px] font-medium text-gray-400">
                    Badge = last week − first week
                  </p>
                ) : null}
              </div>
              <span
                className={`shrink-0 rounded-full bg-gray-50 px-2.5 py-1 text-sm font-semibold tabular-nums ${changeTone(conversionTrend.changePercent)}`}
                title="Last week conversion % minus first week conversion %"
              >
                {changeArrow(conversionTrend.changePercent)}
                {formatInsightsChangePercent(conversionTrend.changePercent)}
              </span>
            </div>

            {conversionPoints.length === 0 ? (
              <p className="mt-8 text-sm text-gray-500">
                No conversion trend points for this filter.
              </p>
            ) : (
              <>
                <div className="flex h-44 items-center justify-center">
                  <svg
                    viewBox="0 0 320 140"
                    className="h-auto w-full max-w-[320px]"
                    role="img"
                    aria-label="Conversion trend line"
                  >
                    <path
                      d={conversionPath}
                      fill="none"
                      stroke="#111827"
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {lastConversionPoint ? (
                      <circle
                        cx={lastConversionPoint.x}
                        cy={lastConversionPoint.y}
                        r="5"
                        fill="#22c55e"
                      />
                    ) : null}
                  </svg>
                </div>
                <div className="flex justify-between gap-1">
                  {conversionPoints.map((p, i) => {
                    const pct = Number(p.conversionPercent ?? 0);
                    const short = shortChartLabel(String(p.label ?? ""), i);
                    return (
                      <span
                        key={`${p.label}-${i}`}
                        className="min-w-0 flex-1 text-center text-[10px] font-semibold text-gray-600 sm:text-[11px]"
                        title={`${p.label}: ${pct.toFixed(1)}%`}
                      >
                        <span className="block tabular-nums text-gray-500">
                          {Number.isFinite(pct) ? `${pct.toFixed(1)}%` : "—"}
                        </span>
                        {short}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* C) Revenue forecast */}
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-lg xl:max-w-[400px]">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-800">Revenue forecast</h2>
              <p className="mt-0.5 text-[11px] font-medium text-gray-400">
                Hub actual / projected / target (Insight heuristic)
              </p>
            </div>

            <div className="flex items-end justify-center gap-4 sm:gap-5">
              <div className="flex flex-col items-center">
                <div
                  className="w-16 rounded-t-sm bg-green-500 sm:w-20"
                  style={{ height: `${bar(actual)}px` }}
                  title={`Actual ${formatInsightsInrCompact(actual)}`}
                />
                <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-700">
                  Actual
                </p>
                <p className="text-center text-xs tabular-nums text-gray-500">
                  {formatInsightsInrCompact(actual)}
                </p>
              </div>

              <div className="flex flex-col items-center">
                <div
                  className="w-16 rounded-t-sm bg-slate-800 sm:w-20"
                  style={{ height: `${bar(projected)}px` }}
                  title={`Projected ${formatInsightsInrCompact(projected)}`}
                />
                <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-700">
                  Projected
                </p>
                <p className="text-center text-xs tabular-nums text-gray-500">
                  {formatInsightsInrCompact(projected)}
                </p>
              </div>

              <div className="flex flex-col items-center">
                <div
                  className="w-16 rounded-t-sm bg-gray-200 sm:w-20"
                  style={{ height: `${bar(target)}px` }}
                  title={`Target ${formatInsightsInrCompact(target)}`}
                />
                <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-700">
                  Target
                </p>
                <p className="text-center text-xs tabular-nums text-gray-500">
                  {formatInsightsInrCompact(target)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedWeek ? (
        <WeekDaySheet week={selectedWeek} onClose={() => setSelectedWeek(null)} />
      ) : null}
    </main>
  );
}
