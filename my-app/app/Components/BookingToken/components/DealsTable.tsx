"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEAL_ROWS } from "../data/mock-data";
import type { BookingStatus, DealRow, TokenStatus } from "../types";
import {
  bookingTokenLeadToDealRow,
  readBookingTokenLeads,
} from "@/lib/booking-token-leads";

function TokenBadge({ status }: { status: TokenStatus }) {
  if (status === "issued") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">
        <span className="text-emerald-600">✓</span> Issued
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-700">
        Token
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
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight") ?? "";
  const [handoffRows, setHandoffRows] = useState<DealRow[]>([]);

  useEffect(() => {
    function loadHandoffs() {
      const rows = readBookingTokenLeads().map(bookingTokenLeadToDealRow);
      setHandoffRows(rows);
    }
    loadHandoffs();
    window.addEventListener("storage", loadHandoffs);
    return () => window.removeEventListener("storage", loadHandoffs);
  }, []);

  const rows = useMemo(() => {
    const handoffIds = new Set(handoffRows.map((row) => row.id));
    const mockRows = DEAL_ROWS.filter((row) => !handoffIds.has(row.id));
    return [...handoffRows, ...mockRows];
  }, [handoffRows]);

  const totalActive = 124 + handoffRows.length;

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
            {rows.map((row) => {
              const highlighted = highlightId && row.id === highlightId;
              return (
                <tr
                  key={row.id}
                  id={row.fromBookingDone ? `deal-${row.id}` : undefined}
                  className={`border-b border-[var(--bt-border)] last:border-0 hover:bg-slate-50/50 ${
                    highlighted ? "bg-emerald-50/80 ring-1 ring-inset ring-emerald-200" : ""
                  }`}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                        {row.initials}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[var(--bt-text)]">{row.customer}</span>
                          {row.fromBookingDone ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                              Booking Done
                            </span>
                          ) : null}
                        </div>
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
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--bt-border)] bg-slate-50/60 px-4 py-3 text-xs text-[var(--bt-muted)]">
        <span className="font-semibold uppercase tracking-wide">
          Showing {rows.length} of {totalActive} active deals
          {handoffRows.length > 0 ? ` · ${handoffRows.length} from Booking Done` : ""}
        </span>
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
