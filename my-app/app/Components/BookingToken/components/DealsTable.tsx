"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { BookingStatus, BookingTokenTab, DealRow, FinanceReviewStatus, TokenStatus } from "../types";
import {
  financeReviewBadgeClass,
  financeReviewLabel,
  shouldShowFinanceReview,
} from "@/lib/booking-token-finance-status";
import BookingPaymentPanel, {
  type BookingPaymentPanelMode,
} from "./BookingPaymentPanel";
import CancelDealConfirmModal from "./CancelDealConfirmModal";
import ConvertToBookingModal from "./ConvertToBookingModal";
import DeleteCancelledLeadModal from "./DeleteCancelledLeadModal";
import RejectCancellationModal from "./RejectCancellationModal";
import {
  approveBookingTokenCancellation,
  cancelBookingTokenDeal,
  convertBookingTokenDeal,
  rejectBookingTokenCancellation,
} from "@/lib/booking-done-api";
import type { BookingTokenCancelInput } from "@/lib/booking-done-api";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";
import { deleteBookingTokenForLead } from "@/lib/booking-token-delete";
import { isAfterCancellationWindow } from "@/lib/booking-token-cancellation";
import { canShowCancellation } from "@/lib/booking-token-listing-type";
import { persistClosedWonBookingDoneMilestone } from "@/lib/closed-won-customer-milestone";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import type { CrmLeadType } from "@/lib/leads-filter";
import { isSuperAdminRole } from "@/lib/roleUtils";
import {
  BOOKING_TOKEN_DEALS_PAGE_SIZE,
  fetchDashboardDealsPage,
  filterDealRowsForTab,
} from "@/lib/booking-token-deals-fetch";
import type { BookingDateFilterState } from "@/lib/booking-token-date-filter";
import type { BookingDealFilterState } from "@/lib/booking-token-deal-filters";

const MONEY_CELL =
  "px-2 py-3 text-right text-xs tabular-nums text-[var(--bt-text)] whitespace-nowrap";
const HEAD_CELL =
  "px-2 py-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--bt-muted)] whitespace-nowrap";
const MONEY_HEAD = `${HEAD_CELL} text-right`;
const STATUS_HEAD = `${HEAD_CELL} text-center`;
const BODY_CELL = "px-2 py-3 align-middle";
const STATUS_CELL = `${BODY_CELL} text-center`;
const STICKY_ACTION_HEAD =
  "sticky right-0 z-20 w-[168px] min-w-[168px] max-w-[168px] bg-slate-50/95 px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-[var(--bt-muted)] shadow-[-6px_0_10px_rgba(15,23,42,0.05)]";
const STICKY_ACTION_CELL =
  "sticky right-0 z-10 w-[168px] min-w-[168px] max-w-[168px] bg-[var(--bt-surface)] px-3 py-3 align-top shadow-[-6px_0_10px_rgba(15,23,42,0.05)] group-hover:bg-slate-50/50";

const ACTION_COL_WIDTH = 168;

type TableColumn = {
  id: string;
  header: string;
  width: string;
  headClassName: string;
};

function buildTableColumns(showRemaining: boolean): TableColumn[] {
  const cols: TableColumn[] = [
    {
      id: "customer",
      header: "Customer",
      width: showRemaining ? "180px" : "196px",
      headClassName: HEAD_CELL,
    },
    {
      id: "assign",
      header: "Assign",
      width: "96px",
      headClassName: HEAD_CELL,
    },
    {
      id: "dealValue",
      header: "Deal Value",
      width: "108px",
      headClassName: MONEY_HEAD,
    },
    {
      id: "received",
      header: "Received",
      width: "100px",
      headClassName: MONEY_HEAD,
    },
    {
      id: "tenPercent",
      header: "10% Target",
      width: "100px",
      headClassName: MONEY_HEAD,
    },
  ];

  if (showRemaining) {
    cols.push({
      id: "remaining",
      header: "Remaining",
      width: "96px",
      headClassName: MONEY_HEAD,
    });
  }

  cols.push(
    {
      id: "token",
      header: "Token",
      width: "80px",
      headClassName: STATUS_HEAD,
    },
    {
      id: "booking",
      header: "Booking",
      width: "88px",
      headClassName: STATUS_HEAD,
    },
    {
      id: "finance",
      header: "Finance",
      width: "88px",
      headClassName: STATUS_HEAD,
    },
    {
      id: "expClose",
      header: "Exp. Close",
      width: "96px",
      headClassName: `${MONEY_HEAD} text-center`,
    },
    {
      id: "action",
      header: "Action",
      width: `${ACTION_COL_WIDTH}px`,
      headClassName: STICKY_ACTION_HEAD,
    },
  );

  return cols;
}

function tableMinWidth(columns: TableColumn[]): number {
  return columns.reduce((sum, col) => {
    const match = col.width.match(/^(\d+(?:\.\d+)?)px$/);
    return sum + (match ? Number(match[1]) : 96);
  }, 0);
}

