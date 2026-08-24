"use client";

import type { ReactNode } from "react";
import type {
  BookingValueCard,
  InsightsDashboard,
  InsightsKpiMetric,
  InsightsTone,
  PerformanceCards,
  WeightedPipelineCard,
} from "@/lib/crm-insights-api";
import {
  formatInsightsChangeAbsolute,
  formatInsightsCount,
  formatInsightsInrCompact,
} from "@/lib/crm-insights-api";
import type { TokenMetricsData } from "./InsightSect2";
import type { QuotesSentMonthMetrics } from "@/lib/insights-quotes-sent-month";

type Props = {
  data: PerformanceCards | null;
  loading?: boolean;
  kpis: InsightsDashboard["kpis"];
  tokenMetrics?: TokenMetricsData;
  dashboardLoading?: boolean;
  quotesSentMonth?: QuotesSentMonthMetrics | null;
  quotesSentMonthLoading?: boolean;
};

type ToneTheme = {
  card: string;
  top: string;
  value: string;
  accent: string;
  bar: string;
  pill: string;
  pillText: string;
};

const TONE: Record<InsightsTone, ToneTheme> = {
  green: {
    card: "border-emerald-100/90 bg-emerald-50/70",
    top: "border-t-emerald-500",
    value: "text-gray-900",
    accent: "text-emerald-600",
    bar: "bg-emerald-500",
    pill: "bg-emerald-400",
    pillText: "text-gray-950",
  },
  yellow: {
    card: "border-amber-100/90 bg-amber-50/75",
    top: "border-t-amber-500",
    value: "text-amber-600",
    accent: "text-amber-600",
    bar: "bg-amber-500",
    pill: "bg-amber-500",
    pillText: "text-white",
  },
  red: {
    card: "border-red-100/90 bg-red-50/80",
    top: "border-t-red-500",
    value: "text-red-600",
    accent: "text-red-600",
    bar: "bg-red-500",
    pill: "bg-red-500",
    pillText: "text-white",
  },
  neutral: {
    card: "border-slate-200/80 bg-white",
    top: "border-t-slate-900",
    value: "text-gray-900",
    accent: "text-gray-700",
    bar: "bg-slate-800",
    pill: "bg-slate-200",
    pillText: "text-slate-800",
  },
};

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function toneFromSigned(value: number | null | undefined): InsightsTone {
  const v = Number(value ?? 0);
  if (!Number.isFinite(v) || v === 0) return "yellow";
  return v > 0 ? "green" : "red";
}

function moneyFromHubOrFe(
  hub: InsightsKpiMetric | null | undefined,
  feValue: number | undefined,
): number {
  if (hub != null && Number.isFinite(hub.value)) return hub.value;
  return Number(feValue ?? 0);
}

function Shell({
  tone,
  children,
  className = "",
}: {
  tone: InsightsTone;
  children: ReactNode;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <article
      className={`flex h-full min-h-[158px] flex-col rounded-xl border border-t-[3px] p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${t.card} ${t.top} ${className}`}
    >
      {children}
    </article>
  );
}

function BookingValueTile({ card }: { card: BookingValueCard }) {
  const t = TONE[card.tone];
  const fill = clampPct(card.progressRatio * 100);
  const pct = Number.isFinite(card.completionPercent)
    ? `${card.completionPercent}%`
    : "0%";

  return (
    <Shell tone={card.tone}>
      <p className="text-[11px] font-semibold leading-none text-gray-500">
        {card.title}
      </p>
      <p className="mt-3 text-[1.7rem] font-extrabold leading-none tracking-tight text-gray-900 sm:text-[1.85rem]">
        {card.valueLabel}
      </p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wide text-gray-400">
          <span className="uppercase">Target</span> {card.targetLabel}
        </p>
        <p className={`text-sm font-extrabold leading-none ${t.accent}`}>{pct}</p>
      </div>
      <div className="mt-auto pt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200/80">
          <div
            className={`h-1.5 rounded-full ${t.bar} transition-all duration-300`}
            style={{ width: `${fill}%` }}
          />
        </div>
      </div>
    </Shell>
  );
}

