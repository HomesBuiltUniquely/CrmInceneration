"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { BookingStatus, BookingTokenTab, DealRow, TokenStatus } from "../types";
import BookingPaymentPanel, {
  type BookingPaymentPanelMode,
} from "./BookingPaymentPanel";
import CancelDealConfirmModal from "./CancelDealConfirmModal";
import { cancelBookingTokenDeal, fetchBookingTokenDeals } from "@/lib/booking-done-api";
import type { BookingTokenCancelInput } from "@/lib/booking-done-api";
import { canShowCancellation, listingTypeQueryForTab } from "@/lib/booking-token-listing-type";
import { bookingTokenDealToDealRow } from "@/lib/booking-token-leads";

const MONEY_CELL = "px-2 py-3 text-xs tabular-nums text-[var(--bt-text)] whitespace-nowrap";
const HEAD_CELL =
  "px-2 py-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--bt-muted)] whitespace-nowrap";
const BODY_CELL = "px-2 py-3 align-middle";
const STICKY_ACTION_HEAD =
  "sticky right-0 z-20 bg-slate-50/95 px-2 py-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--bt-muted)] shadow-[-6px_0_10px_rgba(15,23,42,0.05)]";
const STICKY_ACTION_CELL =
  "sticky right-0 z-10 bg-[var(--bt-surface)] px-2 py-3 align-middle shadow-[-6px_0_10px_rgba(15,23,42,0.05)] group-hover:bg-slate-50/50";

type Props = {
  tab: BookingTokenTab;
  onDealCancelled?: () => void;
  onDealsChanged?: () => void;
};

function TokenBadge({ status }: { status: TokenStatus }) {
  if (status === "issued") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-700">
        <span className="text-emerald-600">✓</span> Issued
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-700">
        Token
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[9px] font-bold uppercase text-orange-700">
      <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-orange-300 border-t-orange-600" />
      Minting
    </span>
  );
}

function BookingStatusText({ status }: { status: BookingStatus }) {
  if (status === "cancelled") {
    return <span className="text-[10px] font-bold uppercase text-red-600">Cancelled</span>;
  }
  if (status === "confirmed") {
    return <span className="text-[10px] font-bold uppercase text-emerald-600">Confirmed</span>;
  }
  return <span className="text-[10px] font-bold uppercase text-orange-600">In Progress</span>;
}

