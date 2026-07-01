"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  formatQuoteAmount,
  leadQuoteOptionFromSavedLink,
  normalizeLeadQuoteOptions,
  extractQuoteIdFromUrl,
  resolveQuoteVerifyUrl,
  sortQuotesForRevisionDisplay,
  type LeadQuoteOption,
} from "@/lib/crm-quote-links";
import { formatCrmDateTime } from "@/lib/date-time-format";
import { buildLeadQuoteOptionsFromProlance } from "@/lib/prolance-quote-api";
import PaymentProofUploadSection from "@/app/Components/CrmLeadDetailsV2/PaymentProofUploadSection";
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
  clearBookingDoneDraft,
  paymentProofsToFiles,
} from "@/lib/booking-done-payment-storage";
import {
  submitBookingDone,
  uploadBookingPaymentProofs,
} from "@/lib/booking-done-api";
import { buildBookingDoneSubmitPayload, validateBookingDoneHandoff } from "@/lib/booking-token-leads";
import { persistClosedWonCustomerMilestoneFromPayment } from "@/lib/closed-won-customer-milestone";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import {
  getLeadDetail,
  fetchNewCrmQuotePayloads,
} from "@/lib/lead-details-client";
import {
  BOOKING_DONE_SUBSTAGE,
  CLOSED_WON_CATEGORY,
  CLOSED_WON_STAGE,
  TOKEN_DONE_SUBSTAGE,
} from "@/lib/closed-won-customer-milestone";
import { isClosedWonCustomerSubstage } from "@/lib/milestone-substage-map";
import type { CrmLeadType } from "@/lib/leads-filter";

type Props = {
  open: boolean;
  leadType: string;
  leadId: string;
  onClose: () => void;
  onHandoffComplete?: () => void;
};

type QuoteLoadState = "idle" | "loading" | "ready" | "empty" | "error";

const CONFIRM_BOOKING_TOKEN_LABEL = "Confirm for Booking & Token";

function bookingTokenUrl(recordId: string): string {
  return `/booking-token?from=booking-done&highlight=${encodeURIComponent(recordId)}`;
}

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

function readMilestoneFromDetail(detail: Record<string, unknown>): {
  stage: string;
  category: string;
  subStage: string;
  isCustomerMilestone: boolean;
} {
  const stageObj =
    detail.stage && typeof detail.stage === "object" && !Array.isArray(detail.stage)
      ? (detail.stage as Record<string, unknown>)
      : {};
  const stage = pickDetailStr(detail, "milestoneStage") || pickDetailStr(stageObj, "milestoneStage");
  const category =
    pickDetailStr(detail, "milestoneStageCategory") ||
    pickDetailStr(stageObj, "milestoneStageCategory");
  const subStage =
    pickDetailStr(detail, "milestoneSubStage") ||
    pickDetailStr(stageObj, "milestoneSubStage") ||
    pickDetailStr(detail, "status");
  return {
    stage,
    category,
    subStage,
    isCustomerMilestone: isClosedWonCustomerSubstage(subStage),
  };
}

type QuoteLoadResult = {
  options: LeadQuoteOption[];
  hubLeadId: string;
};

async function fetchQuoteOptionsForLead(
  businessLeadId: string,
  externalReferenceId: string,
  savedQuoteLink: string,
): Promise<QuoteLoadResult> {
  const payloads = await fetchNewCrmQuotePayloads(businessLeadId, externalReferenceId);
  const anchorQuoteId = resolveAnchorQuoteId(payloads, savedQuoteLink);
  const hubLeadId = resolveHubLeadId(payloads);

  if (anchorQuoteId) {
    try {
      const prolanceOptions = await buildLeadQuoteOptionsFromProlance(anchorQuoteId, hubLeadId);
      if (prolanceOptions.length > 0) {
        return { options: prolanceOptions, hubLeadId };
      }
    } catch {
      /* fall through */
    }
  }

  const savedOption = savedQuoteLink ? leadQuoteOptionFromSavedLink(savedQuoteLink) : null;
  const fallback = mergeQuoteOptions(
    ...payloads.map((payload) => normalizeLeadQuoteOptions(payload)),
    ...(savedOption ? [[savedOption]] : []),
  );
  return { options: fallback, hubLeadId };
}

function resolveHubLeadId(payloads: unknown[]): string {
  for (const payload of payloads) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
    const row = payload as Record<string, unknown>;
    const hubLeadId = row.leadId;
    if (typeof hubLeadId === "number" && Number.isFinite(hubLeadId) && hubLeadId > 0) {
      return String(Math.trunc(hubLeadId));
    }
    if (typeof hubLeadId === "string" && /^\d+$/.test(hubLeadId.trim())) {
      return hubLeadId.trim();
    }
  }
  return "";
}

