"use client";

import { useEffect, useMemo, useState } from "react";
import { LEDGER_ITEMS } from "../data/mock-data";
import type { LedgerItem } from "../types";
import {
  bookingTokenLeadToLedgerItem,
  readBookingTokenLeads,
} from "@/lib/booking-token-leads";

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

export default function RecentLedger() {
  const [handoffItems, setHandoffItems] = useState<LedgerItem[]>([]);

  useEffect(() => {
    function loadHandoffs() {
      const items = readBookingTokenLeads()
        .slice(0, 5)
        .map(bookingTokenLeadToLedgerItem);
      setHandoffItems(items);
    }
    loadHandoffs();
    window.addEventListener("storage", loadHandoffs);
    return () => window.removeEventListener("storage", loadHandoffs);
  }, []);

  const items = useMemo(() => {
    const handoffIds = new Set(handoffItems.map((item) => item.id));
    const mockItems = LEDGER_ITEMS.filter((item) => !handoffIds.has(item.id));
    return [...handoffItems, ...mockItems].slice(0, 6);
  }, [handoffItems]);

  return (
    <section className="rounded-xl border border-[var(--bt-border)] bg-[var(--bt-surface)] p-5 shadow-sm">
      <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--bt-muted)]">
        Recent Token & Booking Ledger
      </h2>
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
    </section>
  );
}