function DealRowActions({
  row,
  onView,
  onPay,
  onCancel,
}: {
  row: DealRow;
  onView: (row: DealRow) => void;
  onPay: (row: DealRow) => void;
  onCancel: (row: DealRow) => void;
}) {
  const actionBtn =
    "inline-flex h-6 w-full items-center justify-center rounded px-1 text-[8px] font-bold uppercase leading-none tracking-wide whitespace-nowrap transition";

  if (row.listingType === "cancel") {
    return (
      <div className="w-[128px]">
        <button
          type="button"
          onClick={() => onView(row)}
          className={`${actionBtn} border border-[var(--bt-border)] bg-white text-[var(--bt-text)] hover:bg-slate-50`}
        >
          View
        </button>
      </div>
    );
  }

  if (row.listingType === "booking") {
    return (
      <div className="grid w-[128px] grid-cols-1 gap-1">
        <button
          type="button"
          onClick={() => onView(row)}
          className={`${actionBtn} border border-[var(--bt-border)] bg-white text-[var(--bt-text)] hover:bg-slate-50`}
        >
          View
        </button>
        {row.showConvert ? (
          <button
            type="button"
            className={`${actionBtn} bg-[var(--bt-green)] text-[var(--bt-navy)] hover:brightness-105`}
          >
            Convert to Booking →
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid w-[128px] grid-cols-2 gap-1">
      <button
        type="button"
        onClick={() => onView(row)}
        className={`${actionBtn} border border-[var(--bt-border)] bg-white text-[var(--bt-text)] hover:bg-slate-50`}
      >
        View
      </button>
      {row.showPay ? (
        <button
          type="button"
          onClick={() => onPay(row)}
          className={`${actionBtn} border border-[var(--bt-navy)] bg-[var(--bt-navy)] text-white hover:brightness-110`}
        >
          Pay
        </button>
      ) : (
        <span className={`${actionBtn} border border-transparent opacity-0`} aria-hidden="true">
          —
        </span>
      )}
      {row.showCancellation ? (
        <button
          type="button"
          onClick={() => onCancel(row)}
          className={`${actionBtn} col-span-2 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
        >
          Cancellation
        </button>
      ) : null}
    </div>
  );
}

function filterRowsForTab(rows: DealRow[], tab: BookingTokenTab): DealRow[] {
  switch (tab) {
    case "all":
      return rows.filter((row) => row.listingType !== "cancel");
    case "booking":
      return rows.filter((row) => row.listingType === "booking");
    case "token":
      return rows.filter((row) => row.listingType === "token");
    case "cancel":
      return rows.filter((row) => row.listingType === "cancel");
    default:
      return rows;
  }
}

function applyCancellationWindow(rows: DealRow[], nowMs: number): DealRow[] {
  return rows.map((row) => ({
    ...row,
    showCancellation: canShowCancellation(row.listingType, row.submittedAt, nowMs),
  }));
}

export default function DealsTable({ tab, onDealCancelled, onDealsChanged }: Props) {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight") ?? "";
  const fromBookingDone = searchParams.get("from") === "booking-done";

  const [rows, setRows] = useState<DealRow[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<BookingPaymentPanelMode>("view");
  const [selectedDeal, setSelectedDeal] = useState<DealRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<DealRow | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const displayRows = useMemo(
    () => applyCancellationWindow(filterRowsForTab(rows, tab), nowMs),
    [rows, tab, nowMs],
  );

  const openPanel = useCallback((row: DealRow, mode: BookingPaymentPanelMode) => {
    setSelectedDeal(row);
    setPanelMode(mode);
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setSelectedDeal(null);
  }, []);

  const loadDeals = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const listingType = listingTypeQueryForTab(tab);
      let response = await fetchBookingTokenDeals({
        page: 0,
        size: 50,
        listingType,
      });
      let mapped = response.deals.map(bookingTokenDealToDealRow);

      const filtered = filterRowsForTab(mapped, tab);
      if (filtered.length === 0 && listingType) {
        const fallback = await fetchBookingTokenDeals({ page: 0, size: 50 });
        mapped = fallback.deals.map(bookingTokenDealToDealRow);
      }

      setRows(mapped);
      setTotalElements(filterRowsForTab(mapped, tab).length);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load deals.");
      setRows([]);
      setTotalElements(0);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void loadDeals();
  }, [loadDeals, fromBookingDone, highlightId, tab]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const handleConfirmCancel = useCallback(
    async (input: BookingTokenCancelInput) => {
      if (!cancelTarget) return;
      setCancelSubmitting(true);
      setCancelError("");
      try {
        await cancelBookingTokenDeal(cancelTarget.id, input);
        setCancelTarget(null);
        await loadDeals();
        onDealsChanged?.();
        if (input.scope === "deal") {
          onDealCancelled?.();
        }
      } catch (error) {
        setCancelError(error instanceof Error ? error.message : "Unable to cancel deal.");
      } finally {
        setCancelSubmitting(false);
      }
    },
    [cancelTarget, loadDeals, onDealCancelled, onDealsChanged],
  );

  const tabLabel =
    tab === "all"
      ? "all active"
      : tab === "booking"
        ? "booking (10% done)"
        : tab === "token"
          ? "token"
          : "cancelled";

  const emptyMessage =
    tab === "cancel"
      ? "No cancelled bookings yet"
      : tab === "booking"
        ? "No booking deals yet"
        : tab === "token"
          ? "No token deals yet"
          : "No deals yet";
  const emptyHint =
    tab === "cancel"
      ? "Deals cancelled within 24 hours of Booking Done appear here with payment history."
      : tab === "booking"
        ? "Only leads with full 10% booking advance appear here."
        : tab === "token"
          ? "Leads still paying toward 10% (token / partial) appear here."
          : "All active token and booking deals appear here.";

  return (
    <>
      <BookingPaymentPanel
        open={panelOpen}
        mode={panelMode}
        deal={selectedDeal}
        onClose={closePanel}
        onUpdated={() => {
          void loadDeals();
          onDealsChanged?.();
        }}
      />
      <CancelDealConfirmModal
        open={cancelTarget != null}
        deal={cancelTarget}
        submitting={cancelSubmitting}
        error={cancelError}
        onClose={() => {
          if (cancelSubmitting) return;
          setCancelTarget(null);
          setCancelError("");
        }}
        onConfirm={(input) => void handleConfirmCancel(input)}
      />
      <div className="overflow-hidden rounded-xl border border-[var(--bt-border)] bg-[var(--bt-surface)] shadow-sm">
        {loadError ? (
          <div className="border-b border-[var(--bt-border)] bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {loadError}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "128px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-[var(--bt-border)] bg-slate-50/80">
                <th className={HEAD_CELL}>Customer</th>
                <th className={HEAD_CELL}>Deal Value</th>
                <th className={HEAD_CELL}>Received</th>
                <th className={HEAD_CELL}>10% Target</th>
                <th className={HEAD_CELL}>Remaining</th>
                <th className={HEAD_CELL}>Token</th>
                <th className={HEAD_CELL}>Booking</th>
                <th className={HEAD_CELL}>Exp. Close</th>
                <th className={STICKY_ACTION_HEAD}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && displayRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-[var(--bt-muted)]">
                    Loading deals…
                  </td>
                </tr>
              ) : null}
              {!loading && displayRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <p className="text-sm font-semibold text-[var(--bt-text)]">{emptyMessage}</p>
                    <p className="mt-1 text-xs text-[var(--bt-muted)]">{emptyHint}</p>
                  </td>
                </tr>
              ) : null}
              {displayRows.map((row) => {
                const highlighted = highlightId && row.id === highlightId;
                const stickyBg = highlighted ? "bg-emerald-50/80" : "bg-[var(--bt-surface)]";
                return (
                  <tr
                    key={row.id}
                    id={row.fromBookingDone ? `deal-${row.id}` : undefined}
                    className={`group border-b border-[var(--bt-border)] last:border-0 hover:bg-slate-50/50 ${
                      highlighted ? "bg-emerald-50/80 ring-1 ring-inset ring-emerald-200" : ""
                    }`}
                  >
                    <td className={BODY_CELL}>
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600">
                          {row.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span
                              className="truncate text-xs font-semibold text-[var(--bt-text)]"
                              title={row.customer}
                            >
                              {row.customer}
                            </span>
                            {row.listingType === "cancel" ? (
                              <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-red-700">
                                Cancel
                              </span>
                            ) : row.listingType === "booking" ? (
                              <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-blue-700">
                                Booking
                              </span>
                            ) : row.fromBookingDone ? (
                              <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-emerald-700">
                                Done
                              </span>
                            ) : null}
                          </div>
                          <div className="truncate text-[10px] text-[var(--bt-muted)]" title={row.asset}>
                            {row.asset}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={`${MONEY_CELL} font-semibold`}>{row.dealValue}</td>
                    <td className={MONEY_CELL}>{row.preBooking}</td>
                    <td className={`${MONEY_CELL} text-[var(--bt-muted)]`}>{row.tenPercentTarget}</td>
                    <td className={`${MONEY_CELL} font-semibold`}>{row.remaining}</td>
                    <td className={BODY_CELL}>
                      <TokenBadge status={row.tokenStatus} />
                    </td>
                    <td className={BODY_CELL}>
                      <BookingStatusText status={row.bookingStatus} />
                    </td>
                    <td className={`${BODY_CELL} text-[10px] text-[var(--bt-muted)] whitespace-nowrap`}>
                      {row.expClosing}
                    </td>
                    <td
                      className={`${STICKY_ACTION_CELL} ${stickyBg} ${highlighted ? "group-hover:bg-emerald-50/80" : ""}`}
                    >
                      <DealRowActions
                        row={row}
                        onView={(dealRow) => openPanel(dealRow, "view")}
                        onPay={(dealRow) => openPanel(dealRow, "pay")}
                        onCancel={setCancelTarget}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--bt-border)] bg-slate-50/60 px-4 py-3 text-xs text-[var(--bt-muted)]">
          <span className="font-semibold uppercase tracking-wide">
            Showing {displayRows.length} of {totalElements} {tabLabel} deals
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-[var(--bt-border)] bg-white px-3 py-1.5 font-semibold uppercase hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded border border-[var(--bt-border)] bg-white px-3 py-1.5 font-semibold uppercase hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
