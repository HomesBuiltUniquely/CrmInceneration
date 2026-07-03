"use client";

import type { DealLedgerRow } from "./data/mock-data";
import type { IncentiveProfile } from "@/lib/incentives-profile";
import { journeyMarkers } from "@/lib/incentives-profile";

const MIN_INCENTIVE_ACHIEVEMENT_PCT = 40;

function closureBadgeClass(type: DealLedgerRow["closureTime"]): string {
  if (type === "BOOKING DONE") return "bg-[#ecfdf5] text-[#047857]";
  if (type === "TOKEN") return "bg-[#fef9c3] text-[#a16207]";
  if (type === "SAME DAY") return "bg-[#ffedd5] text-[#c2410c]";
  if (type === "48 HOURS") return "bg-[#fef9c3] text-[#a16207]";
  return "bg-[#e0f2fe] text-[#0369a1]";
}

function weightBadgeClass(tier: DealLedgerRow["weightTier"]): string {
  if (tier === "full") return "bg-[#ecfdf5] text-[#047857]";
  if (tier === "half") return "bg-[#fef9c3] text-[#a16207]";
  return "bg-[#f1f5f9] text-[#64748b]";
}

type Props = {
  profile: IncentiveProfile;
  viewingLabel: string;
  bookingCount?: number;
};

