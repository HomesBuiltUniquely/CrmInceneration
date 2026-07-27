import {
  classifyBookingPayment,
  calculateBookingTenPercent,
  type BookingPaymentKind,
} from "@/lib/booking-done-payment-rules";
import {
  parsePaymentAmountInput,
  readPaymentAmount,
  readPaymentProofs,
  readBookingDate,
  isValidBookingDateValue,
} from "@/lib/booking-done-payment-storage";
import { formatQuoteAmount, resolveQuoteVerifyUrl, type LeadQuoteOption } from "@/lib/crm-quote-links";
import {
  canShowConvert,
  canShowPay,
  isCancelListingType,
  resolveListingType,
  resolveShowCancellationButton,
} from "@/lib/booking-token-listing-type";
import { isCancelledBookingStatus } from "@/lib/booking-token-cancellation";
import { normalizeFinanceReviewStatus } from "@/lib/booking-token-finance-status";
import {
  isBufferAppliedDeal,
  readOptionalDealBoolean,
  readOptionalDealNumber,
  resolveBookingBufferFields,
} from "@/lib/booking-token-buffer";
import type { BookingTokenDeal } from "@/lib/booking-done-api";
import type { PaymentHistoryEntry } from "@/lib/booking-payment-history-api";
import type {
  BookingStatus,
  DealRow,
  LedgerItem,
  TokenStatus,
  CancellationApprovalStatus,
} from "@/app/Components/BookingToken/types";
import { displayDash } from "@/lib/booking-token-display-format";

export const RECENT_LEDGER_ITEM_LIMIT = 5;
export const RECENT_LEDGER_DEALS_FETCH = 20;

export type BuildBookingDoneSubmitInput = {
  leadType: string;
  leadId: string;
  hubLeadId?: string;
  selectedQuote: LeadQuoteOption | null;
};

