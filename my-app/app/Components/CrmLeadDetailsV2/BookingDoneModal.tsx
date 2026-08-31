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
  resolveQuoteVerifyUrl,
  sortQuotesForRevisionDisplay,
  type LeadQuoteOption,
} from "@/lib/crm-quote-links";
import { formatCrmDateTime } from "@/lib/date-time-format";
import {
  fetchQuoteOptionsForLeadDetail,
  refreshQuoteOptionDetails,
} from "@/lib/lead-quote-options";
import { publishLeadQuoteSelection, readLeadQuoteSelection } from "@/lib/lead-quote-selection";
import PaymentProofUploadSection from "@/app/Components/CrmLeadDetailsV2/PaymentProofUploadSection";
import BookingDateSection from "@/app/Components/CrmLeadDetailsV2/BookingDateSection";
import PaymentChannelSelector from "@/app/Components/BookingToken/components/PaymentChannelSelector";
import PaymentLinkPendingBanner from "@/app/Components/BookingToken/components/PaymentLinkPendingBanner";
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
  readBookingDate,
  isValidBookingDateValue,
  clearBookingDoneDraft,
  paymentProofsToFiles,
  formatPaymentAmountInput,
  writePaymentAmount,
} from "@/lib/booking-done-payment-storage";
import {
  fetchBookingDoneRecords,
  submitBookingDone,
  uploadBookingPaymentProofs,
} from "@/lib/booking-done-api";
import { buildBookingDoneSubmitPayload, validateBookingDoneHandoff } from "@/lib/booking-token-leads";
import { persistClosedWonCustomerMilestoneFromPayment } from "@/lib/closed-won-customer-milestone";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import {
  getLeadDetail,
} from "@/lib/lead-details-client";
import {
  BOOKING_DONE_SUBSTAGE,
  CLOSED_WON_CATEGORY,
  CLOSED_WON_STAGE,
  TOKEN_DONE_SUBSTAGE,
} from "@/lib/closed-won-customer-milestone";
import { isClosedWonCustomerSubstage } from "@/lib/milestone-substage-map";
import type { CrmLeadType } from "@/lib/leads-filter";
import {
  PAYMENT_LINK_POLL_MS,
  copyPaymentLink,
  createLeadPaymentLink,
  editPaymentLinkAmount,
  fetchLeadPaymentLinkActive,
  hasLeadContact,
  isBannerPaymentLink,
  isStalePaymentLinkAction,
  PaymentLinkApiError,
  resolveCopiedPaymentLinkUrl,
  resolveSwitchOfflineAmount,
  resendPaymentLink,
  switchPaymentLinkOffline,
  type PaymentLinkAttempt,
} from "@/lib/booking-payment-link-api";
import type { OfflinePaymentMethodId, PaymentChannelChoice } from "@/lib/booking-payment-display";

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
  const [paymentDraftRevision, setPaymentDraftRevision] = useState(0);
  const [quoteAmountRefreshing, setQuoteAmountRefreshing] = useState(false);
  const [channel, setChannel] = useState<PaymentChannelChoice>("online");
  const [offlineMethod, setOfflineMethod] = useState<OfflinePaymentMethodId | "">("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [activeAttempt, setActiveAttempt] = useState<PaymentLinkAttempt | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkPaid, setLinkPaid] = useState(false);
  const [paidRecordId, setPaidRecordId] = useState("");

  const bumpPaymentDraft = useCallback(() => {
    setPaymentDraftRevision((value) => value + 1);
  }, []);

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
      setPaymentDraftRevision(0);
      setChannel("online");
      setOfflineMethod("");
      setActiveAttempt(null);
      setLinkPaid(false);
      setPaidRecordId("");
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
        setCustomerPhone(pickDetailStr(detail, "phoneNumber", "phone", "mobile", "customerPhone"));
        setCustomerEmail(pickDetailStr(detail, "email", "customerEmail", "mail"));
        setLeadIdentifier(
          pickDetailStr(detail, "uniqueId", "lead_identifier", "leadIdentifier", "leadRef") ||
            leadId,
        );

        const { options: merged, hubLeadId: resolvedHubLeadId } =
          await fetchQuoteOptionsForLeadDetail(detail, leadId);
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
        const storedSelection = readLeadQuoteSelection(validLeadType, leadId);
        const storedQuote = storedSelection
          ? merged.find(
              (option) =>
                option.id === storedSelection.quoteId ||
                option.quoteId === storedSelection.quoteId,
            ) ?? null
          : null;
        const defaultSelection =
          storedQuote?.id ??
          merged.find((option) => option.isLatest)?.id ??
          merged[0]?.id ??
          "";
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

  const applyAttempt = useCallback((attempt: PaymentLinkAttempt | null | undefined) => {
    setActiveAttempt(isBannerPaymentLink(attempt) ? attempt ?? null : null);
  }, []);

  const loadActiveAttempt = useCallback(async () => {
    if (!isCrmLeadType(leadType)) return null;
    try {
      const attempt = await fetchLeadPaymentLinkActive(leadType, leadId);
      applyAttempt(attempt);
      return attempt;
    } catch {
      setActiveAttempt(null);
      return null;
    }
  }, [applyAttempt, leadId, leadType]);

  useEffect(() => {
    if (!open) return;
    void loadActiveAttempt();
  }, [loadActiveAttempt, open]);

  useEffect(() => {
    if (!open || !activeAttempt?.id) return;
    const tick = window.setInterval(() => {
      void (async () => {
        const attempt = await loadActiveAttempt();
        const paid = String(attempt?.status ?? "").toUpperCase() === "PAID";
        const bannerGone = !isBannerPaymentLink(attempt);
        if (!paid && !bannerGone) return;
        if (paid || bannerGone) {
          try {
            if (isCrmLeadType(leadType)) {
              const { records } = await fetchBookingDoneRecords(leadType, leadId);
              const recordId =
                attempt?.bookingTokenRecordId || records[0]?.id || "";
              if (recordId) {
                setPaidRecordId(recordId);
                setLinkPaid(true);
              } else if (paid) {
                setLinkPaid(true);
              }
            }
          } catch {
            if (attempt?.bookingTokenRecordId) {
              setPaidRecordId(attempt.bookingTokenRecordId);
              setLinkPaid(true);
            } else if (paid) {
              setLinkPaid(true);
            }
          }
          onHandoffComplete?.();
        }
      })();
    }, PAYMENT_LINK_POLL_MS);
    return () => window.clearInterval(tick);
  }, [activeAttempt?.id, leadId, leadType, loadActiveAttempt, onHandoffComplete, open]);

  const selectedQuote = useMemo(
    () => quoteOptions.find((option) => option.id === selectedQuoteId) ?? quoteOptions[0] ?? null,
    [quoteOptions, selectedQuoteId],
  );

  const handleSelectQuote = useCallback(
    async (id: string) => {
      setSelectedQuoteId(id);
      const option = quoteOptions.find((item) => item.id === id);
      if (!option) return;
      setQuoteAmountRefreshing(true);
      try {
        const refreshed = await refreshQuoteOptionDetails(option);
        setQuoteOptions((prev) =>
          prev.map((item) => (item.id === id ? refreshed : item)),
        );
        publishLeadQuoteSelection(leadType, leadId, refreshed, true);
      } finally {
        setQuoteAmountRefreshing(false);
      }
    },
    [leadId, leadType, quoteOptions],
  );

  const amountReceived = useMemo(
    () => parsePaymentAmountInput(readPaymentAmount(leadType, leadId)),
    [leadId, leadType, open, paymentDraftRevision],
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

  const hasBookingDate = useMemo(() => {
    void paymentDraftRevision;
    return isValidBookingDateValue(readBookingDate(leadType, leadId));
  }, [leadId, leadType, paymentDraftRevision]);

  const showBanner = isBannerPaymentLink(activeAttempt);
  const missingContacts = !hasLeadContact(customerPhone, customerEmail);

  useEffect(() => {
    if (!open || channel !== "online") return;
    if (parsePaymentAmountInput(readPaymentAmount(leadType, leadId)) != null) return;
    if (tenPercentAmount == null) return;
    writePaymentAmount(leadType, leadId, formatPaymentAmountInput(tenPercentAmount));
    bumpPaymentDraft();
  }, [bumpPaymentDraft, channel, leadId, leadType, open, tenPercentAmount]);

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
    if (!offlineMethod) {
      setHandoffError("Select Cash, Cheque, Bank Transfer, or DD.");
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
      const record = await submitBookingDone(leadType, leadId, {
        ...payload,
        paymentChannel: "OFFLINE",
        paymentMethod: offlineMethod,
      });
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

  async function handleSendLeadPaymentLink() {
    setHandoffError("");
    if (!isCrmLeadType(leadType)) {
      setHandoffError("Invalid lead type.");
      return;
    }
    if (!selectedQuote || selectedQuote.amount == null) {
      setHandoffError("Select a quotation version before sending a payment link.");
      return;
    }
    if (!hasBookingDate) {
      setHandoffError("Select a booking date before sending a payment link.");
      return;
    }
    if (missingContacts) {
      setHandoffError("Phone and email are both missing. Add a contact before sending a payment link.");
      return;
    }
    const amount = parsePaymentAmountInput(readPaymentAmount(leadType, leadId));
    setLinkBusy(true);
    try {
      const result = await createLeadPaymentLink(leadType, leadId, {
        ...(amount != null && amount > 0 ? { amount } : {}),
        quoteId: selectedQuote.quoteId,
        quoteAmount: selectedQuote.amount,
        tenPercentAmount: calculateBookingTenPercent(selectedQuote.amount),
        quoteVersionLabel: selectedQuote.label,
        quoteVerifyUrl: resolveQuoteVerifyUrl(selectedQuote, hubLeadId) || undefined,
        bookingDate: readBookingDate(leadType, leadId),
        hubLeadId: hubLeadId || undefined,
      });
      applyAttempt(result.attempt);
      if (result.warnings?.length) {
        setHandoffError(result.warnings.join(" · "));
      }
    } catch (err) {
      if (err instanceof PaymentLinkApiError && err.useOfflineFallback) {
        setChannel("offline");
        setHandoffError(`${err.message} Easebuzz is unavailable — record an Offline proof instead.`);
      } else {
        setHandoffError(err instanceof Error ? err.message : "Unable to send payment link.");
      }
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleCopyLeadPaymentLink() {
    if (!activeAttempt) return;
    setLinkBusy(true);
    setHandoffError("");
    try {
      const result = await copyPaymentLink(activeAttempt.id);
      const url = resolveCopiedPaymentLinkUrl(result, activeAttempt);
      if (result.attempt) applyAttempt(result.attempt);
      if (!url) {
        setHandoffError("Payment link URL is not available yet.");
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch (err) {
      setHandoffError(err instanceof Error ? err.message : "Unable to copy payment link.");
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleResendLeadPaymentLink() {
    if (!activeAttempt) return;
    setLinkBusy(true);
    setHandoffError("");
    try {
      const result = await resendPaymentLink(activeAttempt.id);
      applyAttempt(result.attempt);
    } catch (err) {
      if (isStalePaymentLinkAction(err)) {
        await loadActiveAttempt();
      }
      if (err instanceof PaymentLinkApiError && err.useOfflineFallback) {
        setChannel("offline");
        setHandoffError(`${err.message} Easebuzz is unavailable — record an Offline proof instead.`);
      } else {
        setHandoffError(err instanceof Error ? err.message : "Unable to resend payment link.");
      }
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleEditLeadPaymentLink(amount: number) {
    if (!activeAttempt) return;
    setLinkBusy(true);
    setHandoffError("");
    try {
      const result = await editPaymentLinkAmount(activeAttempt.id, amount);
      applyAttempt(result.attempt);
    } catch (err) {
      if (isStalePaymentLinkAction(err)) {
        await loadActiveAttempt();
      }
      setHandoffError(err instanceof Error ? err.message : "Unable to edit payment link.");
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleSwitchLeadOffline() {
    if (!activeAttempt) return;
    const confirmed = window.confirm(
      "Switch this payment to Offline? The online link will be cancelled. Record one cash/cheque/bank payment — not a second payment.",
    );
    if (!confirmed) return;
    setLinkBusy(true);
    setHandoffError("");
    try {
      const result = await switchPaymentLinkOffline(activeAttempt.id);
      const switchedAmount = resolveSwitchOfflineAmount(result, activeAttempt);
      setActiveAttempt(null);
      setChannel("offline");
      if (switchedAmount != null) {
        writePaymentAmount(leadType, leadId, formatPaymentAmountInput(switchedAmount));
        bumpPaymentDraft();
      }
    } catch (err) {
      setHandoffError(err instanceof Error ? err.message : "Unable to switch to offline payment.");
    } finally {
      setLinkBusy(false);
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
            onSelectQuote={(id) => void handleSelectQuote(id)}
            selectedQuote={selectedQuote}
            amountRefreshing={quoteAmountRefreshing}
          />

          <BookingDateSection
            leadType={leadType}
            leadId={leadId}
            onBookingDateChange={bumpPaymentDraft}
          />

          {linkPaid ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
              Online payment received. Token is recorded automatically. Convert is still manual.
              {paidRecordId ? (
                <button
                  type="button"
                  onClick={() => window.location.assign(bookingTokenUrl(paidRecordId))}
                  className="ml-2 font-bold underline"
                >
                  Open Booking &amp; Token
                </button>
              ) : null}
            </div>
          ) : null}

          {showBanner && activeAttempt ? (
            <div className="mt-4">
              <PaymentLinkPendingBanner
                attempt={activeAttempt}
                busy={linkBusy}
                onCopy={() => void handleCopyLeadPaymentLink()}
                onResend={() => void handleResendLeadPaymentLink()}
                onEdit={(amount) => void handleEditLeadPaymentLink(amount)}
                onSwitchOffline={() => void handleSwitchLeadOffline()}
              />
            </div>
          ) : (
            <>
              <div className="mt-4 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4">
                <PaymentChannelSelector
                  channel={channel}
                  offlineMethod={offlineMethod}
                  disabled={submitting || linkBusy || handoffComplete}
                  onChannelChange={setChannel}
                  onOfflineMethodChange={setOfflineMethod}
                />
              </div>

              <PaymentProofUploadSection
                leadType={leadType}
                leadId={leadId}
                selectedQuote={selectedQuote}
                quoteAmountRefreshing={quoteAmountRefreshing}
                onPaymentDraftChange={bumpPaymentDraft}
                hideProofs={channel === "online"}
              />
            </>
          )}

          {paymentKind && channel === "offline" && !showBanner ? (
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
            {showBanner
              ? "Customer pays on Easebuzz. Token is created when payment succeeds — Convert stays manual."
              : channel === "online"
                ? "Send the Easebuzz link after selecting quote and booking date. Token is not created until the customer pays."
                : `Select quote and payment, then click ${CONFIRM_BOOKING_TOKEN_LABEL} to send this lead to Booking & Token.`}
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
              disabled={submitting || linkBusy}
              className="inline-flex h-10 items-center justify-center rounded-[6px] border border-[#d6dce6] bg-white px-4 text-[12px] font-bold uppercase tracking-wide text-[#374151] transition hover:bg-[#f8fafc] disabled:opacity-60"
            >
              Close
            </button>
            {showBanner || linkPaid ? null : channel === "online" ? (
              <button
                type="button"
                onClick={() => void handleSendLeadPaymentLink()}
                disabled={
                  handoffComplete ||
                  linkBusy ||
                  !selectedQuote ||
                  !hasBookingDate ||
                  missingContacts
                }
                className="inline-flex h-10 items-center justify-center rounded-[6px] bg-[#1dde63] px-4 text-[12px] font-bold uppercase tracking-wide text-[#05220f] transition hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {linkBusy ? "Sending…" : "Send payment link"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleConfirmSubmit()}
                disabled={handoffComplete || submitting || !selectedQuote || !paymentKind || !hasBookingDate}
                className="inline-flex h-10 items-center justify-center rounded-[6px] bg-[#1dde63] px-4 text-[12px] font-bold uppercase tracking-wide text-[#05220f] transition hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Sending…" : CONFIRM_BOOKING_TOKEN_LABEL}
              </button>
            )}
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
  amountRefreshing = false,
}: {
  loadState: QuoteLoadState;
  error: string;
  options: LeadQuoteOption[];
  hubLeadId: string;
  selectedQuoteId: string;
  onSelectQuote: (id: string) => void;
  selectedQuote: LeadQuoteOption | null;
  amountRefreshing?: boolean;
}) {
  const revisionOptions = sortQuotesForRevisionDisplay(options);

  return (
    <section className="mt-4 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4">
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#ecfdf5] text-[15px] text-[#047857]"
          aria-hidden
        >
          🕒
        </span>
        <div>
          <p className="text-[15px] font-bold text-[#0f172a]">Revision History</p>
          <p className="mt-1 text-[13px] text-[#64748b]">
            Click a version to select it for booking. Use{" "}
            <span className="font-semibold text-[#334155]">Open quotation</span> to view the quote in a
            new tab.
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
        <p className="mt-4 rounded-md border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] text-[#64748b]">
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
                <div
                  key={option.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectQuote(option.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectQuote(option.id);
                    }
                  }}
                  className={`block cursor-pointer rounded-xl border px-4 py-3 text-left transition ${
                    selected
                      ? "border-[#86efac] bg-[#ecfdf5] shadow-[inset_4px_0_0_#16a34a]"
                      : "border-[#e2e8f0] bg-white hover:border-[#cbd5e1] hover:bg-white"
                  }`}
                >
                  <p className="text-[15px] font-bold text-[#0f172a]">{option.label}</p>
                  <p className="mt-2 text-[12px] text-[#64748b]">
                    Created on {formatQuoteCreatedAt(option.createdAt)}
                  </p>
                  {option.quoteId ? (
                    <p className="mt-1 text-[12px] text-[#64748b]">ID {option.quoteId}</p>
                  ) : null}
                  <p className="mt-3 text-[18px] font-bold text-[#0f172a]">
                    {formatQuoteAmount(option.amount)}
                  </p>
                  {quoteUrl ? (
                    <a
                      href={quoteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="mt-2 inline-block text-[11px] font-semibold uppercase tracking-wide text-[#047857] hover:underline"
                    >
                      Open quotation →
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>

          {selectedQuote ? (
            <div className="rounded-lg border border-[#bbf7d0] bg-[#ecfdf5] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#047857]">
                Selected for booking
              </p>
              <p className="mt-1 text-[14px] font-semibold text-[#065f46]">
                {selectedQuote.label}
                {" · "}
                {amountRefreshing ? "Loading amount…" : formatQuoteAmount(selectedQuote.amount)}
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
