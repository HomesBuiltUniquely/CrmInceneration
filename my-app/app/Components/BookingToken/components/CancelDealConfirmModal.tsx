"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { DealRow } from "@/app/Components/BookingToken/types";
import {
  fetchPaymentHistory,
  type PaymentHistoryEntry,
  type PaymentHistoryResponse,
} from "@/lib/booking-payment-history-api";
import type { BookingTokenCancelInput, BookingTokenCancelScope } from "@/lib/booking-done-api";
import { formatQuoteAmount } from "@/lib/crm-quote-links";

type Props = {
  open: boolean;
  deal: DealRow | null;
  submitting: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (input: BookingTokenCancelInput) => void;
};

function clampPanelPosition(x: number, y: number, panelWidth: number, panelHeight: number) {
  const margin = 8;
  return {
    x: Math.min(Math.max(margin, x), window.innerWidth - panelWidth - margin),
    y: Math.min(Math.max(margin, y), window.innerHeight - panelHeight - margin),
  };
}

function getTopAlignedPanelPosition(panelWidth: number, panelHeight: number) {
  return clampPanelPosition(
    (window.innerWidth - panelWidth) / 2,
    16,
    panelWidth,
    panelHeight,
  );
}

function formatPaymentKind(kind?: string): string {
  if (!kind) return "";
  return kind.replace(/_/g, " ");
}

function formatPaymentSource(source?: string): string {
  if (!source) return "";
  if (source === "booking_done") return "Booking Done";
  if (source === "pay_action") return "Pay action";
  return source.replace(/_/g, " ");
}

function formatHistoryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function buildSummaryFromDeal(deal: DealRow): PaymentHistoryResponse {
  return {
    recordId: deal.id,
    leadType: deal.leadType,
    leadId: deal.leadId,
    leadIdentifier: deal.leadIdentifier,
    customerName: deal.customer,
    quoteAmount: deal.dealValueAmount,
    tenPercentAmount: deal.tenPercentAmount,
    amountReceived: deal.paidAmount,
    remainingAmount: deal.remainingAmount,
    history: [],
  };
}

