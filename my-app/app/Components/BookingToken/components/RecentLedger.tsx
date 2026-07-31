"use client";

import { useEffect, useState } from "react";
import type { LedgerItem } from "../types";
import { fetchPaymentHistory } from "@/lib/booking-payment-history-api";
import {
  bookingTokenDealToDealRow,
  buildRecentLedgerItems,
  RECENT_LEDGER_ITEM_LIMIT,
} from "@/lib/booking-token-leads";
import { fetchDashboardBookingTokenDeals } from "@/lib/booking-token-deals-fetch";
import type { BookingDateFilterState } from "@/lib/booking-token-date-filter";
import type { BookingDealFilterState } from "@/lib/booking-token-deal-filters";

function LedgerIcon({ tone }: { tone: "success" | "warning" | "info" }) {
  const bg =
    tone === "success"
      ? "bg-emerald-100 text-emerald-600"
      : tone === "warning"
        ? "bg-orange-100 text-orange-600"
        : "bg-blue-100 text-blue-600";
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${bg}`}>
      {tone === "success" ? "$" : tone === "warning" ? "◎" : "✓"}
    </div>
  );
}

type Props = {
  refreshSignal?: number;
  dateFilter: BookingDateFilterState;
  dealFilters?: BookingDealFilterState;
  tab: "all" | "token" | "booking";
};

export default function RecentLedger({
  refreshSignal = 0,
  dateFilter,
  dealFilters,
  tab,
}: Props) {
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadLedger() {
      setLoading(true);
      try {
        const deals = await fetchDashboardBookingTokenDeals({ tab, dateFilter, dealFilters });
        const histories = new Map<
          string,
          Awaited<ReturnType<typeof fetchPaymentHistory>>["history"]
        >();

        await Promise.all(
          deals.map(async (deal) => {
            try {
              const history = await fetchPaymentHistory(bookingTokenDealToDealRow(deal));
              histories.set(deal.id, history.history);
            } catch {
              /* fall back to deal-level handoff row in buildRecentLedgerItems */
            }
          }),
        );

        if (!cancelled) {
          setItems(buildRecentLedgerItems(deals, histories, RECENT_LEDGER_ITEM_LIMIT));
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLedger();
    return () => {
      cancelled = true;
    };
  }, [refreshSignal, dateFilter, dealFilters, tab]);

  return (
    <section className="rounded-xl border border-[var(--bt-border)] bg-[var(--bt-surface)] p-5 shadow-sm">
      <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--bt-muted)]">
        Recent Token & Booking Ledger
      </h2>
      {loading ? (
        <p className="mt-4 text-sm text-[var(--bt-muted)]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--bt-muted)]">
          No recent booking activity yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--bt-border)]">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
              <LedgerIcon tone={item.tone} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--bt-text)]">{item.title}</p>
                <p className="text-xs text-[var(--bt-muted)]">{item.detail}</p>
              </div>
              <span className="shrink-0 text-xs font-medium text-[var(--bt-muted)]">{item.time}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
