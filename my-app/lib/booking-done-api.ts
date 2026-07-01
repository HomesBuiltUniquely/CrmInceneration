import type { BookingPaymentKind } from "@/lib/booking-done-payment-rules";
import type { CrmLeadType } from "@/lib/leads-filter";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";

export type BookingDoneSubmitInput = {
  hubLeadId?: string;
  quoteId?: string;
  quoteVersionLabel?: string;
  quoteAmount: number;
  tenPercentAmount?: number | null;
  amountReceived: number;
  paymentKind: BookingPaymentKind;
  quoteVerifyUrl?: string;
};

export type BookingTokenRecord = {
  id: string;
  leadType: string;
  leadId: number;
  leadIdentifier?: string;
  customerName?: string;
  customerPhone?: string;
  hubLeadId?: string;
  quoteId?: string;
  quoteVersionLabel?: string;
  quoteAmount: number;
  tenPercentAmount?: number | null;
  amountReceived: number;
  remainingAmount?: number | null;
  paymentKind: BookingPaymentKind | string;
  quoteVerifyUrl?: string;
  tokenStatus: string;
  bookingStatus: string;
  listingType?: string;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  submittedByName?: string;
  createdAt?: string;
  updatedAt?: string;
  paymentProofCount?: number;
  financeReviewStatus?: string;
  financeReviewAt?: string | null;
  financeReviewBy?: string | null;
  financeRejectReason?: string | null;
};

export type BookingTokenDeal = {
  id: string;
  leadType: string;
  leadId: number;
  leadIdentifier?: string;
  customerName: string;
  customerPhone?: string;
  dealValue: number;
  preBookingAmount: number;
  tenPercentAmount?: number | null;
  remainingAmount?: number | null;
  paymentKind: BookingPaymentKind | string;
  tokenStatus: string;
  bookingStatus: string;
  /** Hub bucket — token | booking | cancel (prefer over client derive) */
  listingType?: string;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  quoteId?: string;
  hubLeadId?: string;
  submittedAt: string;
  paymentProofCount?: number;
  financeReviewStatus?: string;
  financeReviewAt?: string | null;
  financeReviewBy?: string | null;
  financeRejectReason?: string | null;
};

export type BookingTokenDealsResponse = {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  deals: BookingTokenDeal[];
};

function bookingDoneBffPath(leadType: CrmLeadType, leadId: string): string {
  return `/api/crm/booking-done/${encodeURIComponent(leadType)}/${encodeURIComponent(leadId)}`;
}

function parseApiError(text: string, fallback: string): string {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const msg =
      (typeof parsed.userMessage === "string" && parsed.userMessage.trim()) ||
      (typeof parsed.error === "string" && parsed.error.trim()) ||
      (typeof parsed.message === "string" && parsed.message.trim());
    const debug =
      typeof parsed.debugMessage === "string" ? parsed.debugMessage.trim() : "";
    if (msg && debug && debug !== msg) return `${msg} (${debug})`;
    if (msg) return msg;
    if (debug) return debug;
  } catch {
    /* ignore */
  }
  return fallback;
}

export async function submitBookingDone(
  leadType: CrmLeadType,
  leadId: string,
  input: BookingDoneSubmitInput,
): Promise<BookingTokenRecord> {
  const res = await fetch(bookingDoneBffPath(leadType, leadId), {
    method: "POST",
    credentials: "include",
    headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      hubLeadId: input.hubLeadId,
      quoteId: input.quoteId,
      quoteVersionLabel: input.quoteVersionLabel,
      quoteAmount: input.quoteAmount,
      tenPercentAmount: input.tenPercentAmount ?? undefined,
      amountReceived: input.amountReceived,
      paymentKind: input.paymentKind,
      quoteVerifyUrl: input.quoteVerifyUrl,
    }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, "Unable to submit Booking Done record."));
  }
  return JSON.parse(text) as BookingTokenRecord;
}

export async function fetchBookingDoneRecords(
  leadType: CrmLeadType,
  leadId: string,
): Promise<{ records: BookingTokenRecord[] }> {
  const res = await fetch(bookingDoneBffPath(leadType, leadId), {
    credentials: "include",
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, "Unable to load booking records."));
  }
  return JSON.parse(text) as { records: BookingTokenRecord[] };
}

