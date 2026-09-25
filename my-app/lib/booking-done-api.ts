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
  /** Calendar day of booking (`YYYY-MM-DD`). */
  bookingDate?: string;
  paymentChannel?: string;
  paymentMethod?: string;
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
  /** Calendar booking date (`YYYY-MM-DD`). */
  bookingDate?: string;
  /** Old-lead recognition backfill (YYYY-MM-DD). Hub resolves listing dates — do not recompute on FE. */
  tokenTakenDate?: string | null;
  tokenPaidDate?: string | null;
  tokenAmountPaid?: number | null;
  bookingDoneDate?: string | null;
  tenPercentPaidDate?: string | null;
  tokenRecognitionDate?: string | null;
  bookingRecognitionDate?: string | null;
  listingDate?: string | null;
  dateSource?: string | null;
  financeReviewStatus?: string;
  financeReviewAt?: string | null;
  financeReviewBy?: string | null;
  financeRejectReason?: string | null;
};

/** Optional old-lead token / 10% recognition backfill (Hub applies; FE does not recompute). */
export type BookingTokenRecognitionInput = {
  tokenTakenDate?: string;
  tokenPaidDate?: string;
  tokenAmountPaid?: number;
  quoteAmount?: number;
  tenPercentAmount?: number;
  amountReceived?: number;
  bookingDoneDate?: string;
  tenPercentPaidDate?: string;
  listingType?: "token" | "booking";
  bookingDate?: string;
};

