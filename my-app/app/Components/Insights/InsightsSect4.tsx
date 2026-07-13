"use client";

import {
  formatInsightsCount,
  formatInsightsTrendDays,
  type InsightsDashboard,
  type InsightsStageVelocity,
} from "@/lib/crm-insights-api";

type Props = {
  dropReasons: InsightsDashboard["dropReasons"];
  stageVelocity: InsightsStageVelocity[];
};

function trendTone(trendDays: number): string {
  if (trendDays < 0) return "bg-green-50 text-green-600";
  if (trendDays > 0) return "bg-red-50 text-red-600";
  return "bg-gray-100 text-gray-500";
}

export default function InsightSect4({ dropReasons, stageVelocity }: Props) {
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
                {formatInsightsCount(dropReasons.total)} Total
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[600px] w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-400">
                    <th className="px-3 py-4">Reason</th>
                    <th className="py-4">Count</th>
                    <th className="py-4">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {dropReasons.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="border-b border-gray-100 px-3 py-5 text-sm text-gray-500"
                      >
                        No drop reasons for this filter.
                      </td>
                    </tr>
                  ) : (
                    dropReasons.items.map((item) => (
                      <tr
                        key={item.reason}
                        className="transition-colors hover:bg-gray-50"
                      >
                        <td className="border-b border-gray-100 px-3 py-5 font-medium text-gray-700">
                          {item.reason}
                        </td>
                        <td className="border-b border-gray-100 font-semibold text-gray-900">
                          {formatInsightsCount(item.count)}
                        </td>
                        <td className="border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                              {Math.round(item.percent)}%
                            </span>
                            <div className="h-2.5 flex-1 rounded-full bg-gray-100">
                              <div
                                className="h-2.5 rounded-full bg-red-500"
                                style={{
                                  width: `${Math.min(100, Math.max(0, item.percent))}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
                        No stage velocity data for this filter.
                      </td>
                    </tr>
                  ) : (
                    stageVelocity.map((item) => (
                      <tr
                        key={`${item.fromStage}-${item.toStage}`}
                        className="transition-colors hover:bg-gray-50"
                      >
                        <td className="border-b border-gray-100 px-3 py-5 text-gray-700">
                          {item.fromStage} → {item.toStage}
                        </td>
                        <td className="border-b border-gray-100 font-semibold text-gray-900">
                          {item.avgDays.toFixed(1)} Days
                        </td>
                        <td className="border-b border-gray-100">
                          <span
                            className={`rounded-full px-3 py-1 text-sm font-semibold ${trendTone(item.trendDays)}`}
                          >
                            {formatInsightsTrendDays(item.trendDays)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
