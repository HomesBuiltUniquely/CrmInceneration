"use client";

import { useCallback, useEffect, useState } from "react";
import { computeBookingTokenKpis } from "@/lib/booking-token-kpis";
import { fetchDashboardDealRows } from "@/lib/booking-token-deals-fetch";
import {
  isBookingDateFilterActive,
  bookingDateFilterSummary,
  type BookingDateFilterState,
} from "@/lib/booking-token-date-filter";
import type { BookingTokenTab } from "../types";

type Props = {
  /** Bump to refetch after pay / cancel / new deal. */
  refreshSignal?: number;
  dateFilter: BookingDateFilterState;
  tab: BookingTokenTab;
};

export default function KpiCards({ refreshSignal = 0, dateFilter, tab }: Props) {
  const [loading, setLoading] = useState(true);
  const [kpiCards, setKpiCards] = useState(() => computeBookingTokenKpis([], tab));

  const loadKpis = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchDashboardDealRows({ tab, dateFilter });
      setKpiCards(computeBookingTokenKpis(rows, tab));
    } catch {
      setKpiCards(computeBookingTokenKpis([], tab));
    } finally {
      setLoading(false);
    }
  }, [dateFilter, tab]);

  useEffect(() => {
    void loadKpis();
  }, [loadKpis, refreshSignal]);

  return (
    <div>
      {isBookingDateFilterActive(dateFilter) ? (
        <p className="mb-3 text-[11px] font-medium text-[var(--bt-muted)]">
          KPIs for{" "}
          <span className="font-semibold text-[var(--bt-text)]">
            {bookingDateFilterSummary(dateFilter)}
          </span>
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpiCards.map((card) => (
        <article
          key={card.id}
          className="rounded-xl border border-[var(--bt-border)] bg-[var(--bt-surface)] p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--bt-muted)]">
              {card.label}
            </span>
            <span
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                card.trendUrgent
                  ? "bg-[var(--bt-red-soft)] text-[var(--bt-red)]"
                  : card.trendUp
                    ? "bg-[var(--bt-green-soft)] text-emerald-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {loading ? "…" : card.trend}
              {card.trendUp && !card.trendUrgent ? <span aria-hidden>↗</span> : null}
              {card.trendUrgent ? <span aria-hidden>!</span> : null}
            </span>
          </div>
          <p
            className={`mt-2 text-2xl font-bold tracking-tight text-[var(--bt-text)] ${loading ? "animate-pulse text-slate-300" : ""}`}
          >
            {loading ? "—" : card.value}
          </p>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${card.barTone === "green" ? "bg-[var(--bt-green)]" : "bg-[var(--bt-orange)]"}`}
              style={{ width: `${loading ? 0 : card.barWidth}%` }}
            />
          </div>
        </article>
      ))}
      </div>
    </div>
  );
}
