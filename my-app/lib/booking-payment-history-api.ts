import type { DealRow } from "@/app/Components/BookingToken/types";
import type { FinanceReviewStatus } from "@/app/Components/BookingToken/types";
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
  financeReviewStatus?: FinanceReviewStatus | string;
  financeReviewAt?: string | null;
  financeReviewBy?: string | null;
  financeRejectReason?: string | null;
};

export type PaymentHistoryResponse = {
  recordId: string;
  leadType?: string;
  leadId?: number;
  leadIdentifier?: string;
  customerName?: string;
  assign?: string | null;
  assignee?: string | null;
  designerName?: string | null;
  bookingDate?: string | null;
  createdAt?: string | null;
  submittedAt?: string | null;
  submittedByName?: string | null;
  cancelledByName?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  cancellationRequestedByName?: string | null;
  cancellationRequestedAt?: string | null;
  cancellationApprovedByName?: string | null;
  cancellationApprovedAt?: string | null;
  quoteAmount: number;
  tenPercentAmount: number;
  amountReceived: number;
  remainingAmount: number;
  financeReviewStatus?: FinanceReviewStatus | string;
  financeReviewAt?: string | null;
  financeReviewBy?: string | null;
  financeRejectReason?: string | null;
  financePaymentHistoryId?: string | null;
  history: PaymentHistoryEntry[];
  summary?: {
    paymentCount: number;
    proofCount: number;
    lastPaymentAt?: string | null;
    financeReviewStatus?: FinanceReviewStatus | string;
    financeReviewAt?: string | null;
    financeReviewBy?: string | null;
    financeRejectReason?: string | null;
    financePaymentHistoryId?: string | null;
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
            financeReviewStatus: deal.financeReviewStatus,
            financeReviewAt: deal.financeReviewAt ?? null,
            financeReviewBy: deal.financeReviewBy ?? null,
            financeRejectReason: deal.financeRejectReason ?? null,
          },
        ]
      : [];

  return {
    recordId: deal.id,
    leadType: deal.leadType,
    leadId: deal.leadId,
    leadIdentifier: deal.leadIdentifier,
    customerName: deal.customer,
    assign: deal.assign === "—" ? null : deal.assign,
    designerName: deal.designerName === "—" ? null : deal.designerName,
    bookingDate: deal.bookingDate ?? null,
    createdAt: deal.createdAt ?? null,
    submittedAt: deal.submittedAt,
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

export async function fetchPaymentHistoryEntry(
  recordId: string,
  paymentHistoryId: string,
): Promise<PaymentHistoryEntry> {
  const params = new URLSearchParams({ paymentHistoryId });
  const res = await fetch(
    `/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/payment-history/entry?${params.toString()}`,
    {
      credentials: "include",
      headers: getCrmAuthHeaders(),
      cache: "no-store",
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, "Unable to load payment entry."));
  }
  return JSON.parse(text) as PaymentHistoryEntry;
}

export type RemoveBookingPaymentResponse = PaymentHistoryResponse & {
  listingType?: string;
  bookingStatus?: string;
  tokenStatus?: string;
  paymentKind?: string;
};

export async function removeBookingPayment(
  recordId: string,
  paymentHistoryId: string,
): Promise<RemoveBookingPaymentResponse> {
  const params = new URLSearchParams({ paymentHistoryId });
  const res = await fetch(
    `/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/payment-history/entry?${params.toString()}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: getCrmAuthHeaders(),
      cache: "no-store",
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, "Unable to remove payment."));
  }
  const parsed = JSON.parse(text) as RemoveBookingPaymentResponse;
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
  const params = new URLSearchParams({ proofId });
  return `/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/payment-proof/content?${params.toString()}`;
}

export function formatPaymentSummaryLine(label: string, amount: number): string {
  return `${label}: ${formatQuoteAmount(amount)}`;
}
