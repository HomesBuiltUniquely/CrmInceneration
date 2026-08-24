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

/**
 * Payoff stays computed + on the model; set true to show the column again.
 * Hide-only (not removed) so incentives data still loads.
 */
const SHOW_PAYOFF_COLUMN = false;

/** No Value column — closed $ is not shown (Achieved/Payoff cover incentives money). */
const COLS_BASE = SHOW_PAYOFF_COLUMN
  ? "grid-cols-[minmax(180px,1.4fr)_minmax(56px,0.55fr)_minmax(72px,0.6fr)_minmax(80px,0.65fr)_minmax(56px,0.55fr)_minmax(64px,0.55fr)_minmax(88px,0.75fr)_minmax(80px,0.7fr)]"
  : "grid-cols-[minmax(180px,1.4fr)_minmax(56px,0.55fr)_minmax(72px,0.6fr)_minmax(80px,0.65fr)_minmax(56px,0.55fr)_minmax(64px,0.55fr)_minmax(88px,0.75fr)]";

const COLS_WITH_RANK = SHOW_PAYOFF_COLUMN
  ? "grid-cols-[32px_minmax(180px,1.4fr)_minmax(56px,0.55fr)_minmax(72px,0.6fr)_minmax(80px,0.65fr)_minmax(56px,0.55fr)_minmax(64px,0.55fr)_minmax(88px,0.75fr)_minmax(80px,0.7fr)]"
  : "grid-cols-[32px_minmax(180px,1.4fr)_minmax(56px,0.55fr)_minmax(72px,0.6fr)_minmax(80px,0.65fr)_minmax(56px,0.55fr)_minmax(64px,0.55fr)_minmax(88px,0.75fr)]";

function gridCols(showRank: boolean): string {
  return showRank ? COLS_WITH_RANK : COLS_BASE;
}

function convTone(percent: number): string {
  if (percent >= 10) return "bg-green-50 text-green-600";
  return "bg-red-50 text-red-600";
}

function payoffTone(payoff: number): string {
  if (payoff > 0) return "text-emerald-700";
  return "text-gray-400";
}

function rankTextClass(rank: number): string {
  if (rank === 1) return "font-extrabold text-amber-700";
  if (rank === 2) return "font-bold text-slate-600";
  if (rank === 3) return "font-bold text-orange-700";
  return "font-semibold text-gray-500";
}

function podiumRowClass(rank: number): string {
  if (rank === 1) {
    return "border-amber-100/80 bg-amber-50/70 hover:bg-amber-50";
  }
  if (rank === 2) {
    return "border-slate-200/80 bg-slate-50/80 hover:bg-slate-100/70";
  }
  if (rank === 3) {
    return "border-orange-100/80 bg-orange-50/60 hover:bg-orange-50/90";
  }
  return "border-gray-50 hover:bg-slate-50/80";
}

function podiumAvatarClass(rank: number): string {
  if (rank === 1) {
    return "bg-gradient-to-br from-amber-200 to-amber-400 text-amber-950 ring-2 ring-amber-200/80";
  }
  if (rank === 2) {
    return "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800 ring-2 ring-slate-200/80";
  }
  if (rank === 3) {
    return "bg-gradient-to-br from-orange-200 to-amber-600 text-orange-950 ring-2 ring-orange-200/70";
  }
  return "bg-slate-100 text-slate-700";
}

function podiumStripeClass(rank: number): string {
  if (rank === 1) return "bg-gradient-to-b from-amber-400 via-yellow-400 to-amber-500";
  if (rank === 2) return "bg-gradient-to-b from-slate-300 via-slate-400 to-slate-500";
  if (rank === 3) return "bg-gradient-to-b from-orange-300 via-amber-600 to-orange-700";
  return "";
}

function TrophyIcon({ rank }: { rank: 1 | 2 | 3 }) {
  const fill =
    rank === 1 ? "#f59e0b" : rank === 2 ? "#94a3b8" : "#d97706";
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden>
      <path
        fill={fill}
        d="M7 4h10v2h2.5a1.5 1.5 0 0 1 1.5 1.5V9a4.5 4.5 0 0 1-4.05 4.47A5.002 5.002 0 0 1 13 16.9V18h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-1.1a5.002 5.002 0 0 1-4.45-3.43A4.5 4.5 0 0 1 2.5 9V7.5A1.5 1.5 0 0 1 4 6h3V4zm0 2v2.5A2.5 2.5 0 0 1 4.5 9V8H7zm10 0h2.5v1a2.5 2.5 0 0 1-2.5 2.5V6z"
      />
    </svg>
  );
}

