"use client";

import { KPI_CARDS } from "../data/mock-data";

export default function KpiCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {KPI_CARDS.map((card) => (
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
              {card.trend}
              {card.trendUp && !card.trendUrgent ? <span aria-hidden>↗</span> : null}
              {card.trendUrgent ? <span aria-hidden>!</span> : null}
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--bt-text)]">{card.value}</p>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${card.barTone === "green" ? "bg-[var(--bt-green)]" : "bg-[var(--bt-orange)]"}`}
              style={{ width: `${card.barWidth}%` }}
            />
          </div>
        </article>
      ))}
    </div>
  );
}