function resolveAnchorQuoteId(payloads: unknown[], savedQuoteLink: string): string {
  for (const payload of payloads) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
    const row = payload as Record<string, unknown>;
    const quoteId = row.quoteId;
    if (typeof quoteId === "number" && Number.isFinite(quoteId) && quoteId > 0) {
      return String(Math.trunc(quoteId));
    }
    if (typeof quoteId === "string" && /^\d+$/.test(quoteId.trim())) {
      return quoteId.trim();
    }
    const fromUrl =
      extractQuoteIdFromUrl(String(row.customerQuoteUrl ?? "")) ||
      extractQuoteIdFromUrl(String(row.internalQuoteUrl ?? ""));
    if (fromUrl) return fromUrl;
  }
  return extractQuoteIdFromUrl(savedQuoteLink);
}

function mergeQuoteOptions(...groups: LeadQuoteOption[][]): LeadQuoteOption[] {
  const byKey = new Map<string, LeadQuoteOption>();
  for (const group of groups) {
    for (const option of group) {
      const key = option.customerQuoteUrl || option.internalQuoteUrl || option.id;
      if (!key || byKey.has(key)) continue;
      byKey.set(key, option);
    }
  }
  return normalizeLeadQuoteOptions([...byKey.values()]);
}

export default function BookingDoneModal({
  open,
  leadType,
  leadId,
  onClose,
  onHandoffComplete,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [panelEntered, setPanelEntered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const [quoteLoadState, setQuoteLoadState] = useState<QuoteLoadState>("idle");
  const [quoteError, setQuoteError] = useState("");
  const [quoteOptions, setQuoteOptions] = useState<LeadQuoteOption[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [hubLeadId, setHubLeadId] = useState("");
  const [handoffError, setHandoffError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [leadIdentifier, setLeadIdentifier] = useState("");
  const [milestoneStage, setMilestoneStage] = useState("");
  const [milestoneCategory, setMilestoneCategory] = useState("");
  const [milestoneSubStage, setMilestoneSubStage] = useState("");
  const [handoffComplete, setHandoffComplete] = useState(false);

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [onClose, submitting]);

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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose, open, submitting]);

  useEffect(() => {
    if (!open) {
      setHandoffError("");
      setSubmitting(false);
      return;
    }

    if (!isCrmLeadType(leadType)) {
      setQuoteLoadState("error");
      setQuoteError("Invalid lead type.");
      return;
    }

    let cancelled = false;
    const validLeadType = leadType as CrmLeadType;

    async function loadQuotes() {
      setQuoteLoadState("loading");
      setQuoteError("");
      try {
        const detail = await getLeadDetail(validLeadType, leadId);
        if (cancelled) return;

        const milestone = readMilestoneFromDetail(detail);
        setMilestoneStage(milestone.stage);
        setMilestoneCategory(milestone.category);
        setMilestoneSubStage(milestone.subStage);
        setHandoffComplete(milestone.isCustomerMilestone);
        setCustomerName(pickDetailStr(detail, "customerName", "name", "leadName") || "Lead");
        setLeadIdentifier(
          pickDetailStr(detail, "uniqueId", "lead_identifier", "leadIdentifier", "leadRef") ||
            leadId,
        );

        const resolvedBusinessLeadId = pickDetailStr(detail, "leadId", "leadRef", "leadCode", "customerId");
        const externalReferenceId = pickDetailStr(
          detail,
          "uniqueId",
          "lead_identifier",
          "leadIdentifier",
          "externalReferenceId",
        );
        const savedQuoteLink = pickDetailStr(detail, "quoteLink", "quoteURL", "proposalLink");

        const { options: merged, hubLeadId: resolvedHubLeadId } = await fetchQuoteOptionsForLead(
          resolvedBusinessLeadId,
          externalReferenceId,
          savedQuoteLink,
        );
        if (cancelled) return;

        if (merged.length === 0) {
          setQuoteOptions([]);
          setSelectedQuoteId("");
          setHubLeadId("");
          setQuoteLoadState("empty");
          return;
        }

        setHubLeadId(resolvedHubLeadId);
        setQuoteOptions(merged);
        const defaultSelection =
          merged.find((option) => option.isLatest)?.id ?? merged[0]?.id ?? "";
        setSelectedQuoteId(defaultSelection);
        setQuoteLoadState("ready");
      } catch (error) {
        if (cancelled) return;
        setQuoteOptions([]);
        setSelectedQuoteId("");
        setHubLeadId("");
        setQuoteLoadState("error");
        setQuoteError(
          error instanceof Error ? error.message : "Unable to load quotations for this lead.",
        );
      }
    }

    void loadQuotes();
    return () => {
      cancelled = true;
    };
  }, [leadId, leadType, open]);

  const selectedQuote = useMemo(
    () => quoteOptions.find((option) => option.id === selectedQuoteId) ?? quoteOptions[0] ?? null,
    [quoteOptions, selectedQuoteId],
  );

  const amountReceived = useMemo(
    () => parsePaymentAmountInput(readPaymentAmount(leadType, leadId)),
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

  async function handleConfirmSubmit() {
    setHandoffError("");
    const validation = validateBookingDoneHandoff({
      leadType,
      leadId,
      hubLeadId,
      selectedQuote,
    });
    if (!validation.ok) {
      setHandoffError(validation.message);
      return;
    }
    if (!isCrmLeadType(leadType)) {
      setHandoffError("Invalid lead type.");
      return;
    }
    const payload = buildBookingDoneSubmitPayload({
      leadType,
      leadId,
      hubLeadId,
      selectedQuote,
    });
    if (!payload) {
      setHandoffError("Unable to prepare booking submission. Check quote and payment amount.");
      return;
    }

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
      await persistClosedWonCustomerMilestoneFromPayment(
        leadType,
        leadId,
        payload.paymentKind,
      );
      onHandoffComplete?.();
      onClose();
      window.location.assign(bookingTokenUrl(record.id));
    } catch (err) {
      setHandoffError(
        err instanceof Error ? err.message : "Unable to submit Booking Done record.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const handleDragStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!panelRef.current || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button,input,textarea,label,a")) return;
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

  if (!open) return null;

  const displayStage = handoffComplete ? CLOSED_WON_STAGE : milestoneStage || "—";
  const displayCategory = handoffComplete ? CLOSED_WON_CATEGORY : milestoneCategory || "—";
  const displaySubStage = handoffComplete
    ? milestoneSubStage || BOOKING_DONE_SUBSTAGE
    : milestoneSubStage || "Pending handoff";
  const pageEyebrow = handoffComplete ? "Closed · Won" : "Booking handoff";
  const pageTitle = handoffComplete
    ? milestoneSubStage === TOKEN_DONE_SUBSTAGE
      ? "Token Done"
      : "Booking Done"
    : "Booking Done";

  return (
    <>
      <div
        className={`fixed inset-0 z-[110] bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 ${
          panelEntered ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        className={`fixed z-[115] flex max-h-[calc(100vh-2rem)] w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[#e0e5ec] bg-white shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          panelEntered ? "scale-100 opacity-100" : "scale-[0.86] opacity-0"
        }`}
        style={{ left: panelPosition.x, top: panelPosition.y }}
        role="dialog"
        aria-modal="true"
        aria-label="Booking done handoff"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`flex shrink-0 items-center justify-between border-b border-[#eef1f5] px-5 py-4 select-none touch-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#16a34a]">
              {pageEyebrow}
            </p>
            <h2 className="mt-0.5 text-[22px] font-bold leading-tight text-[#0f172a]">
              {pageTitle}
            </h2>
            <p className="mt-1 text-[13px] text-[#64748b]">
              {customerName ? `${customerName} · ` : ""}
              {leadIdentifier || `Lead #${leadId}`} · {leadType}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-md px-2 py-1 text-[22px] leading-none text-[#9ca3af] hover:bg-[#f3f4f6] disabled:opacity-50"
            aria-label="Close booking handoff"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#bbf7d0] bg-[#ecfdf5] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#047857]">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#1ed760] text-[10px] text-white">
                {handoffComplete ? "✓" : "…"}
              </span>
              {handoffComplete ? "Customer milestone" : "Awaiting payment handoff"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MilestoneChip label="Stage" value={displayStage} />
            <MilestoneChip label="Category" value={displayCategory} />
            <MilestoneChip label="Sub-stage" value={displaySubStage} highlight={handoffComplete} />
          </div>

          <QuotationSection
            loadState={quoteLoadState}
            error={quoteError}
            options={quoteOptions}
            hubLeadId={hubLeadId}
            selectedQuoteId={selectedQuote?.id ?? selectedQuoteId}
            onSelectQuote={setSelectedQuoteId}
            selectedQuote={selectedQuote}
          />

          <PaymentProofUploadSection
            leadType={leadType}
            leadId={leadId}
            selectedQuote={selectedQuote}
          />

          {paymentKind ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
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

          <p className="mt-4 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-[13px] text-[#475569]">
            Select quote and payment, then click{" "}
            <span className="font-semibold">{CONFIRM_BOOKING_TOKEN_LABEL}</span> to send this lead
            to Booking &amp; Token. You will be redirected to the dashboard.
          </p>

          {handoffError ? (
            <p className="mt-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-[13px] text-[#b91c1c]">
              {handoffError}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-[#eef1f5] bg-white px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center rounded-[6px] border border-[#d6dce6] bg-white px-4 text-[12px] font-bold uppercase tracking-wide text-[#374151] transition hover:bg-[#f8fafc] disabled:opacity-60"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmSubmit()}
              disabled={handoffComplete || submitting || !selectedQuote || !paymentKind}
              className="inline-flex h-10 items-center justify-center rounded-[6px] bg-[#1dde63] px-4 text-[12px] font-bold uppercase tracking-wide text-[#05220f] transition hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Sending…" : CONFIRM_BOOKING_TOKEN_LABEL}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function QuotationSection({
  loadState,
  error,
  options,
  hubLeadId,
  selectedQuoteId,
  onSelectQuote,
  selectedQuote,
}: {
  loadState: QuoteLoadState;
  error: string;
  options: LeadQuoteOption[];
  hubLeadId: string;
  selectedQuoteId: string;
  onSelectQuote: (id: string) => void;
  selectedQuote: LeadQuoteOption | null;
}) {
  const revisionOptions = sortQuotesForRevisionDisplay(options);

  return (
    <section className="mt-4 rounded-lg border border-[#e8dfd8] bg-[#fffaf8] p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-[16px] text-[#b4534a]" aria-hidden>
          🕒
        </span>
        <div>
          <p className="text-[15px] font-bold text-[#3f2b23]">Revision History</p>
          <p className="mt-1 text-[13px] text-[#7c665d]">
            Click a version to open the quotation, then use that price for booking.
          </p>
        </div>
      </div>

      {loadState === "loading" ? (
        <p className="mt-4 text-[13px] text-[#64748b]">Loading quotations…</p>
      ) : null}
      {loadState === "error" ? (
        <p className="mt-4 rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[13px] text-[#b91c1c]">
          {error}
        </p>
      ) : null}
      {loadState === "empty" ? (
        <p className="mt-4 rounded-md border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[13px] text-[#92400e]">
          No quotation found for this lead yet.
        </p>
      ) : null}

      {loadState === "ready" && revisionOptions.length > 0 ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {revisionOptions.map((option) => {
              const selected = option.id === selectedQuoteId;
              const quoteUrl = resolveQuoteVerifyUrl(option, hubLeadId);
              return (
                <a
                  key={option.id}
                  href={quoteUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onSelectQuote(option.id)}
                  className={`block rounded-xl border px-4 py-3 text-left transition ${
                    selected
                      ? "border-[#d7b0aa] bg-[#fff1ef] shadow-[inset_4px_0_0_#9f3d33]"
                      : "border-[#e7ddd7] bg-white hover:border-[#d7c5bf] hover:bg-[#fffdfb]"
                  } ${quoteUrl ? "cursor-pointer" : "pointer-events-none opacity-70"}`}
                >
                  <p className="text-[15px] font-bold text-[#3f2b23]">{option.label}</p>
                  <p className="mt-2 text-[12px] text-[#8b766d]">
                    Created on {formatQuoteCreatedAt(option.createdAt)}
                  </p>
                  {option.quoteId ? (
                    <p className="mt-1 text-[12px] text-[#8b766d]">ID {option.quoteId}</p>
                  ) : null}
                  <p className="mt-3 text-[18px] font-bold text-[#1f2937]">
                    {formatQuoteAmount(option.amount)}
                  </p>
                  {quoteUrl ? (
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[#b4534a]">
                      Open quotation →
                    </p>
                  ) : null}
                </a>
              );
            })}
          </div>

          {selectedQuote ? (
            <div className="rounded-lg border border-[#bbf7d0] bg-[#ecfdf5] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#047857]">
                Selected for booking
              </p>
              <p className="mt-1 text-[14px] font-semibold text-[#065f46]">
                {selectedQuote.label} · {formatQuoteAmount(selectedQuote.amount)}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function formatQuoteCreatedAt(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatCrmDateTime(value);
  return parsed.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function MilestoneChip({
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
      className={`rounded-lg border px-4 py-3 ${
        highlight ? "border-[#bbf7d0] bg-[#ecfdf5]" : "border-[#e2e8f0] bg-[#f8fafc]"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#94a3b8]">{label}</p>
      <p
        className={`mt-1 text-[14px] font-bold ${highlight ? "text-[#047857]" : "text-[#1e293b]"}`}
      >
        {value}
      </p>
    </div>
  );
}
