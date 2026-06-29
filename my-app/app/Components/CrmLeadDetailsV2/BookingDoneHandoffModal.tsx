"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import BookingCelebrationOverlay from "@/app/Components/BookingToken/components/BookingCelebrationOverlay";
import "@/app/Components/BookingToken/booking-token.css";
import {
  bookingPaymentKindDescription,
  bookingPaymentKindLabel,
  calculateBookingTenPercent,
  classifyBookingPayment,
} from "@/lib/booking-done-payment-rules";
import {
  parsePaymentAmountInput,
  readPaymentAmount,
  readPaymentProofs,
} from "@/lib/booking-done-payment-storage";
import {
  submitBookingDone,
  uploadBookingPaymentProofs,
} from "@/lib/booking-done-api";
import {
  buildBookingDoneSubmitPayload,
  validateBookingDoneHandoff,
} from "@/lib/booking-token-leads";
import { getLeadDetail } from "@/lib/lead-details-client";
import { formatQuoteAmount, type LeadQuoteOption } from "@/lib/crm-quote-links";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import type { CrmLeadType } from "@/lib/leads-filter";
import { clearBookingDoneDraft, paymentProofsToFiles } from "@/lib/booking-done-payment-storage";
import { persistClosedWonCustomerMilestoneFromPayment } from "@/lib/closed-won-customer-milestone";

