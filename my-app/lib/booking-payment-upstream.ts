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

export function bookingPaymentProofContentUpstreamUrl(recordId: string, proofId: string): string {
  return `${BASE_URL}/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/payment-proofs/${encodeURIComponent(proofId)}/content`;
}
