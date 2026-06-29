"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DealRow } from "@/app/Components/BookingToken/types";
import {
  fetchPaymentHistory,
  type PaymentHistoryEntry,
  type PaymentHistoryResponse,
} from "@/lib/booking-payment-history-api";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { getLeadDetail } from "@/lib/lead-details-client";
import { detailJsonToLead } from "@/lib/lead-detail-mapper";
import type { CrmLeadType } from "@/lib/leads-filter";
import { isTokenReadyForBookingConvert } from "@/lib/booking-token-listing-type";
import PaymentProofThumbnail from "./PaymentProofThumbnail";
import BookingCelebrationOverlay from "./BookingCelebrationOverlay";
import { formatQuoteAmount } from "@/lib/crm-quote-links";

type Props = {
  open: boolean;
  deal: DealRow | null;
  submitting: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
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

type ConvertLeadDetails = {
  name: string;
  pincode: string;
  assignee: string;
  designerName: string;
  email: string;
  phone: string;
};

const EMPTY_LEAD_DETAILS: ConvertLeadDetails = {
  name: "—",
  pincode: "—",
  assignee: "—",
  designerName: "—",
  email: "—",
  phone: "—",
};

function displayOrDash(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

export default function ConvertToBookingModal({
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
  const [loading, setLoading] = useState(false);
  const [loadingLead, setLoadingLead] = useState(false);
  const [leadDetails, setLeadDetails] = useState<ConvertLeadDetails>(EMPTY_LEAD_DETAILS);
  const [historyData, setHistoryData] = useState<PaymentHistoryResponse | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [celebrating, setCelebrating] = useState(false);

  const summary = historyData ?? (deal ? buildSummaryFromDeal(deal) : null);
  const history = summary?.history ?? [];
  const selectedEntry =
    history.find((entry) => entry.id === selectedEntryId) ?? history[history.length - 1] ?? null;

  const readyToConvert =
    deal != null &&
    isTokenReadyForBookingConvert(
      deal.listingType,
      deal.remainingAmount,
      deal.tenPercentAmount,
      deal.paidAmount,
    );

  const loadHistory = useCallback(async () => {
    if (!deal) return;
    setLoading(true);
    try {
      const data = await fetchPaymentHistory(deal);
      setHistoryData(data);
      setSelectedEntryId(data.history[data.history.length - 1]?.id ?? "");
    } catch {
      setHistoryData(buildSummaryFromDeal(deal));
      setSelectedEntryId("");
    } finally {
      setLoading(false);
    }
  }, [deal]);

  useEffect(() => {
    if (!open || !deal) {
      setHistoryData(null);
      setSelectedEntryId("");
      setCelebrating(false);
      setLeadDetails(EMPTY_LEAD_DETAILS);
      return;
    }
    void loadHistory();
  }, [open, deal, loadHistory]);

  useEffect(() => {
    if (!open || !deal || !isCrmLeadType(deal.leadType)) {
      setLeadDetails(EMPTY_LEAD_DETAILS);
      return;
    }

    let cancelled = false;
    setLoadingLead(true);
    void (async () => {
      try {
        const detail = await getLeadDetail(deal.leadType as CrmLeadType, String(deal.leadId));
        if (cancelled) return;
        const lead = detailJsonToLead(detail, deal.leadType as CrmLeadType);
        setLeadDetails({
          name: displayOrDash(lead.name || deal.customer),
          pincode: displayOrDash(lead.pincode),
          assignee: displayOrDash(lead.assignee === "—" ? "" : lead.assignee),
          designerName: displayOrDash(lead.designerName === "—" ? "" : lead.designerName),
          email: displayOrDash(lead.email),
          phone: displayOrDash(lead.phone),
        });
      } catch {
        if (!cancelled) {
          setLeadDetails({
            ...EMPTY_LEAD_DETAILS,
            name: displayOrDash(deal.customer),
          });
        }
      } finally {
        if (!cancelled) setLoadingLead(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deal, open]);

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
    setCelebrating(false);
    onClose();
  }, [onClose]);

  const handleConfirm = async () => {
    if (!readyToConvert || submitting || celebrating) return;
    try {
      await onConfirm();
      setCelebrating(true);
    } catch {
      setCelebrating(false);
    }
  };

  if (!open || !deal || !summary) return null;

  return (
    <>
      {celebrating ? (
        <BookingCelebrationOverlay
          title="Booking Confirmed!"
          subtitle={`${deal.customer} is now in the Booking bucket.`}
          detail="Full 10% received · Booking complete"
          onDone={handleCelebrationDone}
        />
      ) : null}

      <div
        className={`fixed inset-0 z-[120] bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 ${
          panelEntered ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        className={`fixed z-[125] flex max-h-[min(92vh,880px)] w-[min(960px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-[#e0e5ec] bg-white shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          panelEntered ? "scale-100 opacity-100" : "scale-[0.86] opacity-0"
        }`}
        style={{ left: panelPosition.x, top: panelPosition.y }}
        role="dialog"
        aria-modal="true"
        aria-label="Convert to booking"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Fixed header */}
        <div
          className={`shrink-0 flex items-center justify-between border-b border-[#eef1f5] px-5 py-4 select-none touch-none ${
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
                Convert to Booking
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
            disabled={submitting || celebrating}
            className="bt-btn bt-btn-modal-close disabled:opacity-50"
            aria-label="Close convert panel"
          >
            ×
          </button>
        </div>

        {/* Scrollable body — whole content scrolls; no tiny payment-only strip */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-5 px-5 py-5">
            <section>
              <SectionTitle>Lead details</SectionTitle>
              {loadingLead ? (
                <p className="mt-3 text-sm text-[#6b7280]">Loading lead details…</p>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <InfoCard label="Lead name" value={leadDetails.name} />
                  <InfoCard label="PIN" value={leadDetails.pincode} />
                  <InfoCard label="Assigned to" value={leadDetails.assignee} />
                  <InfoCard label="Designer assigned" value={leadDetails.designerName} />
                  <InfoCard label="Email" value={leadDetails.email} />
                  <InfoCard label="Phone number" value={leadDetails.phone} />
                </div>
              )}
            </section>

            <section>
              <SectionTitle>Deal summary</SectionTitle>
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <InfoCard label="Lead ID" value={deal.leadIdentifier ?? `#${deal.leadId}`} />
                <InfoCard label="Deal value" value={deal.dealValue} />
                <InfoCard label="Token status" value={deal.tokenStatus.replace(/_/g, " ")} />
                <InfoCard label="Booking status" value={deal.bookingStatus.replace(/_/g, " ")} />
                <InfoCard label="Total amount" value={formatQuoteAmount(summary.quoteAmount)} />
                <InfoCard label="10% target" value={formatQuoteAmount(summary.tenPercentAmount)} />
                <InfoCard
                  label="Amount paid"
                  value={formatQuoteAmount(summary.amountReceived)}
                  tone="success"
                />
                <InfoCard
                  label="Remaining (10%)"
                  value={formatQuoteAmount(summary.remainingAmount)}
                  tone={summary.remainingAmount > 0 ? "warning" : "success"}
                />
              </div>
            </section>

            {!readyToConvert ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Full 10% must be received before converting. Remaining:{" "}
                {formatQuoteAmount(summary.remainingAmount)}.
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-900">
                10% payment complete. Review lead and payment details below, then confirm to move
                this lead to the Booking bucket.
              </div>
            )}

            <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#fafbfc]">
              <div className="border-b border-[#eef1f5] bg-white px-4 py-3">
                <SectionTitle inline>
                  Payment history
                  {summary.summary ? (
                    <span className="ml-2 font-normal normal-case tracking-normal text-[#6b7280]">
                      · {summary.summary.paymentCount} payment
                      {summary.summary.paymentCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </SectionTitle>
              </div>

              <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-[#eef1f5]">
                <div className="min-h-[200px] border-b border-[#eef1f5] lg:min-h-[280px] lg:border-b-0">
                  {loading ? (
                    <p className="px-4 py-8 text-center text-sm text-[#6b7280]">
                      Loading payment details…
                    </p>
                  ) : history.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-[#6b7280]">
                      No payments recorded yet.
                    </p>
                  ) : (
                    <ul>
                      {history.map((entry) => (
                        <li key={entry.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedEntryId(entry.id)}
                            className={`bt-btn bt-btn-list-row ${
                              selectedEntry?.id === entry.id ? "bt-btn-list-row-active" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[13px] font-bold text-[#111827]">
                                  Payment {entry.sequence} · {formatQuoteAmount(entry.amount)}
                                </p>
                                <p className="mt-1 text-[11px] text-[#6b7280]">
                                  Paid {formatQuoteAmount(entry.cumulativeReceived)}
                                  {entry.source ? ` · ${formatPaymentSource(entry.source)}` : ""}
                                </p>
                              </div>
                              <p className="shrink-0 text-right text-[10px] leading-snug text-[#9ca3af]">
                                {formatHistoryDate(entry.createdAt)}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="min-h-[200px] bg-white p-4 lg:min-h-[280px]">
                  <PaymentDetailSection deal={deal} entry={selectedEntry} />
                  {error ? (
                    <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {error}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Fixed footer */}
        <div className="shrink-0 border-t border-[#eef1f5] bg-white px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting || celebrating}
              className="bt-btn bt-btn-modal bt-btn-modal-secondary disabled:opacity-60"
            >
              Not yet
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || celebrating || !readyToConvert}
              className="bt-btn bt-btn-modal bt-btn-modal-primary disabled:opacity-60"
            >
              {submitting ? "Converting…" : "Confirm convert to booking"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function SectionTitle({
  children,
  inline = false,
}: {
  children: ReactNode;
  inline?: boolean;
}) {
  return (
    <p
      className={`text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af] ${
        inline ? "" : "border-b border-[#f1f5f9] pb-2"
      }`}
    >
      {children}
    </p>
  );
}

function InfoCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-[#bbf7d0] bg-[#ecfdf5]"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : "border-[#e5e7eb] bg-white";

  return (
    <div
      className={`flex min-h-[4.5rem] flex-col justify-center rounded-lg border px-3 py-2.5 ${toneClass}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">{label}</p>
      <p className="mt-1 break-words text-[13px] font-semibold leading-snug text-[#111827]" title={value}>
        {value}
      </p>
    </div>
  );
}

function PaymentDetailSection({
  deal,
  entry,
}: {
  deal: DealRow;
  entry: PaymentHistoryEntry | null;
}) {
  if (!entry) {
    return <p className="text-sm text-[#6b7280]">Select a payment to review proofs and notes.</p>;
  }

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
        Payment detail
      </p>
      <p className="mt-2 text-[14px] font-bold text-[#111827]">
        {formatQuoteAmount(entry.amount)} received
        {entry.paymentKind ? (
          <span className="ml-1 text-[12px] font-semibold text-[#059669]">
            · {formatPaymentKind(entry.paymentKind)}
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-[12px] text-[#6b7280]">
        {formatHistoryDate(entry.createdAt)}
        {entry.source ? ` · ${formatPaymentSource(entry.source)}` : ""}
      </p>
      {entry.notes ? (
        <div className="mt-3 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">Notes</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#374151]">{entry.notes}</p>
        </div>
      ) : null}
      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
          Payment proofs
        </p>
        {entry.proofs.length === 0 ? (
          <p className="mt-2 text-[12px] text-[#9ca3af]">No screenshots attached.</p>
        ) : (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {entry.proofs.map((proof) => (
              <PaymentProofThumbnail
                key={proof.id}
                recordId={deal.id}
                proofId={proof.id}
                fileName={proof.originalFileName}
                mimeType={proof.mimeType}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
