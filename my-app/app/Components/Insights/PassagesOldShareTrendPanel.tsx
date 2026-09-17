"use client";

import { useEffect, useMemo, useState } from "react";
import {
  filterPassagesTrendPointsByGranularity,
  type InsightsPassagesTrendPoint,
  type InsightsTrendGranularity,
} from "@/lib/crm-insights-api";
import { buildRangeWeekBuckets } from "@/lib/insights-week-charts";
import InsightsChartGranularityToggle from "./InsightsChartGranularityToggle";

type ViewMode = "chart" | "table";

type Props = {
  points: InsightsPassagesTrendPoint[];
  loading?: boolean;
  hubImplemented?: boolean;
  granularity?: InsightsTrendGranularity;
  onGranularityChange?: (value: InsightsTrendGranularity) => void;
  showGranularityToggle?: boolean;
  /** YYYY-MM-DD bounds — used to label W1…W5 date ranges when Hub omits rangeLabel. */
  dateFrom?: string | null;
  dateTo?: string | null;
  onClose?: () => void;
};

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const MONTH_PAGE_SIZE = 5;
const WEEK_PLACEHOLDER_COUNT = 5;

function buildEmptyWeekPlaceholders(
  dateFrom?: string | null,
  dateTo?: string | null,
): InsightsPassagesTrendPoint[] {
  const buckets =
    dateFrom && dateTo
      ? buildRangeWeekBuckets(
          { submittedFrom: dateFrom, submittedTo: dateTo },
          WEEK_PLACEHOLDER_COUNT,
        )
      : [];
  return Array.from({ length: WEEK_PLACEHOLDER_COUNT }, (_, i) => {
    const rangeLabel = buckets[i]?.label;
    return {
      period: `W${i + 1}`,
      periodLabel: rangeLabel ? `W${i + 1} · ${rangeLabel}` : `W${i + 1}`,
      weekIndex: i + 1,
      month: `W${i + 1}`,
      rangeLabel,
      newCount: 0,
      oldCount: 0,
      oldSharePercent: 0,
    };
  });
}

function buildEmptyMonthPlaceholders(count = MONTH_PAGE_SIZE): InsightsPassagesTrendPoint[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    return {
      period: key,
      periodLabel: label,
      month: key,
      monthLabel: label,
      newCount: 0,
      oldCount: 0,
      oldSharePercent: 0,
    };
  });
}

function periodShortLabel(point: InsightsPassagesTrendPoint, isWeek: boolean): string {
  if (isWeek) {
    const w = point.period.match(/^W(\d+)$/i);
    if (w) return `W${w[1]}`;
    return point.period.slice(0, 3);
  }
  const label = point.periodLabel?.trim() || point.monthLabel?.trim() || point.period;
  const shortMonth = label.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
  if (shortMonth) return shortMonth[1]!;
  const iso = point.period.match(/^(\d{4})-(\d{2})/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, 1).toLocaleDateString("en-IN", {
      month: "short",
    });
  }
  return label.length > 6 ? label.slice(0, 3) : label;
}

function periodFullLabel(point: InsightsPassagesTrendPoint, isWeek: boolean): string {
  if (isWeek) {
    const base = periodShortLabel(point, true);
    if (point.rangeLabel?.trim()) return `${base} · ${point.rangeLabel.trim()}`;
    if (point.periodLabel && !/^W\d+$/i.test(point.periodLabel)) {
      return point.periodLabel;
    }
    return base;
  }
  if (point.periodLabel?.trim()) return point.periodLabel.trim();
  if (point.monthLabel?.trim()) return point.monthLabel.trim();
  const iso = point.period.match(/^(\d{4})-(\d{2})/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, 1).toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    });
  }
  return point.period;
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 transition-colors duration-200 ${active ? "text-white" : "text-slate-600"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path d="M3 14l4-5 3 3 7-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TableIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 transition-colors duration-200 ${active ? "text-white" : "text-slate-600"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <rect x="3" y="4" width="14" height="12" rx="1.5" />
      <path d="M3 8h14M8 8v8" />
    </svg>
  );
}

