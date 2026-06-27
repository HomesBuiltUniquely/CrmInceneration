import type { DealRow } from "@/app/Components/BookingToken/types";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { formatQuoteAmount } from "@/lib/crm-quote-links";

export type PaymentHistoryProof = {
  id: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes?: number;
  uploadedAt?: string;
  uploadedBy?: string;
  viewUrl?: string;
};

export type PaymentHistoryEntry = {
  id: string;
  sequence: number;
  amount: number;
  cumulativeReceived: number;
  remainingAfter: number;
  paymentKind?: string;
  source?: string;
  recordedBy?: string;
  notes?: string;
  createdAt: string;
  proofs: PaymentHistoryProof[];
};

export type PaymentHistoryResponse = {
  recordId: string;
  leadType?: string;
  leadId?: number;
  leadIdentifier?: string;
  customerName?: string;
  quoteAmount: number;
  tenPercentAmount: number;
  amountReceived: number;
  remainingAmount: number;
  history: PaymentHistoryEntry[];
  summary?: {
    paymentCount: number;
    proofCount: number;
    lastPaymentAt?: string | null;
  };
};

function parseApiError(text: string, fallback: string): string {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const msg =
      (typeof parsed.userMessage === "string" && parsed.userMessage.trim()) ||
      (typeof parsed.error === "string" && parsed.error.trim()) ||
      (typeof parsed.message === "string" && parsed.message.trim());
    if (msg) return msg;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function buildFallbackPaymentHistory(deal: DealRow): PaymentHistoryResponse {
  const paid = deal.paidAmount;
  const remaining = deal.remainingAmount;
  const history: PaymentHistoryEntry[] =
    paid > 0
      ? [
          {
            id: `${deal.id}-initial`,
            sequence: 1,
            amount: paid,
            cumulativeReceived: paid,
            remainingAfter: remaining,
            paymentKind: remaining <= 0 ? "FULL_10%" : "TOKEN",
            source: "booking_done",
            notes: "Initial payment from Booking Done handoff",
            createdAt: new Date().toISOString(),
            proofs: [],
          },
        ]
      : [];

  return {
    recordId: deal.id,
    leadType: deal.leadType,
    leadId: deal.leadId,
    leadIdentifier: deal.leadIdentifier,
    customerName: deal.customer,
    quoteAmount: deal.dealValueAmount,
    tenPercentAmount: deal.tenPercentAmount,
    amountReceived: paid,
    remainingAmount: remaining,
    history,
  };
}

export async function fetchPaymentHistory(deal: DealRow): Promise<PaymentHistoryResponse> {
  const res = await fetch(
    `/api/crm/booking-token/deals/${encodeURIComponent(deal.id)}/payment-history`,
    {
      credentials: "include",
      headers: getCrmAuthHeaders(),
      cache: "no-store",
    },
  );
  const text = await res.text();
  if (res.status === 503) {
    return buildFallbackPaymentHistory(deal);
  }
  if (!res.ok) {
    throw new Error(parseApiError(text, "Unable to load payment history."));
  }
  const parsed = JSON.parse(text) as PaymentHistoryResponse;
  return {
    ...parsed,
    history: Array.isArray(parsed.history) ? parsed.history : [],
  };
}

export type BookingPaymentSubmitResponse = PaymentHistoryEntry & {
  listingType?: string;
  paymentKind?: string;
  amountReceived?: number;
  remainingAmount?: number;
};

export async function submitBookingPayment(
  recordId: string,
  input: { amount: number; notes?: string; files: File[] },
): Promise<BookingPaymentSubmitResponse> {
  const form = new FormData();
  form.append("amount", String(input.amount));
  if (input.notes?.trim()) {
    form.append("notes", input.notes.trim());
  }
  for (const file of input.files) {
    form.append("files", file, file.name);
  }

  const res = await fetch(`/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/payments`, {
    method: "POST",
    credentials: "include",
    headers: getCrmAuthHeaders(),
    body: form,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, "Unable to record payment."));
  }
  return JSON.parse(text) as BookingPaymentSubmitResponse;
}

/** Always route proof bytes through the Next.js BFF (img tags cannot send Bearer auth to Hub). */
export function paymentProofViewUrl(recordId: string, proofId: string): string {
  return `/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/payment-proofs/${encodeURIComponent(proofId)}/content`;
}

export function formatPaymentSummaryLine(label: string, amount: number): string {
  return `${label}: ${formatQuoteAmount(amount)}`;
}