export default function CancelDealConfirmModal({
  open,
  deal,
  submitting,
  error,
  onClose,
  onConfirm,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [panelEntered, setPanelEntered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState<PaymentHistoryResponse | null>(null);
  const [cancelScope, setCancelScope] = useState<BookingTokenCancelScope>("deal");
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);

  const summary = historyData ?? (deal ? buildSummaryFromDeal(deal) : null);
  const history = summary?.history ?? [];
  const selectedPayments = history.filter((entry) => selectedPaymentIds.includes(entry.id));
  const selectedAmount = selectedPayments.reduce((sum, entry) => sum + entry.amount, 0);
  const allSelected =
    history.length > 0 && history.every((entry) => selectedPaymentIds.includes(entry.id));

  const syncSelectionForScope = useCallback(
    (scope: BookingTokenCancelScope, entries: PaymentHistoryEntry[]) => {
      if (scope === "deal") {
        setSelectedPaymentIds(entries.map((entry) => entry.id));
      } else {
        setSelectedPaymentIds([]);
      }
    },
    [],
  );

  const loadHistory = useCallback(async () => {
    if (!deal) return;
    setLoading(true);
    try {
      const data = await fetchPaymentHistory(deal);
      setHistoryData(data);
      syncSelectionForScope("deal", data.history);
      setCancelScope("deal");
    } catch {
      setHistoryData(buildSummaryFromDeal(deal));
    } finally {
      setLoading(false);
    }
  }, [deal, syncSelectionForScope]);

  useEffect(() => {
    if (!open || !deal) return;
    setReason("");
    setLocalError("");
    setHistoryData(null);
    setCancelScope("deal");
    setSelectedPaymentIds([]);
    void loadHistory();
  }, [open, deal, loadHistory]);

  const handleScopeChange = (scope: BookingTokenCancelScope) => {
    setCancelScope(scope);
    syncSelectionForScope(scope, history);
    if (localError) setLocalError("");
  };

  const togglePaymentSelection = (entryId: string) => {
    if (cancelScope === "deal") return;
    setSelectedPaymentIds((prev) =>
      prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId],
    );
  };

  const selectAllPayments = () => {
    setSelectedPaymentIds(history.map((entry) => entry.id));
  };

  const clearPaymentSelection = () => {
    setSelectedPaymentIds([]);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const panelWidth = Math.min(920, window.innerWidth - 32);
    const estimatedHeight = Math.min(window.innerHeight - 32, 560);
    setPanelPosition(getTopAlignedPanelPosition(panelWidth, estimatedHeight));
    setPanelEntered(false);
  }, [open, deal?.id]);

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    setPanelPosition(getTopAlignedPanelPosition(rect.width, rect.height));
  }, [open, historyData, loading]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelEntered(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    setPanelEntered(false);
    window.setTimeout(() => onClose(), 280);
  }, [submitting, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, submitting, handleClose]);

  const handleDragStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!panelRef.current || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button,input,textarea,label")) return;
    const rect = panelRef.current.getBoundingClientRect();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragOffsetRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, []);

  const handleDragMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const next = clampPanelPosition(
      event.clientX - dragOffsetRef.current.x,
      event.clientY - dragOffsetRef.current.y,
      rect.width,
      rect.height,
    );
    panelRef.current.style.left = `${next.x}px`;
    panelRef.current.style.top = `${next.y}px`;
    setPanelPosition(next);
  }, []);

  const handleDragEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const handleSubmit = () => {
    if (!reason.trim()) {
      setLocalError("Enter a cancellation reason before confirming.");
      return;
    }
    if (cancelScope === "payments" && selectedPaymentIds.length === 0) {
      setLocalError("Select at least one payment to cancel, or choose Cancel entire deal.");
      return;
    }

    const scope: BookingTokenCancelScope =
      cancelScope === "deal" || allSelected ? "deal" : "payments";

    setLocalError("");
    onConfirm({
      reason: reason.trim(),
      scope,
      paymentHistoryEntryIds:
        scope === "payments" ? selectedPaymentIds : undefined,
    });
  };

  if (!open || !deal || !summary) return null;

  const displayError = localError || error;

  return (
    <>
      <div
        className={`fixed inset-0 z-[120] bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 ${
          panelEntered ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        className={`fixed z-[125] flex max-h-[calc(100vh-2rem)] w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[#e0e5ec] bg-white shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          panelEntered ? "scale-100 opacity-100" : "scale-[0.86] opacity-0"
        }`}
        style={{ left: panelPosition.x, top: panelPosition.y }}
        role="dialog"
        aria-modal="true"
        aria-label="Cancel booking"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`flex items-center justify-between border-b border-[#eef1f5] px-5 py-4 select-none touch-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-50 text-red-600">
                ✕
              </span>
              <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#374151]">
                Cancellation
              </h2>
            </div>
            <p className="mt-1 truncate text-[13px] font-semibold text-[#111827]" title={deal.customer}>
              {deal.customer}
            </p>
            <p className="truncate text-[12px] text-[#6b7280]">{deal.asset}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-md px-2 py-1 text-[18px] leading-none text-[#9ca3af] hover:bg-[#f3f4f6] disabled:opacity-50"
            aria-label="Close cancellation panel"
          >
            ×
          </button>
        </div>

        <div className="grid gap-3 border-b border-[#eef1f5] px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Total amount" value={formatQuoteAmount(summary.quoteAmount)} />
          <SummaryCard label="10% amount" value={formatQuoteAmount(summary.tenPercentAmount)} />
          <SummaryCard label="Amount paid" value={formatQuoteAmount(summary.amountReceived)} highlight />
          <SummaryCard
            label="Remaining (10%)"
            value={formatQuoteAmount(summary.remainingAmount)}
            highlight={summary.remainingAmount > 0}
          />
        </div>

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
          <div className="min-h-0 overflow-hidden border-b border-[#eef1f5] lg:border-b-0 lg:border-r">
            <div className="border-b border-[#eef1f5] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
                What to cancel
              </p>
              <div className="mt-2 flex flex-col gap-2">
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#e5e7eb] px-3 py-2 hover:bg-[#f9fafb]">
                  <input
                    type="radio"
                    name="cancel-scope"
                    checked={cancelScope === "deal"}
                    onChange={() => handleScopeChange("deal")}
                    disabled={submitting}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-[12px] font-semibold text-[#111827]">
                      Cancel entire deal
                    </span>
                    <span className="text-[11px] text-[#6b7280]">
                      Whole booking moves to Cancel tab — all payments voided
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#e5e7eb] px-3 py-2 hover:bg-[#f9fafb]">
                  <input
                    type="radio"
                    name="cancel-scope"
                    checked={cancelScope === "payments"}
                    onChange={() => handleScopeChange("payments")}
                    disabled={submitting}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-[12px] font-semibold text-[#111827]">
                      Cancel selected payments only
                    </span>
                    <span className="text-[11px] text-[#6b7280]">
                      Pick one or more payments below — deal stays active if any payment remains
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
                Payment history
                {summary.summary ? (
                  <span className="ml-2 font-normal normal-case tracking-normal text-[#6b7280]">
                    · {summary.summary.paymentCount} payment
                    {summary.summary.paymentCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </p>
              {cancelScope === "payments" && history.length > 0 ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllPayments}
                    className="text-[10px] font-semibold text-[#2563eb] hover:underline"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={clearPaymentSelection}
                    className="text-[10px] font-semibold text-[#6b7280] hover:underline"
                  >
                    Clear
                  </button>
                </div>
              ) : null}
            </div>
            {loading ? (
              <p className="px-4 py-6 text-sm text-[#6b7280]">Loading history…</p>
            ) : history.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[#6b7280]">No payments recorded yet.</p>
            ) : (
              <ul className="max-h-[min(220px,calc(100vh-26rem))] overflow-y-auto">
                {history.map((entry) => {
                  const checked = selectedPaymentIds.includes(entry.id);
                  const readOnly = cancelScope === "deal";
                  return (
                    <li key={entry.id}>
                      <label
                        className={`flex w-full cursor-pointer items-start gap-3 border-b border-[#f1f5f9] px-4 py-3 transition ${
                          checked ? "bg-[#fef2f2]" : "hover:bg-[#f9fafb]"
                        } ${readOnly ? "cursor-default" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={submitting || readOnly}
                          onChange={() => togglePaymentSelection(entry.id)}
                          className="mt-1 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[12px] font-bold text-[#111827]">
                                Payment {entry.sequence} · {formatQuoteAmount(entry.amount)}
                                {entry.paymentKind ? (
                                  <span className="ml-1 font-semibold text-[#059669]">
                                    · {formatPaymentKind(entry.paymentKind)}
                                  </span>
                                ) : null}
                              </p>
                              <p className="mt-1 text-[11px] text-[#6b7280]">
                                Total paid {formatQuoteAmount(entry.cumulativeReceived)} · Remaining{" "}
                                {formatQuoteAmount(entry.remainingAfter)}
                                {entry.source ? (
                                  <span className="text-[#9ca3af]">
                                    {" "}
                                    · {formatPaymentSource(entry.source)}
                                  </span>
                                ) : null}
                              </p>
                            </div>
                            <p className="shrink-0 text-[10px] text-[#9ca3af]">
                              {formatHistoryDate(entry.createdAt)}
                            </p>
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {selectedPaymentIds.length > 0 ? (
              <div className="border-t border-[#eef1f5] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">
                  Selected for cancellation
                </p>
                <p className="mt-1 text-[12px] font-semibold text-[#111827]">
                  {selectedPaymentIds.length} payment{selectedPaymentIds.length === 1 ? "" : "s"} ·{" "}
                  {formatQuoteAmount(selectedAmount)}
                </p>
                {cancelScope === "payments" && !allSelected ? (
                  <p className="mt-1 text-[11px] text-[#6b7280]">
                    Deal remains on Token tab after partial cancel.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
                Cancel this lead
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-[#6b7280]">
                Choose to cancel the <span className="font-semibold text-[#374151]">entire deal</span>{" "}
                or only <span className="font-semibold text-[#374151]">selected payments</span>. Full
                deal cancel moves the lead to the Cancel tab. Allowed only within 24 hours of Booking
                Done.
              </p>

              <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                Cancellation reason
              </label>
              <textarea
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  if (localError) setLocalError("");
                }}
                rows={4}
                disabled={submitting}
                placeholder="Why is this booking being cancelled?"
                className="mt-1.5 w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:opacity-60"
              />
            </div>

            <div className="shrink-0 border-t border-[#eef1f5] bg-white px-4 py-3">
              {displayError ? (
                <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {displayError}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="flex-1 rounded-lg border border-[#d1d5db] px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#374151] hover:bg-[#f9fafb] disabled:opacity-60"
                >
                  Keep booking
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {submitting
                    ? "Cancelling…"
                    : cancelScope === "deal" || allSelected
                      ? "Cancel entire deal"
                      : "Cancel selected payments"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function SummaryCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        highlight ? "border-[#bbf7d0] bg-[#ecfdf5]" : "border-[#e5e7eb] bg-[#f9fafb]"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">{label}</p>
      <p className="mt-1 text-[15px] font-bold text-[#111827]">{value}</p>
    </div>
  );
}
