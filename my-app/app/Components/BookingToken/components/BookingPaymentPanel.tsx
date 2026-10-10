"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import type { DealRow } from "@/app/Components/BookingToken/types";
import type { FinanceReviewStatus } from "@/app/Components/BookingToken/types";
import {
  financeReviewBadgeClass,
  financeReviewLabel,
  normalizeFinanceReviewStatus,
  shouldShowFinanceReview,
} from "@/lib/booking-token-finance-status";
import {
  fetchPaymentHistory,
  rebindDealQuote,
  removeBookingPayment,
  submitBookingPayment,
  type PaymentHistoryEntry,
  type PaymentHistoryResponse,
} from "@/lib/booking-payment-history-api";
import { previewQuoteChange } from "@/lib/booking-done-payment-rules";
import {
  fetchQuoteOptionsForLeadDetail,
  refreshQuoteOptionDetails,
} from "@/lib/lead-quote-options";
import {
  formatQuoteAmount,
  resolveQuoteVerifyUrl,
  type LeadQuoteOption,
} from "@/lib/crm-quote-links";
import { getLeadDetail } from "@/lib/lead-details-client";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import type { CrmLeadType } from "@/lib/leads-filter";
import type { QuoteLoadState } from "./BookingQuoteVersionPicker";
import {
  formatPaymentKind,
  isEasebuzzPayment,
  paymentHistoryMetaLine,
  type OfflinePaymentMethodId,
  type PaymentChannelChoice,
} from "@/lib/booking-payment-display";
import {
  PAYMENT_LINK_POLL_MS,
  cancelPaymentLink,
  copyPaymentLinkToClipboard,
  createDealPaymentLink,
  editPaymentLinkAmount,
  fetchDealPaymentLinkActive,
  hasLeadContact,
  isBannerPaymentLink,
  isStalePaymentLinkAction,
  notifyPaymentLinkUpdated,
  markPaymentLinkHoldMarkAsWon,
  markPaymentLinkOnlineSuccess,
  releasePaymentLinkMarkAsWonGate,
  PaymentLinkApiError,
  isPaymentLinkActiveConflict,
  resolveSwitchOfflineAmount,
  resendPaymentLink,
  switchPaymentLinkOffline,
  type PaymentLinkAttempt,
} from "@/lib/booking-payment-link-api";
import AppConfirmModal from "@/app/Components/Shared/AppConfirmModal";
import PaymentProofThumbnail from "./PaymentProofThumbnail";
import PaymentProofViewModal from "./PaymentProofViewModal";
import PaymentLinkPendingBanner from "./PaymentLinkPendingBanner";
import LeadPaymentLinkStatusChip from "@/app/Components/CrmLeadDetailsV2/LeadPaymentLinkStatusChip";
import BookingLeadDetailsGrid from "./BookingLeadDetailsGrid";
import {
  EMPTY_BOOKING_LEAD_DETAILS,
  fetchBookingLeadDetails,
  type BookingLeadDetails,
} from "@/lib/booking-token-lead-details";
import {
  formatPaymentAmountInput,
  parsePaymentAmountInput,
  validatePaymentProofFile,
} from "@/lib/booking-done-payment-storage";
import {
  splitPaymentTowardTenAndExtra,
} from "@/lib/booking-payment-overpay";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";
import { isSuperAdminRole, canUsePaymentLinkIntegration } from "@/lib/roleUtils";
import {
  formatBookingDateDisplay,
  formatFormSubmittedAt,
} from "@/lib/booking-token-display-format";
import {
  dealLevelLabel,
  dealLevelTone,
  type DealLevelTone,
} from "@/lib/booking-token-listing-type";
import {
  SendPaymentBody,
  SendPaymentModal,
  validateSendPaymentForm,
  type SendPaymentFieldErrors,
} from "./SendPayment";

export type BookingPaymentPanelMode = "view" | "pay";

type Props = {
  open: boolean;
  mode: BookingPaymentPanelMode;
  deal: DealRow | null;
  onClose: () => void;
  onUpdated?: () => void;
};

type DraftProof = {
  id: string;
  file: File;
  previewUrl: string;
};

