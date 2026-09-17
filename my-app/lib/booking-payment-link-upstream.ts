import { BASE_URL } from "@/lib/base-url";
import { crmLeadTypeToFloorPlanLeadType } from "@/lib/floor-plan";
import type { CrmLeadType } from "@/lib/leads-filter";

export type PaymentLinkAction = "copy" | "resend" | "edit" | "switch-offline" | "cancel" | "delete";

export function leadPaymentLinksUpstreamCandidates(
  leadType: CrmLeadType,
  leadId: string,
): string[] {
  const type = encodeURIComponent(leadType);
  const id = encodeURIComponent(leadId);
  const short = encodeURIComponent(crmLeadTypeToFloorPlanLeadType(leadType));
  return [
    ...new Set([
      `${BASE_URL}/v1/leads/${type}/${id}/payment-links`,
      `${BASE_URL}/api/crm/lead/${type}/${id}/payment-links`,
      `${BASE_URL}/v1/leads/${short}/${id}/payment-links`,
    ]),
  ];
}

export function leadPaymentLinksActiveUpstreamCandidates(
  leadType: CrmLeadType,
  leadId: string,
): string[] {
  return leadPaymentLinksUpstreamCandidates(leadType, leadId).map((url) => `${url}/active`);
}

export function dealPaymentLinksUpstreamCandidates(recordId: string): string[] {
  const id = encodeURIComponent(recordId);
  return [
    `${BASE_URL}/v1/booking-token/deals/${id}/payment-links`,
    `${BASE_URL}/api/crm/booking-token/deals/${id}/payment-links`,
  ];
}

export function dealPaymentLinksActiveUpstreamCandidates(recordId: string): string[] {
  return dealPaymentLinksUpstreamCandidates(recordId).map((url) => `${url}/active`);
}

export function paymentLinkActionUpstreamCandidates(
  attemptId: string,
  action: PaymentLinkAction,
): string[] {
  const id = encodeURIComponent(attemptId);
  return [
    `${BASE_URL}/v1/booking-token/payment-links/${id}/${action}`,
    `${BASE_URL}/api/crm/booking-token/payment-links/${id}/${action}`,
    `${BASE_URL}/v1/leads/payment-links/${id}/${action}`,
    `${BASE_URL}/api/crm/lead/payment-links/${id}/${action}`,
  ];
}
