"use client";

import {
  formatInsightsCount,
  formatInsightsInrCompact,
  formatInsightsPercent,
  type InsightsTeamMember,
} from "@/lib/crm-insights-api";

type Props = {
  team: InsightsTeamMember[];
  /** e.g. All time · Insights date filter */
  incentiveScopeLabel?: string;
  incentivesLoading?: boolean;
};

const TEAM_VISIBLE_ROWS = 7;
const TEAM_ROW_HEIGHT_PX = 60;
const TEAM_SCROLL_MAX_PX = TEAM_VISIBLE_ROWS * TEAM_ROW_HEIGHT_PX;

/** No Value column — closed $ is not shown (Achieved/Payoff cover incentives money). */
const COLS =
  "grid-cols-[minmax(180px,1.4fr)_minmax(56px,0.55fr)_minmax(72px,0.6fr)_minmax(80px,0.65fr)_minmax(56px,0.55fr)_minmax(64px,0.55fr)_minmax(88px,0.75fr)_minmax(80px,0.7fr)]";

function convTone(percent: number): string {
  if (percent >= 10) return "bg-green-50 text-green-600";
  return "bg-red-50 text-red-600";
}

function payoffTone(payoff: number): string {
  if (payoff > 0) return "text-emerald-700";
  return "text-gray-400";
}

export default function InsightSect5({
  team,
  incentiveScopeLabel,
  incentivesLoading = false,
}: Props) {
  const needsScroll = team.length > TEAM_VISIBLE_ROWS;

  return (
    <main className="px-4 lg:px-0">
      <div className="mt-8 flex justify-center">
        <div className="w-full max-w-[1320px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md">
          <div className="border-b border-gray-100 px-4 py-3.5 sm:px-6">
            <h2 className="text-lg font-bold leading-tight text-gray-900 sm:text-xl">
              Team Performance Matrix
            </h2>
            <p className="mt-0.5 text-[11px] text-gray-400">
              {incentivesLoading
                ? "Loading achieved & payoff…"
                : incentiveScopeLabel
                  ? `Hub activity · ${incentiveScopeLabel}`
                  : "Hub activity · Achieved & Payoff follow Insights date filter"}
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div
                className={`grid ${COLS} gap-x-2 bg-gray-50/90 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:px-5`}
              >
                <div className="text-left">Salesperson</div>
                <div className="text-right">Leads</div>
                <div className="text-right">Meetings</div>
                <div className="text-right">Proposals</div>
                <div className="text-right">Closed</div>
                <div className="text-right">Conv %</div>
                <div className="text-right text-sky-600/90">Achieved</div>
                <div className="text-right text-sky-600/90">Payoff</div>
              </div>

              <div
                className={`insights-table-scroll ${
                  needsScroll
                    ? "overflow-y-auto overscroll-contain"
                    : "overflow-visible"
                }`}
                style={
                  needsScroll
                    ? { maxHeight: `${TEAM_SCROLL_MAX_PX}px` }
                    : undefined
                }
              >
                {team.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-gray-500">
                    No team performance rows for this filter.
                  </div>
                ) : (
                  team.map((member) => {
                    const leads = Number(member.leads) || 0;
                    const closed = Number(member.closed) || 0;
                    const conversionPercent =
                      Number(member.conversionPercent) || 0;
                    const incentivePending =
                      member.achievedIncentive == null && member.payoff == null;
                    const achieved = Number(member.achievedIncentive) || 0;
                    const payoff = Number(member.payoff) || 0;

                    return (
                      <div
                        key={String(member.userId || member.name)}
                        className={`group grid ${COLS} gap-x-2 items-center border-b border-gray-50 px-4 py-2.5 transition-colors duration-150 hover:bg-slate-50/80 sm:px-5`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                            {(member.name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-800">
                              {member.name || "—"}
                            </p>
                            <p className="truncate text-[10px] uppercase tracking-wide text-gray-400">
                              {member.role || "Sales Executive"}
                            </p>
                          </div>
                        </div>

                        <div className="text-right text-sm font-medium tabular-nums text-gray-700">
                          {formatInsightsCount(leads)}
                        </div>
                        <div className="text-right text-sm font-medium tabular-nums text-gray-700">
                          {formatInsightsCount(member.meetings)}
                        </div>
                        <div className="text-right text-sm font-medium tabular-nums text-gray-700">
                          {formatInsightsCount(member.proposals)}
                        </div>
                        <div className="text-right text-sm font-semibold tabular-nums text-gray-900">
                          {formatInsightsCount(closed)}
                        </div>
                        <div className="flex justify-end">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${convTone(conversionPercent)}`}
                          >
                            {formatInsightsPercent(conversionPercent)}
                          </span>
                        </div>
                        <div className="text-right text-sm font-semibold tabular-nums text-slate-800">
                          {incentivePending
                            ? "…"
                            : formatInsightsInrCompact(achieved)}
                        </div>
                        <div
                          className={`text-right text-sm font-semibold tabular-nums ${payoffTone(payoff)}`}
                        >
                          {incentivePending
                            ? "…"
                            : payoff > 0
                              ? formatInsightsInrCompact(payoff)
                              : "₹0"}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {needsScroll ? (
            <p className="border-t border-gray-50 px-4 py-2 text-center text-[10px] font-medium text-gray-400">
              Scroll · {formatInsightsCount(team.length)} members
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
