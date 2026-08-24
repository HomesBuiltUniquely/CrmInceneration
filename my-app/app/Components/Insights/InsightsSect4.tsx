"use client";

import { useMemo, useState } from "react";
import {
  formatInsightsCount,
  formatInsightsDuration,
  type InsightsDashboard,
  type InsightsStageVelocity,
} from "@/lib/crm-insights-api";
import { reconcileDropReasonsToTotal } from "@/lib/lead-lost-segment";
import {
  INSIGHTS_FUNNEL_STAGE_DEFS,
  type FunnelStagePathDataMap,
} from "@/lib/insights-funnel-stage-paths";
import InsightsInfoTip from "./InsightsInfoTip";

type DropItem = { reason: string; count: number; percent: number };

type Props = {
  dropReasons: InsightsDashboard["dropReasons"];
  /** When set (Lost Funnel Total), drop reasons are reconciled so counts sum exactly. */
  lostTotalOverride?: number | null;
  /** Per-milestone lost substages — same source as Sales Funnel Lost Path. */
  stagePathData?: FunnelStagePathDataMap;
  stagePathLoading?: boolean;
  /** Hub `stageVelocity` only — completed transition avgs, not FE-derived. */
  stageVelocity: InsightsStageVelocity[];
};

/** Visible rows before scroll (~6 reasons). */
const DROP_REASON_VISIBLE_ROWS = 6;
const DROP_REASON_ROW_HEIGHT_PX = 72;
const DROP_REASON_SCROLL_MAX_PX = DROP_REASON_VISIBLE_ROWS * DROP_REASON_ROW_HEIGHT_PX;

const MILESTONE_LOST_DEFS = INSIGHTS_FUNNEL_STAGE_DEFS.filter(
  (d) => d.stageKey !== "fresh_lead",
);

type MilestoneFilter = "all" | (typeof MILESTONE_LOST_DEFS)[number]["stageKey"];

/** Hub checkpoint meanings for tooltips (not FE calculation). */
const STAGE_VELOCITY_TOOLTIPS: Record<string, string> = {
  "Discovery→Connection":
    "Time from entering Discovery/Fresh Lead until Connection milestone.",
  "Connection→Design Meeting":
    "Time from Connection until Meeting Scheduled (design meeting fixed).",
  "Design→Proposal":
    "Time after Meeting Successful until Quote Sent to Customer (process flag, not a pipeline milestone).",
  "Proposal→Closed Won":
    "Time after Quote Sent until Closed Won (Token Done / Booking Done).",
};

function stageVelocityTooltip(fromStage: string, toStage: string): string | undefined {
  return STAGE_VELOCITY_TOOLTIPS[`${fromStage}→${toStage}`];
}

function trendTone(trendDays: number): string {
  if (trendDays < 0) return "bg-green-50 text-green-600";
  if (trendDays > 0) return "bg-red-50 text-red-600";
  return "bg-gray-100 text-gray-500";
}

function formatTrendLabel(trendDays: number): string {
  const v = Number(trendDays);
  if (!Number.isFinite(v) || v === 0) return "Same";
  if (v < 0) return `Faster · ${formatInsightsDuration(Math.abs(v))}`;
  return `Slower · ${formatInsightsDuration(v)}`;
}

function hasAnyVelocityData(rows: InsightsStageVelocity[]): boolean {
  return rows.some((r) => Number.isFinite(r.avgDays) && r.avgDays > 0);
}

function toDropItems(
  rows: Array<{ title: string; count: number }>,
  total: number,
): DropItem[] {
  return [...rows]
    .filter((r) => (Number(r.count) || 0) > 0)
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
    .map((r) => ({
      reason: r.title,
      count: r.count,
      percent: total > 0 ? (r.count / total) * 100 : 0,
    }));
}

