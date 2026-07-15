import type { PaymentHistoryResponse } from "@/lib/booking-payment-history-api";
import { bookingPaymentHistoryUpstreamUrl } from "@/lib/booking-payment-upstream";

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

export function buildDesignModuleConvertPayload(
  paymentHistory: PaymentHistoryResponse,
  recordId: string,
): Record<string, unknown> {
  const completionEntry =
    paymentHistory.history.find((entry) => Number(entry.remainingAfter) === 0) ??
    paymentHistory.history[paymentHistory.history.length - 1];

  const paymentHistoryPayload = paymentHistory.history.map((entry) => ({
    id: entry.id,
    sequence: entry.sequence,
    amount: entry.amount,
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

  return {
    bookingTokenRecordId: recordId,
    paymentHistoryId: completionEntry?.id ?? paymentHistory.financePaymentHistoryId ?? null,
    leadType: paymentHistory.leadType,
    leadId: paymentHistory.leadId,
    leadIdentifier: paymentHistory.leadIdentifier,
    customerName: paymentHistory.customerName,
    projectName: paymentHistory.customerName,
    quoteAmount: paymentHistory.quoteAmount,
    tenPercentAmount: paymentHistory.tenPercentAmount,
    amountReceived: paymentHistory.amountReceived,
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
  if ((paymentHistory.remainingAmount ?? 0) > 0) {
    throw new Error("Full 10% must be received before finance sync.");
  }

  const payload = buildDesignModuleConvertPayload(paymentHistory, recordId);
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
