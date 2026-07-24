import type { PaymentHistoryResponse } from "@/lib/booking-payment-history-api";
import { bookingPaymentHistoryUpstreamUrl } from "@/lib/booking-payment-upstream";
import {
  BOOKING_BUFFER_RATE,
  calculateBufferThresholdAmount,
  defaultFinanceBufferNote,
  normalizeBookingApprovalMode,
} from "@/lib/booking-token-buffer";
import type { BookingApprovalMode } from "@/app/Components/BookingToken/types";

export const DESIGN_MODULE_URL = (
  process.env.DESIGN_MODULE_URL?.trim() || "http://localhost:3001"
).replace(/\/+$/, "");

export const HUB_SYNC_API_KEY =
  process.env.HUB_SYNC_API_KEY?.trim() ||
  process.env.EXTERNAL_LEAD_INGEST_API_KEY?.trim() ||
  "hi";

/** Hub origin for payment proof URLs (Design Module fetches proofs from here). */
export const HUB_PROOF_BASE_URL = (
  process.env.HUB_API_BASE_URL?.trim() ||
  process.env.BASE_URL?.trim() ||
  "http://localhost:8081"
).replace(/\/+$/, "");

type AuthHeaders = Record<string, string>;

function hubProofContentPath(recordId: string, proofId: string): string {
  return `/v1/booking-token/deals/${encodeURIComponent(recordId)}/payment-proofs/${encodeURIComponent(proofId)}/content`;
}

function readPaymentHistoryField<T>(
  paymentHistory: PaymentHistoryResponse,
  ...keys: string[]
): T | undefined {
  const row = paymentHistory as PaymentHistoryResponse & Record<string, unknown>;
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) return value as T;
  }
  return undefined;
}

export type FinanceSyncEligibility = {
  allowed: boolean;
  bookingApprovalMode: BookingApprovalMode;
  bufferApplied: boolean;
  bufferThresholdAmount: number;
  shortfallAmount: number;
  message?: string;
};

/** Allow Design Module sync on full 10% or 9.9% buffer (matches convert rules). */
export function resolveFinanceSyncEligibility(
  paymentHistory: PaymentHistoryResponse,
): FinanceSyncEligibility {
  const quoteAmount = Math.max(0, paymentHistory.quoteAmount ?? 0);
  const tenPercentAmount = Math.max(0, paymentHistory.tenPercentAmount ?? 0);
  const amountReceived = Math.max(0, paymentHistory.amountReceived ?? 0);
  const remainingAmount = Math.max(0, paymentHistory.remainingAmount ?? 0);
  const hubThreshold = readPaymentHistoryField<number>(
    paymentHistory,
    "bufferThresholdAmount",
    "buffer_threshold_amount",
  );
  const bufferThresholdAmount =
    hubThreshold != null && Number.isFinite(hubThreshold) && hubThreshold > 0
      ? hubThreshold
      : calculateBufferThresholdAmount(quoteAmount);

  const hubMode = normalizeBookingApprovalMode(
    readPaymentHistoryField<string>(
      paymentHistory,
      "bookingApprovalMode",
      "booking_approval_mode",
    ),
  );

  if (remainingAmount <= 0 || (tenPercentAmount > 0 && amountReceived >= tenPercentAmount)) {
    return {
      allowed: true,
      bookingApprovalMode: hubMode === "BUFFER_9_9" ? "BUFFER_9_9" : "FULL_10",
      bufferApplied: false,
      bufferThresholdAmount,
      shortfallAmount: 0,
    };
  }

  if (bufferThresholdAmount > 0 && amountReceived >= bufferThresholdAmount) {
    return {
      allowed: true,
      bookingApprovalMode: "BUFFER_9_9",
      bufferApplied: true,
      bufferThresholdAmount,
      shortfallAmount: remainingAmount,
    };
  }

  return {
    allowed: false,
    bookingApprovalMode: "PENDING",
    bufferApplied: false,
    bufferThresholdAmount,
    shortfallAmount: remainingAmount,
    message: `Paid amount must reach at least 9.9% of quote (${bufferThresholdAmount}) before finance sync.`,
  };
}