function podiumTrophyWrapClass(rank: number): string {
  if (rank === 1) return "bg-amber-100 ring-amber-200";
  if (rank === 2) return "bg-slate-100 ring-slate-300";
  return "bg-orange-100 ring-orange-200";
}

export default function InsightSect5({
  team,
  incentiveScopeLabel,
  incentivesLoading = false,
}: Props) {
  const needsScroll = team.length > TEAM_VISIBLE_ROWS;
  const hasAnyAchieved = team.some(
    (m) => (Number(m.achievedIncentive) || 0) > 0,
  );
  const cols = gridCols(hasAnyAchieved);

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
                ? SHOW_PAYOFF_COLUMN
                  ? "Loading achieved & payoff…"
                  : "Loading achieved…"
                : incentiveScopeLabel
                  ? `Hub activity · ${incentiveScopeLabel}`
                  : SHOW_PAYOFF_COLUMN
                    ? "Hub activity · Achieved & Payoff follow Insights date filter"
                    : "Hub activity · Achieved follows Insights date filter"}
            </p>
          </div>

          <div className="overflow-x-auto">
            <div
              className={
                SHOW_PAYOFF_COLUMN
                  ? hasAnyAchieved
                    ? "min-w-[900px]"
                    : "min-w-[860px]"
                  : hasAnyAchieved
                    ? "min-w-[820px]"
                    : "min-w-[780px]"
              }
            >
              <div
                className={`grid ${cols} gap-x-2 bg-gray-50/90 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:px-5`}
              >
                {hasAnyAchieved ? (
                  <div className="text-center" aria-label="Rank">
                    <span className="sr-only">Rank</span>
                  </div>
                ) : null}
                <div className="text-left">Salesperson</div>
                <div className="text-right">Leads</div>
                <div className="text-right">Meetings</div>
                <div className="text-right">Proposals</div>
                <div className="text-right">Closed</div>
                <div className="text-right">Conv %</div>
                <div className="text-right text-sky-600/90">Achieved ↓</div>
                {SHOW_PAYOFF_COLUMN ? (
                  <div className="text-right text-sky-600/90">Payoff</div>
                ) : null}
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
                  team.map((member, index) => {
                    const rank = index + 1;
                    const isPodium = hasAnyAchieved && rank <= 3;
                    const podiumRank: 1 | 2 | 3 | null =
                      isPodium && rank >= 1 && rank <= 3
                        ? (rank as 1 | 2 | 3)
                        : null;
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
                        className={`group relative grid ${cols} gap-x-2 items-center border-b px-4 py-2.5 transition-colors duration-150 sm:px-5 ${
                          isPodium ? podiumRowClass(rank) : "border-gray-50 hover:bg-slate-50/80"
                        }`}
                      >
                        {isPodium ? (
                          <span
                            className={`absolute inset-y-0 left-0 w-1 ${podiumStripeClass(rank)}`}
                            aria-hidden
                          />
                        ) : null}

                        {hasAnyAchieved ? (
                          <div
                            className={`text-center text-[12px] tabular-nums ${rankTextClass(rank)}`}
                            title={`Rank ${rank} by Achieved`}
                          >
                            {rank}
                          </div>
                        ) : null}

                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="relative shrink-0">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                                isPodium ? podiumAvatarClass(rank) : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {(member.name || "?").charAt(0).toUpperCase()}
                            </div>
                            {podiumRank ? (
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-1 ring-white ${podiumTrophyWrapClass(podiumRank)}`}
                                title={
                                  podiumRank === 1
                                    ? "Gold"
                                    : podiumRank === 2
                                      ? "Silver"
                                      : "Bronze"
                                }
                                aria-label={
                                  podiumRank === 1
                                    ? "Gold trophy"
                                    : podiumRank === 2
                                      ? "Silver trophy"
                                      : "Bronze trophy"
                                }
                              >
                                <TrophyIcon rank={podiumRank} />
                              </span>
                            ) : null}
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
                        <div
                          className={`text-right text-sm font-semibold tabular-nums ${
                            rank === 1 && hasAnyAchieved
                              ? "text-amber-800"
                              : rank === 2 && hasAnyAchieved
                                ? "text-slate-700"
                                : rank === 3 && hasAnyAchieved
                                  ? "text-orange-800"
                                  : "text-slate-800"
                          }`}
                        >
                          {incentivePending
                            ? "…"
                            : formatInsightsInrCompact(achieved)}
                        </div>
                        {SHOW_PAYOFF_COLUMN ? (
                          <div
                            className={`text-right text-sm font-semibold tabular-nums ${payoffTone(payoff)}`}
                          >
                            {incentivePending
                              ? "…"
                              : payoff > 0
                                ? formatInsightsInrCompact(payoff)
                                : "₹0"}
                          </div>
                        ) : null}
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
