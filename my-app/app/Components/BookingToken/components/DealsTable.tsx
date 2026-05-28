"use client";

import { DEAL_ROWS } from "../data/mock-data";
import type { BookingStatus, TokenStatus } from "../types";

function TokenBadge({ status }: { status: TokenStatus }) {
  if (status === "issued") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">
        <span className="text-emerald-600">✓</span> Issued
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-bold uppercase text-orange-700">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-orange-300 border-t-orange-600" />
      Minting
    </span>
  );
}

function BookingStatusText({ status }: { status: BookingStatus }) {
  if (status === "confirmed") {
    return <span className="text-xs font-bold uppercase text-emerald-600">Confirmed</span>;
  }
  return <span className="text-xs font-bold uppercase text-orange-600">In Progress</span>;
}

export default function DealsTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--bt-border)] bg-[var(--bt-surface)] shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--bt-border)] bg-slate-50/80">
              {[
                "Customer & Asset",
                "Deal Value",
                "Pre-Booking",
                "Token Status",
                "Booking Status",
                "Exp. Closing",
                "Action",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--bt-muted)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEAL_ROWS.map((row) => (
              <tr key={row.id} className="border-b border-[var(--bt-border)] last:border-0 hover:bg-slate-50/50">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                      {row.initials}
                    </div>
                    <div>
                      <div className="font-semibold text-[var(--bt-text)]">{row.customer}</div>
                      <div className="text-xs text-[var(--bt-muted)]">{row.asset}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 font-semibold text-[var(--bt-text)]">{row.dealValue}</td>
                <td className="px-4 py-4 text-[var(--bt-text)]">{row.preBooking}</td>
                <td className="px-4 py-4">
                  <TokenBadge status={row.tokenStatus} />
                </td>
                <td className="px-4 py-4">
                  <BookingStatusText status={row.bookingStatus} />
                </td>
                <td className="px-4 py-4 text-[var(--bt-muted)]">{row.expClosing}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-2">
                    {row.showConvert ? (
                      <button
                        type="button"
                        className="rounded-md bg-[var(--bt-green)] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--bt-navy)] transition hover:brightness-105"
                      >
                        Convert to Booking →
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-lg p-2 text-[var(--bt-muted)] hover:bg-slate-100"
                      aria-label="More actions"
                    >
                      ⋮
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--bt-border)] bg-slate-50/60 px-4 py-3 text-xs text-[var(--bt-muted)]">
        <span className="font-semibold uppercase tracking-wide">Showing 4 of 124 active deals</span>
        <div className="flex gap-2">
          <button type="button" className="rounded border border-[var(--bt-border)] bg-white px-3 py-1.5 font-semibold uppercase hover:bg-slate-50">
            Previous
          </button>
          <button type="button" className="rounded border border-[var(--bt-border)] bg-white px-3 py-1.5 font-semibold uppercase hover:bg-slate-50">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