export type BookingTokenRecognitionResponse = BookingTokenRecord & {
  success?: boolean;
  created?: boolean;
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
  /** Calendar booking date (`YYYY-MM-DD`). */
  bookingDate?: string;
  createdAt?: string;
  designerName?: string | null;
  cancelledByName?: string | null;
  cancellationRequestedAt?: string | null;
  /** Live CRM lead assignee */
  assign?: string | null;
  assignee?: string | null;
  submittedByName?: string | null;
  submittedByRole?: string | null;
  submittedByUserId?: number;
  extraAmountReceived?: number | null;
  totalAmountReceived?: number | null;
  cancellationApprovalStatus?: string | null;
  cancellationRequestedByName?: string | null;
  cancellationApprovedByName?: string | null;
  cancellationApprovedAt?: string | null;
  cancellationRejectReason?: string | null;
  cancellationReviewedAt?: string | null;
  cancellationReviewedByName?: string | null;
  cancellationAttemptCount?: number | null;
  cancellationLastRejectAt?: string | null;
  previousListingType?: string | null;
  previousMilestoneSubstage?: string | null;
  cancellationPayload?: string | null;
  canApproveCancellation?: boolean;
  canRestoreBookingTokenCancellation?: boolean;
  canResubmitBookingTokenCancellation?: boolean;
  paymentProofCount?: number;
  financeReviewStatus?: string;
  financeReviewAt?: string | null;
  financeReviewBy?: string | null;
  financeRejectReason?: string | null;
  /** 9.9% of quote — minimum cumulative paid to convert. */
  bufferThresholdAmount?: number | null;
  bookingApprovalMode?: "FULL_10" | "BUFFER_9_9" | "PENDING" | string | null;
  bufferApplied?: boolean | null;
  shortfallAmount?: number | null;
  canConvertToBooking?: boolean | null;
  financeBufferNote?: string | null;
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
      bookingDate: input.bookingDate,
      paymentChannel: input.paymentChannel,
      paymentMethod: input.paymentMethod,
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

function recognitionBffPath(leadType: CrmLeadType, leadId: string): string {
  return `${bookingDoneBffPath(leadType, leadId)}/recognition`;
}

/** Strip empty strings / NaN so Hub only receives sent keys (partial apply). */
export function buildBookingTokenRecognitionPayload(
  input: BookingTokenRecognitionInput,
): Record<string, string | number> {
  const body: Record<string, string | number> = {};
  const putDate = (key: keyof BookingTokenRecognitionInput, value: string | undefined) => {
    const v = value?.trim() ?? "";
    if (v) body[key] = v;
  };
  const putNum = (key: keyof BookingTokenRecognitionInput, value: number | undefined) => {
    if (value == null || Number.isNaN(value)) return;
    body[key] = value;
  };
  putDate("tokenTakenDate", input.tokenTakenDate);
  putDate("tokenPaidDate", input.tokenPaidDate);
  putNum("tokenAmountPaid", input.tokenAmountPaid);
  putNum("quoteAmount", input.quoteAmount);
  putNum("tenPercentAmount", input.tenPercentAmount);
  putNum("amountReceived", input.amountReceived);
  putDate("bookingDoneDate", input.bookingDoneDate);
  putDate("tenPercentPaidDate", input.tenPercentPaidDate);
  putDate("bookingDate", input.bookingDate);
  if (input.listingType === "token" || input.listingType === "booking") {
    body.listingType = input.listingType;
  }
  return body;
}

/**
 * PATCH recognition dates/amounts for an old lead.
 * Hub creates a Booking & Token deal if none exists. Do not recompute dates/money on FE.
 */
export async function saveBookingTokenRecognition(
  leadType: CrmLeadType,
  leadId: string,
  input: BookingTokenRecognitionInput,
): Promise<BookingTokenRecognitionResponse> {
  const body = buildBookingTokenRecognitionPayload(input);
  const res = await fetch(recognitionBffPath(leadType, leadId), {
    method: "PATCH",
    credentials: "include",
    headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      parseApiError(text, "Unable to save token/booking recognition dates."),
    );
  }
  return JSON.parse(text) as BookingTokenRecognitionResponse;
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
  /** Preset: previous_month | 3m | 6m | 1y */
  dateRange?: string;
  /** ISO instant — filter by handoff / createdAt (inclusive); custom range wins over dateRange */
  submittedFrom?: string;
  submittedTo?: string;
  submittedByRole?: string;
  assignee?: string;
  /** Manager + all SEs under them (active and inactive). Hub expands — do not FE-expand. */
  salesManagerId?: number;
  cancellationStatus?: string;
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
  if (opts?.dateRange) {
    params.set("dateRange", opts.dateRange);
  }
  if (opts?.submittedFrom) {
    params.set("submittedFrom", opts.submittedFrom);
  }
  if (opts?.submittedTo) {
    params.set("submittedTo", opts.submittedTo);
  }
  if (opts?.submittedByRole) {
    params.set("submittedByRole", opts.submittedByRole);
  }
  if (opts?.assignee?.trim()) {
    params.set("assignee", opts.assignee.trim());
  }
  if (opts?.salesManagerId != null && opts.salesManagerId > 0) {
    params.set("salesManagerId", String(opts.salesManagerId));
  }
  if (opts?.cancellationStatus) {
    params.set("cancellationStatus", opts.cancellationStatus);
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

export type BookingTokenGlobalSearchResponse = {
  q: string;
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  scope?: string;
  matchFields?: string[];
  deals: BookingTokenDeal[];
  salesManagerId?: number | null;
};

/** Cross-tab search: token + booking + cancel (name / phone / lead id / Easebuzz txn). */
export async function fetchBookingTokenGlobalSearch(opts: {
  q: string;
  page?: number;
  size?: number;
}): Promise<BookingTokenGlobalSearchResponse> {
  const q = opts.q.trim();
  if (q.length < 2) {
    throw new Error("Enter at least 2 characters to search.");
  }
  const params = new URLSearchParams();
  params.set("q", q);
  params.set("page", String(opts.page ?? 0));
  params.set("size", String(opts.size ?? 20));

  const res = await fetch(`/api/crm/booking-token/deals/search?${params.toString()}`, {
    credentials: "include",
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, "Unable to run global search."));
  }
  return JSON.parse(text) as BookingTokenGlobalSearchResponse;
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
  /** Hub lead sync — use for immediate UI refresh after cancel */
  leadType?: string | null;
  leadId?: number | null;
  milestoneStage?: string | null;
  milestoneStageCategory?: string | null;
  milestoneSubStage?: string | null;
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
  financeHandlingMode?: string | null;
  financeSection?: string | null;
  projectStage?: string | null;
  approvedBy?: string | null;
  bookingApprovalMode?: "FULL_10" | "BUFFER_9_9" | "PENDING" | string;
  bufferApplied?: boolean;
  financeBufferNote?: string | null;
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

export type BookingTokenCancelApprovalResponse = {
  id: string;
  listingType?: string;
  bookingStatus?: string;
  cancellationApprovalStatus?: string;
  refundId?: string | null;
  refundAmount?: number | null;
  designLeadId?: number | null;
  designSyncError?: string | null;
};

export async function approveBookingTokenCancellation(
  recordId: string,
): Promise<BookingTokenCancelApprovalResponse> {
  const res = await fetch(
    `/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/cancel/approve`,
    {
      method: "POST",
      credentials: "include",
      headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
      body: "{}",
      cache: "no-store",
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, "Unable to approve cancellation."));
  }
  const parsed = JSON.parse(text) as BookingTokenCancelApprovalResponse;
  if (parsed.designSyncError?.trim()) {
    throw new Error(
      `Cancellation approved in CRM, but Design Module refund sync failed: ${parsed.designSyncError.trim()}`,
    );
  }
  return parsed;
}

export async function rejectBookingTokenCancellation(
  recordId: string,
  reason: string,
): Promise<BookingTokenCancelApprovalResponse> {
  const res = await fetch(
    `/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/cancel/reject`,
    {
      method: "POST",
      credentials: "include",
      headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ reason: reason.trim() }),
      cache: "no-store",
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, "Unable to reject cancellation."));
  }
  return JSON.parse(text) as BookingTokenCancelApprovalResponse;
}

export async function resubmitBookingTokenCancellation(
  recordId: string,
): Promise<BookingTokenCancelApprovalResponse> {
  const res = await fetch(
    `/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/cancel/resubmit`,
    {
      method: "POST",
      credentials: "include",
      headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
      body: "{}",
      cache: "no-store",
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(text, "Unable to resubmit cancellation."));
  }
  return JSON.parse(text) as BookingTokenCancelApprovalResponse;
}
