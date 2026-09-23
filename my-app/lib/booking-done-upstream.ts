import { BASE_URL } from "@/lib/base-url";
import { crmLeadTypeToFloorPlanLeadType } from "@/lib/floor-plan";
import type { CrmLeadType } from "@/lib/leads-filter";

/** Hub booking-done paths (tried in order until one responds without NoResourceFound). */
export function bookingDoneUpstreamCandidates(
  leadType: CrmLeadType,
  leadId: string,
  recordId?: string,
): string[] {
  const id = encodeURIComponent(leadId);
  const suffix = recordId
    ? `/booking-done/${encodeURIComponent(recordId)}/payment-proofs`
    : "/booking-done";
  const short = crmLeadTypeToFloorPlanLeadType(leadType);
  const paths = [
    `${BASE_URL}/api/crm/lead/${leadType}/${id}${suffix}`,
    `${BASE_URL}/v1/leads/${leadType}/${id}${suffix}`,
    `${BASE_URL}/v1/leads/${short}/${id}${suffix}`,
  ];
  return [...new Set(paths)];
}

/** Hub PATCH …/booking-done/recognition (old-lead token / 10% date backfill). */
export function bookingDoneRecognitionUpstreamCandidates(
  leadType: CrmLeadType,
  leadId: string,
): string[] {
  const id = encodeURIComponent(leadId);
  const short = crmLeadTypeToFloorPlanLeadType(leadType);
  const paths = [
    `${BASE_URL}/v1/leads/${leadType}/${id}/booking-done/recognition`,
    `${BASE_URL}/api/crm/lead/${leadType}/${id}/booking-done/recognition`,
    `${BASE_URL}/v1/leads/${short}/${id}/booking-done/recognition`,
  ];
  return [...new Set(paths)];
}

export function bookingTokenDealRecognitionUpstreamUrl(recordId: string): string {
  return `${BASE_URL}/v1/booking-token/deals/${encodeURIComponent(recordId)}/recognition`;
}

export const BOOKING_DONE_NOT_DEPLOYED_MESSAGE =
  "Booking Done API is not available on the Hub server yet. Backend must deploy BookingDoneController and run the booking_token_record migration on hows.hubinterior.com.";

export function isBookingDoneNotDeployedResponse(text: string): boolean {
  const haystack = text.toLowerCase();
  return (
    haystack.includes("noresourcefoundexception") ||
    haystack.includes("no static resource") ||
    haystack.includes("cannot post /v1/leads/") ||
    haystack.includes("cannot patch /v1/leads/")
  );
}
