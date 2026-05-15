"use client";

import { LEDGER_ITEMS } from "../data/mock-data";

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
  return (
    <section className="rounded-xl border border-[var(--bt-border)] bg-[var(--bt-surface)] p-5 shadow-sm">
      <h2 className="text-[10px] font-bold uppercase tracking-wider text-[var(--bt-muted)]">
        Recent Token & Booking Ledger
      </h2>
      <ul className="mt-4 divide-y divide-[var(--bt-border)]">
        {LEDGER_ITEMS.map((item) => (
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
