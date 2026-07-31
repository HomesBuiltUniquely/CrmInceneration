"use client";

import {
  formatInsightsCount,
  formatInsightsInrCompact,
  formatInsightsPercent,
  type InsightsTeamMember,
} from "@/lib/crm-insights-api";

type Props = {
  team: InsightsTeamMember[];
  teamPeriod: "daily" | "monthly";
  onTeamPeriodChange: (period: "daily" | "monthly") => void;
};

export default function InsightSect5({
  team,
  teamPeriod,
  onTeamPeriodChange,
}: Props) {
  return (
    <main className="px-4 lg:px-0">
      <div className="mt-10 flex justify-center">
        <div className="w-full max-w-[1290px] rounded-2xl border border-gray-100 bg-white shadow-md">
          <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">
              Team Performance Matrix
            </h2>

            <div className="flex overflow-hidden rounded-lg border border-gray-200 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => onTeamPeriodChange("daily")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  teamPeriod === "daily"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => onTeamPeriodChange("monthly")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  teamPeriod === "monthly"
                    ? "bg-slate-900 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Monthly
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-8 py-4">Salesperson</th>
                  <th className="py-4">Leads</th>
                  <th className="py-4">Meetings</th>
                  <th className="py-4">Proposals</th>
                  <th className="py-4">Closed</th>
                  <th className="py-4">Value</th>
                  <th className="py-4">Conv %</th>
                </tr>
              </thead>
              <tbody>
                {team.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="border-b border-gray-100 px-8 py-6 text-sm text-gray-500"
                    >
                      No team performance rows for this filter.
                    </td>
                  </tr>
                ) : (
                  team.map((member) => {
                    const good = member.conversionPercent >= 10;
                    return (
                      <tr
                        key={String(member.userId || member.name)}
                        className="transition-colors hover:bg-gray-50"
                      >
                        <td className="border-b border-gray-100 px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-700 sm:h-12 sm:w-12 sm:text-lg">
                              {(member.name || "?").charAt(0)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-800">
                                {member.name}
                              </h3>
                              <p className="text-xs uppercase tracking-wide text-gray-400">
                                {member.role}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-gray-100 font-medium text-gray-700">
                          {formatInsightsCount(member.leads)}
                        </td>
                        <td className="border-b border-gray-100 font-medium text-gray-700">
                          {formatInsightsCount(member.meetings)}
                        </td>
                        <td className="border-b border-gray-100 font-medium text-gray-700">
                          {formatInsightsCount(member.proposals)}
                        </td>
                        <td className="border-b border-gray-100 font-semibold text-gray-900">
                          {formatInsightsCount(member.closed)}
                        </td>
                        <td className="border-b border-gray-100 font-semibold text-gray-900">
                          {formatInsightsInrCompact(member.closedValue)}
                        </td>
                        <td className="border-b border-gray-100">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              good
                                ? "bg-green-50 text-green-600"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {formatInsightsPercent(member.conversionPercent)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