function clampPanelPosition(
  x: number,
  y: number,
  panelWidth: number,
  panelHeight: number,
  margin = 8,
) {
  return {
    x: Math.min(Math.max(margin, x), Math.max(margin, window.innerWidth - panelWidth - margin)),
    y: Math.min(Math.max(margin, y), Math.max(margin, window.innerHeight - panelHeight - margin)),
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

function getCenteredPanelPosition(panelWidth: number, panelHeight: number) {
  return clampPanelPosition(
    (window.innerWidth - panelWidth) / 2,
    (window.innerHeight - panelHeight) / 2,
    panelWidth,
    panelHeight,
    40,
  );
}

function formatHistoryDate(iso: string): string {
  return formatFormSubmittedAt(iso);
}

export default function BookingPaymentPanel({ open, mode, deal, onClose, onUpdated }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [panelEntered, setPanelEntered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [historyData, setHistoryData] = useState<PaymentHistoryResponse | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [notes, setNotes] = useState("");
  const [draftProofs, setDraftProofs] = useState<DraftProof[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [draftProofViewer, setDraftProofViewer] = useState<DraftProof | null>(null);
  const [leadDetails, setLeadDetails] = useState<BookingLeadDetails>(EMPTY_BOOKING_LEAD_DETAILS);
  const [loadingLead, setLoadingLead] = useState(false);
  const [viewerRole, setViewerRole] = useState("");
  const canUsePaymentLinks = canUsePaymentLinkIntegration(viewerRole);
  const [channel, setChannel] = useState<PaymentChannelChoice>("online");
  const [offlineMethod, setOfflineMethod] = useState<OfflinePaymentMethodId | "">("");
  const [activeAttempt, setActiveAttempt] = useState<PaymentLinkAttempt | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "online" | "offline">("all");
  const [linkBusy, setLinkBusy] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState("");
  const [historyDetailOpen, setHistoryDetailOpen] = useState(false);
  const [quoteLoadState, setQuoteLoadState] = useState<QuoteLoadState>("idle");
  const [quoteError, setQuoteError] = useState("");
  const [quoteOptions, setQuoteOptions] = useState<LeadQuoteOption[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [hubLeadId, setHubLeadId] = useState("");
  const [quoteAmountRefreshing, setQuoteAmountRefreshing] = useState(false);
  const [rebindingQuote, setRebindingQuote] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<SendPaymentFieldErrors>({});
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  useEffect(() => {
    setViewerRole(normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? ""));
  }, []);

  const isBookingView = mode === "view" && deal?.listingType === "booking";
  const isTokenView = mode === "view" && deal?.listingType === "token";
  const isCancelView =
    mode === "view" &&
    Boolean(
      deal &&
        (deal.listingType === "cancel" ||
          deal.isCancelled ||
          deal.bookingStatus === "cancelled" ||
          deal.bookingStatus === "pending_cancellation" ||
          deal.cancellationApprovalStatus === "PENDING"),
    );
  /** View action on any tab (token, booking, cancel, all) — same columns as the deals table. */
  const isRichDetailView = mode === "view";

  const summary = historyData ?? (deal ? buildSummaryFromDeal(deal) : null);
  const selectedQuote = useMemo(
    () => quoteOptions.find((option) => option.id === selectedQuoteId) ?? null,
    [quoteOptions, selectedQuoteId],
  );
  const dealQuoteId = (summary?.quoteId ?? deal?.quoteId ?? null)?.trim() || null;
  const quoteSelectionDiffers =
    Boolean(selectedQuote) &&
    Boolean(summary) &&
    Boolean(deal) &&
    !isDealLockedQuote(selectedQuote, dealQuoteId, summary?.quoteAmount ?? deal?.dealValueAmount);
  const quotePreview =
    quoteSelectionDiffers && selectedQuote?.amount != null
      ? previewQuoteChange({
          amountReceived: summary?.amountReceived,
          extraAmountReceived: summary?.extraAmountReceived,
          totalAmountReceived: summary?.totalAmountReceived,
          quoteAmount: selectedQuote.amount,
        })
      : null;
  const displayQuoteAmount = quotePreview?.quoteAmount ?? summary?.quoteAmount ?? 0;
  const displayTenPercent = quotePreview?.tenPercentAmount ?? summary?.tenPercentAmount ?? 0;
  const displayPaidSoFar = (() => {
    if (quotePreview) return quotePreview.paidSoFar;
    const total = Number(summary?.totalAmountReceived);
    if (Number.isFinite(total)) return Math.max(0, total);
    return Math.max(0, Number(summary?.amountReceived ?? 0)) + Math.max(0, Number(summary?.extraAmountReceived ?? 0));
  })();
  const displayRemaining = quotePreview?.remainingAmount ?? summary?.remainingAmount ?? 0;
  const displayExtra = quotePreview?.extraAmountReceived ?? summary?.extraAmountReceived ?? 0;
  const history = summary?.history ?? [];
  const visibleHistory = history.filter((entry) => {
    if (historyFilter === "online") return isEasebuzzPayment(entry);
    if (historyFilter === "offline") return !isEasebuzzPayment(entry);
    return true;
  });
  const selectedEntry =
    visibleHistory.find((entry) => entry.id === selectedEntryId) ??
    history.find((entry) => entry.id === selectedEntryId) ??
    visibleHistory[visibleHistory.length - 1] ??
    history[history.length - 1] ??
    null;
  const lastHistoryEntry = history[history.length - 1] ?? null;
  const canRemoveSelectedPayment =
    isSuperAdminRole(viewerRole) &&
    selectedEntry != null &&
    lastHistoryEntry?.id === selectedEntry.id &&
    normalizeFinanceReviewStatus(selectedEntry.financeReviewStatus) !== "APPROVED";

  const loadHistory = useCallback(async () => {
    if (!deal) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchPaymentHistory(deal);
      setHistoryData(data);
      setSelectedEntryId(data.history[data.history.length - 1]?.id ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payment history.");
    } finally {
      setLoading(false);
    }
  }, [deal]);

  const loadActiveAttempt = useCallback(async () => {
    if (!canUsePaymentLinks) {
      setActiveAttempt(null);
      return null;
    }
    if (!deal) return null;
    try {
      const attempt = await fetchDealPaymentLinkActive(deal.id);
      const next = isBannerPaymentLink(attempt) ? attempt : null;
      setActiveAttempt(next);
      return attempt;
    } catch {
      setActiveAttempt(null);
      return null;
    }
  }, [canUsePaymentLinks, deal, viewerRole]);

  useEffect(() => {
    if (!open || !deal) return;
    const canUsePaymentLinks = canUsePaymentLinkIntegration(viewerRole);
    setAmountInput(
      mode === "pay" && deal.remainingAmount > 0
        ? formatPaymentAmountInput(deal.remainingAmount)
        : "",
    );
    setNotes("");
    setDraftProofs([]);
    setHistoryData(null);
    setLeadDetails(EMPTY_BOOKING_LEAD_DETAILS);
    setChannel(canUsePaymentLinks ? "online" : "offline");
    setOfflineMethod("");
    setActiveAttempt(null);
    setHistoryFilter("all");
    setCopiedNotice("");
    setHistoryDetailOpen(false);
    setQuoteLoadState("idle");
    setQuoteError("");
    setQuoteOptions([]);
    setSelectedQuoteId("");
    setHubLeadId("");
    setQuoteAmountRefreshing(false);
    setRebindingQuote(false);
    setFieldErrors({});
    setDiscardConfirmOpen(false);
    void loadHistory();
    if (canUsePaymentLinks) {
      void loadActiveAttempt();
    }
  }, [open, deal, loadHistory, loadActiveAttempt, mode, viewerRole]);

  useEffect(() => {
    if (!open || !deal || mode !== "pay") return;
    if (!isCrmLeadType(deal.leadType)) {
      setQuoteLoadState("error");
      setQuoteError("Invalid lead type.");
      return;
    }
    let cancelled = false;
    const activeDeal = deal;
    const validLeadType = activeDeal.leadType as CrmLeadType;

    async function loadQuotes() {
      setQuoteLoadState("loading");
      setQuoteError("");
      try {
        const detail = await getLeadDetail(validLeadType, String(activeDeal.leadId));
        if (cancelled) return;
        const { options: merged, hubLeadId: resolvedHubLeadId } =
          await fetchQuoteOptionsForLeadDetail(detail, String(activeDeal.leadId));
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
        const lockedId = (activeDeal.quoteId ?? "").trim();
        const locked =
          lockedId
            ? merged.find((option) => option.quoteId === lockedId || option.id === lockedId) ?? null
            : merged.find(
                (option) =>
                  option.amount != null &&
                  Math.round(option.amount) === Math.round(activeDeal.dealValueAmount),
              ) ?? null;
        const defaultSelection =
          locked?.id ?? merged.find((option) => option.isLatest)?.id ?? merged[0]?.id ?? "";
        setSelectedQuoteId(defaultSelection);
        setQuoteLoadState("ready");
      } catch (err) {
        if (cancelled) return;
        setQuoteOptions([]);
        setSelectedQuoteId("");
        setHubLeadId("");
        setQuoteLoadState("error");
        setQuoteError(
          err instanceof Error ? err.message : "Unable to load quotations for this lead.",
        );
      }
    }

    void loadQuotes();
    return () => {
      cancelled = true;
    };
  }, [deal, mode, open]);

  useEffect(() => {
    if (!open || !deal || (!isRichDetailView && mode !== "pay")) return;
    let cancelled = false;
    setLoadingLead(true);
    void (async () => {
      const details = await fetchBookingLeadDetails({
        leadType: deal.leadType,
        leadId: deal.leadId,
        fallbackName: deal.customer,
      });
      if (!cancelled) {
        setLeadDetails(details);
        setLoadingLead(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deal, isRichDetailView, mode, open]);

  useEffect(() => {
    if (!open || !deal || !canUsePaymentLinks || !activeAttempt?.id) return;
    const tick = window.setInterval(() => {
      void (async () => {
        const previousId = activeAttempt?.id ?? null;
        const previousStatus = activeAttempt?.status ?? null;
        const attempt = await loadActiveAttempt();
        const bannerGone = isBannerPaymentLink(attempt) === false;
        const paid = String(attempt?.status ?? "").toUpperCase() === "PAID";
        if ((previousId && bannerGone) || paid || (previousStatus && previousStatus !== attempt?.status)) {
          await loadHistory();
          if (paid || bannerGone) onUpdated?.();
        }
      })();
    }, PAYMENT_LINK_POLL_MS);
    return () => window.clearInterval(tick);
  }, [activeAttempt?.id, activeAttempt?.status, canUsePaymentLinks, deal, loadActiveAttempt, loadHistory, onUpdated, open]);

  useLayoutEffect(() => {
    if (!open) return;
    const panelWidth =
      mode === "pay"
        ? Math.min(1120, window.innerWidth - 48)
        : Math.min(920, window.innerWidth - 32);
    const estimatedHeight = Math.min(
      window.innerHeight - (mode === "pay" ? 80 : 24),
      mode === "pay" ? 640 : 520,
    );
    setPanelPosition(
      mode === "pay"
        ? getCenteredPanelPosition(panelWidth, estimatedHeight)
        : getTopAlignedPanelPosition(panelWidth, estimatedHeight),
    );
    setPanelEntered(false);
  }, [open, mode, deal?.id]);

  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    setPanelPosition(
      mode === "pay"
        ? getCenteredPanelPosition(rect.width, rect.height)
        : getTopAlignedPanelPosition(rect.width, rect.height),
    );
  }, [open, mode, historyData, draftProofs.length, loading]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelEntered(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open || mode === "pay") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const isPayFormDirty = useCallback(() => {
    if (mode !== "pay") return false;
    if (draftProofs.length > 0) return true;
    if (notes.trim()) return true;
    if (offlineMethod) return true;
    const amount = parsePaymentAmountInput(amountInput);
    if (amount != null && amount > 0 && amount !== Math.round(displayRemaining)) return true;
    return false;
  }, [amountInput, displayRemaining, draftProofs.length, mode, notes, offlineMethod]);

  const closePanelNow = useCallback(() => {
    setDiscardConfirmOpen(false);
    setPanelEntered(false);
    for (const proof of draftProofs) {
      URL.revokeObjectURL(proof.previewUrl);
    }
    setDraftProofs([]);
    window.setTimeout(() => onClose(), 280);
  }, [draftProofs, onClose]);

  const handleClose = useCallback(() => {
    if (submitting || linkBusy || rebindingQuote) return;
    if (isPayFormDirty()) {
      setDiscardConfirmOpen(true);
      return;
    }
    closePanelNow();
  }, [closePanelNow, isPayFormDirty, linkBusy, rebindingQuote, submitting]);

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

  const addProofFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!deal) return;
      setError("");
      const batch = Array.from(files);
      if (batch.length === 0) return;
      const remaining = 10 - draftProofs.length;
      if (remaining <= 0) {
        setError("You can upload up to 10 payment proofs.");
        return;
      }
      const nextProofs = [...draftProofs];
      for (const file of batch.slice(0, remaining)) {
        const validationError = validatePaymentProofFile(file);
        if (validationError) {
          setError(validationError);
          continue;
        }
        nextProofs.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
      setDraftProofs(nextProofs);
      setFieldErrors((prev) => ({ ...prev, proofCount: undefined }));
    },
    [deal, draftProofs],
  );

  const removeDraftProof = useCallback((id: string) => {
    setDraftProofs((prev) => {
      const target = prev.find((proof) => proof.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((proof) => proof.id !== id);
    });
  }, []);

  const handleUseRemaining = useCallback(() => {
    if (displayRemaining <= 0) return;
    setAmountInput(formatPaymentAmountInput(displayRemaining));
  }, [displayRemaining]);

  const buildQuotePayload = useCallback(() => {
    if (!selectedQuote || selectedQuote.amount == null) return {};
    const quoteId = selectedQuote.quoteId?.trim() || selectedQuote.id;
    if (!quoteId) return {};
    // Always send selected quote on pay/link so Hub can no-op or rebind.
    const tenPercent =
      quotePreview?.tenPercentAmount ?? Math.round(selectedQuote.amount * 0.1);
    return {
      quoteId,
      quoteVersionLabel: selectedQuote.label,
      quoteAmount: selectedQuote.amount,
      tenPercentAmount: tenPercent,
      quoteVerifyUrl: resolveQuoteVerifyUrl(selectedQuote, hubLeadId) || undefined,
    };
  }, [hubLeadId, quotePreview?.tenPercentAmount, selectedQuote]);

  const handleSelectQuote = useCallback(
    async (id: string) => {
      setSelectedQuoteId(id);
      setError("");
      const option = quoteOptions.find((row) => row.id === id);
      if (!option) return;
      setQuoteAmountRefreshing(true);
      try {
        const refreshed = await refreshQuoteOptionDetails(option);
        setQuoteOptions((prev) =>
          prev.map((row) => (row.id === refreshed.id ? refreshed : row)),
        );
        const preview =
          refreshed.amount != null
            ? previewQuoteChange({
                amountReceived: summary?.amountReceived,
                extraAmountReceived: summary?.extraAmountReceived,
                totalAmountReceived: summary?.totalAmountReceived,
                quoteAmount: refreshed.amount,
              })
            : null;
        if (preview && preview.dueNow > 0) {
          setAmountInput(formatPaymentAmountInput(preview.dueNow));
        } else {
          setAmountInput("");
        }
      } finally {
        setQuoteAmountRefreshing(false);
      }
    },
    [quoteOptions, summary?.amountReceived, summary?.extraAmountReceived, summary?.totalAmountReceived],
  );

  const handleApplyQuoteOnly = useCallback(async () => {
    if (!deal || !selectedQuote || selectedQuote.amount == null) return;
    const quoteId = selectedQuote.quoteId?.trim() || selectedQuote.id;
    if (!quoteId) {
      setError("Selected quotation is missing a quote id.");
      return;
    }
    setRebindingQuote(true);
    setError("");
    try {
      await rebindDealQuote(deal.id, {
        quoteId,
        quoteVersionLabel: selectedQuote.label,
        quoteAmount: selectedQuote.amount,
        tenPercentAmount: Math.round(selectedQuote.amount * 0.1),
        quoteVerifyUrl: resolveQuoteVerifyUrl(selectedQuote, hubLeadId) || undefined,
      });
      await loadHistory();
      await loadActiveAttempt();
      onUpdated?.();
      closePanelNow();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update quote on this deal.");
    } finally {
      setRebindingQuote(false);
    }
  }, [closePanelNow, deal, hubLeadId, loadActiveAttempt, loadHistory, onUpdated, selectedQuote]);

  const handleSubmitPayment = useCallback(async () => {
    if (!deal || !summary) return;
    if (quoteSelectionDiffers && displayRemaining <= 0) {
      await handleApplyQuoteOnly();
      return;
    }
    const amount = parsePaymentAmountInput(amountInput);
    const validated = validateSendPaymentForm({
      versionId: selectedQuoteId || (deal.quoteId ?? ""),
      type: "offline",
      method: canUsePaymentLinks ? offlineMethod : offlineMethod || "CASH",
      amount,
      notes,
      proofCount: draftProofs.length,
    });
    if (!validated.ok) {
      setFieldErrors(validated.errors);
      setError(validated.errors.root || validated.errors.amount || validated.errors.proofCount || validated.errors.method || "Check the form and try again.");
      return;
    }
    if (canUsePaymentLinks && !offlineMethod) {
      setFieldErrors({ method: "Select Cash, Cheque, Bank Transfer, or DD." });
      setError("Select Cash, Cheque, Bank Transfer, or DD.");
      return;
    }

    setSubmitting(true);
    setError("");
    setFieldErrors({});
    try {
      await submitBookingPayment(deal.id, {
        amount: validated.values.amount,
        notes,
        files: draftProofs.map((proof) => proof.file),
        ...(canUsePaymentLinks
          ? { paymentMethod: offlineMethod, paymentChannel: "OFFLINE" }
          : {}),
        ...buildQuotePayload(),
      });
      for (const proof of draftProofs) {
        URL.revokeObjectURL(proof.previewUrl);
      }
      setDraftProofs([]);
      setAmountInput("");
      setNotes("");
      await loadHistory();
      await loadActiveAttempt();
      onUpdated?.();
      if (mode === "pay") {
        closePanelNow();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record payment.");
    } finally {
      setSubmitting(false);
    }
  }, [
    amountInput,
    buildQuotePayload,
    canUsePaymentLinks,
    closePanelNow,
    deal,
    displayRemaining,
    draftProofs,
    handleApplyQuoteOnly,
    loadActiveAttempt,
    loadHistory,
    mode,
    notes,
    offlineMethod,
    onUpdated,
    quoteSelectionDiffers,
    selectedQuoteId,
    summary,
  ]);

  const applyAttempt = useCallback(
    (attempt: PaymentLinkAttempt | null | undefined) => {
      if (!deal) {
        setActiveAttempt(isBannerPaymentLink(attempt) ? attempt ?? null : null);
        return;
      }
      const status = String(attempt?.status ?? "").toUpperCase();
      const paid = status === "PAID";
      const banner = isBannerPaymentLink(attempt) ? attempt ?? null : null;
      setActiveAttempt(banner);
      notifyPaymentLinkUpdated(deal.leadType, String(deal.leadId), banner);
      if (paid) markPaymentLinkOnlineSuccess(deal.leadType, String(deal.leadId));
      if (status === "EXPIRED") markPaymentLinkHoldMarkAsWon(deal.leadType, String(deal.leadId));
    },
    [deal],
  );

  const handleSendPaymentLink = useCallback(async () => {
    if (!deal || !summary) return;
    if (quoteSelectionDiffers && displayRemaining <= 0) {
      await handleApplyQuoteOnly();
      return;
    }
    if (isBannerPaymentLink(activeAttempt) && !quoteSelectionDiffers) {
      setError(
        "A payment link is already pending. Wait for payment, delete the link, or switch to offline.",
      );
      return;
    }
    if (!hasLeadContact(leadDetails.phone, leadDetails.email)) {
      setError("Phone and email are both missing. Add a contact before sending a payment link.");
      return;
    }
    const amount = parsePaymentAmountInput(amountInput);
    if (amountInput.trim() && (amount == null || amount <= 0)) {
      setFieldErrors({ amount: "Enter a valid payment amount greater than 0." });
      setError("Enter a valid payment amount, or leave it blank to use the remaining amount.");
      return;
    }
    const effectiveAmount = amount != null && amount > 0 ? amount : displayRemaining;
    if (!(effectiveAmount > 0)) {
      setFieldErrors({ amount: "Amount must be greater than 0." });
      setError("Enter a payment amount greater than 0.");
      return;
    }
    setLinkBusy(true);
    setError("");
    setFieldErrors({});
    try {
      const quoteFields = buildQuotePayload();
      const result = await createDealPaymentLink(deal.id, {
        ...(amount != null && amount > 0 ? { amount } : {}),
        ...quoteFields,
      });
      applyAttempt(result.attempt);
      await loadHistory();
      onUpdated?.();
      if (result.warnings?.length) {
        setError(result.warnings.join(" · "));
      }
    } catch (err) {
      if (isPaymentLinkActiveConflict(err)) {
        if (err.attempt) applyAttempt(err.attempt);
        setError(
          err.message ||
            "A payment link is already active. Delete it, wait for payment, or switch to offline.",
        );
      } else if (err instanceof PaymentLinkApiError && err.useOfflineFallback) {
        setChannel("offline");
        setError(`${err.message} Online payment is unavailable — record an Offline proof instead.`);
      } else {
        setError(err instanceof Error ? err.message : "Unable to send payment link.");
      }
    } finally {
      setLinkBusy(false);
    }
  }, [
    activeAttempt,
    amountInput,
    applyAttempt,
    buildQuotePayload,
    deal,
    displayRemaining,
    handleApplyQuoteOnly,
    leadDetails.email,
    leadDetails.phone,
    loadHistory,
    onUpdated,
    quoteSelectionDiffers,
    summary,
  ]);

  const handleCopyPaymentLink = useCallback(async () => {
    if (!activeAttempt) return;
    setLinkBusy(true);
    setError("");
    try {
      const result = await copyPaymentLinkToClipboard(activeAttempt.id, activeAttempt);
      if (result.attempt) applyAttempt(result.attempt);
      setCopiedNotice("Payment link copied");
      window.setTimeout(() => setCopiedNotice(""), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to copy payment link.");
    } finally {
      setLinkBusy(false);
    }
  }, [activeAttempt, applyAttempt]);

  const handleResendPaymentLink = useCallback(async () => {
    if (!activeAttempt) return;
    setLinkBusy(true);
    setError("");
    try {
      const result = await resendPaymentLink(activeAttempt.id);
      applyAttempt(result.attempt);
    } catch (err) {
      if (isStalePaymentLinkAction(err)) {
        await loadActiveAttempt();
      }
      if (err instanceof PaymentLinkApiError && err.useOfflineFallback) {
        setChannel("offline");
        setError(`${err.message} Online payment is unavailable — record an Offline proof instead.`);
      } else {
        setError(err instanceof Error ? err.message : "Unable to resend payment link.");
      }
    } finally {
      setLinkBusy(false);
    }
  }, [activeAttempt, applyAttempt, loadActiveAttempt]);

  const handleEditPaymentLink = useCallback(
    async (amount: number) => {
      if (!activeAttempt) return;
      setLinkBusy(true);
      setError("");
      try {
        const result = await editPaymentLinkAmount(activeAttempt.id, amount);
        applyAttempt(result.attempt);
      } catch (err) {
        if (isStalePaymentLinkAction(err)) {
          await loadActiveAttempt();
        }
        setError(err instanceof Error ? err.message : "Unable to edit payment link.");
      } finally {
        setLinkBusy(false);
      }
    },
    [activeAttempt, applyAttempt, loadActiveAttempt],
  );

  const handleSwitchOffline = useCallback(async () => {
    if (!activeAttempt || !deal) return;
    setLinkBusy(true);
    setError("");
    try {
      const result = await switchPaymentLinkOffline(activeAttempt.id);
      const switchedAmount = resolveSwitchOfflineAmount(result, activeAttempt);
      setActiveAttempt(null);
      notifyPaymentLinkUpdated(deal.leadType, String(deal.leadId), null);
      releasePaymentLinkMarkAsWonGate(deal.leadType, String(deal.leadId));
      setChannel("offline");
      setHistoryDetailOpen(false);
      if (switchedAmount != null) {
        setAmountInput(formatPaymentAmountInput(switchedAmount));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to switch to offline payment.");
    } finally {
      setLinkBusy(false);
    }
  }, [activeAttempt, deal]);

  const handleDeletePaymentLink = useCallback(
    async (opts: { notifyCustomer: boolean }) => {
      if (!activeAttempt || !deal) return;
      setLinkBusy(true);
      setError("");
      try {
        const result = await cancelPaymentLink(activeAttempt.id, {
          notifyCustomer: opts.notifyCustomer,
        });
        setActiveAttempt(null);
        notifyPaymentLinkUpdated(deal.leadType, String(deal.leadId), null);
        releasePaymentLinkMarkAsWonGate(deal.leadType, String(deal.leadId));
        const warning =
          result.warning?.trim() ||
          (result.deactivateSucceeded === false
            ? "Link cancelled in CRM, but Easebuzz deactivate may have failed."
            : "");
        setCopiedNotice(
          warning || "Payment link deleted — you can send a new one.",
        );
        window.setTimeout(() => setCopiedNotice(""), 2500);
        onUpdated?.();
      } catch (err) {
        if (isStalePaymentLinkAction(err)) {
          await loadActiveAttempt();
        }
        setError(err instanceof Error ? err.message : "Unable to delete payment link.");
      } finally {
        setLinkBusy(false);
      }
    },
    [activeAttempt, deal, loadActiveAttempt, onUpdated],
  );

  const handleRemovePayment = useCallback(async () => {
    if (!deal || !selectedEntry) return;
    setRemoving(true);
    setError("");
    try {
      const data = await removeBookingPayment(deal.id, selectedEntry.id);
      setHistoryData(data);
      setSelectedEntryId(data.history[data.history.length - 1]?.id ?? "");
      setRemoveConfirmOpen(false);
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove payment.");
    } finally {
      setRemoving(false);
    }
  }, [deal, onUpdated, selectedEntry]);

  if (!open || !deal || !summary) return null;

  const title =
    mode === "pay"
      ? "Send Payment"
      : isCancelView
        ? "Cancellation details"
        : isBookingView
          ? "Booking details"
          : isTokenView
            ? "Token details"
            : "Deal details";
  const canChangeQuote =
    mode === "pay" &&
    deal.listingType === "token" &&
    Number(summary.remainingAmount) > 0 &&
    deal.cancellationApprovalStatus !== "PENDING";
  const canPay =
    deal.listingType === "token" &&
    Number(displayRemaining) > 0 &&
    deal.cancellationApprovalStatus !== "PENDING";
  const quoteCompleteAfterRebind =
    canChangeQuote && quoteSelectionDiffers && displayRemaining <= 0;
  const showBanner = canUsePaymentLinks && isBannerPaymentLink(activeAttempt);
  const showPayComposer =
    mode === "pay" && (canPay || showBanner || quoteCompleteAfterRebind || canChangeQuote);
  const missingContacts =
    !loadingLead && !hasLeadContact(leadDetails.phone, leadDetails.email);

  const parsedPayAmount = parsePaymentAmountInput(amountInput);
  const paySplit =
    parsedPayAmount != null && parsedPayAmount > 0
      ? splitPaymentTowardTenAndExtra(parsedPayAmount, displayRemaining)
      : null;
  const quoteHelperText =
    quoteSelectionDiffers && quotePreview
      ? `Paid ${formatQuoteAmount(quotePreview.paidSoFar)} against previous quote · New 10% ${formatQuoteAmount(quotePreview.tenPercentAmount)} · Due now ${formatQuoteAmount(quotePreview.dueNow)}`
      : null;

  const pendingLinkBanner =
    showBanner && activeAttempt ? (
      <PaymentLinkPendingBanner
        attempt={activeAttempt}
        busy={linkBusy}
        onCopy={() => void handleCopyPaymentLink()}
        onResend={() => void handleResendPaymentLink()}
        onEdit={(amount) => void handleEditPaymentLink(amount)}
        onSwitchOffline={() => void handleSwitchOffline()}
        onDelete={(opts) => void handleDeletePaymentLink(opts)}
      />
    ) : null;
  const onlineSuccessChip =
    canUsePaymentLinks && deal && !showBanner ? (
      <LeadPaymentLinkStatusChip
        leadType={deal.leadType}
        leadId={String(deal.leadId)}
        hasEasebuzzHistory={history.some((entry) => isEasebuzzPayment(entry))}
        successOnly
      />
    ) : null;

  const paymentHistoryBlock = (
    <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#fafbfc]">
      <div className="border-b border-[#eef1f5] bg-white px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
          Payment history
          {summary.summary ? (
            <span className="ml-2 font-normal normal-case tracking-normal text-[#6b7280]">
              · {summary.summary.paymentCount} payment
              {summary.summary.paymentCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </p>
      </div>
      <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-[#eef1f5]">
        <div className="min-h-[200px] border-b border-[#eef1f5] lg:min-h-[240px] lg:border-b-0">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-[#6b7280]">Loading history…</p>
          ) : history.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#6b7280]">No payments recorded yet.</p>
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
                          {paymentHistoryMetaLine(entry) ? ` · ${paymentHistoryMetaLine(entry)}` : ""}
                        </p>
                        {entry.remainingAfter <= 0 &&
                        shouldShowFinanceReview(
                          normalizeFinanceReviewStatus(entry.financeReviewStatus),
                          entry.remainingAfter,
                        ) ? (
                          <span
                            className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${financeReviewBadgeClass(normalizeFinanceReviewStatus(entry.financeReviewStatus))}`}
                          >
                            Finance: {financeReviewLabel(normalizeFinanceReviewStatus(entry.financeReviewStatus))}
                          </span>
                        ) : null}
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
        <div className="min-h-[200px] bg-white p-4 lg:min-h-[240px]">
          <HistoryDetailSection
            deal={deal}
            entry={selectedEntry}
            canRemove={canRemoveSelectedPayment}
            removing={removing}
            onRemove={() => setRemoveConfirmOpen(true)}
          />
        </div>
      </div>
    </div>
  );

  const payComposer = showPayComposer ? (
    <SendPaymentBody
      totalAmount={displayQuoteAmount}
      bookingAmount10={displayTenPercent}
      amountPaid={displayPaidSoFar}
      remaining10={displayRemaining}
      quoteLoadState={canChangeQuote ? quoteLoadState : "idle"}
      quoteError={quoteError}
      quoteOptions={canChangeQuote ? quoteOptions : []}
      hubLeadId={hubLeadId}
      selectedQuoteId={selectedQuoteId}
      selectedQuote={selectedQuote}
      dealQuoteId={dealQuoteId}
      quoteAmountRefreshing={quoteAmountRefreshing}
      onSelectQuote={(id) => void handleSelectQuote(id)}
      historyLoading={loading}
      history={visibleHistory}
      paymentCount={summary.summary?.paymentCount ?? history.length}
      proofCount={
        summary.summary?.proofCount ??
        history.reduce((n, entry) => n + (entry.proofs?.length ?? 0), 0)
      }
      historyFilter={historyFilter}
      onHistoryFilterChange={setHistoryFilter}
      selectedEntryId={selectedEntryId}
      onSelectEntry={(id) => {
        setSelectedEntryId(id);
        setHistoryDetailOpen(true);
      }}
      showHistoryFilters={canUsePaymentLinks}
      channel={channel}
      onChannelChange={(next) => {
        setFieldErrors({});
        if (next === "offline" && showBanner && !quoteSelectionDiffers) {
          void handleSwitchOffline();
          return;
        }
        setChannel(next);
      }}
      showOnlineChannel={canUsePaymentLinks}
      offlineMethod={offlineMethod}
      onOfflineMethodChange={(method) => {
        setFieldErrors((prev) => ({ ...prev, method: undefined }));
        setOfflineMethod(method);
      }}
      amountInput={amountInput}
      onAmountChange={(value) => {
        setFieldErrors((prev) => ({ ...prev, amount: undefined }));
        setAmountInput(value);
      }}
      onUseRemaining={handleUseRemaining}
      extraToFinance={paySplit?.extraToFinance ?? 0}
      notes={notes}
      onNotesChange={setNotes}
      draftProofs={draftProofs}
      dragActive={dragActive}
      fileInputRef={fileInputRef}
      onPickFiles={() => fileInputRef.current?.click()}
      onFileInputChange={(event) => {
        if (event.target.files) void addProofFiles(event.target.files);
        event.target.value = "";
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        if (event.dataTransfer.files.length > 0) {
          void addProofFiles(event.dataTransfer.files);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onRemoveProof={removeDraftProof}
      onPreviewProof={setDraftProofViewer}
      fieldErrors={fieldErrors}
      disabled={submitting || linkBusy || rebindingQuote}
      submitting={submitting || linkBusy || rebindingQuote}
      primaryLabel={
        quoteCompleteAfterRebind
          ? "Apply quote change"
          : canUsePaymentLinks && channel === "online"
            ? `Send payment link · ${formatQuoteAmount(parsePaymentAmountInput(amountInput) ?? displayRemaining)}`
            : `Save payment · ${formatQuoteAmount(parsePaymentAmountInput(amountInput) ?? 0)}`
      }
      onPrimaryAction={() => {
        if (quoteCompleteAfterRebind) {
          void handleApplyQuoteOnly();
          return;
        }
        if (canUsePaymentLinks && channel === "online") {
          void handleSendPaymentLink();
          return;
        }
        void handleSubmitPayment();
      }}
      primaryDisabled={
        quoteCompleteAfterRebind
          ? rebindingQuote || submitting || linkBusy
          : canUsePaymentLinks && channel === "online"
            ? (showBanner && !quoteSelectionDiffers) ||
              linkBusy ||
              loadingLead ||
              missingContacts ||
              rebindingQuote
            : submitting || rebindingQuote
      }
      helperSlot={
        <>
          {quoteHelperText ? (
            <p className="rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-950">
              {quoteHelperText}
            </p>
          ) : null}
          {deal && (deal.bufferApplied || deal.bookingApprovalMode === "BUFFER_9_9") ? (
            <div className="rounded-[14px] border border-sky-200 bg-sky-50 px-3 py-2.5 text-[12px] leading-relaxed text-sky-950">
              {deal.financeBufferNote?.trim() ||
                "Booking via 9.9% buffer. Remaining toward 10% is expected until Finance collects the shortfall."}
            </div>
          ) : null}
          {error ? (
            <p
              className="rounded-[14px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
              aria-live="polite"
            >
              {error}
            </p>
          ) : null}
          {copiedNotice ? (
            <p className="text-[12px] font-semibold text-emerald-700">{copiedNotice}</p>
          ) : null}
        </>
      }
      bannerSlot={
        <>
          {pendingLinkBanner}
          {!pendingLinkBanner ? onlineSuccessChip : null}
        </>
      }
      historyDetailOpen={Boolean(historyDetailOpen && selectedEntry)}
      middleTopSlot={
        historyDetailOpen && selectedEntry ? (
          <div className="rounded-2xl border border-[#E3E8EE] bg-[#F7F9FA] p-3">
            <button
              type="button"
              onClick={() => setHistoryDetailOpen(false)}
              className="mb-2 text-[12px] font-semibold text-[#047857] hover:underline"
            >
              ← Back to payment form
            </button>
            <HistoryDetailSection
              deal={deal}
              entry={selectedEntry}
              canRemove={canRemoveSelectedPayment}
              removing={removing}
              onRemove={() => setRemoveConfirmOpen(true)}
            />
          </div>
        ) : quoteCompleteAfterRebind ? (
          <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-900">
            With this quote, paid amount already meets the new 10%. Apply the quote
            change to freeze it and unlock Convert to Booking — no extra payment needed.
          </div>
        ) : null
      }
    />
  ) : (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <p className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Full 10% is already received. Use Convert to Booking on the deal row.
      </p>
      {error ? (
        <p className="rounded-[14px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );

  if (mode === "pay") {
    return (
      <>
        <SendPaymentModal
          open={open}
          entered={panelEntered}
          customer={deal.customer}
          quoteId={selectedQuote?.quoteId || deal.quoteId}
          bookingRef={deal.asset}
          onClose={handleClose}
          panelRef={panelRef}
          position={panelPosition}
          isDragging={isDragging}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
        >
          {payComposer}
        </SendPaymentModal>

        <PaymentProofViewModal
          open={draftProofViewer != null}
          onClose={() => setDraftProofViewer(null)}
          fileName={draftProofViewer?.file.name ?? "Payment proof"}
          mimeType={draftProofViewer?.file.type}
          previewUrl={draftProofViewer?.previewUrl}
        />

        <AppConfirmModal
          open={removeConfirmOpen && selectedEntry != null}
          title="Remove payment?"
          message={
            selectedEntry
              ? `Remove payment ${formatQuoteAmount(selectedEntry.amount)}? If 10% is no longer complete, the deal returns to the Token tab so you can Convert to Booking again.`
              : ""
          }
          confirmLabel="Remove payment"
          danger
          submitting={removing}
          onClose={() => {
            if (!removing) setRemoveConfirmOpen(false);
          }}
          onConfirm={() => void handleRemovePayment()}
        />

        <AppConfirmModal
          open={discardConfirmOpen}
          title="Discard payment?"
          message="You have unsaved payment details. Close anyway?"
          confirmLabel="Discard"
          danger
          onClose={() => setDiscardConfirmOpen(false)}
          onConfirm={closePanelNow}
        />
      </>
    );
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-[90] bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 ${
          panelEntered ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        className={`fixed z-[95] flex max-h-[calc(100vh-2rem)] w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-[#E3E8EE] bg-white shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          panelEntered ? "scale-100 opacity-100" : "scale-[0.86] opacity-0"
        }`}
        style={{ left: panelPosition.x, top: panelPosition.y }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className={`flex items-center justify-between border-b border-[#E3E8EE] px-5 py-4 select-none touch-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[22px] font-bold ${
                  isCancelView
                    ? "bg-red-50 text-red-600"
                    : "bg-[#E7F6EF] text-[#047857]"
                }`}
              >
                {isCancelView ? "✕" : "₹"}
              </span>
              <div className="min-w-0">
                <h2 className="text-[18px] font-bold tracking-tight text-[#0F172A]">
                  {title}
                </h2>
                <p className="mt-0.5 truncate text-[13px] text-[#5B6778]">
                  {`${deal.customer} · ${deal.asset}`}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E3E8EE] bg-white text-[22px] leading-none text-[#5B6778] transition hover:bg-[#F7F9FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40"
            aria-label="Close payment panel"
          >
            ×
          </button>
        </div>

        {isRichDetailView ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            <div className="space-y-5">
              {isCancelView ? (
                <section>
                  <p className="border-b border-[#f1f5f9] pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
                    Cancellation details
                  </p>
                  <div className="mt-3">
                    <CancellationDetailsGrid
                      deal={deal}
                      leadDetails={leadDetails}
                      loadingLead={loadingLead}
                    />
                  </div>
                </section>
              ) : null}

              <section>
                <p className="border-b border-[#f1f5f9] pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
                  Lead details
                </p>
                <div className="mt-3">
                  <BookingLeadDetailsGrid details={leadDetails} loading={loadingLead} />
                </div>
              </section>

              <section>
                <p className="border-b border-[#f1f5f9] pb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
                  Deal summary
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <SummaryCard
                    label="Level"
                    value={dealLevelLabel(deal)}
                    levelTone={dealLevelTone(deal)}
                  />
                  <SummaryCard
                    label="Booking date"
                    value={formatBookingDateDisplay(deal.bookingDate)}
                  />
                  <SummaryCard label="Total amount" value={formatQuoteAmount(summary.quoteAmount)} />
                  <SummaryCard label="10% target" value={formatQuoteAmount(summary.tenPercentAmount)} />
                  <SummaryCard label="Amount paid" value={formatQuoteAmount(summary.amountReceived)} highlight />
                  {summary.remainingAmount > 0 ? (
                    <SummaryCard
                      label="Remaining (10%)"
                      value={formatQuoteAmount(summary.remainingAmount)}
                    />
                  ) : null}
                  {(summary.extraAmountReceived ?? 0) > 0 ? (
                    <SummaryCard
                      label="Extra (Finance)"
                      value={formatQuoteAmount(summary.extraAmountReceived ?? 0)}
                      highlight
                    />
                  ) : null}
                  {deal && shouldShowFinanceReview(deal.financeReviewStatus ?? "NOT_READY", deal.remainingAmount) ? (
                    <SummaryCard
                      label="Finance review"
                      value={financeReviewLabel(deal.financeReviewStatus ?? "NOT_READY")}
                      tone={normalizeFinanceReviewStatus(deal.financeReviewStatus)}
                    />
                  ) : null}
                </div>
                {deal && (deal.bufferApplied || deal.bookingApprovalMode === "BUFFER_9_9") ? (
                  <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-[12px] leading-relaxed text-sky-950">
                    {deal.financeBufferNote?.trim() ||
                      "Booking via 9.9% buffer. Remaining toward 10% is expected until Finance collects the shortfall."}
                  </div>
                ) : null}
              {pendingLinkBanner ? <div className="mt-3">{pendingLinkBanner}</div> : null}
              {onlineSuccessChip ? <div className="mt-3">{onlineSuccessChip}</div> : null}
              </section>

              {paymentHistoryBlock}

              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <AppConfirmModal
        open={removeConfirmOpen && selectedEntry != null}
        title="Remove payment?"
        message={
          selectedEntry
            ? `Remove payment ${formatQuoteAmount(selectedEntry.amount)}? If 10% is no longer complete, the deal returns to the Token tab so you can Convert to Booking again.`
            : ""
        }
        confirmLabel="Remove payment"
        danger
        submitting={removing}
        onClose={() => {
          if (!removing) setRemoveConfirmOpen(false);
        }}
        onConfirm={() => void handleRemovePayment()}
      />
    </>
  );
}

function isDealLockedQuote(
  option: LeadQuoteOption | null,
  dealQuoteId: string | null,
  dealQuoteAmount?: number | null,
): boolean {
  if (!option) return false;
  const locked = dealQuoteId?.trim();
  if (locked) {
    return option.quoteId === locked || option.id === locked;
  }
  if (option.amount == null || dealQuoteAmount == null || !Number.isFinite(dealQuoteAmount)) {
    return false;
  }
  return Math.round(option.amount) === Math.round(dealQuoteAmount);
}

function buildSummaryFromDeal(deal: DealRow): PaymentHistoryResponse {
  return {
    recordId: deal.id,
    leadType: deal.leadType,
    leadId: deal.leadId,
    leadIdentifier: deal.leadIdentifier,
    customerName: deal.customer,
    quoteId: deal.quoteId ?? null,
    quoteVersionLabel: deal.quoteVersionLabel ?? null,
    quoteAmount: deal.dealValueAmount,
    tenPercentAmount: deal.tenPercentAmount,
    amountReceived: deal.paidAmount,
    remainingAmount: deal.remainingAmount,
    extraAmountReceived: deal.extraAmountReceived,
    totalAmountReceived: deal.totalAmountReceived,
    history: [],
  };
}

function SummaryCard({
  label,
  value,
  highlight = false,
  tone,
  levelTone,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: FinanceReviewStatus;
  levelTone?: DealLevelTone;
}) {
  const toneClass =
    levelTone === "booking"
      ? "border-blue-200 bg-blue-50"
      : levelTone === "token"
        ? "border-amber-200 bg-amber-50"
        : levelTone === "cancel"
          ? "border-red-200 bg-red-50"
          : tone === "APPROVED"
            ? "border-emerald-200 bg-emerald-50"
            : tone === "PENDING"
              ? "border-amber-200 bg-amber-50"
              : tone === "REJECTED"
                ? "border-red-200 bg-red-50"
                : highlight
                  ? "border-[#bbf7d0] bg-[#ecfdf5]"
                  : "border-[#e5e7eb] bg-[#f9fafb]";
  const valueClass =
    levelTone === "booking"
      ? "text-blue-800"
      : levelTone === "token"
        ? "text-amber-800"
        : levelTone === "cancel"
          ? "text-red-800"
          : tone === "APPROVED"
            ? "text-emerald-800"
            : tone === "PENDING"
              ? "text-amber-800"
              : tone === "REJECTED"
                ? "text-red-800"
                : "text-[#111827]";

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${toneClass}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#9ca3af]">{label}</p>
      <p className={`mt-1 text-[15px] font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function displayValue(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function cancellationStatusLabel(deal: DealRow): string {
  if (deal.cancellationApprovalStatus === "PENDING") return "Pending approval";
  if (deal.cancellationApprovalStatus === "REJECTED") return "Rejected";
  if (deal.listingType === "cancel" || deal.isCancelled || deal.bookingStatus === "cancelled") {
    return "Cancelled";
  }
  return deal.bookingStatus.replace(/_/g, " ");
}

function CancellationDetailsGrid({
  deal,
  leadDetails,
  loadingLead,
}: {
  deal: DealRow;
  leadDetails: BookingLeadDetails;
  loadingLead: boolean;
}) {
  const assignee =
    leadDetails.assignee !== "—" ? leadDetails.assignee : displayValue(deal.assign);
  const designer =
    loadingLead && deal.designerName === "—"
      ? "Loading…"
      : displayValue(deal.designerName !== "—" ? deal.designerName : leadDetails.designerName);
  const isPending = deal.cancellationApprovalStatus === "PENDING";
  const cancelledBy = isPending
    ? "—"
    : displayValue(deal.cancelledByName ?? deal.cancellationApprovedByName);
  const requestedBy = displayValue(deal.cancellationRequestedByName);
  const approvedBy = displayValue(deal.cancellationApprovedByName);
  const cancelledOn = deal.cancelledAt ? formatHistoryDate(deal.cancelledAt) : "—";
  const requestedOn = deal.cancellationRequestedAt
    ? formatHistoryDate(deal.cancellationRequestedAt)
    : "—";
  const bookingDateLabel = formatBookingDateDisplay(deal.bookingDate);
  const reason = displayValue(deal.cancellationReason);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Status" value={cancellationStatusLabel(deal)} highlight />
        {isPending ? (
          <>
            <SummaryCard label="Requested by" value={requestedBy} />
            <SummaryCard label="Requested on" value={requestedOn} />
          </>
        ) : (
          <>
            <SummaryCard label="Cancelled by" value={cancelledBy} />
            <SummaryCard label="Approved by" value={approvedBy} />
            <SummaryCard label="Cancelled on" value={cancelledOn} />
          </>
        )}
        <SummaryCard label="Booking date" value={bookingDateLabel} />
        <SummaryCard label="Lead assigned to" value={assignee} />
        <SummaryCard label="Designer" value={designer} />
      </div>
      <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#b91c1c]">
          Cancellation reason
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words text-[13px] font-semibold leading-snug text-[#7f1d1d]">
          {reason}
        </p>
      </div>
    </div>
  );
}

function HistoryDetailSection({
  deal,
  entry,
  canRemove = false,
  removing = false,
  onRemove,
}: {
  deal: DealRow;
  entry: PaymentHistoryEntry | null;
  canRemove?: boolean;
  removing?: boolean;
  onRemove?: () => void;
}) {
  if (!entry) {
    return <p className="text-sm text-[#6b7280]">Select a payment from the list.</p>;
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">Payment detail</p>
        {canRemove && onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            className="shrink-0 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            {removing ? "Removing…" : "Remove payment"}
          </button>
        ) : null}
      </div>
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
        {paymentHistoryMetaLine(entry) ? ` · ${paymentHistoryMetaLine(entry)}` : ""}
      </p>
      {entry.gatewayPaymentId ? (
        <p className="mt-1 text-[11px] text-[#6b7280]">Gateway id {entry.gatewayPaymentId}</p>
      ) : null}
      {entry.notes ? (
        <p className="mt-3 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3 text-[12px] text-[#374151]">
          {entry.notes}
        </p>
      ) : null}
      {entry.remainingAfter <= 0 &&
      shouldShowFinanceReview(normalizeFinanceReviewStatus(entry.financeReviewStatus), entry.remainingAfter) ? (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">Finance review</p>
          <p className="mt-1 text-[13px] font-semibold text-[#111827]">
            {financeReviewLabel(normalizeFinanceReviewStatus(entry.financeReviewStatus))}
          </p>
          {entry.financeReviewBy ? (
            <p className="mt-1 text-[11px] text-[#6b7280]">By {entry.financeReviewBy}</p>
          ) : null}
          {entry.financeRejectReason ? (
            <p className="mt-1 text-[11px] text-red-600">{entry.financeRejectReason}</p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
          Payment proofs
        </p>
        {entry.proofs.length === 0 ? (
          <p className="mt-2 text-[12px] text-[#9ca3af]">
            {isEasebuzzPayment(entry)
              ? "Online payment — no screenshot required."
              : "No screenshots attached for this payment."}
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2">
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

function OnlineLinkFormSection({
  amountInput,
  remainingAmount,
  missingContacts,
  disabled = false,
  onAmountChange,
  onUseRemaining,
}: {
  amountInput: string;
  remainingAmount: number;
  missingContacts: boolean;
  disabled?: boolean;
  onAmountChange: (value: string) => void;
  onUseRemaining: () => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
        Send payment link
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-[#6b7280]">
        Default is the remaining 10% amount. WhatsApp and email are sent together; SMS is used if
        WhatsApp fails.
      </p>
      {missingContacts ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Phone and email are both missing. Add a contact before sending a payment link.
        </p>
      ) : null}
      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
        Link amount
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-sm font-semibold text-[#374151]">₹</span>
        <input
          type="text"
          inputMode="numeric"
          value={amountInput}
          disabled={disabled}
          onChange={(event) => onAmountChange(event.target.value.replace(/[^\d,]/g, ""))}
          placeholder="0"
          className="h-10 flex-1 rounded-lg border border-[#d1d5db] px-3 text-sm outline-none focus:border-[#059669] focus:ring-2 focus:ring-[#bbf7d0] disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:opacity-70"
        />
      </div>
      <button
        type="button"
        onClick={onUseRemaining}
        disabled={disabled}
        className="bt-btn bt-btn-link mt-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Use remaining ({formatQuoteAmount(remainingAmount)})
      </button>
    </div>
  );
}

function PayFormSection({
  amountInput,
  notes,
  draftProofs,
  dragActive,
  remainingAmount,
  paySplit,
  fileInputRef,
  onAmountChange,
  onNotesChange,
  onUseRemaining,
  onPickFiles,
  onFileInputChange,
  onDrop,
  onDragOver,
  onDragLeave,
  onRemoveProof,
  onPreviewProof,
}: {
  amountInput: string;
  notes: string;
  draftProofs: DraftProof[];
  dragActive: boolean;
  remainingAmount: number;
  paySplit: { towardTen: number; extraToFinance: number } | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onAmountChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onUseRemaining: () => void;
  onPickFiles: () => void;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onRemoveProof: (id: string) => void;
  onPreviewProof: (proof: DraftProof) => void;
}) {
  const showExtraPreview = paySplit != null && paySplit.extraToFinance > 0;

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">Next payment</p>

      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
        Payment amount
      </label>
      <p className="mt-0.5 text-[11px] leading-relaxed text-[#9ca3af]">
        Up to {formatQuoteAmount(remainingAmount)} completes the 10% target. Any amount above that is
        recorded as extra and sent to Finance.
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-sm font-semibold text-[#374151]">₹</span>
        <input
          type="text"
          inputMode="numeric"
          value={amountInput}
          onChange={(event) => onAmountChange(event.target.value.replace(/[^\d,]/g, ""))}
          placeholder="0"
          className="h-10 flex-1 rounded-lg border border-[#d1d5db] px-3 text-sm outline-none focus:border-[#059669] focus:ring-2 focus:ring-[#bbf7d0]"
        />
      </div>
      <button
        type="button"
        onClick={onUseRemaining}
        className="bt-btn bt-btn-link mt-2"
      >
        Use full remaining ({formatQuoteAmount(remainingAmount)})
      </button>

      {showExtraPreview && paySplit ? (
        <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-[12px] leading-relaxed text-violet-950">
          <p>
            <span className="font-semibold">{formatQuoteAmount(paySplit.towardTen)}</span> toward
            10% target
            {paySplit.extraToFinance > 0 ? (
              <>
                {" "}
                · <span className="font-semibold">{formatQuoteAmount(paySplit.extraToFinance)}</span>{" "}
                extra to Finance
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
        Notes (optional)
      </label>
      <textarea
        value={notes}
        onChange={(event) => onNotesChange(event.target.value)}
        rows={2}
        className="mt-1.5 w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm outline-none focus:border-[#059669] focus:ring-2 focus:ring-[#bbf7d0]"
        placeholder="UPI ref, bank transfer note…"
      />

      <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
        Payment proof (multiple allowed)
      </label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,application/pdf"
        multiple
        className="hidden"
        onChange={onFileInputChange}
      />
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`mt-1.5 rounded-lg border-2 border-dashed px-4 py-5 text-center transition ${
          dragActive ? "border-[#059669] bg-[#ecfdf5]" : "border-[#d1d5db] bg-[#f9fafb]"
        }`}
      >
        <p className="text-[12px] text-[#6b7280]">Drag screenshots here or</p>
        <button
          type="button"
          onClick={onPickFiles}
          className="bt-btn bt-btn-upload"
        >
          Upload proofs
        </button>
      </div>

      {draftProofs.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {draftProofs.map((proof) => (
            <div key={proof.id} className="relative overflow-hidden rounded-lg border border-[#e5e7eb]">
              <button
                type="button"
                onClick={() => onPreviewProof(proof)}
                className="block w-full text-left"
                title="Click to view full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={proof.previewUrl} alt={proof.file.name} className="h-24 w-full object-cover" />
              </button>
              <button
                type="button"
                onClick={() => onRemoveProof(proof.id)}
                className="bt-btn absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-black/80"
              >
                Remove
              </button>
              <p className="truncate px-2 py-1 text-[10px] text-[#6b7280]">{proof.file.name}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