export type BookingDoneSubmitPayload = {
  hubLeadId?: string;
  quoteId?: string;
  quoteVersionLabel?: string;
  quoteAmount: number;
  tenPercentAmount: number | null;
  amountReceived: number;
  paymentKind: BookingPaymentKind;
  quoteVerifyUrl?: string;
  bookingDate: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "LD";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function readOptionalDealString(deal: BookingTokenDeal, ...keys: string[]): string | null {
  const row = deal as BookingTokenDeal & Record<string, unknown>;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function formatExpClosing(submittedAt: string): string {
  const base = new Date(submittedAt);
  if (Number.isNaN(base.getTime())) return "—";
  const closing = new Date(base);
  closing.setDate(closing.getDate() + 30);
  return closing.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function mapHubTokenStatus(status: string, paymentKind: string): TokenStatus {
  const normalized = status.trim().toLowerCase();
  if (normalized === "pending") return "pending";
  if (normalized === "issued" || normalized === "not_applicable") return "issued";
  if (normalized === "minting") return "minting";
  if (paymentKind.toUpperCase() === "TOKEN") return "pending";
  return "issued";
}

function mapHubBookingStatus(status: string): BookingStatus {
  const normalized = status.trim().toLowerCase();
  if (normalized === "confirmed") return "confirmed";
  if (normalized === "cancelled") return "cancelled";
  if (normalized === "pending_cancellation") return "pending_cancellation";
  return "in_progress";
}

function normalizeCancellationApprovalStatus(
  value?: string | null,
): CancellationApprovalStatus {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "PENDING") return "PENDING";
  if (normalized === "REJECTED") return "REJECTED";
  if (normalized === "APPROVED") return "APPROVED";
  return "NONE";
}

function resolveAssigneeName(deal: BookingTokenDeal): string {
  const assign = deal.assign?.trim() || deal.assignee?.trim();
  return assign || "—";
}

export function buildBookingDoneSubmitPayload(
  input: BuildBookingDoneSubmitInput,
): BookingDoneSubmitPayload | null {
  const { hubLeadId, selectedQuote } = input;
  if (!selectedQuote || selectedQuote.amount == null) return null;

  const amountReceived = parsePaymentAmountInput(
    readPaymentAmount(input.leadType, input.leadId),
  );
  if (amountReceived == null || amountReceived <= 0) return null;

  const quoteAmount = selectedQuote.amount;
  const tenPercentAmount = calculateBookingTenPercent(quoteAmount);
  const paymentKind = classifyBookingPayment(amountReceived, quoteAmount);
  if (!paymentKind) return null;

  const bookingDate = readBookingDate(input.leadType, input.leadId);
  if (!isValidBookingDateValue(bookingDate)) return null;

  return {
    hubLeadId: hubLeadId || undefined,
    quoteId: selectedQuote.quoteId,
    quoteVersionLabel: selectedQuote.label,
    quoteAmount,
    tenPercentAmount,
    amountReceived,
    paymentKind,
    bookingDate,
    quoteVerifyUrl:
      resolveQuoteVerifyUrl(selectedQuote, hubLeadId ?? "") || undefined,
  };
}

export type BookingDoneHandoffValidation = {
  ok: true;
} | {
  ok: false;
  message: string;
};

export function validateBookingDoneHandoff(
  input: BuildBookingDoneSubmitInput,
): BookingDoneHandoffValidation {
  if (!input.selectedQuote) {
    return { ok: false, message: "Select a quotation version before opening Booking & Token." };
  }
  if (input.selectedQuote.amount == null) {
    return { ok: false, message: "Selected quotation has no amount. Choose another version." };
  }
  const amountReceived = parsePaymentAmountInput(readPaymentAmount(input.leadType, input.leadId));
  if (amountReceived == null || amountReceived <= 0) {
    return { ok: false, message: "Enter the payment amount received before continuing." };
  }
  const bookingDate = readBookingDate(input.leadType, input.leadId);
  if (!isValidBookingDateValue(bookingDate)) {
    return { ok: false, message: "Select a booking date before continuing." };
  }
  return { ok: true };
}

function resolveRemainingAmount(deal: BookingTokenDeal): number {
  if (deal.remainingAmount != null && Number.isFinite(deal.remainingAmount)) {
    return Math.max(0, deal.remainingAmount);
  }
  const ten = deal.tenPercentAmount ?? 0;
  return Math.max(0, ten - deal.preBookingAmount);
}

function resolveDesignerName(deal: BookingTokenDeal): string {
  const name = readOptionalDealString(deal, "designerName", "designer_name");
  return displayDash(name);
}

function resolveBookingDate(deal: BookingTokenDeal): string | null {
  return (
    readOptionalDealString(deal, "bookingDate", "booking_date") ??
    deal.bookingDate?.trim() ??
    null
  );
}

function resolveBookingBufferFieldsFromDeal(deal: BookingTokenDeal) {
  const raw = deal as BookingTokenDeal & Record<string, unknown>;
  return resolveBookingBufferFields({
    listingType: resolveListingType(deal),
    remainingAmount: resolveRemainingAmount(deal),
    canConvertToBooking:
      readOptionalDealBoolean(raw, "canConvertToBooking", "can_convert_to_booking") ?? null,
    bookingApprovalMode:
      (raw.bookingApprovalMode ?? raw.booking_approval_mode) as string | null | undefined,
    bufferApplied: readOptionalDealBoolean(raw, "bufferApplied", "buffer_applied") ?? null,
    bufferThresholdAmount:
      readOptionalDealNumber(raw, "bufferThresholdAmount", "buffer_threshold_amount") ?? null,
    shortfallAmount: readOptionalDealNumber(raw, "shortfallAmount", "shortfall_amount") ?? null,
    financeBufferNote: readOptionalDealString(deal, "financeBufferNote", "finance_buffer_note"),
    tenPercentAmount: deal.tenPercentAmount ?? null,
    quoteAmount: deal.dealValue,
    preBookingAmount: deal.preBookingAmount,
  });
}

export function bookingTokenDealToDealRow(deal: BookingTokenDeal): DealRow {
  const paymentKind = String(deal.paymentKind ?? "").toUpperCase();
  const assetParts = [
    deal.quoteId ? `Quote ${deal.quoteId}` : null,
    deal.leadIdentifier ? deal.leadIdentifier : `Lead #${deal.leadId}`,
  ].filter(Boolean);
  const remaining = resolveRemainingAmount(deal);
  const listingType = resolveListingType(deal);
  const isCancelled = isCancelListingType(listingType) || isCancelledBookingStatus(deal.bookingStatus);
  const cancellationApprovalStatus = normalizeCancellationApprovalStatus(
    deal.cancellationApprovalStatus,
  );
  const isPendingCancellation =
    cancellationApprovalStatus === "PENDING" ||
    mapHubBookingStatus(deal.bookingStatus) === "pending_cancellation";
  const bufferFields = resolveBookingBufferFieldsFromDeal(deal);

  return {
    id: deal.id,
    leadType: deal.leadType,
    leadId: deal.leadId,
    leadIdentifier: deal.leadIdentifier,
    initials: initialsFromName(deal.customerName),
    customer: deal.customerName,
    assign: resolveAssigneeName(deal),
    designerName: resolveDesignerName(deal),
    bookingDate: resolveBookingDate(deal),
    createdAt:
      readOptionalDealString(deal, "createdAt", "created_at") ?? deal.createdAt ?? null,
    asset: assetParts.join(" · "),
    dealValue: formatQuoteAmount(deal.dealValue),
    dealValueAmount: deal.dealValue,
    preBooking: formatQuoteAmount(deal.preBookingAmount),
    paidAmount: deal.preBookingAmount,
    extraAmountReceived:
      readOptionalDealNumber(deal, "extraAmountReceived", "extra_amount_received") ?? undefined,
    totalAmountReceived:
      readOptionalDealNumber(deal, "totalAmountReceived", "total_amount_received") ?? undefined,
    tenPercentTarget: formatQuoteAmount(deal.tenPercentAmount),
    tenPercentAmount: deal.tenPercentAmount ?? Math.round(deal.dealValue * 0.1),
    remaining: formatQuoteAmount(remaining),
    remainingAmount: remaining,
    tokenStatus: mapHubTokenStatus(deal.tokenStatus, paymentKind),
    bookingStatus: mapHubBookingStatus(deal.bookingStatus),
    expClosing: formatExpClosing(deal.submittedAt),
    submittedAt: deal.submittedAt,
    isCancelled,
    listingType,
    showCancellation: resolveShowCancellationButton(
      {
        listingType,
        submittedAt:
          readOptionalDealString(deal, "createdAt", "created_at") ?? deal.submittedAt,
        bookingStatus: deal.bookingStatus,
        cancellationApprovalStatus: deal.cancellationApprovalStatus,
      },
    ),
    showPay: canShowPay(listingType, remaining) && !isPendingCancellation,
    showConvert:
      canShowConvert(listingType, remaining, bufferFields.canConvertToBooking) &&
      !isPendingCancellation,
    canConvertToBooking: bufferFields.canConvertToBooking,
    bookingApprovalMode: bufferFields.bookingApprovalMode,
    bufferThresholdAmount: bufferFields.bufferThresholdAmount,
    bufferApplied: bufferFields.bufferApplied,
    shortfallAmount: bufferFields.shortfallAmount,
    financeBufferNote: bufferFields.financeBufferNote,
    cancellationReason: deal.cancellationReason ?? null,
    cancelledAt: deal.cancelledAt ?? null,
    cancelledByName:
      readOptionalDealString(deal, "cancelledByName", "cancelled_by_name") ?? null,
    cancellationRequestedAt:
      readOptionalDealString(
        deal,
        "cancellationRequestedAt",
        "cancellation_requested_at",
      ) ?? deal.cancellationRequestedAt ?? null,
    fromBookingDone: true,
    financeReviewStatus: normalizeFinanceReviewStatus(deal.financeReviewStatus),
    financeReviewAt: deal.financeReviewAt ?? null,
    financeReviewBy: deal.financeReviewBy ?? null,
    financeRejectReason: deal.financeRejectReason ?? null,
    submittedByName: deal.submittedByName ?? null,
    submittedByRole: deal.submittedByRole ?? null,
    cancellationApprovalStatus,
    cancellationRequestedByName:
      readOptionalDealString(
        deal,
        "cancellationRequestedByName",
        "cancellation_requested_by_name",
      ) ?? deal.cancellationRequestedByName ?? null,
    cancellationApprovedByName:
      readOptionalDealString(
        deal,
        "cancellationApprovedByName",
        "cancellation_approved_by_name",
        "cancellationReviewedByName",
        "cancellation_reviewed_by_name",
        "approvedByName",
        "approved_by_name",
      ) ?? deal.cancellationApprovedByName ?? null,
    cancellationApprovedAt:
      readOptionalDealString(
        deal,
        "cancellationApprovedAt",
        "cancellation_approved_at",
        "cancellationReviewedAt",
        "cancellation_reviewed_at",
        "approvedAt",
        "approved_at",
      ) ?? deal.cancellationApprovedAt ?? null,
    cancellationRejectReason:
      readOptionalDealString(
        deal,
        "cancellationRejectReason",
        "cancellation_reject_reason",
      ) ?? deal.cancellationRejectReason ?? null,
    cancellationAttemptCount:
      readOptionalDealNumber(deal, "cancellationAttemptCount", "cancellation_attempt_count") ??
      undefined,
    cancellationLastRejectAt:
      readOptionalDealString(
        deal,
        "cancellationLastRejectAt",
        "cancellation_last_reject_at",
      ) ?? deal.cancellationLastRejectAt ?? null,
    previousListingType:
      readOptionalDealString(deal, "previousListingType", "previous_listing_type") ??
      deal.previousListingType ??
      null,
    previousMilestoneSubstage:
      readOptionalDealString(
        deal,
        "previousMilestoneSubstage",
        "previous_milestone_substage",
      ) ?? deal.previousMilestoneSubstage ?? null,
    canApproveCancellation: Boolean(deal.canApproveCancellation),
    canRestoreBookingTokenCancellation: Boolean(deal.canRestoreBookingTokenCancellation),
    canResubmitBookingTokenCancellation: Boolean(deal.canResubmitBookingTokenCancellation),
  };
}

export function bookingTokenDealToLedgerItem(deal: BookingTokenDeal): LedgerItem {
  const paymentKind = String(deal.paymentKind ?? "").toUpperCase();
  const received = formatQuoteAmount(deal.preBookingAmount);
  const remainingRaw = resolveRemainingAmount(deal);
  const kindLabel =
    paymentKind === "FULL_10%"
      ? "Full 10% booking advance"
      : paymentKind === "TOKEN"
        ? "Token amount"
        : "Pre-booking deposit";
  const remainingSuffix =
    remainingRaw > 0 ? ` · Remaining ${formatQuoteAmount(remainingRaw)}` : "";

  return {
    id: `ledger-${deal.id}-${deal.submittedAt}`,
    title: "Booking Done handoff",
    detail: `${deal.customerName} — ${received} (${kindLabel})${remainingSuffix}`,
    time: formatRelativeTime(deal.submittedAt),
    tone: paymentKind === "FULL_10%" ? "success" : "warning",
  };
}

type LedgerItemDraft = LedgerItem & { occurredAt: string };

function paymentKindLabel(kind?: string): string {
  const paymentKind = String(kind ?? "").toUpperCase();
  if (paymentKind === "FULL_10%") return "Full 10% booking advance";
  if (paymentKind === "TOKEN") return "Token amount";
  return "Pre-booking deposit";
}

function ledgerTitleForEntry(entry: PaymentHistoryEntry): string {
  const source = (entry.source ?? "").toLowerCase();
  if (source === "booking_done") return "Booking Done handoff";
  if (source === "pay_action") return "Payment recorded";
  if (source === "admin_adjustment") return "Payment adjusted";
  if (
    source === "buffer_convert" ||
    source === "convert_to_booking" ||
    source === "booking_convert"
  ) {
    return "Converted to booking (9.9% buffer)";
  }
  if (source.includes("convert")) return "Converted to booking";
  return entry.sequence <= 1 ? "Booking Done handoff" : "Payment recorded";
}

function ledgerToneForEntry(entry: PaymentHistoryEntry): LedgerItem["tone"] {
  const kind = String(entry.paymentKind ?? "").toUpperCase();
  if (kind === "FULL_10%" || entry.remainingAfter <= 0) return "success";
  if (entry.remainingAfter > 0) return "warning";
  return "info";
}

function paymentHistoryEntryToLedgerItem(
  deal: BookingTokenDeal,
  entry: PaymentHistoryEntry,
): LedgerItemDraft {
  const amount = formatQuoteAmount(entry.amount);
  const kindLabel = paymentKindLabel(entry.paymentKind);
  const remainingSuffix =
    entry.remainingAfter > 0
      ? ` · Remaining ${formatQuoteAmount(entry.remainingAfter)}`
      : "";

  return {
    id: `ledger-${deal.id}-${entry.id}-${entry.createdAt}`,
    title: ledgerTitleForEntry(entry),
    detail: `${deal.customerName} — ${amount} (${kindLabel})${remainingSuffix}`,
    time: formatRelativeTime(entry.createdAt),
    tone: ledgerToneForEntry(entry),
    occurredAt: entry.createdAt,
  };
}

function bufferConvertToLedgerItem(deal: BookingTokenDeal): LedgerItemDraft | null {
  const listingType = resolveListingType(deal);
  if (listingType !== "booking") return null;
  if (!isBufferAppliedDeal(deal)) return null;

  const remaining = resolveRemainingAmount(deal);
  const raw = deal as BookingTokenDeal & Record<string, unknown>;
  const note =
    readOptionalDealString(deal, "financeBufferNote", "finance_buffer_note") ??
    (remaining > 0
      ? `Booking via 9.9% buffer; ${formatQuoteAmount(remaining)} still pending toward 10%`
      : "Booking via 9.9% buffer");
  const occurredAt =
    readOptionalDealString(deal, "updatedAt", "updated_at") ??
    deal.submittedAt;

  return {
    id: `ledger-buffer-convert-${deal.id}-${occurredAt}`,
    title: "Converted to booking (9.9% buffer)",
    detail: `${deal.customerName} — ${note}`,
    time: formatRelativeTime(occurredAt),
    tone: "info",
    occurredAt,
  };
}

function cancellationToLedgerItem(deal: BookingTokenDeal): LedgerItemDraft | null {
  const at = deal.cancelledAt?.trim();
  if (!at || !isCancelledBookingStatus(deal.bookingStatus)) return null;
  const reason = deal.cancellationReason?.trim();
  return {
    id: `ledger-cancel-${deal.id}-${at}`,
    title: "Deal cancelled",
    detail: reason
      ? `${deal.customerName} — ${reason}`
      : `${deal.customerName} — Booking deal cancelled`,
    time: formatRelativeTime(at),
    tone: "warning",
    occurredAt: at,
  };
}

/** Flatten payment-history events across deals; newest first, capped at `limit`. */
export function buildRecentLedgerItems(
  deals: BookingTokenDeal[],
  histories: Map<string, PaymentHistoryEntry[]>,
  limit = RECENT_LEDGER_ITEM_LIMIT,
): LedgerItem[] {
  const drafts: LedgerItemDraft[] = [];

  for (const deal of deals) {
    const entries = histories.get(deal.id);
    if (entries?.length) {
      for (const entry of entries) {
        drafts.push(paymentHistoryEntryToLedgerItem(deal, entry));
      }
    } else if (deal.preBookingAmount > 0 || deal.submittedAt) {
      drafts.push({
        ...bookingTokenDealToLedgerItem(deal),
        occurredAt: deal.submittedAt,
      });
    }

    const cancelItem = cancellationToLedgerItem(deal);
    if (cancelItem) drafts.push(cancelItem);

    const bufferConvertItem = bufferConvertToLedgerItem(deal);
    if (bufferConvertItem) {
      const hasConvertHistory = entries?.some((entry) => {
        const source = (entry.source ?? "").toLowerCase();
        return source.includes("convert");
      });
      if (!hasConvertHistory) drafts.push(bufferConvertItem);
    }
  }

  return drafts
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, limit)
    .map(({ occurredAt: _occurredAt, ...item }) => item);
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Just now";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function readDraftPaymentProofCount(leadType: string, leadId: string): number {
  return readPaymentProofs(leadType, leadId).length;
}
