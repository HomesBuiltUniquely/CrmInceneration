"use client";

import { useMemo } from "react";
import {
  formatInsightsCount,
  formatInsightsTrendDays,
  type InsightsDashboard,
  type InsightsStageVelocity,
} from "@/lib/crm-insights-api";
import { reconcileDropReasonsToTotal } from "@/lib/lead-lost-segment";

type Props = {
  dropReasons: InsightsDashboard["dropReasons"];
  /** When set (Lost Funnel Total), drop reasons are reconciled so counts sum exactly. */
  lostTotalOverride?: number | null;
  /** Hub `stageVelocity` only — completed transition avgs, not FE-derived. */
  stageVelocity: InsightsStageVelocity[];
};

/** Visible rows before scroll (~6 reasons). */
const DROP_REASON_VISIBLE_ROWS = 6;
const DROP_REASON_ROW_HEIGHT_PX = 68;
const DROP_REASON_SCROLL_MAX_PX = DROP_REASON_VISIBLE_ROWS * DROP_REASON_ROW_HEIGHT_PX;

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

function hasAnyVelocityData(rows: InsightsStageVelocity[]): boolean {
  return rows.some((r) => Number.isFinite(r.avgDays) && r.avgDays > 0);
}

export default function InsightSect4({
  dropReasons,
  lostTotalOverride,
  stageVelocity,
}: Props) {
  const reconciled = useMemo(
    () => reconcileDropReasonsToTotal(dropReasons, lostTotalOverride),
    [dropReasons, lostTotalOverride],
  );

  const sortedDropItems = reconciled.items;
  const needsDropScroll = sortedDropItems.length > DROP_REASON_VISIBLE_ROWS;
  const showVelocityEmpty =
    stageVelocity.length === 0 || !hasAnyVelocityData(stageVelocity);

  return (
    <main className="px-4 lg:px-0">
      <div className="mt-10 flex justify-center">
        <div className="flex w-full max-w-[1320px] flex-col gap-6 lg:flex-row lg:gap-8">
          <div className="w-full rounded-2xl border border-gray-100 bg-white p-5 shadow-md sm:p-6 lg:w-[720px] lg:p-7">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">
                Drop Reason Analysis
              </h2>
              <span className="w-fit rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-600">
                {formatInsightsCount(reconciled.total)} Total
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[600px] w-full table-fixed">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-400">
                    <th className="w-[58%] px-3 py-4">Reason</th>
                    <th className="w-[22%] py-4 pr-4 text-right">Count</th>
                    <th className="w-[20%] py-4 pr-3 text-right">Percentage</th>
                  </tr>
                </thead>
              </table>

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
                <table className="min-w-[600px] w-full table-fixed">
                  <tbody>
                    {sortedDropItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="border-b border-gray-100 px-3 py-5 text-sm text-gray-500"
                        >
                          No drop reasons for this filter.
                        </td>
                      </tr>
                    ) : (
                      sortedDropItems.map((item) => (
                        <tr
                          key={item.reason}
                          className="group border-b border-gray-100 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_8px_22px_rgba(15,23,42,0.08)]"
                        >
                          <td className="w-[58%] px-3 py-4 align-middle font-medium text-gray-700 transition-colors group-hover:text-gray-900">
                            <span className="line-clamp-2">{item.reason}</span>
                          </td>
                          <td className="w-[22%] py-4 pr-4 text-right align-middle font-semibold tabular-nums text-gray-900">
                            {formatInsightsCount(item.count)}
                          </td>
                          <td className="w-[20%] py-4 pr-3 text-right align-middle">
                            <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-semibold tabular-nums text-red-600 transition-shadow group-hover:shadow-sm">
                              {Math.round(item.percent)}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {needsDropScroll ? (
              <p className="mt-3 text-center text-[11px] font-medium text-gray-400">
                Scroll to see all {formatInsightsCount(sortedDropItems.length)} reasons
              </p>
            ) : null}
          </div>

          <div className="w-full rounded-2xl border border-gray-100 bg-white p-5 shadow-md sm:p-6 lg:w-[560px] lg:p-7">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">
                Stage Velocity
              </h2>
              <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-600">
                Avg Days
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[500px] w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-400">
                    <th className="px-3 py-4">Sales Phase</th>
                    <th className="py-4">Duration</th>
                    <th className="py-4">Trend</th>
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
                            className={`px-3 py-5 ${muted ? "text-gray-400" : "text-gray-700"}`}
                          >
                            {item.fromStage} → {item.toStage}
                          </td>
                          <td
                            className={`font-semibold tabular-nums ${
                              muted ? "text-gray-400" : "text-gray-900"
                            }`}
                          >
                            {Number(item.avgDays ?? 0).toFixed(1)} Days
                          </td>
                          <td>
                            <span
                              className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${trendTone(item.trendDays)}`}
                              title={
                                item.trendDays < 0
                                  ? "Faster than previous period"
                                  : item.trendDays > 0
                                    ? "Slower than previous period"
                                    : "No change vs previous period"
                              }
                            >
                              {formatInsightsTrendDays(item.trendDays)}
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
