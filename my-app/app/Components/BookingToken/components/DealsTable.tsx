"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { BookingStatus, BookingTokenTab, DealRow, TokenStatus } from "../types";
import BookingPaymentPanel, {
  type BookingPaymentPanelMode,
} from "./BookingPaymentPanel";
import CancelDealConfirmModal from "./CancelDealConfirmModal";
import ConvertToBookingModal from "./ConvertToBookingModal";
import DeleteCancelledLeadModal from "./DeleteCancelledLeadModal";
import { cancelBookingTokenDeal, convertBookingTokenDeal } from "@/lib/booking-done-api";
import type { BookingTokenCancelInput } from "@/lib/booking-done-api";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";
import { deleteBookingTokenForLead } from "@/lib/booking-token-delete";
import { canShowCancellation } from "@/lib/booking-token-listing-type";
import { persistClosedWonBookingDoneMilestone } from "@/lib/closed-won-customer-milestone";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import type { CrmLeadType } from "@/lib/leads-filter";
import { isAdminRole } from "@/lib/roleUtils";
import {
  fetchDashboardDealRows,
  filterDealRowsForTab,
} from "@/lib/booking-token-deals-fetch";
import type { BookingDateFilterState } from "@/lib/booking-token-date-filter";

const MONEY_CELL =
  "px-2 py-3 text-right text-xs tabular-nums text-[var(--bt-text)] whitespace-nowrap";
const HEAD_CELL =
  "px-2 py-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--bt-muted)] whitespace-nowrap";
const MONEY_HEAD = `${HEAD_CELL} text-right`;
const STATUS_HEAD = `${HEAD_CELL} text-center`;
const BODY_CELL = "px-2 py-3 align-middle";
const STATUS_CELL = `${BODY_CELL} text-center`;
const STICKY_ACTION_HEAD =
  "sticky right-0 z-20 bg-slate-50/95 px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-[var(--bt-muted)] shadow-[-6px_0_10px_rgba(15,23,42,0.05)]";
const STICKY_ACTION_CELL =
  "sticky right-0 z-10 bg-[var(--bt-surface)] px-3 py-3 align-top shadow-[-6px_0_10px_rgba(15,23,42,0.05)] group-hover:bg-slate-50/50";

const ACTION_COL_WIDTH = "152px";

const COLUMN_WIDTHS_WITH_REMAINING = [
  "24%",
  "10%",
  "9%",
  "9%",
  "9%",
  "8%",
  "8%",
  "8%",
  ACTION_COL_WIDTH,
] as const;

const COLUMN_WIDTHS_WITHOUT_REMAINING = [
  "28%",
  "12%",
  "11%",
  "11%",
  "10%",
  "10%",
  "10%",
  ACTION_COL_WIDTH,
] as const;

const ACTION_BTN_VIEW = "bt-btn bt-btn-action bt-btn-action-view";
const ACTION_BTN_PAY = "bt-btn bt-btn-action bt-btn-action-pay";
const ACTION_BTN_CONVERT = "bt-btn bt-btn-action bt-btn-action-convert";
const ACTION_BTN_CANCEL = "bt-btn bt-btn-action bt-btn-action-danger";
const ACTION_BTN_DELETE = "bt-btn bt-btn-action bt-btn-action-danger";

function ActionButtonStack({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-col gap-1.5"
      style={{ width: ACTION_COL_WIDTH, minWidth: ACTION_COL_WIDTH, maxWidth: ACTION_COL_WIDTH }}
    >
      {children}
    </div>
  );
}

type Props = {
  tab: BookingTokenTab;
  dateFilter: BookingDateFilterState;
  onDealCancelled?: () => void;
  onDealsChanged?: () => void;
  onConvertedToBooking?: () => void;
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
  onConvert,
  onDelete,
  showDelete,
}: {
  row: DealRow;
  onView: (row: DealRow) => void;
  onPay: (row: DealRow) => void;
  onCancel: (row: DealRow) => void;
  onConvert: (row: DealRow) => void;
  onDelete: (row: DealRow) => void;
  showDelete: boolean;
}) {
  return (
    <ActionButtonStack>
      <button type="button" onClick={() => onView(row)} className={ACTION_BTN_VIEW}>
        View
      </button>

      {row.listingType === "cancel" && showDelete ? (
        <button type="button" onClick={() => onDelete(row)} className={ACTION_BTN_DELETE}>
          <TrashIcon />
          <span>Remove</span>
        </button>
      ) : null}

      {row.showPay ? (
        <button type="button" onClick={() => onPay(row)} className={ACTION_BTN_PAY}>
          Pay
        </button>
      ) : null}

      {row.showConvert ? (
        <button type="button" onClick={() => onConvert(row)} className={ACTION_BTN_CONVERT}>
          <span>Convert Booking</span>
          <span aria-hidden className="text-[10px] leading-none">
            →
          </span>
        </button>
      ) : null}

      {row.showCancellation ? (
        <button type="button" onClick={() => onCancel(row)} className={ACTION_BTN_CANCEL}>
          Cancellation
        </button>
      ) : null}
    </ActionButtonStack>
  );
}

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function applyCancellationWindow(rows: DealRow[], nowMs: number): DealRow[] {
  return rows.map((row) => ({
    ...row,
    showCancellation: canShowCancellation(row.listingType, row.submittedAt, nowMs),
  }));
}