type Props = {
  open: boolean;
  leadType: string;
  leadId: string;
  hubLeadId: string;
  selectedQuote: LeadQuoteOption | null;
  onClose: () => void;
  onComplete: (
    recordId: string,
    substage: string,
    opts: { navigatedInNewTab: boolean },
  ) => void;
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

function pickDetailStr(detail: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = detail[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function bookingTokenTabUrl(recordId: string): string {
  return `/booking-token?from=booking-done&highlight=${encodeURIComponent(recordId)}`;
}

/** Open B&T dashboard in a new tab; reuse `pendingTab` from sync user click when possible. */
function navigateBookingTokenTab(recordId: string, pendingTab: Window | null): boolean {
  const url = bookingTokenTabUrl(recordId);
  if (pendingTab && !pendingTab.closed) {
    pendingTab.location.href = url;
    return true;
  }
  return window.open(url, "_blank", "noopener,noreferrer") != null;
}

export default function BookingDoneHandoffModal({
  open,
  leadType,
  leadId,
  hubLeadId,
  selectedQuote,
  onClose,
  onComplete,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [panelEntered, setPanelEntered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const [loadingLead, setLoadingLead] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  const [completedRecordId, setCompletedRecordId] = useState("");
  const [completedSubstage, setCompletedSubstage] = useState("");
  const [celebrationMode, setCelebrationMode] = useState<"new-tab" | "same-tab">("new-tab");
  const openedInNewTabRef = useRef(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [leadIdentifier, setLeadIdentifier] = useState("");

  const amountReceived = useMemo(
    () => parsePaymentAmountInput(readPaymentAmount(leadType, leadId)),
    [leadId, leadType, open],
  );
  const proofDrafts = useMemo(
    () => (open ? readPaymentProofs(leadType, leadId) : []),
    [leadId, leadType, open],
  );
  const tenPercentAmount = useMemo(
    () => calculateBookingTenPercent(selectedQuote?.amount),
    [selectedQuote?.amount],
  );
  const paymentKind = useMemo(
    () => classifyBookingPayment(amountReceived, selectedQuote?.amount ?? null),
    [amountReceived, selectedQuote?.amount],
  );
  const remainingAmount = useMemo(() => {
    if (tenPercentAmount == null || amountReceived == null) return null;
    return Math.max(0, tenPercentAmount - amountReceived);
  }, [amountReceived, tenPercentAmount]);

  useEffect(() => {
    if (!open || !isCrmLeadType(leadType)) return;
    let cancelled = false;
    setLoadingLead(true);
    void (async () => {
      try {
        const detail = await getLeadDetail(leadType as CrmLeadType, leadId);
        if (cancelled) return;
        setCustomerName(
          pickDetailStr(detail, "customerName", "name", "leadName") || "Lead",
        );
        setCustomerPhone(pickDetailStr(detail, "phone", "customerPhone", "mobile"));
        setLeadIdentifier(
          pickDetailStr(detail, "leadId", "leadIdentifier", "uniqueId", "leadRef"),
        );
      } catch {
        if (!cancelled) {
          setCustomerName("Lead");
          setCustomerPhone("");
          setLeadIdentifier(leadId);
        }
      } finally {
        if (!cancelled) setLoadingLead(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId, leadType, open]);

  useEffect(() => {
    if (!open) {
      setError("");
      setCelebrating(false);
      setCompletedRecordId("");
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelEntered(false);
      return;
    }
    const frame = window.requestAnimationFrame(() => setPanelEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const next = getTopAlignedPanelPosition(rect.width, rect.height);
    panelRef.current.style.left = `${next.x}px`;
    panelRef.current.style.top = `${next.y}px`;
    setPanelPosition(next);
  }, [open]);

  const handleClose = useCallback(() => {
    if (submitting || celebrating) return;
    onClose();
  }, [celebrating, onClose, submitting]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting && !celebrating) handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [celebrating, handleClose, open, submitting]);

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

  const handleCelebrationDone = useCallback(() => {
    const recordId = completedRecordId;
    const substage = completedSubstage;
    const navigatedInNewTab = openedInNewTabRef.current;
    setCelebrating(false);
    onClose();
    if (!recordId) return;

    onComplete(recordId, substage, { navigatedInNewTab });

    if (!navigatedInNewTab) {
      window.location.assign(bookingTokenTabUrl(recordId));
    }
  }, [completedRecordId, completedSubstage, onClose, onComplete]);

  const handleConfirm = async () => {
    setError("");
    const validation = validateBookingDoneHandoff({
      leadType,
      leadId,
      hubLeadId,
      selectedQuote,
    });
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    if (!isCrmLeadType(leadType)) {
      setError("Invalid lead type.");
      return;
    }
    const payload = buildBookingDoneSubmitPayload({
      leadType,
      leadId,
      hubLeadId,
      selectedQuote,
    });
    if (!payload) {
      setError("Unable to prepare booking submission. Check quote and payment amount.");
      return;
    }

    // Reserve a new tab while the confirm click is still a user gesture (avoids popup blockers).
    const pendingTab = window.open("about:blank", "_blank", "noopener,noreferrer");

    setSubmitting(true);
    try {
      const record = await submitBookingDone(leadType, leadId, payload);
      const draftProofs = readPaymentProofs(leadType, leadId);
      if (draftProofs.length > 0) {
        const files = await paymentProofsToFiles(draftProofs);
        if (files.length > 0) {
          await uploadBookingPaymentProofs(leadType, leadId, record.id, files);
        }
      }
      clearBookingDoneDraft(leadType, leadId);
      const substage = await persistClosedWonCustomerMilestoneFromPayment(
        leadType,
        leadId,
        payload.paymentKind,
      );

      const tabOpened = navigateBookingTokenTab(record.id, pendingTab);
      openedInNewTabRef.current = tabOpened;
      if (!tabOpened && pendingTab && !pendingTab.closed) {
        pendingTab.close();
      }

      setCompletedRecordId(record.id);
      setCompletedSubstage(substage);
      setCelebrationMode(tabOpened ? "new-tab" : "same-tab");
      setCelebrating(true);
    } catch (err) {
      if (pendingTab && !pendingTab.closed) pendingTab.close();
      setError(err instanceof Error ? err.message : "Unable to submit Booking Done record.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {celebrating ? (
        <BookingCelebrationOverlay
          title="Sent to Booking & Token!"
          subtitle={
            celebrationMode === "new-tab"
              ? "Booking & Token opened in a new browser tab."
              : "Opening Booking & Token in this tab…"
          }
          detail={
            celebrationMode === "new-tab"
              ? "Switch tabs to review the deal — this lead stays open here."
              : "Pop-ups were blocked — you will land on the dashboard shortly."
          }
          onDone={handleCelebrationDone}
        />
      ) : null}

      {!celebrating ? (
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
        aria-label="Booking done handoff"
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
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                ✓
              </span>
              <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#374151]">
                Mark as Done — Review
              </h2>
            </div>
            <p className="mt-1 truncate text-[13px] font-semibold text-[#111827]">
              {loadingLead ? "Loading lead…" : customerName}
            </p>
            <p className="truncate text-[12px] text-[#6b7280]">
              {leadIdentifier || leadId} · {leadType}
              {customerPhone ? ` · ${customerPhone}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-md px-2 py-1 text-[18px] leading-none text-[#9ca3af] hover:bg-[#f3f4f6] disabled:opacity-50"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="grid gap-3 border-b border-[#eef1f5] bg-[#fafbfc] px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Selected quote"
            value={selectedQuote?.label ?? "—"}
          />
          <SummaryCard
            label="Quote amount"
            value={formatQuoteAmount(selectedQuote?.amount)}
          />
          <SummaryCard
            label="Amount received"
            value={formatQuoteAmount(amountReceived)}
            highlight
          />
          <SummaryCard
            label="10% target"
            value={formatQuoteAmount(tenPercentAmount)}
          />
        </div>

        {paymentKind ? (
          <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-900">
            <span className="font-semibold">{bookingPaymentKindLabel(paymentKind)}</span>
            {" · "}
            {bookingPaymentKindDescription(
              paymentKind,
              amountReceived ?? 0,
              tenPercentAmount,
            )}
            {remainingAmount != null && remainingAmount > 0
              ? ` Remaining toward 10%: ${formatQuoteAmount(remainingAmount)}.`
              : ""}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
            Payment proofs ({proofDrafts.length})
          </p>
          {proofDrafts.length === 0 ? (
            <p className="mt-2 text-sm text-[#6b7280]">No payment screenshots attached.</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {proofDrafts.map((proof) => (
                <div
                  key={proof.id}
                  className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f9fafb]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proof.previewUrl}
                    alt={proof.name}
                    className="h-28 w-full object-cover"
                  />
                  <p className="truncate px-2 py-1 text-[10px] text-[#6b7280]">{proof.name}</p>
                </div>
              ))}
            </div>
          )}

          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-[#eef1f5] bg-white px-5 py-4">
          <p className="mb-3 text-[12px] text-[#6b7280]">
            Confirm to send this lead to Booking & Token. A new browser tab will open with
            the dashboard after success.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-[#d1d5db] px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#374151] hover:bg-[#f9fafb] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={submitting || !selectedQuote || !paymentKind}
              className="flex-1 rounded-lg bg-[#1dde63] px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#05220f] hover:bg-[#1ed760] disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Confirm & send to Booking & Token"}
            </button>
          </div>
        </div>
      </div>
        </>
      ) : null}
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
        highlight ? "border-[#bbf7d0] bg-[#ecfdf5]" : "border-[#e5e7eb] bg-white"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">{label}</p>
      <p className="mt-1 text-[14px] font-bold text-[#111827]">{value}</p>
    </div>
  );
}