function WeightedPipelineTile({
  card,
  quoteValueInr,
  quoteCount,
  loading,
}: {
  card: WeightedPipelineCard;
  quoteValueInr: number;
  quoteCount: number;
  loading?: boolean;
}) {
  const remaining = Number(card.remainingTargetInr ?? 0);
  const coverageX =
    remaining > 0 && Number.isFinite(quoteValueInr) ? quoteValueInr / remaining : 0;
  const coverageLabel = `${coverageX.toFixed(1)}x`;
  const coverageTone: InsightsTone = coverageX >= 1 ? "green" : "neutral";
  const pill = TONE[coverageTone];

  return (
    <Shell tone="neutral">
      <p className="text-[11px] font-semibold leading-none text-gray-500">
        {card.title}
      </p>
      <p className="mt-1.5 text-[10px] font-medium leading-snug text-gray-400">
        Quotes sent
      </p>
      <p className="mt-3 text-[1.7rem] font-extrabold leading-none tracking-tight text-gray-900 sm:text-[1.85rem]">
        {loading ? "…" : formatInsightsInrCompact(quoteValueInr)}
      </p>
      <div className="mt-3 h-px w-full bg-gray-200/90" />
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <p className="min-w-0 text-[10px] font-semibold tracking-wide text-gray-400">
          <span className="uppercase">Rem. Target</span>{" "}
          <span className="text-gray-800">{card.remainingTargetLabel}</span>
          <span className="text-gray-300"> · </span>
          <span className="text-gray-800">
            {loading ? "…" : `${formatInsightsCount(quoteCount)} leads`}
          </span>
        </p>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide ${pill.pill} ${pill.pillText}`}
        >
          <span className="uppercase">Coverage</span>&nbsp;
          {loading ? "…" : coverageLabel}
        </span>
      </div>
    </Shell>
  );
}

function GrowthMoneyTile({
  title,
  valueLabel,
  metaLabel,
  metaValue,
  accent,
  progressRatio,
  tone,
  hint,
}: {
  title: string;
  valueLabel: string;
  metaLabel: string;
  metaValue: string;
  accent: string;
  progressRatio: number;
  tone: InsightsTone;
  hint?: string;
}) {
  const t = TONE[tone];
  const fill = clampPct(progressRatio * 100);

  return (
    <Shell tone={tone}>
      <p className="text-[11px] font-semibold leading-none text-gray-500">{title}</p>
      {hint ? (
        <p className="mt-1.5 text-[10px] font-medium leading-snug text-gray-400">{hint}</p>
      ) : null}
      <p className="mt-3 text-[1.7rem] font-extrabold leading-none tracking-tight text-gray-900 sm:text-[1.85rem]">
        {valueLabel}
      </p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="min-w-0 text-[10px] font-semibold tracking-wide text-gray-400">
          {metaLabel ? <span className="uppercase">{metaLabel}</span> : null}
          {metaLabel ? " " : null}
          <span className="text-gray-700">{metaValue}</span>
        </p>
        {accent ? (
          <p className={`shrink-0 text-sm font-extrabold leading-none ${t.accent}`}>{accent}</p>
        ) : null}
      </div>
      <div className="mt-auto pt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200/80">
          <div
            className={`h-1.5 rounded-full ${t.bar} transition-all duration-300`}
            style={{ width: `${fill}%` }}
          />
        </div>
      </div>
    </Shell>
  );
}

function SkeletonCard() {
  return (
    <div className="flex h-full min-h-[158px] flex-col rounded-xl border border-gray-200/80 border-t-[3px] border-t-gray-200 bg-white p-3.5">
      <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
      <div className="mt-4 h-7 w-28 animate-pulse rounded bg-gray-100" />
      <div className="mt-4 h-3 w-full animate-pulse rounded bg-gray-100" />
      <div className="mt-auto pt-4">
        <div className="h-1.5 w-full animate-pulse rounded-full bg-gray-100" />
      </div>
    </div>
  );
}

export default function InsightsPerformanceCards({
  data,
  loading = false,
  kpis,
  tokenMetrics,
  dashboardLoading = false,
  quotesSentMonth = null,
  quotesSentMonthLoading = false,
}: Props) {
  const cards = data?.cards;
  const hasHubMoney =
    kpis.tokenValue != null || kpis.bookingValue != null || kpis.grossBooking != null;
  const isMoneyLoading =
    dashboardLoading || (!hasHubMoney && Boolean(tokenMetrics?.loading));

  const tokenValue = moneyFromHubOrFe(kpis.tokenValue, tokenMetrics?.tokenValue);
  const bookingValue = moneyFromHubOrFe(
    kpis.bookingValue,
    tokenMetrics?.bookingValue ?? kpis.closedWon.value,
  );
  const grossBooking =
    kpis.grossBooking != null && Number.isFinite(kpis.grossBooking.value)
      ? kpis.grossBooking.value
      : tokenValue + bookingValue;

  const tokenMeta =
    kpis.tokenValue?.changeAbsolute != null
      ? formatInsightsChangeAbsolute(kpis.tokenValue.changeAbsolute)
      : tokenMetrics?.tokenCount != null
        ? `${tokenMetrics.tokenCount} tokens`
        : "Token deals";
  const grossMeta =
    kpis.grossBooking?.changeAbsolute != null
      ? formatInsightsChangeAbsolute(kpis.grossBooking.changeAbsolute)
      : "Token + Booking";

  const tokenTone = toneFromSigned(kpis.tokenValue?.changeAbsolute);
  const grossTone = toneFromSigned(kpis.grossBooking?.changeAbsolute);

  return (
    <section className="mt-6 px-4 sm:px-6 lg:px-8">
      <div
        className={`grid grid-cols-1 items-stretch gap-3.5 sm:grid-cols-2 xl:grid-cols-4 ${
          loading && cards ? "opacity-80" : ""
        }`}
      >
        {loading && !cards ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {cards ? <BookingValueTile card={cards.bookingValue} /> : <SkeletonCard />}
            <GrowthMoneyTile
              title="Gross Booking Value"
              hint="Token Value + Booking Value combined"
              valueLabel={isMoneyLoading ? "..." : formatInsightsInrCompact(grossBooking)}
              metaLabel="Change"
              metaValue={isMoneyLoading ? "…" : grossMeta}
              accent=""
              progressRatio={Number(kpis.grossBooking?.progressRatio ?? (grossBooking > 0 ? 1 : 0))}
              tone={isMoneyLoading ? "neutral" : grossTone}
            />
            {cards ? (
              <WeightedPipelineTile
                card={cards.weightedPipeline}
                quoteValueInr={quotesSentMonth?.quotationValueInr ?? 0}
                quoteCount={quotesSentMonth?.quotesSentCount ?? 0}
                loading={quotesSentMonthLoading}
              />
            ) : (
              <SkeletonCard />
            )}
            <GrowthMoneyTile
              title="Token Value"
              valueLabel={isMoneyLoading ? "..." : formatInsightsInrCompact(tokenValue)}
              metaLabel=""
              metaValue={isMoneyLoading ? "…" : tokenMeta}
              accent=""
              progressRatio={Number(
                kpis.tokenValue?.progressRatio ?? (tokenValue > 0 ? 0.7 : 0),
              )}
              tone={isMoneyLoading ? "yellow" : tokenTone}
            />
          </>
        )}
      </div>
    </section>
  );
}