export default function PassagesOldShareTrendPanel({
  points,
  loading = false,
  hubImplemented = true,
  granularity = "month",
  onGranularityChange,
  showGranularityToggle = false,
  dateFrom = null,
  dateTo = null,
  onClose,
}: Props) {
  const [view, setView] = useState<ViewMode>("chart");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null);
  const [monthPage, setMonthPage] = useState(0);

  const isWeekMode = granularity === "week";
  const periodNoun = isWeekMode ? "Week" : "Month";

  const filteredPoints = useMemo(() => {
    if (loading) return [];
    return filterPassagesTrendPointsByGranularity(points, granularity);
  }, [points, granularity, loading]);

  const isPlaceholder = !loading && filteredPoints.length === 0;

  const monthPageCount = Math.max(
    1,
    Math.ceil(filteredPoints.length / MONTH_PAGE_SIZE),
  );
  const monthPageClamped = Math.min(monthPage, monthPageCount - 1);

  const displayPoints = useMemo(() => {
    if (loading) return [];
    if (filteredPoints.length === 0) {
      return isWeekMode
        ? buildEmptyWeekPlaceholders(dateFrom, dateTo)
        : buildEmptyMonthPlaceholders();
    }
    if (isWeekMode) return filteredPoints;
    if (filteredPoints.length <= MONTH_PAGE_SIZE) return filteredPoints;
    const start = monthPageClamped * MONTH_PAGE_SIZE;
    return filteredPoints.slice(start, start + MONTH_PAGE_SIZE);
  }, [
    filteredPoints,
    isWeekMode,
    monthPageClamped,
    loading,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    setHoverIdx(null);
    setPinnedIdx(null);
  }, [granularity, view, monthPageClamped]);

  useEffect(() => {
    if (isWeekMode || filteredPoints.length === 0) {
      setMonthPage(0);
      return;
    }
    let bestIdx = filteredPoints.length - 1;
    for (let i = filteredPoints.length - 1; i >= 0; i -= 1) {
      const p = filteredPoints[i]!;
      if (
        Number(p.oldSharePercent ?? 0) > 0 ||
        Number(p.newCount ?? 0) + Number(p.oldCount ?? 0) > 0
      ) {
        bestIdx = i;
        break;
      }
    }
    setMonthPage(Math.max(0, Math.floor(bestIdx / MONTH_PAGE_SIZE)));
  }, [filteredPoints, isWeekMode, granularity]);

  useEffect(() => {
    setMonthPage((p) => Math.min(p, Math.max(0, monthPageCount - 1)));
  }, [monthPageCount]);

  const canPageMonths = !isWeekMode && filteredPoints.length > MONTH_PAGE_SIZE;
  const canMonthPrev = canPageMonths && monthPageClamped > 0;
  const canMonthNext = canPageMonths && monthPageClamped < monthPageCount - 1;

  const monthWindowLabel = useMemo(() => {
    if (isPlaceholder || !canPageMonths || displayPoints.length === 0) return "";
    const first = periodFullLabel(displayPoints[0]!, false);
    const last = periodFullLabel(displayPoints[displayPoints.length - 1]!, false);
    return first === last ? first : `${first} – ${last}`;
  }, [canPageMonths, displayPoints, isPlaceholder]);

  const coords = useMemo(() => {
    const width = 280;
    const height = 160;
    const padX = isWeekMode ? 36 : 28;
    const padY = 22;
    const vals = displayPoints.map((p) => Number(p.oldSharePercent ?? 0));
    const step =
      vals.length <= 1 ? 0 : (width - padX * 2) / (vals.length - 1);
    return vals.map((v, i) => {
      const x = padX + i * step;
      const clamped = Math.min(100, Math.max(0, v));
      const y = height - padY - (clamped / 100) * (height - padY * 2);
      return { x, y, v: clamped };
    });
  }, [displayPoints, isWeekMode]);

  const lineD = useMemo(() => {
    if (coords.length === 0) return "";
    return coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  }, [coords]);

  const activeIdx = pinnedIdx ?? hoverIdx;
  const activePoint =
    activeIdx != null && !isPlaceholder ? displayPoints[activeIdx] : null;

  const subtitle = isWeekMode
    ? "W1–W5 this month · % of Movement that were old leads · tap a point for dates"
    : `Trailing months · old-lead share of Movement (${MONTH_PAGE_SIZE} per page)`;

  const emptyHint = isWeekMode
    ? "No Movement in this range yet — chart shows W1–W5 at 0%."
    : "No Movement history yet — chart shows recent months at 0%.";

  function renderChartFootnote() {
    if (!isPlaceholder) return null;
    return (
      <p className="mt-2 text-center text-[10px] font-medium text-slate-400">
        {hubImplemented ? emptyHint : "Trend unavailable — check Hub connection."}
      </p>
    );
  }

  function renderPager() {
    if (!canPageMonths) return null;
    return (
      <div className="mt-2 flex items-center justify-center gap-2 text-[10px] font-medium text-slate-400">
        <span className="tabular-nums text-slate-500">{monthWindowLabel}</span>
        <span className="text-slate-300">·</span>
        <span className="tabular-nums">
          {monthPageClamped + 1}/{monthPageCount}
        </span>
      </div>
    );
  }

  function PagerButton({
    dir,
    disabled,
    onClick,
  }: {
    dir: "prev" | "next";
    disabled: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        aria-label={dir === "prev" ? "Older months" : "Newer months"}
        disabled={disabled}
        onClick={onClick}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-600 transition ${
          disabled
            ? "cursor-not-allowed bg-slate-50 text-slate-300"
            : "bg-slate-100 hover:bg-slate-200 active:scale-95"
        }`}
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden>
          <path
            d={dir === "prev" ? "M12 4L6 10l6 6" : "M8 4l6 6-6 6"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );
  }

  function DetailBox({ point }: { point: InsightsPassagesTrendPoint }) {
    const oldPct = Math.round(Number(point.oldSharePercent ?? 0));
    const range = point.rangeLabel?.trim();
    return (
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 w-[min(100%,11.5rem)] -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-center shadow-md">
        <p className="text-[10px] font-semibold text-slate-700">
          {periodShortLabel(point, isWeekMode)}
          {range ? (
            <span className="font-medium text-slate-500"> · {range}</span>
          ) : null}
        </p>
        <p className="text-sm font-bold tabular-nums text-blue-600">
          {oldPct}%
          <span className="text-xs font-medium text-slate-500"> old</span>
        </p>
        <p className="text-[10px] tabular-nums text-slate-500">
          New {point.newCount} · Old {point.oldCount}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-slate-900">
            Old lead share trend
          </h3>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {showGranularityToggle && onGranularityChange ? (
            <InsightsChartGranularityToggle
              value={granularity}
              onChange={onGranularityChange}
            />
          ) : null}
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              aria-label="Chart view"
              aria-pressed={view === "chart"}
              onClick={() => setView("chart")}
              className={`rounded-md p-1.5 transition-all duration-300 hover:scale-[1.04] active:scale-[0.96] ${
                view === "chart" ? "bg-slate-900 shadow-sm" : "hover:bg-white"
              }`}
              style={{ transitionTimingFunction: EASE }}
            >
              <ChartIcon active={view === "chart"} />
            </button>
            <button
              type="button"
              aria-label="Table view"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
              className={`rounded-md p-1.5 transition-all duration-300 hover:scale-[1.04] active:scale-[0.96] ${
                view === "table" ? "bg-slate-900 shadow-sm" : "hover:bg-white"
              }`}
              style={{ transitionTimingFunction: EASE }}
            >
              <TableIcon active={view === "table"} />
            </button>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close trend panel"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-800 active:scale-95"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 py-3">
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-xs font-medium text-slate-500">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
            Loading {isWeekMode ? "weekly" : "monthly"} trend…
          </div>
        ) : view === "table" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 items-stretch gap-1">
              {canPageMonths ? (
                <PagerButton
                  dir="prev"
                  disabled={!canMonthPrev}
                  onClick={() => setMonthPage((p) => Math.max(0, p - 1))}
                />
              ) : null}
              <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm">
                    <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-2.5">{periodNoun}</th>
                      {isWeekMode ? (
                        <th className="px-3 py-2.5">Dates</th>
                      ) : null}
                      <th className="px-3 py-2.5 text-right">Old %</th>
                      <th className="hidden px-3 py-2.5 text-right sm:table-cell">New</th>
                      <th className="hidden px-3 py-2.5 text-right sm:table-cell">Old</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isWeekMode ? displayPoints : [...displayPoints].reverse()).map((p) => (
                      <tr
                        key={p.period}
                        className={`border-b border-slate-50 transition-colors hover:bg-slate-50/80 ${
                          isPlaceholder ? "text-slate-400" : ""
                        }`}
                      >
                        <td className="px-3 py-2.5 font-semibold text-slate-800">
                          {periodShortLabel(p, isWeekMode)}
                        </td>
                        {isWeekMode ? (
                          <td className="px-3 py-2.5 text-slate-500">
                            {p.rangeLabel?.trim() || "—"}
                          </td>
                        ) : null}
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                          {Math.round(Number(p.oldSharePercent ?? 0))}%
                        </td>
                        <td className="hidden px-3 py-2.5 text-right tabular-nums text-slate-500 sm:table-cell">
                          {p.newCount}
                        </td>
                        <td className="hidden px-3 py-2.5 text-right tabular-nums text-slate-500 sm:table-cell">
                          {p.oldCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canPageMonths ? (
                <PagerButton
                  dir="next"
                  disabled={!canMonthNext}
                  onClick={() =>
                    setMonthPage((p) => Math.min(monthPageCount - 1, p + 1))
                  }
                />
              ) : null}
            </div>
            {renderPager()}
            {renderChartFootnote()}
          </div>
        ) : (
          <div className="relative flex flex-1 flex-col justify-center">
            <div className="flex items-center gap-1">
              {canPageMonths ? (
                <PagerButton
                  dir="prev"
                  disabled={!canMonthPrev}
                  onClick={() => setMonthPage((p) => Math.max(0, p - 1))}
                />
              ) : null}
              <div className="relative min-w-0 flex-1 pt-14">
                {activePoint ? <DetailBox point={activePoint} /> : null}
                <svg
                  viewBox="0 0 280 160"
                  className="h-auto w-full"
                  role="img"
                  aria-label="Old lead share trend line chart"
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  {[0, 20, 40, 60, 80, 100].map((tick) => {
                    const y = 160 - 22 - (tick / 100) * (160 - 44);
                    return (
                      <g key={tick}>
                        <line x1={28} x2={272} y1={y} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                        <text x={4} y={y + 3} fontSize={9} fill="#94a3b8">
                          {tick}
                        </text>
                      </g>
                    );
                  })}
                  {!isPlaceholder && activeIdx != null && coords[activeIdx] ? (
                    <line
                      x1={coords[activeIdx]!.x}
                      x2={coords[activeIdx]!.x}
                      y1={22}
                      y2={138}
                      stroke="#cbd5e1"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                  ) : null}
                  <path
                    d={lineD}
                    fill="none"
                    stroke={isPlaceholder ? "#cbd5e1" : "#2563eb"}
                    strokeWidth={isPlaceholder ? 2 : 2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {coords.map((c, i) => (
                    <g key={displayPoints[i]?.period ?? i}>
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r={
                          activeIdx === i && !isPlaceholder
                            ? 6
                            : 3.5
                        }
                        fill={isPlaceholder ? "#cbd5e1" : "#2563eb"}
                        stroke="#fff"
                        strokeWidth={2}
                        className="cursor-pointer transition-all duration-200"
                        onMouseEnter={() => !isPlaceholder && setHoverIdx(i)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isPlaceholder) return;
                          setPinnedIdx((prev) => (prev === i ? null : i));
                        }}
                      />
                      {!isPlaceholder ? (
                        <rect
                          x={c.x - 18}
                          y={0}
                          width={36}
                          height={160}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoverIdx(i)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPinnedIdx((prev) => (prev === i ? null : i));
                          }}
                        />
                      ) : null}
                    </g>
                  ))}
                </svg>
              </div>
              {canPageMonths ? (
                <PagerButton
                  dir="next"
                  disabled={!canMonthNext}
                  onClick={() =>
                    setMonthPage((p) => Math.min(monthPageCount - 1, p + 1))
                  }
                />
              ) : null}
            </div>
            {renderPager()}
            <div className="mt-2 flex justify-between gap-0.5 px-1">
              {displayPoints.map((p, i) => (
                <button
                  key={p.period}
                  type="button"
                  disabled={isPlaceholder}
                  onClick={() =>
                    !isPlaceholder &&
                    setPinnedIdx((prev) => (prev === i ? null : i))
                  }
                  className={`flex flex-1 flex-col items-center gap-0.5 text-center transition-colors ${
                    !isPlaceholder && activeIdx === i
                      ? "text-blue-600"
                      : "text-slate-400"
                  } ${isPlaceholder ? "cursor-default" : "cursor-pointer hover:text-slate-600"}`}
                >
                  <span className="text-[10px] font-semibold">
                    {periodShortLabel(p, isWeekMode)}
                  </span>
                  {isWeekMode && p.rangeLabel?.trim() ? (
                    <span className="max-w-[4.5rem] truncate text-[8px] font-medium leading-tight text-slate-400">
                      {p.rangeLabel.trim()}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            {renderChartFootnote()}
          </div>
        )}
      </div>
    </div>
  );
}
