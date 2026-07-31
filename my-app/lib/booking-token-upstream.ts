import { BASE_URL } from "@/lib/base-url";

export function bookingTokenCancelUpstreamUrl(recordId: string): string {
  return `${BASE_URL}/v1/booking-token/deals/${encodeURIComponent(recordId)}/cancel`;
}

export function bookingTokenCancelApproveUpstreamUrl(recordId: string): string {
  return `${BASE_URL}/v1/booking-token/deals/${encodeURIComponent(recordId)}/cancel/approve`;
}

export function bookingTokenCancelRejectUpstreamUrl(recordId: string): string {
  return `${BASE_URL}/v1/booking-token/deals/${encodeURIComponent(recordId)}/cancel/reject`;
}

export function bookingTokenCancelResubmitUpstreamUrl(recordId: string): string {
  return `${BASE_URL}/v1/booking-token/deals/${encodeURIComponent(recordId)}/cancel/resubmit`;
}

export function bookingTokenConvertUpstreamCandidates(recordId: string): string[] {
  const id = encodeURIComponent(recordId);
  return [
    `${BASE_URL}/v1/booking-token/deals/${id}/convert`,
    `${BASE_URL}/api/crm/booking-token/deals/${id}/convert`,
  ];
}

export function bookingTokenConvertUpstreamUrl(recordId: string): string {
  return bookingTokenConvertUpstreamCandidates(recordId)[0];
}

export function bookingTokenDeleteForLeadUpstreamUrl(leadType: string, leadId: string): string {
  const type = encodeURIComponent(leadType);
  const id = encodeURIComponent(leadId);
  return `${BASE_URL}/v1/leads/${type}/${id}/booking-token`;
}

export function bookingTokenLeadCancellationUpstreamUrl(
  leadType: string,
  leadId: string,
): string {
  const type = encodeURIComponent(leadType);
  const id = encodeURIComponent(leadId);
  return `${BASE_URL}/v1/booking-token/leads/${type}/${id}/cancellation`;
}

export function bookingTokenLeadCancellationRestoreUpstreamUrl(
  leadType: string,
  leadId: string,
): string {
  return `${bookingTokenLeadCancellationUpstreamUrl(leadType, leadId)}/restore`;
}
