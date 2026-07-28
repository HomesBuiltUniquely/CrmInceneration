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

// SVG arc-ring progress indicator for achievement %
function AchievementRing({ pct }: { pct: number }) {
  const r = 18;
  const cx = 22;
  const cy = 22;
  const circumference = 2 * Math.PI * r;
  const fill = Math.min(100, Math.max(0, pct));
  const dash = (fill / 100) * circumference;
  const color =
    fill >= 100 ? "#10b981" : fill >= 70 ? "#f59e0b" : "#ef4444";
  const trackColor =
    fill >= 100 ? "#d1fae5" : fill >= 70 ? "#fef3c7" : "#fee2e2";

  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      {/* track ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth="4"
      />
      {/* filled arc */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={`${dash} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      {/* centre label */}
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="8.5"
        fontWeight="700"
        fill={color}
      >
        {fill}%
      </text>
    </svg>
  );
}

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
            <table className="min-w-[1320px] w-full table-fixed">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-8 py-4 w-[200px]">Salesperson</th>
                  <th className="px-4 py-4 w-[72px]">Leads</th>
                  <th className="px-4 py-4 w-[86px]">Meetings</th>
                  <th className="px-4 py-4 w-[90px]">Proposals</th>
                  <th className="px-4 py-4 w-[76px]">Closed</th>
                  <th className="px-4 py-4 w-[82px]">Value</th>
                  <th className="px-4 py-4 w-[76px]">Conv %</th>
                  {/* Incentive columns */}
                  <th className="px-4 py-4 w-[140px]">
                    <span className="inline-flex items-center gap-1">
                      <span>🎯</span> Target
                    </span>
                  </th>
                  <th className="px-4 py-4 w-[140px]">
                    <span className="inline-flex items-center gap-1">
                      <span>✦</span> Achieved
                    </span>
                  </th>
                  <th className="px-4 py-4 w-[110px] text-center">
                    Achiev&nbsp;%
                  </th>
                </tr>
              </thead>
              <tbody>
                {team.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="border-b border-gray-100 px-8 py-6 text-sm text-gray-500"
                    >
                      No team performance rows for this filter.
                    </td>
                  </tr>
                ) : (
                  team.map((member) => {
                    const good = member.conversionPercent >= 10;

                    // ── Incentive maths ──────────────────────────────
                    const hasIncentive =
                      member.targetIncentive != null &&
                      member.targetIncentive > 0;

                    const rawPct = hasIncentive
                      ? ((member.achievedIncentive ?? 0) /
                          member.targetIncentive!) *
                        100
                      : null;

                    // capped at 100 for the ring display
                    const achievedPct =
                      rawPct != null
                        ? Math.min(100, Math.round(rawPct))
                        : null;

                    // raw display pct — can exceed 100 for overachievement
                    const displayPct =
                      rawPct != null ? Math.round(rawPct) : null;

                    const incentiveTone =
                      achievedPct == null
                        ? "text-gray-400"
                        : achievedPct >= 100
                          ? "text-emerald-600"
                          : achievedPct >= 70
                            ? "text-amber-600"
                            : "text-red-500";

                    const statusLabel =
                      displayPct == null
                        ? null
                        : displayPct >= 100
                          ? "🏆 Achieved"
                          : displayPct >= 70
                            ? "⚡ On Track"
                            : "⚠ Below";

                    const statusCls =
                      displayPct == null
                        ? ""
                        : displayPct >= 100
                          ? "bg-emerald-50 text-emerald-700"
                          : displayPct >= 70
                            ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-600";

                    return (
                      <tr
                        key={String(member.userId || member.name)}
                        className="transition-colors hover:bg-gray-50"
                      >
                        {/* Salesperson */}
                        <td className="border-b border-gray-100 px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-700">
                              {(member.name || "?").charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate font-semibold text-gray-800 text-sm">
                                {member.name}
                              </h3>
                              <p className="truncate text-[10px] uppercase tracking-wide text-gray-400">
                                {member.role}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Leads */}
                        <td className="border-b border-gray-100 px-4 py-5 font-medium text-gray-700 text-sm">
                          {formatInsightsCount(member.leads)}
                        </td>

                        {/* Meetings */}
                        <td className="border-b border-gray-100 px-4 py-5 font-medium text-gray-700 text-sm">
                          {formatInsightsCount(member.meetings)}
                        </td>

                        {/* Proposals */}
                        <td className="border-b border-gray-100 px-4 py-5 font-medium text-gray-700 text-sm">
                          {formatInsightsCount(member.proposals)}
                        </td>

                        {/* Closed */}
                        <td className="border-b border-gray-100 px-4 py-5 font-semibold text-gray-900 text-sm">
                          {formatInsightsCount(member.closed)}
                        </td>

                        {/* Value */}
                        <td className="border-b border-gray-100 px-4 py-5 font-semibold text-gray-900 text-sm">
                          {formatInsightsInrCompact(member.closedValue)}
                        </td>

                        {/* Conv % */}
                        <td className="border-b border-gray-100 px-4 py-5">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              good
                                ? "bg-green-50 text-green-600"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {formatInsightsPercent(member.conversionPercent)}
                          </span>
                        </td>

                        {/* 🎯 Target Incentive */}
                        <td className="border-b border-gray-100 px-4 py-5">
                          {hasIncentive ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                                🎯{" "}
                                {formatInsightsInrCompact(
                                  member.targetIncentive!,
                                )}
                              </span>
                              <span className="text-[10px] text-gray-400 pl-0.5">
                                Monthly Target
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-gray-300">
                              —
                            </span>
                          )}
                        </td>

                        {/* ✦ Achieved Amount */}
                        <td className="border-b border-gray-100 px-4 py-5">
                          {hasIncentive ? (
                            <div className="flex flex-col gap-1">
                              <span
                                className={`text-sm font-bold ${incentiveTone}`}
                              >
                                {formatInsightsInrCompact(
                                  member.achievedIncentive ?? 0,
                                )}
                              </span>
                              {statusLabel ? (
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusCls}`}
                                >
                                  {statusLabel}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-gray-300">
                              —
                            </span>
                          )}
                        </td>

                        {/* Achievement % Ring */}
                        <td className="border-b border-gray-100 px-4 py-5">
                          <div className="flex items-center justify-center">
                            {hasIncentive && achievedPct != null ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <AchievementRing pct={achievedPct} />
                                {displayPct != null && displayPct > 100 ? (
                                  <span className="text-[10px] font-semibold text-emerald-600">
                                    +{displayPct - 100}% over
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-gray-300">
                                —
                              </span>
                            )}
                          </div>
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
