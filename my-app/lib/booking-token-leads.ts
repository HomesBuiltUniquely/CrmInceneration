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
import type { BookingStatus, DealRow, LedgerItem, TokenStatus } from "@/app/Components/BookingToken/types";

export type BookingTokenLeadRecord = {
  id: string;
  crmLeadType: string;
  crmLeadId: string;
  businessLeadId?: string;
  hubLeadId?: string;
  customerName: string;
  quoteId?: string;
  quoteVersionLabel?: string;
  quoteAmount: number | null;
  quoteVerifyUrl?: string;
  tenPercentAmount: number | null;
  amountReceived: number | null;
  paymentKind: BookingPaymentKind | null;
  paymentProofCount: number;
  tokenStatus: TokenStatus;
  bookingStatus: BookingStatus;
  submittedAt: string;
  source: "booking-done";
  showConvert?: boolean;
};

const STORAGE_KEY = "booking-token-leads:v1";

function bookingTokenLeadId(leadType: string, leadId: string): string {
  return `${leadType}-${leadId}`;
}

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

function tokenStatusForPayment(kind: BookingPaymentKind | null): TokenStatus {
  if (kind === "FULL_10%") return "issued";
  if (kind === "TOKEN") return "pending";
  return "minting";
}

function bookingStatusForPayment(kind: BookingPaymentKind | null): BookingStatus {
  if (kind === "FULL_10%") return "confirmed";
  return "in_progress";
}

export function readBookingTokenLeads(): BookingTokenLeadRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is BookingTokenLeadRecord =>
        Boolean(row) &&
        typeof row === "object" &&
        typeof (row as BookingTokenLeadRecord).id === "string" &&
        typeof (row as BookingTokenLeadRecord).crmLeadId === "string",
    );
  } catch {
    return [];
  }
}

export function writeBookingTokenLeads(leads: BookingTokenLeadRecord[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

export function upsertBookingTokenLead(record: BookingTokenLeadRecord): BookingTokenLeadRecord {
  const existing = readBookingTokenLeads();
  const next = [record, ...existing.filter((row) => row.id !== record.id)];
  writeBookingTokenLeads(next);
  return record;
}

export type BuildBookingTokenLeadInput = {
  leadType: string;
  leadId: string;
  customerName: string;
  businessLeadId?: string;
  hubLeadId?: string;
  selectedQuote: LeadQuoteOption | null;
};

export function buildBookingTokenLeadFromBookingDone(
  input: BuildBookingTokenLeadInput,
): BookingTokenLeadRecord {
  const { leadType, leadId, customerName, businessLeadId, hubLeadId, selectedQuote } = input;
  const amountRaw = readPaymentAmount(leadType, leadId);
  const amountReceived = parsePaymentAmountInput(amountRaw);
  const quoteAmount = selectedQuote?.amount ?? null;
  const tenPercentAmount = calculateBookingTenPercent(quoteAmount);
  const paymentKind = classifyBookingPayment(amountReceived, quoteAmount);
  const paymentProofCount = readPaymentProofs(leadType, leadId).length;
  const submittedAt = new Date().toISOString();

  return {
    id: bookingTokenLeadId(leadType, leadId),
    crmLeadType: leadType,
    crmLeadId: leadId,
    businessLeadId,
    hubLeadId,
    customerName: customerName.trim() || `Lead #${leadId}`,
    quoteId: selectedQuote?.quoteId,
    quoteVersionLabel: selectedQuote?.label,
    quoteAmount,
    quoteVerifyUrl: selectedQuote
      ? resolveQuoteVerifyUrl(selectedQuote, hubLeadId ?? "") || undefined
      : undefined,
    tenPercentAmount,
    amountReceived,
    paymentKind,
    paymentProofCount,
    tokenStatus: tokenStatusForPayment(paymentKind),
    bookingStatus: bookingStatusForPayment(paymentKind),
    submittedAt,
    source: "booking-done",
    showConvert: paymentKind === "TOKEN",
  };
}

export type BookingDoneHandoffValidation = {
  ok: true;
} | {
  ok: false;
  message: string;
};

export function validateBookingDoneHandoff(
  input: BuildBookingTokenLeadInput,
): BookingDoneHandoffValidation {
  if (!input.selectedQuote) {
    return { ok: false, message: "Select a quotation version before opening Booking & Token." };
  }
  const amountReceived = parsePaymentAmountInput(readPaymentAmount(input.leadType, input.leadId));
  if (amountReceived == null || amountReceived <= 0) {
    return { ok: false, message: "Enter the payment amount received before continuing." };
  }
  return { ok: true };
}

export function bookingTokenLeadToDealRow(record: BookingTokenLeadRecord): DealRow {
  const assetParts = [
    record.quoteVersionLabel,
    record.quoteId ? `Quote ${record.quoteId}` : null,
    `Lead #${record.crmLeadId}`,
  ].filter(Boolean);

  return {
    id: record.id,
    initials: initialsFromName(record.customerName),
    customer: record.customerName,
    asset: assetParts.join(" · "),
    dealValue: formatQuoteAmount(record.quoteAmount),
    preBooking: formatQuoteAmount(record.amountReceived),
    tokenStatus: record.tokenStatus,
    bookingStatus: record.bookingStatus,
    expClosing: formatExpClosing(record.submittedAt),
    showConvert: record.showConvert,
    fromBookingDone: true,
  };
}

export function bookingTokenLeadToLedgerItem(record: BookingTokenLeadRecord): LedgerItem {
  const received = formatQuoteAmount(record.amountReceived);
  const kindLabel =
    record.paymentKind === "FULL_10%"
      ? "Full 10% booking advance"
      : record.paymentKind === "TOKEN"
        ? "Token amount"
        : "Pre-booking deposit";

  return {
    id: `ledger-${record.id}-${record.submittedAt}`,
    title: "Booking Done handoff",
    detail: `${record.customerName} — ${received} (${kindLabel})`,
    time: formatRelativeTime(record.submittedAt),
    tone: record.paymentKind === "FULL_10%" ? "success" : "warning",
  };
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

export function findBookingTokenLead(id: string): BookingTokenLeadRecord | null {
  return readBookingTokenLeads().find((row) => row.id === id) ?? null;
}
