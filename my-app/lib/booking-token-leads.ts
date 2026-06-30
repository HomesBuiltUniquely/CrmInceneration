import {
  classifyBookingPayment,
  calculateBookingTenPercent,
  type BookingPaymentKind,
} from "@/lib/booking-done-payment-rules";
import {
  parsePaymentAmountInput,
  readPaymentAmount,
  readPaymentProofs,
} from "@/lib/booking-done-payment-storage";
import { formatQuoteAmount, resolveQuoteVerifyUrl, type LeadQuoteOption } from "@/lib/crm-quote-links";
import {
  canShowCancellation,
  canShowConvert,
  canShowPay,
  isCancelListingType,
  resolveListingType,
} from "@/lib/booking-token-listing-type";
import { isCancelledBookingStatus } from "@/lib/booking-token-cancellation";
import { normalizeFinanceReviewStatus } from "@/lib/booking-token-finance-status";
import type { BookingTokenDeal } from "@/lib/booking-done-api";
import type { PaymentHistoryEntry } from "@/lib/booking-payment-history-api";
import type { BookingStatus, DealRow, LedgerItem, TokenStatus } from "@/app/Components/BookingToken/types";

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
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "LD";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
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
  return "in_progress";
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

  return {
    hubLeadId: hubLeadId || undefined,
    quoteId: selectedQuote.quoteId,
    quoteVersionLabel: selectedQuote.label,
    quoteAmount,
    tenPercentAmount,
    amountReceived,
    paymentKind,
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
  return { ok: true };
}

function resolveRemainingAmount(deal: BookingTokenDeal): number {
  if (deal.remainingAmount != null && Number.isFinite(deal.remainingAmount)) {
    return Math.max(0, deal.remainingAmount);
  }
  const ten = deal.tenPercentAmount ?? 0;
  return Math.max(0, ten - deal.preBookingAmount);
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

  return {
    id: deal.id,
    leadType: deal.leadType,
    leadId: deal.leadId,
    leadIdentifier: deal.leadIdentifier,
    initials: initialsFromName(deal.customerName),
    customer: deal.customerName,
    asset: assetParts.join(" · "),
    dealValue: formatQuoteAmount(deal.dealValue),
    dealValueAmount: deal.dealValue,
    preBooking: formatQuoteAmount(deal.preBookingAmount),
    paidAmount: deal.preBookingAmount,
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
    showCancellation: canShowCancellation(listingType, deal.submittedAt),
    showPay: canShowPay(listingType, remaining),
    showConvert: canShowConvert(listingType, remaining),
    cancellationReason: deal.cancellationReason ?? null,
    cancelledAt: deal.cancelledAt ?? null,
    fromBookingDone: true,
    financeReviewStatus: normalizeFinanceReviewStatus(deal.financeReviewStatus),
    financeReviewAt: deal.financeReviewAt ?? null,
    financeReviewBy: deal.financeReviewBy ?? null,
    financeRejectReason: deal.financeRejectReason ?? null,
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