const ACTION_BTN_VIEW = "bt-btn bt-btn-action bt-btn-action-view";
const ACTION_BTN_PAY = "bt-btn bt-btn-action bt-btn-action-pay";
const ACTION_BTN_CONVERT = "bt-btn bt-btn-action bt-btn-action-convert";
const ACTION_BTN_CANCEL = "bt-btn bt-btn-action bt-btn-action-danger";
const ACTION_BTN_DELETE = "bt-btn bt-btn-action bt-btn-action-danger";
const ACTION_BTN_APPROVE = "bt-btn bt-btn-action bt-btn-action-convert";
const ACTION_BTN_REJECT = "bt-btn bt-btn-action bt-btn-action-danger";

function ActionButtonStack({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex w-full flex-col gap-1.5"
      style={{ minWidth: ACTION_COL_WIDTH - 24, maxWidth: ACTION_COL_WIDTH - 24 }}
    >
      {children}
    </div>
  );
}

type Props = {
  tab: BookingTokenTab;
  dateFilter: BookingDateFilterState;
  dealFilters?: BookingDealFilterState;
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
  if (status === "pending_cancellation") {
    return (
      <span className="text-[10px] font-bold uppercase text-amber-700">Pending cancel</span>
    );
  }
  if (status === "confirmed") {
    return <span className="text-[10px] font-bold uppercase text-emerald-600">Confirmed</span>;
  }
  return <span className="text-[10px] font-bold uppercase text-orange-600">In Progress</span>;
}