const MAX_PAYMENT_PROOFS = 10;

export async function uploadBookingPaymentProofs(
  leadType: CrmLeadType,
  leadId: string,
  recordId: string,
  files: File[],
): Promise<{ success: boolean; uploadedCount: number }> {
  if (files.length === 0) {
    return { success: true, uploadedCount: 0 };
  }

  const batch = files.slice(0, MAX_PAYMENT_PROOFS);
  const form = new FormData();
  for (const file of batch) {
    form.append("files", file, file.name);
  }

  const res = await fetch(
    `${bookingDoneBffPath(leadType, leadId)}/${encodeURIComponent(recordId)}/payment-proofs`,
    {
      method: "POST",
      credentials: "include",
      headers: getCrmAuthHeaders(),
      body: form,
      cache: "no-store",
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, "Unable to upload payment proofs."));
  }
  const parsed = JSON.parse(text) as { uploadedCount?: number };
  return {
    success: true,
    uploadedCount: parsed.uploadedCount ?? batch.length,
  };
}

export async function fetchBookingTokenDeals(opts?: {
  page?: number;
  size?: number;
  search?: string;
  /** Hub filter: token | booking | cancel — omit for All tab (token + booking) */
  listingType?: "token" | "booking" | "cancel";
  /** ISO instant — filter by handoff / createdAt (inclusive) */
  submittedFrom?: string;
  submittedTo?: string;
}): Promise<BookingTokenDealsResponse> {
  const params = new URLSearchParams();
  params.set("page", String(opts?.page ?? 0));
  params.set("size", String(opts?.size ?? 20));
  if (opts?.search?.trim()) {
    params.set("search", opts.search.trim());
  }
  if (opts?.listingType) {
    params.set("listingType", opts.listingType);
  }
  if (opts?.submittedFrom) {
    params.set("submittedFrom", opts.submittedFrom);
  }
  if (opts?.submittedTo) {
    params.set("submittedTo", opts.submittedTo);
  }

  const res = await fetch(`/api/crm/booking-token/deals?${params.toString()}`, {
    credentials: "include",
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, "Unable to load booking deals."));
  }
  return JSON.parse(text) as BookingTokenDealsResponse;
}

export type BookingTokenCancelScope = "deal" | "payments";

export type BookingTokenCancelInput = {
  reason: string;
  scope: BookingTokenCancelScope;
  /** Required when scope is `payments` — one or more payment_history entry ids. */
  paymentHistoryEntryIds?: string[];
};

export type BookingTokenCancelResponse = {
  id: string;
  listingType?: "cancel" | "token" | "booking" | string;
  bookingStatus?: string;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  /** Partial cancel — ids that were voided */
  cancelledPaymentEntryIds?: string[];
};

export async function cancelBookingTokenDeal(
  recordId: string,
  input: BookingTokenCancelInput,
): Promise<BookingTokenCancelResponse> {
  const body: Record<string, unknown> = {
    reason: input.reason.trim(),
    scope: input.scope,
  };
  if (input.scope === "payments" && input.paymentHistoryEntryIds?.length) {
    body.paymentHistoryEntryIds = input.paymentHistoryEntryIds;
  }

  const res = await fetch(`/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/cancel`, {
    method: "POST",
    credentials: "include",
    headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, "Unable to cancel this booking deal."));
  }
  return JSON.parse(text) as BookingTokenCancelResponse;
}

export type BookingTokenConvertResponse = {
  id: string;
  listingType?: "booking" | "token" | string;
  paymentKind?: string;
  remainingAmount?: number;
  bookingStatus?: string;
  designLeadId?: number | null;
  designSyncError?: string | null;
};

export async function convertBookingTokenDeal(
  recordId: string,
): Promise<BookingTokenConvertResponse> {
  const res = await fetch(
    `/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/convert`,
    {
      method: "POST",
      credentials: "include",
      headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ confirm: true }),
      cache: "no-store",
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, "Unable to convert this deal to booking."));
  }
  const parsed = JSON.parse(text) as BookingTokenConvertResponse;
  if (parsed.designSyncError?.trim()) {
    throw new Error(
      `Booking converted in CRM, but Design Module finance sync failed: ${parsed.designSyncError.trim()}`,
    );
  }
  return parsed;
}