export default function IncentiveDashboard({ profile, viewingLabel, bookingCount }: Props) {
  const { summary, slabs, payoutMath, speedBonuses, dealLedger } = profile;
  const progressPct = Math.min(100, Math.max(0, summary.achievementPct));
  const activeMarker =
    summary.currentSlabLabel === "—"
      ? null
      : Number.parseInt(summary.currentSlabLabel, 10) || null;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--inc-text)] md:text-3xl">
            Performance Incentives
          </h2>
          <p className="mt-1 text-sm text-[var(--inc-muted)]">
            {viewingLabel}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#dc2626]">
          <span aria-hidden>⚡</span>
          {summary.nextSlabGap}
        </span>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard label="Total Target" value={summary.totalTarget} />
        <SummaryCard
          label="Weighted Revenue"
          value={summary.revenueAchieved}
          badge={summary.revenueDelta}
        />
        <SummaryCard label="Achievement %" value={`${summary.achievementPct}%`} />
        <SummaryCard
          label="Incentive Earned"
          value={summary.incentiveEarned}
          badge={
            summary.incentiveEligible
              ? "Monthly payout"
              : `Need ${MIN_INCENTIVE_ACHIEVEMENT_PCT}% weighted`
          }
          highlight={summary.incentiveEligible}
          muted={!summary.incentiveEligible}
        />
        <SummaryCard label="On-Spot Bonus" value={summary.onSpotBonus} />
      </div>

      <section className="mb-6 rounded-xl border border-[var(--inc-border)] bg-[var(--inc-surface)] p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--inc-text)]">
            Incentive Journey
          </h3>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--inc-muted)]">
            Current Slab:{" "}
            <span className="text-[var(--inc-green-dark)]">{summary.currentSlabLabel}</span>
          </p>
        </div>
        <div className="relative pt-8 pb-2">
          <div className="relative h-3 overflow-hidden rounded-full bg-[#e5e7eb]">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--inc-green)]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div
            className="absolute top-0 -translate-x-1/2 rounded-md bg-[var(--inc-navy)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md"
            style={{ left: `${progressPct}%` }}
          >
            You are here ({summary.achievementPct}%)
          </div>
          <div className="mt-4 grid grid-cols-5 text-center text-[11px] font-semibold text-[var(--inc-muted)]">
            {journeyMarkers.map((m) => (
              <span key={m} className={m === activeMarker ? "font-bold text-[var(--inc-green-dark)]" : ""}>
                {m}%
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="relative mb-6 grid gap-6 xl:grid-cols-[1fr_280px]">
        <section className="rounded-xl border border-[var(--inc-border)] bg-[var(--inc-surface)] p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--inc-text)]">
            Incentive Slab Structure
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--inc-border)] text-[10px] font-bold uppercase tracking-wide text-[var(--inc-muted)]">
                  <th className="pb-3 pr-4">Tier</th>
                  <th className="pb-3 pr-4">Target %</th>
                  <th className="pb-3 pr-4">Revenue</th>
                  <th className="pb-3 pr-4">Incentive %</th>
                  <th className="pb-3">Potential Earned</th>
                </tr>
              </thead>
              <tbody>
                {slabs.map((row) => (
                  <tr
                    key={row.tier}
                    className={`border-b border-[#f1f5f9] ${row.active ? "bg-[var(--inc-green-soft)]" : ""}`}
                  >
                    <td className="py-3 pr-4 font-semibold text-[var(--inc-text)]">{row.tier}</td>
                    <td className="py-3 pr-4">{row.targetPct}%</td>
                    <td className="py-3 pr-4">{row.revenue}</td>
                    <td className="py-3 pr-4">{row.incentivePct}</td>
                    <td className="py-3 font-bold text-[var(--inc-text)]">
                      {row.potential}
                      {row.active ? (
                        <span className="ml-2 rounded bg-[var(--inc-green)] px-2 py-0.5 text-[9px] font-bold uppercase text-[#05220f]">
                          Active
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-xl bg-[var(--inc-navy)] p-5 text-white shadow-xl xl:absolute xl:right-0 xl:top-0 xl:z-10 xl:w-[280px]">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[#94a3b8]" aria-hidden>
              ▦
            </span>
            <h3 className="text-[11px] font-bold uppercase tracking-wide">Current Payout Math</h3>
          </div>
          <div className="rounded-lg border border-dashed border-[#334155] bg-[#111827] px-3 py-2 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wide text-[#94a3b8]">
              Monthly Target
            </p>
            <p className="mt-1 text-lg font-bold">{payoutMath.monthlyTarget}</p>
          </div>
          <dl className="mt-4 space-y-2 text-[12px]">
            <div className="flex justify-between gap-2">
              <dt className="text-[#94a3b8]">Weighted Revenue</dt>
              <dd className="font-bold">{payoutMath.revenueAchieved}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[#94a3b8]">Eligible Slab</dt>
              <dd className="font-bold">{payoutMath.eligibleSlab}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[#94a3b8]">Incentive Rate</dt>
              <dd className="font-bold">{payoutMath.multiplier}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-wide text-[#94a3b8]">
            Total Payout
          </p>
          <p className="text-[32px] font-bold leading-none text-[var(--inc-green)]">
            {payoutMath.totalPayout}
          </p>
          <p className="mt-3 text-[10px] italic text-[#64748b]">
            *Monthly payout = target × slab rate when total weighted reaches slab % (min 40%).
          </p>
        </aside>
      </div>

      <section className="mb-6">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--inc-text)]">
          Speed Bonuses: On-Spot Closures
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--inc-border)] bg-[var(--inc-surface)] p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--inc-muted)]">
              Total Closures
            </p>
            <p className="mt-2 text-4xl font-bold text-[var(--inc-text)]">
              {String(speedBonuses.totalClosures).padStart(2, "0")}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--inc-border)] bg-[var(--inc-surface)] p-5 shadow-sm">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wide text-[var(--inc-muted)]">
              Bonus Breakdown
            </p>
            <BonusRow
              label={`Same Day (${String(speedBonuses.sameDayCount).padStart(2, "0")})`}
              amount={speedBonuses.sameDayAmount}
              pct={100}
              variant="green"
            />
            <BonusRow
              label={`48 Hour (${String(speedBonuses.fortyEightHourCount).padStart(2, "0")})`}
              amount={speedBonuses.fortyEightHourAmount}
              pct={50}
              variant="muted"
            />
          </div>
          <div className="flex flex-col justify-center rounded-xl bg-[var(--inc-green)] p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#05220f]/70">
              Total Speed Bonus
            </p>
            <p className="mt-2 text-4xl font-bold text-[#05220f]">{speedBonuses.totalSpeedBonus}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--inc-border)] bg-[var(--inc-surface)] p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--inc-text)]">
              Booking Done — Weighted Breakdown
            </h3>
            <p className="mt-1 text-[12px] text-[var(--inc-muted)]">
              Per-lead weighted values. Monthly incentive applies only when total weighted reaches
              {` ${MIN_INCENTIVE_ACHIEVEMENT_PCT}%`} of target.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--inc-border)] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[var(--inc-text)] hover:bg-[#f8fafc]"
          >
            <span aria-hidden>↓</span>
            Export Data
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--inc-border)] text-[10px] font-bold uppercase tracking-wide text-[var(--inc-muted)]">
                <th className="pb-3 pr-4">Lead</th>
                <th className="pb-3 pr-4">Customer</th>
                <th className="pb-3 pr-4">Quote Value</th>
                <th className="pb-3 pr-4">Received</th>
                <th className="pb-3 pr-4">Weighted</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3">Share of weighted</th>
              </tr>
            </thead>
            <tbody>
              {dealLedger.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--inc-muted)]">
                    <p>No booking-done leads for this period.</p>
                    {bookingCount != null && bookingCount > 0 ? (
                      <p className="mt-2 text-[12px]">
                        {bookingCount} booking{bookingCount === 1 ? "" : "s"} found — none assigned to
                        this executive for the selected month.
                      </p>
                    ) : (
                      <p className="mt-2 text-[12px]">
                        Complete Booking Done on a lead to see quote, payment, and weighted value
                        here. Incentive is paid monthly when total weighted hits the target slab.
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
              dealLedger.map((row) => (
                <tr key={row.id} className="border-b border-[#f1f5f9]">
                  <td className="py-3 pr-4 text-[11px] font-semibold text-[var(--inc-muted)]">
                    {row.leadLabel}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#e5e7eb] text-[11px] font-bold text-[#475569]">
                        {row.initials}
                      </span>
                      <span className="font-semibold text-[var(--inc-text)]">{row.customer}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-medium">{row.dealValue}</td>
                  <td className="py-3 pr-4 font-medium">{row.amountReceived}</td>
                  <td className="py-3 pr-4">
                    <div className="font-bold text-[var(--inc-green-dark)]">{row.weighted}</div>
                    <span
                      className={`mt-1 inline-flex rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${weightBadgeClass(row.weightTier)}`}
                    >
                      {row.weightLabel}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${closureBadgeClass(row.closureTime)}`}
                    >
                      {row.closureTime}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-[#e5e7eb]">
                        <div
                          className="h-full rounded-full bg-[var(--inc-green)]"
                          style={{ width: `${Math.min(100, row.contributionPct)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-[var(--inc-muted)]">
                        {row.contributionPct}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function SummaryCard({
  label,
  value,
  badge,
  highlight = false,
  muted = false,
}: {
  label: string;
  value: string;
  badge?: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        highlight
          ? "border-[var(--inc-green-border)] bg-[var(--inc-green-soft)]"
          : muted
            ? "border-[var(--inc-border)] bg-slate-50"
            : "border-[var(--inc-border)] bg-[var(--inc-surface)]"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--inc-muted)]">{label}</p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <p
          className={`text-xl font-bold md:text-2xl ${
            highlight
              ? "text-[var(--inc-green-dark)]"
              : muted
                ? "text-[var(--inc-muted)]"
                : "text-[var(--inc-text)]"
          }`}
        >
          {value}
        </p>
        {badge ? (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              highlight
                ? "bg-[var(--inc-green-soft)] text-[var(--inc-green-dark)]"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function BonusRow({
  label,
  amount,
  pct,
  variant,
}: {
  label: string;
  amount: string;
  pct: number;
  variant: "green" | "muted";
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between text-[12px] font-semibold">
        <span className="text-[var(--inc-text)]">{label}</span>
        <span className="text-[var(--inc-green-dark)]">{amount}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#e5e7eb]">
        <div
          className={`h-full rounded-full ${variant === "green" ? "bg-[var(--inc-green)]" : "bg-[#64748b]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
