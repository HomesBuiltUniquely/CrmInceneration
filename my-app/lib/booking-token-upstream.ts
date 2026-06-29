import { BASE_URL } from "@/lib/base-url";

export function bookingTokenCancelUpstreamUrl(recordId: string): string {
  return `${BASE_URL}/api/crm/booking-token/deals/${encodeURIComponent(recordId)}/cancel`;
}
