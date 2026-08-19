"use client";

import type { ReactNode } from "react";
import type {
  BookingValueCard,
  ConversionCard,
  InsightsTone,
  InsightsTrend,
  PerformanceCards,
  WeightedPipelineCard,
} from "@/lib/crm-insights-api";

type Props = {
  data: PerformanceCards | null;
  loading?: boolean;
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

function TrendArrow({ trend, className }: { trend: InsightsTrend; className: string }) {
  if (trend === "flat") {
    return (
      <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 ${className}`} aria-hidden>
        <path
          d="M2 8h12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (trend === "up") {
    return (
      <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 ${className}`} aria-hidden>
        <path
          d="M3 11.5 8 5.5l5 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 ${className}`} aria-hidden>
      <path
        d="M3 4.5 8 10.5l5-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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

function WeightedPipelineTile({ card }: { card: WeightedPipelineCard }) {
  const coverageTone: InsightsTone = card.tone === "green" ? "green" : "neutral";
  const pill = TONE[coverageTone];

  return (
    <Shell tone="neutral">
      <p className="text-[11px] font-semibold leading-none text-gray-500">
        {card.title}
      </p>
      <p className="mt-3 text-[1.7rem] font-extrabold leading-none tracking-tight text-gray-900 sm:text-[1.85rem]">
        {card.valueLabel}
      </p>
      <div className="mt-3 h-px w-full bg-gray-200/90" />
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <p className="min-w-0 text-[10px] font-semibold tracking-wide text-gray-400">
          <span className="uppercase">Rem. Target</span>{" "}
          <span className="text-gray-800">{card.remainingTargetLabel}</span>
        </p>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide ${pill.pill} ${pill.pillText}`}
        >
          <span className="uppercase">Coverage</span>&nbsp;{card.coverageLabel}
        </span>
      </div>
    </Shell>
  );
}

function ConversionTile({ card }: { card: ConversionCard }) {
  const t = TONE[card.tone];
  const fill = clampPct(card.valuePercent);
  const marker = clampPct(card.targetPercent);
  const pct = Number.isFinite(card.valuePercent)
    ? `${card.valuePercent}%`
    : "0%";
  const targetPct = Number.isFinite(card.targetPercent)
    ? `${card.targetPercent}%`
    : "0%";

  return (
    <Shell tone={card.tone}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[11px] font-semibold leading-none text-gray-500">
          {card.title}
        </p>
        <TrendArrow trend={card.trend} className={`mt-px shrink-0 ${t.accent}`} />
      </div>
      <p
        className={`mt-3 text-[1.7rem] font-extrabold leading-none tracking-tight sm:text-[1.85rem] ${t.value}`}
      >
        {pct}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-gray-400">Target: {targetPct}</p>
        <span
          className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-extrabold ${t.pill} ${t.pillText}`}
        >
          {card.varianceLabel}
        </span>
      </div>
      <div className="mt-auto pt-3">
        <div className="relative h-1.5 w-full rounded-full bg-gray-200/80">
          <div
            className={`h-1.5 rounded-full ${t.bar} transition-all duration-300`}
            style={{ width: `${fill}%` }}
          />
          <span
            className="absolute top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-900"
            style={{ left: `${marker}%` }}
            aria-hidden
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

export default function InsightsPerformanceCards({ data, loading = false }: Props) {
  const cards = data?.cards;

  return (
    <section className="mt-6 px-4 sm:px-6 lg:px-8">
      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">
        Growth
      </p>
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
        ) : cards ? (
          <>
            <BookingValueTile card={cards.bookingValue} />
            <WeightedPipelineTile card={cards.weightedPipeline} />
            <ConversionTile card={cards.leadToMeeting} />
            <ConversionTile card={cards.meetingToBooking} />
          </>
        ) : null}
      </div>
    </section>
  );
}