function FinanceReviewBadge({
  status,
  remainingAmount,
  rejectReason,
}: {
  status?: FinanceReviewStatus;
  remainingAmount: number;
  rejectReason?: string | null;
}) {
  const normalized = status ?? "NOT_READY";
  if (!shouldShowFinanceReview(normalized, remainingAmount)) {
    return <span className="text-[10px] text-[var(--bt-muted)]">—</span>;
  }
  const label = financeReviewLabel(normalized);
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${financeReviewBadgeClass(normalized)}`}
      title={normalized === "REJECTED" && rejectReason ? rejectReason : undefined}
    >
      {label}
    </span>
  );
}

function DealRowActions({
  row,
  onView,
  onPay,
  onCancel,
  onConvert,
  onDelete,
  onApproveCancellation,
  onRejectCancellation,
  showDelete,
  showCancel,
}: {
  row: DealRow;
  onView: (row: DealRow) => void;
  onPay: (row: DealRow) => void;
  onCancel: (row: DealRow) => void;
  onConvert: (row: DealRow) => void;
  onDelete: (row: DealRow) => void;
  onApproveCancellation: (row: DealRow) => void;
  onRejectCancellation: (row: DealRow) => void;
  showDelete: boolean;
  showCancel: boolean;
}) {
  return (
    <ActionButtonStack>
      <button type="button" onClick={() => onView(row)} className={ACTION_BTN_VIEW}>
        View
      </button>

      {row.canApproveCancellation ? (
        <>
          <button
            type="button"
            onClick={() => onApproveCancellation(row)}
            className={ACTION_BTN_APPROVE}
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => onRejectCancellation(row)}
            className={ACTION_BTN_REJECT}
          >
            Reject
          </button>
        </>
      ) : null}

      {showDelete ? (
        <button type="button" onClick={() => onDelete(row)} className={ACTION_BTN_DELETE}>
          <TrashIcon />
          <span>Delete</span>
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

      {row.showCancellation && showCancel ? (
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
  dealFilters,
  onDealCancelled,
  onDealsChanged,
  onConvertedToBooking,
}: Props) {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight") ?? "";
  const fromBookingDone = searchParams.get("from") === "booking-done";

  const [rows, setRows] = useState<DealRow[]>([]);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
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
  const [approveSubmitting, setApproveSubmitting] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<DealRow | null>(null);
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [approvalError, setApprovalError] = useState("");
  const [viewerRole, setViewerRole] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setViewerRole(normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? ""));
  }, []);

  const isSuperAdmin = isSuperAdminRole(viewerRole);

  const displayRows = useMemo(
    () => applyCancellationWindow(filterDealRowsForTab(rows, tab), nowMs),
    [rows, tab, nowMs],
  );

  /** Remaining toward 10% only matters for token-stage deals. */
  const showRemainingColumn = useMemo(
    () => displayRows.some((row) => row.listingType === "token"),
    [displayRows],
  );

  const columnCount = showRemainingColumn ? 11 : 10;
  const tableColumns = useMemo(
    () => buildTableColumns(showRemainingColumn),
    [showRemainingColumn],
  );
  const minTableWidth = useMemo(() => tableMinWidth(tableColumns), [tableColumns]);

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
      const result = await fetchDashboardDealsPage({
        tab,
        dateFilter,
        dealFilters,
        page,
        size: BOOKING_TOKEN_DEALS_PAGE_SIZE,
      });

      setRows(result.rows);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
      if (result.page !== page) {
        setPage(result.page);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load deals.");
      setRows([]);
      setTotalElements(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [tab, dateFilter, dealFilters, page]);

  useEffect(() => {
    setPage(0);
  }, [tab, dateFilter, dealFilters]);

  useEffect(() => {
    void loadDeals();
  }, [loadDeals, fromBookingDone, highlightId]);

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
        const result = await cancelBookingTokenDeal(cancelTarget.id, input);
        setCancelTarget(null);
        await loadDeals();
        onDealsChanged?.();
        const movedToCancel =
          input.scope === "deal" &&
          (result.listingType === "cancel" ||
            result.bookingStatus?.trim().toLowerCase() === "cancelled");
        if (movedToCancel) {
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

  const handleApproveCancellation = useCallback(
    async (row: DealRow) => {
      setApproveSubmitting(true);
      setApprovalError("");
      try {
        await approveBookingTokenCancellation(row.id);
        await loadDeals();
        onDealsChanged?.();
      } catch (error) {
        setApprovalError(
          error instanceof Error ? error.message : "Unable to approve cancellation.",
        );
      } finally {
        setApproveSubmitting(false);
      }
    },
    [loadDeals, onDealsChanged],
  );

  const handleRejectCancellation = useCallback(
    async (reason: string) => {
      if (!rejectTarget) return;
      setRejectSubmitting(true);
      setApprovalError("");
      try {
        await rejectBookingTokenCancellation(rejectTarget.id, reason);
        setRejectTarget(null);
        await loadDeals();
        onDealsChanged?.();
      } catch (error) {
        setApprovalError(
          error instanceof Error ? error.message : "Unable to reject cancellation.",
        );
      } finally {
        setRejectSubmitting(false);
      }
    },
    [rejectTarget, loadDeals, onDealsChanged],
  );

  const tabLabel =
    tab === "all"
      ? "all active"
      : tab === "booking"
        ? "booking (10% done)"
        : tab === "token"
          ? "token"
          : "cancelled";

  const showingFrom = totalElements === 0 ? 0 : page * BOOKING_TOKEN_DEALS_PAGE_SIZE + 1;
  const showingTo = Math.min((page + 1) * BOOKING_TOKEN_DEALS_PAGE_SIZE, totalElements);
  const canGoPrevious = page > 0 && !loading;
  const canGoNext = page + 1 < totalPages && !loading;

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
      <RejectCancellationModal
        open={rejectTarget != null}
        deal={rejectTarget}
        submitting={rejectSubmitting}
        error={approvalError}
        onClose={() => {
          if (rejectSubmitting) return;
          setRejectTarget(null);
          setApprovalError("");
        }}
        onConfirm={(reason) => void handleRejectCancellation(reason)}
      />
      <div className="overflow-hidden rounded-xl border border-[var(--bt-border)] bg-[var(--bt-surface)] shadow-sm">
        {loadError || approvalError ? (
          <div className="border-b border-[var(--bt-border)] bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {loadError || approvalError}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table
            className="w-full text-left text-sm"
            style={{ minWidth: minTableWidth }}
          >
            <colgroup>
              {tableColumns.map((col) => (
                <col key={col.id} style={{ width: col.width }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-[var(--bt-border)] bg-slate-50/80">
                {tableColumns.map((col) => (
                  <th key={col.id} className={col.headClassName}>
                    {col.header}
                  </th>
                ))}
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
                    <td className={BODY_CELL}>
                      <span
                        className="block truncate text-xs text-[var(--bt-text)]"
                        title={row.assign}
                      >
                        {row.assign}
                      </span>
                      {row.cancellationApprovalStatus === "PENDING" ? (
                        <span className="mt-0.5 inline-flex rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-700">
                          Cancel pending
                        </span>
                      ) : null}
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
                    <td className={STATUS_CELL}>
                      <FinanceReviewBadge
                        status={row.financeReviewStatus}
                        remainingAmount={row.remainingAmount}
                        rejectReason={row.financeRejectReason}
                      />
                    </td>
                    <td className={`${MONEY_CELL} text-center text-[10px] text-[var(--bt-muted)] whitespace-nowrap`}>
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
                        onConvert={setConvertTarget}
                        onDelete={setDeleteTarget}
                        onApproveCancellation={(dealRow) => void handleApproveCancellation(dealRow)}
                        onRejectCancellation={setRejectTarget}
                        showDelete={
                          isSuperAdmin && isAfterCancellationWindow(row.submittedAt, nowMs)
                        }
                        showCancel={!approveSubmitting}
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
            {totalElements === 0
              ? `Showing 0 ${tabLabel} deals`
              : `Showing ${showingFrom}–${showingTo} of ${totalElements} ${tabLabel} deals`}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium tabular-nums">
              Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={!canGoPrevious}
              className="bt-btn bt-btn-pagination disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={!canGoNext}
              className="bt-btn bt-btn-pagination disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