export function buildDesignModuleConvertPayload(
  paymentHistory: PaymentHistoryResponse,
  recordId: string,
  syncEligibility: FinanceSyncEligibility,
): Record<string, unknown> {
  const completionEntry =
    paymentHistory.history.find((entry) => Number(entry.remainingAfter) === 0) ??
    paymentHistory.history[paymentHistory.history.length - 1];

  const paymentHistoryPayload = paymentHistory.history.map((entry) => ({
    id: entry.id,
    sequence: entry.sequence,
    amount: entry.amount,
    extraAmount: entry.extraAmount ?? 0,
    cumulativeReceived: entry.cumulativeReceived,
    remainingAfter: entry.remainingAfter,
    paymentKind: entry.paymentKind,
    source: entry.source,
    notes: entry.notes,
    createdAt: entry.createdAt,
    financeReviewStatus: entry.financeReviewStatus,
    proofs: (entry.proofs ?? []).map((proof) => ({
      id: proof.id,
      originalFileName: proof.originalFileName,
      mimeType: proof.mimeType,
      sizeBytes: proof.sizeBytes,
      uploadedAt: proof.uploadedAt,
      contentPath:
        proof.viewUrl?.trim() ||
        hubProofContentPath(recordId, proof.id),
    })),
  }));

  const remainingAmount = Math.max(0, paymentHistory.remainingAmount ?? 0);
  const extraAmountReceived = Math.max(
    0,
    paymentHistory.extraAmountReceived ??
      readPaymentHistoryField<number>(paymentHistory, "extra_amount_received") ??
      Math.max(0, (paymentHistory.amountReceived ?? 0) - (paymentHistory.tenPercentAmount ?? 0)),
  );
  const totalAmountReceived = Math.max(
    0,
    paymentHistory.totalAmountReceived ??
      readPaymentHistoryField<number>(paymentHistory, "total_amount_received") ??
      (paymentHistory.amountReceived ?? 0),
  );
  const financeBufferNote =
    readPaymentHistoryField<string>(paymentHistory, "financeBufferNote", "finance_buffer_note") ??
    (syncEligibility.bufferApplied && remainingAmount > 0
      ? defaultFinanceBufferNote(remainingAmount, syncEligibility.bufferThresholdAmount)
      : null);

  return {
    bookingTokenRecordId: recordId,
    paymentHistoryId: completionEntry?.id ?? paymentHistory.financePaymentHistoryId ?? null,
    leadType: paymentHistory.leadType,
    leadId: paymentHistory.leadId,
    leadIdentifier: paymentHistory.leadIdentifier,
    customerName: paymentHistory.customerName,
    projectName: paymentHistory.customerName,
    /** Business booking date from Booking Done (`YYYY-MM-DD`) — for Finance / Design Module. */
    bookingDate:
      paymentHistory.bookingDate?.trim() ||
      (paymentHistory as { booking_date?: string | null }).booking_date?.trim() ||
      null,
    quoteAmount: paymentHistory.quoteAmount,
    tenPercentAmount: paymentHistory.tenPercentAmount,
    amountReceived: paymentHistory.amountReceived,
    remainingAmount,
    extraAmountReceived,
    totalAmountReceived,
    bookingApprovalMode: syncEligibility.bookingApprovalMode,
    bufferApplied: syncEligibility.bufferApplied,
    bufferThresholdAmount: syncEligibility.bufferThresholdAmount,
    bufferRate: BOOKING_BUFFER_RATE,
    shortfallAmount: syncEligibility.shortfallAmount,
    financeBufferNote,
    paymentKind:
      (paymentHistory as { paymentKind?: string }).paymentKind ??
      completionEntry?.paymentKind,
    paymentHistory: paymentHistoryPayload,
    hubProofBaseUrl: HUB_PROOF_BASE_URL,
    experience: {
      quoteId:
        (paymentHistory as { quoteId?: string | number }).quoteId ?? null,
      quoteLink:
        (paymentHistory as { quoteLink?: string }).quoteLink ??
        (paymentHistory as { quoteUrl?: string }).quoteUrl ??
        null,
      quoteVersionLabel:
        (paymentHistory as { quoteVersionLabel?: string }).quoteVersionLabel ?? null,
    },
    decision: {
      finalBudget: paymentHistory.quoteAmount ?? null,
      expectedTimeline:
        (paymentHistory as { expectedTimeline?: string }).expectedTimeline ?? null,
      decisionMaker:
        (paymentHistory as { decisionMaker?: string }).decisionMaker ?? null,
    },
    bookingDone: {
      quoteId: (paymentHistory as { quoteId?: string | number }).quoteId ?? null,
      quoteAmount: paymentHistory.quoteAmount,
      tenPercentAmount: paymentHistory.tenPercentAmount,
      amountReceived: paymentHistory.amountReceived,
      remainingAmount,
      extraAmountReceived,
      totalAmountReceived,
      bookingApprovalMode: syncEligibility.bookingApprovalMode,
      bufferApplied: syncEligibility.bufferApplied,
      bufferThresholdAmount: syncEligibility.bufferThresholdAmount,
      shortfallAmount: syncEligibility.shortfallAmount,
      bookingDate:
        paymentHistory.bookingDate?.trim() ||
        (paymentHistory as { booking_date?: string | null }).booking_date?.trim() ||
        null,
      paymentKind:
        (paymentHistory as { paymentKind?: string }).paymentKind ??
        completionEntry?.paymentKind ??
        null,
    },
  };
}