const MILESTONE_ACCENT: Record<string, { chip: string; bar: string; soft: string }> = {
  discovery: {
    chip: "border-violet-200 bg-violet-50 text-violet-800",
    bar: "bg-violet-500",
    soft: "bg-violet-100 text-violet-700",
  },
  connection: {
    chip: "border-sky-200 bg-sky-50 text-sky-800",
    bar: "bg-sky-500",
    soft: "bg-sky-100 text-sky-700",
  },
  exp_design: {
    chip: "border-amber-200 bg-amber-50 text-amber-900",
    bar: "bg-amber-500",
    soft: "bg-amber-100 text-amber-800",
  },
  decision: {
    chip: "border-rose-200 bg-rose-50 text-rose-800",
    bar: "bg-rose-500",
    soft: "bg-rose-100 text-rose-700",
  },
  closed: {
    chip: "border-slate-300 bg-slate-100 text-slate-800",
    bar: "bg-slate-600",
    soft: "bg-slate-200 text-slate-700",
  },
};

export default function InsightSect4({
  dropReasons,
  lostTotalOverride,
  stagePathData = {},
  stagePathLoading = false,
  stageVelocity,
}: Props) {
  const [milestoneFilter, setMilestoneFilter] = useState<MilestoneFilter>("all");

  const reconciledAll = useMemo(
    () => reconcileDropReasonsToTotal(dropReasons, lostTotalOverride),
    [dropReasons, lostTotalOverride],
  );

  const milestoneChips = useMemo(() => {
    return MILESTONE_LOST_DEFS.map((def) => {
      const path = stagePathData[def.stageKey];
      const count = Number(path?.lostTotal) || 0;
      return {
        key: def.stageKey as MilestoneFilter,
        label: def.stageLabel,
        phaseLabel: def.phaseLabel,
        count,
      };
    });
  }, [stagePathData]);

  const hasMilestonePathData = milestoneChips.some((c) => c.count > 0);

  const activeView = useMemo(() => {
    if (milestoneFilter === "all" || !hasMilestonePathData) {
      return {
        title: "All milestones",
        subtitle: "Lost reasons across the full sales journey",
        total: reconciledAll.total,
        items: reconciledAll.items,
        accentKey: "closed",
      };
    }
    const def = MILESTONE_LOST_DEFS.find((d) => d.stageKey === milestoneFilter);
    const path = stagePathData[milestoneFilter];
    const total = Number(path?.lostTotal) || 0;
    return {
      title: def?.phaseLabel ?? milestoneFilter,
      subtitle: `Lost at ${def?.phaseLabel ?? "this"} milestone`,
      total,
      items: toDropItems(path?.lostSubstages ?? [], total),
      accentKey: milestoneFilter,
    };
  }, [milestoneFilter, hasMilestonePathData, reconciledAll, stagePathData]);

  const sortedDropItems = activeView.items;
  const needsDropScroll = sortedDropItems.length > DROP_REASON_VISIBLE_ROWS;
  const showVelocityEmpty =
    stageVelocity.length === 0 || !hasAnyVelocityData(stageVelocity);
  const accent = MILESTONE_ACCENT[activeView.accentKey] ?? MILESTONE_ACCENT.closed;
  const maxCount = Math.max(...sortedDropItems.map((i) => i.count), 1);

  return (
    <main className="px-4 lg:px-0">
      <div className="mt-10 flex justify-center">
        <div className="flex w-full max-w-[1320px] flex-col gap-6 lg:flex-row lg:gap-8">
          <div className="w-full rounded-2xl border border-gray-100 bg-white p-5 shadow-md sm:p-6 lg:w-[720px] lg:p-7">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">
                  Drop Reason Analysis
                </h2>
                <p className="mt-1 text-[12px] font-medium text-gray-400">
                  {activeView.subtitle}
                </p>
              </div>
              <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-sm font-semibold tabular-nums text-red-600">
                {stagePathLoading && !hasMilestonePathData
                  ? "…"
                  : formatInsightsCount(activeView.total)}{" "}
                Lost
              </span>
            </div>

            {hasMilestonePathData || stagePathLoading ? (
              <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => setMilestoneFilter("all")}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-wide transition-all duration-200 ${
                    milestoneFilter === "all"
                      ? "border-rose-300 bg-rose-50 text-rose-800 shadow-sm"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  All
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums ${
                      milestoneFilter === "all"
                        ? "bg-rose-500 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {formatInsightsCount(reconciledAll.total)}
                  </span>
                </button>
                {milestoneChips.map((chip) => {
                  const selected = milestoneFilter === chip.key;
                  const tone = MILESTONE_ACCENT[chip.key] ?? MILESTONE_ACCENT.closed;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setMilestoneFilter(chip.key)}
                      title={`${chip.phaseLabel} lost`}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-wide transition-all duration-200 ${
                        selected
                          ? `${tone.chip} shadow-sm`
                          : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {chip.label}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums ${
                          selected ? tone.soft : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {formatInsightsCount(chip.count)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div
              className={`insights-drop-reason-scroll ${
                needsDropScroll
                  ? "overflow-y-auto overscroll-contain pr-1"
                  : "overflow-visible"
              }`}
              style={
                needsDropScroll
                  ? { maxHeight: `${DROP_REASON_SCROLL_MAX_PX}px` }
                  : undefined
              }
            >
              {sortedDropItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-gray-600">
                    {stagePathLoading
                      ? "Loading milestone lost data…"
                      : milestoneFilter === "all"
                        ? "No drop reasons for this filter."
                        : `No lost leads in ${activeView.title} yet.`}
                  </p>
                  <p className="mt-1 text-[12px] text-gray-400">
                    Switch milestone to explore where leads drop off.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {sortedDropItems.map((item, index) => {
                    const widthPct = Math.max(4, (item.count / maxCount) * 100);
                    const showAcrossLabel =
                      milestoneFilter === "all" && hasMilestonePathData;
                    return (
                      <li
                        key={`${item.reason}-${index}`}
                        className="group rounded-xl border border-gray-100 bg-white px-3.5 py-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.07)]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-baseline gap-2">
                              <p className="min-w-0 truncate text-[13px] font-semibold text-gray-800 group-hover:text-gray-950">
                                {item.reason}
                              </p>
                              {showAcrossLabel ? (
                                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                                  Across milestones
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                              <div
                                className={`h-1.5 rounded-full ${accent.bar} transition-all duration-500 ease-out`}
                                style={{ width: `${widthPct}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex w-14 shrink-0 flex-col items-end gap-1">
                            <span className="text-sm font-extrabold tabular-nums leading-none text-gray-900">
                              {formatInsightsCount(item.count)}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${accent.soft}`}
                            >
                              {Math.round(item.percent)}%
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {needsDropScroll ? (
              <p className="mt-3 text-center text-[11px] font-medium text-gray-400">
                Scroll · {formatInsightsCount(sortedDropItems.length)} reasons
                {milestoneFilter !== "all" ? ` in ${activeView.title}` : ""}
              </p>
            ) : null}
          </div>

          <div className="w-full rounded-2xl border border-gray-100 bg-white p-5 shadow-md sm:p-6 lg:w-[560px] lg:p-7">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">
                    Stage Velocity
                  </h2>
                  <InsightsInfoTip
                    label="How Stage Velocity is counted"
                    math={
                      <span className="space-y-1">
                        <span className="block">
                          Hub already sends two numbers. This screen only displays them.
                        </span>
                        <span className="mt-1 block font-semibold text-gray-600">
                          Duration = avgDays (typical wait for that step)
                        </span>
                        <span className="block">
                          Trend = this wait − last wait
                        </span>
                        <span className="mt-1 block text-gray-400">
                          Example: 7h now, 1d 7h last → Faster by 1 day
                        </span>
                      </span>
                    }
                  >
                    How long a lead usually waits before the next sales step.
                    Hover Duration or Trend for each column.
                  </InsightsInfoTip>
                </div>
                <p className="mt-1 text-[12px] font-medium text-gray-400">
                  How long leads take between steps
                </p>
              </div>
              <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-600">
                Avg time
              </span>
            </div>

            <div className="overflow-visible">
              <table className="w-full table-fixed">
                <colgroup>
                  <col className="w-[42%]" />
                  <col className="w-[22%]" />
                  <col className="w-[36%]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 text-left text-[10px] uppercase tracking-wider text-gray-400 sm:text-xs">
                    <th className="px-2 py-3 sm:px-3 sm:py-4">Sales Phase</th>
                    <th className="py-3 sm:py-4">
                      <InsightsInfoTip
                        side="top"
                        label="How duration is counted"
                        trigger="Duration"
                        math={
                          <span className="space-y-1">
                            <span className="block">Start from Hub avgDays (in days).</span>
                            <span className="block">• Under 1 hour → show minutes</span>
                            <span className="block">• Under 1 day → days × 24 = hours</span>
                            <span className="block">• 1 day or more → days + leftover hours</span>
                            <span className="mt-1 block text-gray-400">
                              Example: 0.3 days × 24 = 7.2h
                            </span>
                          </span>
                        }
                      >
                        Typical wait time for this step. Less than a day is shown
                        as hours, like 7h.
                      </InsightsInfoTip>
                    </th>
                    <th className="py-3 pr-1 sm:py-4">
                      <InsightsInfoTip
                        side="top"
                        align="right"
                        label="How trend is counted"
                        trigger="Trend"
                        math={
                          <span className="space-y-1">
                            <span className="block font-semibold text-gray-600">
                              this period’s wait − last period’s wait
                            </span>
                            <span className="block">• Result below 0 → Faster</span>
                            <span className="block">• Result above 0 → Slower</span>
                            <span className="block">• Result is 0 → Same</span>
                            <span className="mt-1 block text-gray-400">
                              Example: 7h − 1d 7h = Faster 1d
                            </span>
                          </span>
                        }
                      >
                        Compared with the last same stretch of time. Faster means
                        leads moved quicker. Slower means they took longer. Same
                        means no change yet.
                      </InsightsInfoTip>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stageVelocity.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="border-b border-gray-100 px-3 py-5 text-sm text-gray-500"
                      >
                        No velocity data yet
                      </td>
                    </tr>
                  ) : (
                    stageVelocity.map((item) => {
                      const tip = stageVelocityTooltip(item.fromStage, item.toStage);
                      const muted = !Number.isFinite(item.avgDays) || item.avgDays <= 0;
                      return (
                        <tr
                          key={`${item.fromStage}-${item.toStage}`}
                          title={tip}
                          className="border-b border-gray-100 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_8px_22px_rgba(15,23,42,0.08)]"
                        >
                          <td
                            className={`truncate px-2 py-4 text-[13px] sm:px-3 sm:py-5 sm:text-sm ${muted ? "text-gray-400" : "text-gray-700"}`}
                          >
                            {item.fromStage} → {item.toStage}
                          </td>
                          <td
                            className={`whitespace-nowrap font-semibold tabular-nums ${
                              muted ? "text-gray-400" : "text-gray-900"
                            }`}
                            title={
                              muted
                                ? undefined
                                : `${Number(item.avgDays ?? 0).toFixed(2)} days average`
                            }
                          >
                            {formatInsightsDuration(item.avgDays)}
                          </td>
                          <td className="pr-1">
                            <span
                              className={`inline-flex max-w-full truncate rounded-full px-2 py-1 text-[10px] font-semibold sm:px-2.5 sm:text-[11px] ${trendTone(item.trendDays)}`}
                              title={
                                item.trendDays < 0
                                  ? "This phase is faster than the previous period"
                                  : item.trendDays > 0
                                    ? "This phase is slower than the previous period"
                                    : "Same speed as the previous period — no change yet"
                              }
                            >
                              {formatTrendLabel(item.trendDays)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {showVelocityEmpty && stageVelocity.length > 0 ? (
              <p className="mt-3 text-center text-[11px] font-medium text-gray-400">
                No velocity data yet — averages update as completed transitions are logged
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
