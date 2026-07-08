"use client";

import { useEffect, useState } from "react";
import type { PipelineBar } from "../types";
import { fetchDashboardDealRows } from "@/lib/booking-token-deals-fetch";
import { computePipelineVelocity } from "@/lib/booking-token-pipeline-velocity";
import {
  isBookingDateFilterActive,
  bookingDateFilterSummary,
  type BookingDateFilterState,
} from "@/lib/booking-token-date-filter";
import type { BookingDealFilterState } from "@/lib/booking-token-deal-filters";
import type { BookingTokenTab } from "../types";

type Props = {
  refreshSignal?: number;
  dateFilter: BookingDateFilterState;
  dealFilters?: BookingDealFilterState;
  tab: BookingTokenTab;
};

export default function PipelineVelocity({
  refreshSignal = 0,
  dateFilter,
  dealFilters,
  tab,
}: Props) {
  const [bars, setBars] = useState<PipelineBar[]>(() =>
    computePipelineVelocity([], tab, dateFilter),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPipeline() {
      setLoading(true);
      try {
        const rows = await fetchDashboardDealRows({ tab, dateFilter, dealFilters });
        if (!cancelled) {
          setBars(computePipelineVelocity(rows, tab, dateFilter));
        }
      } catch {
        if (!cancelled) setBars(computePipelineVelocity([], tab, dateFilter));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPipeline();
    return () => {
      cancelled = true;
    };
  }, [refreshSignal, dateFilter, dealFilters, tab]);

  const max = Math.max(...bars.map((b) => b.value), 1);
  const hasData = bars.some((bar) => bar.value > 0);

  return (
    <section className="rounded-xl border border-[var(--bt-border)] bg-[var(--bt-surface)] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--bt-muted)]">
          Pipeline Velocity
        </h2>
        <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--bt-muted)]">
          {isBookingDateFilterActive(dateFilter)
            ? bookingDateFilterSummary(dateFilter)
            : String(new Date().getFullYear())}
        </span>
      </div>
      {loading ? (
        <div className="mt-6 flex h-40 items-end justify-between gap-1.5 px-1">
          {bars.map((bar) => (
            <div key={bar.month} className="flex flex-1 flex-col items-center justify-end gap-2">
              <div className="h-8 w-full max-w-[28px] animate-pulse rounded-t-sm bg-slate-200" />
              <span className="text-[9px] font-bold text-[var(--bt-muted)]">{bar.month}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6 flex h-40 items-end justify-between gap-1.5 px-1">
            {bars.map((bar) => {
              const barPx = Math.max(8, Math.round((bar.value / max) * 140));
              return (
                <div key={bar.month} className="flex flex-1 flex-col items-center justify-end gap-2">
                  <div
                    className="w-full max-w-[28px] rounded-t-sm bg-[var(--bt-green)] transition-all duration-300"
                    style={{
                      height: barPx,
                      opacity: bar.value > 0 ? 0.45 + (bar.value / max) * 0.55 : 0.2,
                    }}
                    title={
                      bar.value > 0
                        ? `${bar.value} deal${bar.value === 1 ? "" : "s"} in ${bar.month}`
                        : `No deals in ${bar.month}`
                    }
                  />
                  <span className="text-[9px] font-bold text-[var(--bt-muted)]">{bar.month}</span>
                </div>
              );
            })}
          </div>
          {!hasData ? (
            <p className="mt-3 text-center text-[11px] text-[var(--bt-muted)]">
              No booking handoffs recorded this year yet.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