export async function fetchDealPaymentHistory(
  recordId: string,
  authHeaders: AuthHeaders,
  appOrigin?: string,
): Promise<PaymentHistoryResponse> {
  const url = appOrigin
    ? `${appOrigin.replace(/\/+$/, "")}/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/payment-history`
    : bookingPaymentHistoryUpstreamUrl(recordId);
  const res = await fetch(url, {
    headers: authHeaders,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Unable to load payment history (${res.status})${text ? `: ${text}` : ""}`);
  }
  return JSON.parse(text) as PaymentHistoryResponse;
}

export async function syncConvertBookingToDesignModule(
  recordId: string,
  authHeaders: AuthHeaders,
  appOrigin?: string,
): Promise<{ designLeadId?: number; bookingTokenRecordId?: string }> {
  const paymentHistory = await fetchDealPaymentHistory(recordId, authHeaders, appOrigin);
  if (!paymentHistory.leadType || !paymentHistory.leadId) {
    throw new Error("Payment history missing leadType or leadId.");
  }

  const syncEligibility = resolveFinanceSyncEligibility(paymentHistory);
  if (!syncEligibility.allowed) {
    throw new Error(syncEligibility.message ?? "Finance sync not allowed for this payment state.");
  }

  const payload = buildDesignModuleConvertPayload(paymentHistory, recordId, syncEligibility);
  const endpoints = [
    "/api/hub/crm-lead/convert-booking",
    "/api/hub/booking-token/finance-10p-sync",
  ];

  let lastError = "";
  for (const path of endpoints) {
    const url = `${DESIGN_MODULE_URL}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": HUB_SYNC_API_KEY,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const text = await res.text();
    if (res.ok) {
      try {
        return JSON.parse(text) as { designLeadId?: number; bookingTokenRecordId?: string };
      } catch {
        return {};
      }
    }
    lastError = `Design Module sync failed (${res.status}) via ${path}${text ? `: ${text.slice(0, 200)}` : ""}`;
    if (res.status !== 404) {
      throw new Error(lastError);
    }
  }

  throw new Error(
    `${lastError}. Restart Design Module backend (DesignModulephase1/backend npm run dev) on ${DESIGN_MODULE_URL}.`,
  );
}
