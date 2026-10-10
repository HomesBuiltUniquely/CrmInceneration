import { BASE_URL } from "@/lib/base-url";

export function bookingPaymentHistoryUpstreamUrl(recordId: string): string {
  return `${BASE_URL}/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/payment-history`;
}

export function bookingPaymentHistoryEntryUpstreamUrl(recordId: string, paymentHistoryId: string): string {
  return `${BASE_URL}/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/payment-history/${encodeURIComponent(paymentHistoryId)}`;
}

export function bookingPaymentSubmitUpstreamUrl(recordId: string): string {
  return `${BASE_URL}/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/payments`;
}

/** Hub PATCH …/deals/{recordId}/quote — optional standalone quote rebind. */
export function bookingDealQuoteUpstreamCandidates(recordId: string): string[] {
  const id = encodeURIComponent(recordId);
  return [
    `${BASE_URL}/v1/booking-token/deals/${id}/quote`,
    `${BASE_URL}/api/crm/booking-token/deals/${id}/quote`,
  ];
}

export function bookingPaymentProofContentUpstreamUrl(recordId: string, proofId: string): string {
  return `${BASE_URL}/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/payment-proofs/${encodeURIComponent(proofId)}/content`;
}
