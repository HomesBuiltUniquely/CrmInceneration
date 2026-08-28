"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  formatInsightsChangePercent,
  formatInsightsInrCompact,
  type InsightsDashboard,
} from "@/lib/crm-insights-api";
import type { BookingDateFilterState } from "@/lib/booking-token-date-filter";
import type {
  InsightsMonthBarPoint,
  InsightsWeekBarPoint,
  InsightsWeekCharts,
} from "@/lib/insights-week-charts";
import { intensityFromCounts } from "@/lib/insights-week-charts";
import InsightsInfoTip from "./InsightsInfoTip";

type Props = {
  leadsOverTime: InsightsDashboard["leadsOverTime"];
  conversionTrend: InsightsDashboard["conversionTrend"];
  revenueForecast: InsightsDashboard["revenueForecast"];
  /** Optional cross-check — Actual should match when Hub actualScope = grossBooking. */
  grossBookingKpi?: number | null;
  /** Same date filter as Insights header — only used for labels/copy. */
  dateFilter?: BookingDateFilterState;
  /** FE-rebuilt volume series (week or month root + nested drill-down). */
  volumeCharts?: InsightsWeekCharts | null;
  /** @deprecated use volumeCharts.weekBars */
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

type VolumeIntensity = "high" | "medium" | "low" | "none";

/** Months shown at once on All time / multi-month (arrows for the rest). */
const MONTH_PAGE_SIZE = 6;

/** Shared Leads-over-time bar geometry (month / week / day stay matched). */
const LEAD_VOLUME_BAR_SHAPE = "w-full max-w-[36px] rounded-md";

function barFillClass(intensity: VolumeIntensity): string {
  switch (intensity) {
    case "high":
      return "bg-[#16B981]";
    case "medium":
      return "bg-[#F59E0B]";
    case "low":
      return "bg-[#EF4444]";
    default:
      return "bg-slate-200";
  }
}

function barSoftClass(intensity: VolumeIntensity): string {
  switch (intensity) {
    case "high":
      return "bg-emerald-50 text-[#16B981] ring-emerald-100";
    case "medium":
      return "bg-amber-50 text-[#F59E0B] ring-amber-100";
    case "low":
      return "bg-red-50 text-[#EF4444] ring-red-100";
    default:
      return "bg-slate-50 text-slate-500 ring-slate-100";
  }
}

function barCountTextClass(intensity: VolumeIntensity, count = 1): string {
  switch (intensity) {
    case "high":
      return "text-[#16B981]";
    case "medium":
      return "text-[#F59E0B]";
    case "low":
      return count > 0 ? "text-[#EF4444]" : "text-slate-400";
    default:
      return "text-slate-400";
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

type VolumeBarItem = {
  key: string;
  count: number;
  intensity: VolumeIntensity;
  primaryLabel: string;
  secondaryLabel?: string;
  title?: string;
  onClick?: () => void;
};

/** Shorten "1 May–7 May" → "1–7 May" so week columns stay aligned. */
function compactRangeLabel(range: string): string {
  const raw = range.trim();
  const sameMonth = raw.match(
    /^(\d{1,2})\s+([A-Za-z]{3,})\s*[–-]\s*(\d{1,2})\s+\2$/i,
  );
  if (sameMonth) {
    return `${sameMonth[1]}–${sameMonth[3]} ${sameMonth[2]}`;
  }
  return raw;
}

function VolumeBarRow({
  items,
  maxCount,
  maxHeightPx,
  showIntensityBadge = false,
  compact = false,
  /** When true, secondary label (e.g. "10 Aug") stays visible; High/Med/Low still hover-only. */
  alwaysShowSecondary = false,
}: {
  items: VolumeBarItem[];
  maxCount: number;
  /** Max bar height only (count + axis labels sit outside this track). */
  maxHeightPx?: number;
  /** Kept for call sites; High/Med/Low only show on hover. */
  showIntensityBadge?: boolean;
  /** Tighter track for sheets (still no scroll). */
  compact?: boolean;
  alwaysShowSecondary?: boolean;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const max = Math.max(1, maxCount);
  const barMaxPx = maxHeightPx ?? (compact ? 96 : showIntensityBadge ? 104 : 116);
  const trackPx = barMaxPx;

  return (
    <div className="mt-1 w-full overflow-hidden">
      <div className="flex w-full items-start justify-between gap-1 sm:gap-1.5">
        {items.map((item) => {
          const heightPx = Math.max(
            item.count > 0 ? 10 : 5,
            Math.round((item.count / max) * barMaxPx),
          );
          const active = activeKey === item.key;
          const interactive = Boolean(item.onClick);
          const shellClass = `group flex min-w-0 flex-1 flex-col items-center px-0.5 py-0.5 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            interactive
              ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 active:scale-[0.97]"
              : "cursor-default"
          } ${active ? "scale-[1.03]" : ""}`;

          const tip =
            item.title ??
            `${item.primaryLabel}${
              item.secondaryLabel ? ` (${item.secondaryLabel})` : ""
            }: ${item.count} leads · ${intensityLabel(item.intensity)}`;

          const content = (
            <>
              <span
                className={`mb-1 flex h-5 w-full shrink-0 items-end justify-center text-[11px] font-bold leading-none tabular-nums ${
                  item.count > 0
                    ? barCountTextClass(item.intensity, item.count)
                    : "text-slate-400"
                }`}
              >
                {item.count}
              </span>
              <div
                className="relative flex w-full shrink-0 flex-col items-center justify-end"
                style={{ height: trackPx }}
              >
                <div
                  className={`${LEAD_VOLUME_BAR_SHAPE} shadow-sm transition-[height,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    active
                      ? "scale-y-105 opacity-100 shadow-md"
                      : "opacity-90 group-hover:opacity-100"
                  } ${barFillClass(item.intensity)}`}
                  style={{ height: heightPx, transformOrigin: "bottom center" }}
                />
              </div>
              <div className="mt-1.5 flex w-full shrink-0 flex-col items-center justify-start text-center">
                {/* Primary (W1 / Sat / May) always visible */}
                <span className="w-full truncate text-[10px] font-semibold leading-tight tracking-wide text-slate-700 sm:text-[11px]">
                  {item.primaryLabel}
                </span>
                {/* Day sheet: date always on. Week/month: date with hover */}
                {item.secondaryLabel ? (
                  alwaysShowSecondary ? (
                    <span
                      className="mt-0.5 w-full truncate text-[9px] font-medium leading-tight tabular-nums text-slate-400"
                      title={item.secondaryLabel}
                    >
                      {item.secondaryLabel}
                    </span>
                  ) : (
                    <span
                      className={`mt-0.5 w-full truncate text-[9px] font-medium leading-tight tabular-nums text-slate-400 transition-all duration-200 ease-out ${
                        active
                          ? "max-h-6 translate-y-0 opacity-100"
                          : "pointer-events-none max-h-0 -translate-y-1 opacity-0"
                      }`}
                      title={item.secondaryLabel}
                      aria-hidden={!active}
                    >
                      {item.secondaryLabel}
                    </span>
                  )
                ) : null}
                {/* High / Medium / Low — hover/focus only */}
                <span
                  className={`mt-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ring-1 transition-all duration-200 ease-out ${barSoftClass(item.intensity)} ${
                    active
                      ? "max-h-6 translate-y-0 scale-100 opacity-100"
                      : "pointer-events-none max-h-0 -translate-y-1 scale-95 overflow-hidden opacity-0"
                  }`}
                  aria-hidden={!active}
                >
                  {intensityLabel(item.intensity)}
                </span>
              </div>
            </>
          );

          if (interactive) {
            return (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                title={tip}
                onMouseEnter={() => setActiveKey(item.key)}
                onMouseLeave={() => setActiveKey(null)}
                onFocus={() => setActiveKey(item.key)}
                onBlur={() => setActiveKey(null)}
                className={shellClass}
              >
                {content}
              </button>
            );
          }

          return (
            <div
              key={item.key}
              title={tip}
              onMouseEnter={() => setActiveKey(item.key)}
              onMouseLeave={() => setActiveKey(null)}
              className={shellClass}
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const IOS_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

function IosSheetCard({
  title,
  subtitle,
  eyebrow,
  chips,
  children,
  onClose,
  className = "",
  style,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  chips?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`h-full overflow-hidden rounded-[28px] border border-white/80 bg-white p-5 shadow-2xl shadow-slate-900/18 backdrop-blur-xl sm:p-6 ${className}`}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200/90 sm:hidden" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {eyebrow}
            </p>
          ) : null}
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-sm leading-snug text-slate-500">{subtitle}</p>
          ) : null}
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
      {chips ? <div className="mt-3 flex flex-wrap gap-2">{chips}</div> : null}
      <div className="mt-4 overflow-hidden">{children}</div>
      <p className="mt-4 text-center text-[11px] text-slate-400">
        Green = high · Amber = medium · Red = low
      </p>
    </div>
  );
}

/**
 * iOS-style drill stage:
 * - Single panel centered
 * - Week + day open together: week on left, day on right, pair centered
 * - Close day → week recenters smoothly
 */
function VolumeDrillStage({
  weekPanel,
  dayPanel,
  onDismissBackdrop,
}: {
  weekPanel: ReactNode | null;
  dayPanel: ReactNode | null;
  onDismissBackdrop: () => void;
}) {
  const hasWeek = Boolean(weekPanel);
  const hasDay = Boolean(dayPanel);
  const open = hasWeek || hasDay;
  const pairMode = hasWeek && hasDay;

  const [entered, setEntered] = useState(false);
  const [dayVisible, setDayVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      setDayVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!hasDay) {
      setDayVisible(false);
      return;
    }
    const t = window.setTimeout(() => setDayVisible(true), 40);
    return () => window.clearTimeout(t);
  }, [hasDay, dayPanel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismissBackdrop();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onDismissBackdrop]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-5"
      role="presentation"
    >
      {/* Backdrop — click outside sheet closes week + day / month popups */}
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-900/40"
        style={{
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          opacity: entered ? 1 : 0,
          transition: `opacity 0.4s ${IOS_EASE}`,
        }}
        aria-label="Close popup"
        onClick={onDismissBackdrop}
      />

      {/* pointer-events-none so empty area / gutter clicks hit the backdrop */}
      <div
        className="pointer-events-none relative z-10 flex w-full max-w-[56rem] flex-col items-stretch justify-center gap-3 px-3 pb-4 pt-2 sm:flex-row sm:items-stretch sm:justify-center sm:gap-4 sm:p-0"
        style={{
          opacity: entered ? 1 : 0,
          transition: `opacity 0.35s ${IOS_EASE}`,
        }}
      >
        {weekPanel ? (
          <div
            className="pointer-events-auto w-full min-w-0"
            style={{
              flex: pairMode ? "1 1 0" : "0 1 28rem",
              maxWidth: pairMode ? "26rem" : "28rem",
              marginLeft: pairMode ? 0 : "auto",
              marginRight: pairMode ? 0 : "auto",
              transform: entered
                ? "translate3d(0,0,0) scale(1)"
                : "translate3d(0,20px,0) scale(0.97)",
              transition: `transform 0.5s ${IOS_EASE}, max-width 0.5s ${IOS_EASE}, flex 0.5s ${IOS_EASE}, margin 0.5s ${IOS_EASE}`,
              willChange: "transform",
            }}
          >
            {weekPanel}
          </div>
        ) : null}

        {hasDay ? (
          <div
            className="pointer-events-auto w-full min-w-0"
            style={{
              flex: pairMode ? "1 1 0" : "0 1 28rem",
              maxWidth: pairMode ? "26rem" : "28rem",
              marginLeft: pairMode ? 0 : "auto",
              marginRight: pairMode ? 0 : "auto",
              transform: dayVisible
                ? "translate3d(0,0,0) scale(1)"
                : pairMode
                  ? "translate3d(36px,0,0) scale(0.96)"
                  : "translate3d(0,16px,0) scale(0.97)",
              opacity: dayVisible ? 1 : 0,
              transition: `transform 0.52s ${IOS_EASE}, opacity 0.42s ${IOS_EASE}, max-width 0.5s ${IOS_EASE}, flex 0.5s ${IOS_EASE}`,
              pointerEvents: dayVisible ? "auto" : "none",
              willChange: "transform, opacity",
            }}
          >
            {dayPanel}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WeekDaySheetContent({ week }: { week: InsightsWeekBarPoint }) {
  const maxDay = Math.max(1, ...week.days.map((d) => d.count), 0);
  return (
    <VolumeBarRow
      maxCount={maxDay}
      maxHeightPx={88}
      compact
      alwaysShowSecondary
      items={week.days.map((day) => ({
        key: day.dateKey,
        count: day.count,
        intensity: day.intensity,
        primaryLabel: day.weekdayShort,
        secondaryLabel: `${day.day} ${day.monthShort}`,
        title: `${day.weekdayLong} ${day.day} ${day.monthLong}: ${day.count} leads · ${intensityLabel(day.intensity)}`,
      }))}
    />
  );
}

function MonthWeekSheetContent({
  month,
  onPickWeek,
}: {
  month: InsightsMonthBarPoint;
  onPickWeek: (week: InsightsWeekBarPoint) => void;
}) {
  const maxWeek = Math.max(1, ...month.weeks.map((w) => w.count), 0);
  if (month.weeks.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No week breakdown for this month.
      </p>
    );
  }
  return (
    <VolumeBarRow
      maxCount={maxWeek}
      maxHeightPx={88}
      compact
      showIntensityBadge
      items={month.weeks.map((week) => ({
        key: `${month.monthKey}-${week.shortLabel}`,
        count: week.count,
        intensity: week.intensity,
        primaryLabel: week.shortLabel,
        secondaryLabel: compactRangeLabel(week.rangeLabel),
        title: `${week.shortLabel} (${week.rangeLabel}): ${week.count} — tap for days`,
        onClick: () => onPickWeek(week),
      }))}
    />
  );
}

/** Scale line to actual data range — not 0–100% (small % values were rendering flat). */
function conversionChartScale(values: number[]): { min: number; span: number } {
  const min = 0;
  const dataMax = values.length > 0 ? Math.max(...values) : 0;
  const max = dataMax > 0 ? Math.max(dataMax * 1.12, 1) : 1;
  return { min, span: Math.max(max - min, 0.1) };
}

function conversionPointCoords(
  values: number[],
  index: number,
): { x: number; y: number } {
  const width = 320;
  const height = 140;
  const padX = 10;
  const padY = 20;
  const { min, span } = conversionChartScale(values);
  const step =
    values.length === 1 ? 0 : (width - padX * 2) / (values.length - 1);
  const x = padX + index * step;
  const y =
    height - padY - ((values[index]! - min) / span) * (height - padY * 2);
  return { x, y };
}

export default function InsightsSect6({
  leadsOverTime,
  conversionTrend,
  revenueForecast,
  grossBookingKpi,
  dateFilter,
  volumeCharts,
  weekBars: weekBarsProp,
}: Props) {
  const rootLevel = volumeCharts?.rootLevel ?? (weekBarsProp?.length ? "week" : null);
  const weekBars = volumeCharts?.weekBars?.length
    ? volumeCharts.weekBars
    : weekBarsProp ?? [];
  const monthBars = volumeCharts?.monthBars ?? [];

  const [selectedMonth, setSelectedMonth] = useState<InsightsMonthBarPoint | null>(
    null,
  );
  const [selectedWeek, setSelectedWeek] = useState<InsightsWeekBarPoint | null>(null);
  const [weekFromMonth, setWeekFromMonth] = useState<InsightsMonthBarPoint | null>(
    null,
  );
  /** Page of months for All time / multi-month (6 per page). */
  const [monthPage, setMonthPage] = useState(0);

  const monthPageCount = Math.max(1, Math.ceil(monthBars.length / MONTH_PAGE_SIZE));
  const monthPageClamped = Math.min(monthPage, monthPageCount - 1);
  const visibleMonthBars = useMemo(() => {
    if (monthBars.length <= MONTH_PAGE_SIZE) return monthBars;
    const start = monthPageClamped * MONTH_PAGE_SIZE;
    return monthBars.slice(start, start + MONTH_PAGE_SIZE);
  }, [monthBars, monthPageClamped]);
  const canPageMonths = monthBars.length > MONTH_PAGE_SIZE;
  const canMonthPrev = canPageMonths && monthPageClamped > 0;
  const canMonthNext = canPageMonths && monthPageClamped < monthPageCount - 1;
  const monthWindowLabel =
    visibleMonthBars.length > 0
      ? visibleMonthBars.length === 1
        ? visibleMonthBars[0]!.rangeLabel
        : `${visibleMonthBars[0]!.shortLabel} ${visibleMonthBars[0]!.yearLabel} – ${visibleMonthBars[visibleMonthBars.length - 1]!.shortLabel} ${visibleMonthBars[visibleMonthBars.length - 1]!.yearLabel}`
      : "";

  // Reset drill stack when date scope or chart grain changes.
  useEffect(() => {
    setSelectedMonth(null);
    setSelectedWeek(null);
    setWeekFromMonth(null);
  }, [dateFilter?.preset, dateFilter?.customFrom, dateFilter?.customTo, rootLevel]);

  // Default to the latest 6 months when data loads / date filter changes.
  useEffect(() => {
    if (monthBars.length === 0) {
      setMonthPage(0);
      return;
    }
    setMonthPage(Math.max(0, Math.ceil(monthBars.length / MONTH_PAGE_SIZE) - 1));
  }, [monthBars, dateFilter?.preset, dateFilter?.customFrom, dateFilter?.customTo]);

  // Keep page in range if bars shrink.
  useEffect(() => {
    setMonthPage((p) => Math.min(p, Math.max(0, monthPageCount - 1)));
  }, [monthPageCount]);

  const leadPoints = leadsOverTime.points ?? [];
  const maxLeadCount = useMemo(() => {
    if (rootLevel === "month" && monthBars.length > 0) {
      // Full-series max so bar scale stays comparable across arrow pages.
      return Math.max(1, ...monthBars.map((m) => m.count), 0);
    }
    if (rootLevel === "week" && weekBars.length > 0) {
      return Math.max(1, ...weekBars.map((w) => w.count), 0);
    }
    const counts = leadPoints.map((p) => Number(p.count ?? 0));
    return Math.max(1, ...counts, 0);
  }, [leadPoints, monthBars, rootLevel, weekBars]);

  const legacyIntensities = useMemo(() => {
    if (rootLevel === "week" || rootLevel === "month") return [];
    return intensityFromCounts(leadPoints.map((p) => Number(p.count ?? 0)));
  }, [leadPoints, rootLevel]);

  const conversionPoints = conversionTrend.points ?? [];

  const conversionPath = useMemo(() => {
    if (conversionPoints.length === 0) return "";
    const values = conversionPoints.map((p) =>
      Math.min(100, Math.max(0, Number(p.conversionPercent ?? 0))),
    );
    return values
      .map((_, index) => {
        const { x, y } = conversionPointCoords(values, index);
        return `${index === 0 ? "M" : "L"}${x} ${y}`;
      })
      .join(" ");
  }, [conversionPoints]);

  const lastConversionPoint = useMemo(() => {
    if (conversionPoints.length === 0) return null;
    const values = conversionPoints.map((p) =>
      Math.min(100, Math.max(0, Number(p.conversionPercent ?? 0))),
    );
    const index = conversionPoints.length - 1;
    return conversionPointCoords(values, index);
  }, [conversionPoints]);

  const target = Number(revenueForecast?.target ?? 0) || 0;
  const projected = Number(revenueForecast?.projected ?? 0) || 0;
  const hubActual = Number(revenueForecast?.actual ?? 0) || 0;
  const grossBooking =
    grossBookingKpi != null && Number.isFinite(Number(grossBookingKpi))
      ? Number(grossBookingKpi)
      : null;
  const actual =
    revenueForecast?.actualScope === "grossBooking" && grossBooking != null
      ? grossBooking
      : hubActual;
  const forecastMax = Math.max(1, target, actual, projected);
  const bar = (v: number) => Math.max(8, Math.round((v / forecastMax) * 144));

  const openWeek = (week: InsightsWeekBarPoint, month?: InsightsMonthBarPoint | null) => {
    setWeekFromMonth(month ?? null);
    setSelectedWeek(week);
  };

  const closeWeek = () => {
    setSelectedWeek(null);
    setWeekFromMonth(null);
  };

  const closeMonth = () => {
    setSelectedMonth(null);
    setSelectedWeek(null);
    setWeekFromMonth(null);
  };

  /** Click outside / Escape — close week daily sheet and month week sheet. */
  const closeAllDrill = () => {
    setSelectedMonth(null);
    setSelectedWeek(null);
    setWeekFromMonth(null);
  };

  const helperCopy =
    rootLevel === "month"
      ? "Color = high / med / low volume"
      : rootLevel === "week"
        ? isCalendarMonthPreset(dateFilter)
          ? "Weeks of this month · color = high / med / low"
          : "Weeks in range · color = high / med / low"
        : "Volume in selected range · color = high / med / low";

  const weekClickHint =
    rootLevel === "month"
      ? "Click a month for weeks · click a week for day-wise data"
      : rootLevel === "week"
        ? "Click a week to see day-wise lead data"
        : null;

  const highDay = selectedWeek?.days.find((d) => d.intensity === "high" && d.count > 0);
  const lowDay = selectedWeek?.days.find((d) => d.intensity === "low" && d.count > 0);

  return (
    <main className="px-4 lg:px-0">
      <div className="mt-10 flex justify-center pb-8">
        <div className="grid w-full max-w-[1290px] grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
          {/* A) Leads over time */}
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-lg xl:max-w-[400px]">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-800">Leads over time</h2>
                <p className="mt-0.5 text-[11px] font-medium leading-snug text-gray-400">
                  {helperCopy}
                </p>
                {weekClickHint ? (
                  <p className="mt-1 text-[10px] font-normal leading-snug text-slate-400">
                    {weekClickHint}
                  </p>
                ) : null}
              </div>
              <span
                className={`shrink-0 rounded-full bg-gray-50 px-2.5 py-1 text-sm font-semibold tabular-nums ${changeTone(leadsOverTime.changePercent)}`}
                title="Latest period with data vs the one before it"
              >
                {changeArrow(leadsOverTime.changePercent)}
                {formatInsightsChangePercent(leadsOverTime.changePercent)}
              </span>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="inline-block h-2 w-2 rounded-full bg-[#16B981]" /> High
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="inline-block h-2 w-2 rounded-full bg-[#F59E0B]" /> Med
              </span>
              <span className="inline-flex items-center gap-1 text-slate-500">
                <span className="inline-block h-2 w-2 rounded-full bg-[#EF4444]" /> Low
              </span>
            </div>

            {rootLevel === "month" && monthBars.length > 0 ? (
              <div className="relative">
                <div className="flex items-center gap-1">
                  {canPageMonths ? (
                    <button
                      type="button"
                      aria-label="Older months"
                      disabled={!canMonthPrev}
                      onClick={() => setMonthPage((p) => Math.max(0, p - 1))}
                      className={`flex h-9 w-8 shrink-0 items-center justify-center rounded-full text-slate-600 transition ${
                        canMonthPrev
                          ? "bg-slate-100 hover:bg-slate-200 active:scale-95"
                          : "cursor-not-allowed bg-slate-50 text-slate-300"
                      }`}
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
                        <path
                          d="M12 4L6 10l6 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <VolumeBarRow
                      maxCount={maxLeadCount}
                      showIntensityBadge
                      items={visibleMonthBars.map((month) => ({
                        key: month.monthKey,
                        count: month.count,
                        intensity: month.intensity,
                        primaryLabel: month.shortLabel,
                        secondaryLabel: month.yearLabel,
                        title: `${month.rangeLabel}: ${month.count} leads — tap for weeks`,
                        onClick: () => {
                          setSelectedMonth(month);
                          setSelectedWeek(null);
                          setWeekFromMonth(null);
                        },
                      }))}
                    />
                  </div>
                  {canPageMonths ? (
                    <button
                      type="button"
                      aria-label="Newer months"
                      disabled={!canMonthNext}
                      onClick={() =>
                        setMonthPage((p) => Math.min(monthPageCount - 1, p + 1))
                      }
                      className={`flex h-9 w-8 shrink-0 items-center justify-center rounded-full text-slate-600 transition ${
                        canMonthNext
                          ? "bg-slate-100 hover:bg-slate-200 active:scale-95"
                          : "cursor-not-allowed bg-slate-50 text-slate-300"
                      }`}
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
                        <path
                          d="M8 4l6 6-6 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  ) : null}
                </div>
                {canPageMonths ? (
                  <div className="mt-2 flex items-center justify-center gap-2 text-[10px] font-medium text-slate-400">
                    <span className="tabular-nums text-slate-500">{monthWindowLabel}</span>
                    <span className="text-slate-300">·</span>
                    <span className="tabular-nums">
                      {monthPageClamped + 1}/{monthPageCount}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : rootLevel === "week" && weekBars.length > 0 ? (
              <VolumeBarRow
                maxCount={maxLeadCount}
                showIntensityBadge
                items={weekBars.map((week) => ({
                  key: `${week.shortLabel}-${week.rangeLabel}`,
                  count: week.count,
                  intensity: week.intensity,
                  primaryLabel: week.shortLabel,
                  secondaryLabel: week.rangeLabel,
                  title: `${week.shortLabel} (${week.rangeLabel}): ${week.count} · ${intensityLabel(week.intensity)} — click for days`,
                  onClick: () => openWeek(week),
                }))}
              />
            ) : leadPoints.length === 0 ? (
              <p className="mt-8 text-sm text-gray-500">
                No leads-over-time points for this filter.
              </p>
            ) : (
              <VolumeBarRow
                maxCount={maxLeadCount}
                items={leadPoints.map((item, index) => {
                  const count = Number(item.count ?? 0);
                  const intensity =
                    legacyIntensities[index] ?? ("none" as VolumeIntensity);
                  return {
                    key: `${item.label}-${index}`,
                    count,
                    intensity,
                    primaryLabel: shortChartLabel(item.label, index),
                    title: `${item.label}: ${count} leads (${intensityLabel(intensity)})`,
                  };
                })}
              />
            )}
          </div>

          {/* B) Conversion trend */}
          <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-lg xl:max-w-[400px]">
            <div className="mb-5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-800">Conversion trend</h2>
                  <InsightsInfoTip
                    side="top"
                    label="How conversion trend is counted"
                    math={
                      conversionTrend.numeratorRule
                        ? "Point = (Closed Won + Booking Done) ÷ Leads created in week × 100. Badge = relative change vs first week."
                        : "Point = Closed ÷ Leads × 100. Badge = last period % − first period %. Example: 18 − 16 = +2%."
                    }
                  >
                    {conversionTrend.numeratorRule ? (
                      <>
                        Each week (W1–W5): leads <strong>created</strong> in that week vs
                        how many are now Closed Won or Booking Done (Lost and Hold
                        excluded). The badge compares the last week to the first week.
                      </>
                    ) : (
                      <>
                        Out of all leads in that week or month, how many became a closed
                        deal. The small number on the right tells you if this got better
                        or worse than the start of the range.
                      </>
                    )}
                  </InsightsInfoTip>
                </div>
                <p className="mt-0.5 text-[11px] font-medium leading-snug text-gray-400">
                  How many leads become closed deals
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full bg-gray-50 px-2.5 py-1 text-sm font-semibold tabular-nums ${changeTone(conversionTrend.changePercent)}`}
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
                        className="min-w-[2rem] flex-1 text-center text-[10px] font-semibold text-gray-600 sm:text-[11px]"
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
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-800">Revenue forecast</h2>
                <InsightsInfoTip
                  side="top"
                  label="How forecast is counted"
                  math={
                    revenueForecast?.actualScope === "grossBooking"
                      ? revenueForecast?.targetSource === "incentives"
                        ? "Actual = Token + Booking (grossBooking). Projected = pace to period end. Target = sum of Incentives H1+H2 for scoped execs in this month."
                        : revenueForecast?.targetSource === "config_default"
                          ? "Actual = Token + Booking. Target = config fallback (₹3 Cr) until Incentives targets are loaded in Hub."
                          : "Actual = Token + Booking (grossBooking). Projected = (actual ÷ days elapsed) × days in period. Target = Hub booking target."
                      : "Actual = booked so far. Projected = Hub pace to period end. Target = Hub sales goal. Bars scale to the largest of the three."
                  }
                >
                  Green is money already booked (Token + Booking deals in your
                  filter window). Dark is where we are heading if we keep this
                  pace till the period ends. Grey is the monthly booking goal
                  {revenueForecast?.targetSource === "incentives"
                    ? " from Incentives targets."
                    : revenueForecast?.targetSource === "config_default"
                      ? " (default until targets are set)."
                      : "."}
                </InsightsInfoTip>
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-gray-400">
                Booked so far, heading to, and the goal
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

      <VolumeDrillStage
        onDismissBackdrop={closeAllDrill}
        weekPanel={
          selectedMonth ? (
            <IosSheetCard
              onClose={closeMonth}
              eyebrow="Weekly breakdown"
              title={selectedMonth.rangeLabel}
              subtitle={`${selectedMonth.count} lead${selectedMonth.count === 1 ? "" : "s"} this month · tap a week`}
              chips={
                <>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${barSoftClass(selectedMonth.intensity)}`}
                  >
                    Month · {intensityLabel(selectedMonth.intensity)} volume
                  </span>
                  <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-100">
                    {selectedMonth.weeks.length} week
                    {selectedMonth.weeks.length === 1 ? "" : "s"}
                  </span>
                </>
              }
            >
              <p className="mb-2 text-center text-[10px] font-normal text-slate-400">
                Click a week to get day-wise data
              </p>
              <MonthWeekSheetContent
                month={selectedMonth}
                onPickWeek={(week) => openWeek(week, selectedMonth)}
              />
            </IosSheetCard>
          ) : null
        }
        dayPanel={
          selectedWeek ? (
            <IosSheetCard
              onClose={closeAllDrill}
              eyebrow={
                weekFromMonth
                  ? `${weekFromMonth.rangeLabel} · Daily breakdown`
                  : "Daily breakdown"
              }
              title={selectedWeek.shortLabel}
              subtitle={`${selectedWeek.rangeLabel} · ${selectedWeek.count} lead${selectedWeek.count === 1 ? "" : "s"} this week`}
              chips={
                <>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${barSoftClass(selectedWeek.intensity)}`}
                  >
                    Week · {intensityLabel(selectedWeek.intensity)} volume
                  </span>
                  {highDay ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-[#16B981] ring-1 ring-emerald-100">
                      Peak · {highDay.day} {highDay.monthShort}
                    </span>
                  ) : null}
                  {lowDay && selectedWeek.count > 0 ? (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-[#EF4444] ring-1 ring-red-100">
                      Quiet · {lowDay.day} {lowDay.monthShort}
                    </span>
                  ) : null}
                  {weekFromMonth ? (
                    <button
                      type="button"
                      onClick={closeWeek}
                      className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-100 transition hover:bg-slate-100"
                    >
                      ← Weeks
                    </button>
                  ) : null}
                </>
              }
            >
              <WeekDaySheetContent week={selectedWeek} />
            </IosSheetCard>
          ) : null
        }
      />

    </main>
  );
}