export default function DealsTable({
  tab,
  dateFilter,
  onDealCancelled,
  onDealsChanged,
  onConvertedToBooking,
}: Props) {
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
  const [convertTarget, setConvertTarget] = useState<DealRow | null>(null);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [convertSubmitting, setConvertSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [convertError, setConvertError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DealRow | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [viewerRole, setViewerRole] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setViewerRole(normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? ""));
  }, []);

  const canDeleteLead = tab === "cancel" && isAdminRole(viewerRole);

  const displayRows = useMemo(
    () => applyCancellationWindow(filterDealRowsForTab(rows, tab), nowMs),
    [rows, tab, nowMs],
  );

  /** Remaining toward 10% only matters for token-stage deals. */
  const showRemainingColumn = useMemo(
    () => displayRows.some((row) => row.listingType === "token"),
    [displayRows],
  );

  const columnCount = showRemainingColumn ? 9 : 8;
  const columnWidths = showRemainingColumn
    ? COLUMN_WIDTHS_WITH_REMAINING
    : COLUMN_WIDTHS_WITHOUT_REMAINING;

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
      // Fetch all active deals and filter client-side so Pay auto-promote on Hub does not
      // hide token-stage rows (Convert to Booking is manual after 10% is paid).
      const mapped = await fetchDashboardDealRows({ tab, dateFilter });

      setRows(mapped);
      setTotalElements(mapped.length);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load deals.");
      setRows([]);
      setTotalElements(0);
    } finally {
      setLoading(false);
    }
  }, [tab, dateFilter]);

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

  const handleConfirmConvert = useCallback(async () => {
    if (!convertTarget) return;
    setConvertSubmitting(true);
    setConvertError("");
    try {
      await convertBookingTokenDeal(convertTarget.id);
      if (isCrmLeadType(convertTarget.leadType)) {
        await persistClosedWonBookingDoneMilestone(
          convertTarget.leadType as CrmLeadType,
          String(convertTarget.leadId),
        );
      }
      await loadDeals();
      onDealsChanged?.();
      onConvertedToBooking?.();
    } catch (error) {
      setConvertError(error instanceof Error ? error.message : "Unable to convert to booking.");
      throw error;
    } finally {
      setConvertSubmitting(false);
    }
  }, [convertTarget, loadDeals, onConvertedToBooking, onDealsChanged]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    if (!isCrmLeadType(deleteTarget.leadType)) {
      setDeleteError("Invalid lead type for delete.");
      return;
    }
    setDeleteSubmitting(true);
    setDeleteError("");
    try {
      await deleteBookingTokenForLead(deleteTarget.leadType, deleteTarget.leadId);
      setDeleteTarget(null);
      await loadDeals();
      onDealsChanged?.();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Unable to remove this deal from Booking & Token.");
    } finally {
      setDeleteSubmitting(false);
    }
  }, [deleteTarget, loadDeals, onDealsChanged]);

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
      <ConvertToBookingModal
        open={convertTarget != null}
        deal={convertTarget}
        submitting={convertSubmitting}
        error={convertError}
        onClose={() => {
          if (convertSubmitting) return;
          setConvertTarget(null);
          setConvertError("");
        }}
        onConfirm={handleConfirmConvert}
      />
      <DeleteCancelledLeadModal
        open={deleteTarget != null}
        deal={deleteTarget}
        submitting={deleteSubmitting}
        error={deleteError}
        onClose={() => {
          if (deleteSubmitting) return;
          setDeleteTarget(null);
          setDeleteError("");
        }}
        onConfirm={handleConfirmDelete}
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
              {columnWidths.map((width, index) => (
                <col key={`${width}-${index}`} style={{ width }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-[var(--bt-border)] bg-slate-50/80">
                <th className={HEAD_CELL}>Customer</th>
                <th className={MONEY_HEAD}>Deal Value</th>
                <th className={MONEY_HEAD}>Received</th>
                <th className={MONEY_HEAD}>10% Target</th>
                {showRemainingColumn ? <th className={MONEY_HEAD}>Remaining</th> : null}
                <th className={STATUS_HEAD}>Token</th>
                <th className={STATUS_HEAD}>Booking</th>
                <th className={`${MONEY_HEAD} text-center`}>Exp. Close</th>
                <th className={STICKY_ACTION_HEAD}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && displayRows.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-8 text-center text-sm text-[var(--bt-muted)]">
                    Loading deals…
                  </td>
                </tr>
              ) : null}
              {!loading && displayRows.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="px-4 py-12 text-center">
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
                    {showRemainingColumn ? (
                      <td className={`${MONEY_CELL} font-semibold`}>{row.remaining}</td>
                    ) : null}
                    <td className={STATUS_CELL}>
                      <TokenBadge status={row.tokenStatus} />
                    </td>
                    <td className={STATUS_CELL}>
                      <BookingStatusText status={row.bookingStatus} />
                    </td>
                    <td className={`${MONEY_CELL} text-center text-[10px] text-[var(--bt-muted)]`}>
                      {row.expClosing}
                    </td>
                    <td
                      className={`${STICKY_ACTION_CELL} ${stickyBg} ${highlighted ? "group-hover:bg-emerald-50/80" : ""}`}
                    >
                      <div className="flex justify-end">
                        <DealRowActions
                        row={row}
                        onView={(dealRow) => openPanel(dealRow, "view")}
                        onPay={(dealRow) => openPanel(dealRow, "pay")}
                        onCancel={setCancelTarget}
                        onConvert={setConvertTarget}
                        onDelete={setDeleteTarget}
                        showDelete={canDeleteLead}
                      />
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
            Showing {displayRows.length} of {totalElements} {tabLabel} deals
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="bt-btn bt-btn-pagination"
            >
              Previous
            </button>
            <button
              type="button"
              className="bt-btn bt-btn-pagination"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
