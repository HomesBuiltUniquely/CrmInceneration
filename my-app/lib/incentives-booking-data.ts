import { fetchBookingTokenDeals, type BookingTokenDeal } from "@/lib/booking-done-api";
import type { IncentiveMemberRef } from "@/lib/incentives-profile";

export type IncentiveBookingLead = {
  id: string;
  leadType: string;
  leadId: number;
  customerName: string;
  quoteAmount: number;
  amountReceived: number;
  submittedAt: string;
  submittedByName?: string;
  submittedByUserId?: number;
  listingType?: string;
  paymentKind?: string;
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapDealToLead(deal: BookingTokenDeal): IncentiveBookingLead {
  return {
    id: deal.id,
    leadType: deal.leadType,
    leadId: deal.leadId,
    customerName: deal.customerName,
    quoteAmount: deal.dealValue,
    amountReceived: deal.preBookingAmount,
    submittedAt: deal.submittedAt,
    submittedByName: deal.submittedByName,
    submittedByUserId: deal.submittedByUserId,
    listingType: deal.listingType,
    paymentKind: String(deal.paymentKind ?? ""),
  };
}

export async function fetchIncentiveBookingLeads(): Promise<IncentiveBookingLead[]> {
  const response = await fetchBookingTokenDeals({ page: 0, size: 500 });
  return response.deals
    .filter((deal) => {
      const listing = String(deal.listingType ?? "").toLowerCase();
      const status = String(deal.bookingStatus ?? "").toLowerCase();
      return listing !== "cancel" && status !== "cancelled";
    })
    .map(mapDealToLead);
}

/** Keep leads whose booking-done handoff falls in `YYYY-MM`. */
export function filterIncentiveLeadsForMonth(
  leads: IncentiveBookingLead[],
  monthKey: string,
): IncentiveBookingLead[] {
  return leads.filter((lead) => lead.submittedAt.slice(0, 7) === monthKey);
}

export function filterIncentiveLeadsForExecutive(
  leads: IncentiveBookingLead[],
  member: IncentiveMemberRef,
): IncentiveBookingLead[] {
  const memberName = normalizeName(member.name);
  return leads.filter((lead) => {
    if (lead.submittedByUserId != null && lead.submittedByUserId === member.id) {
      return true;
    }
    if (lead.submittedByName && normalizeName(lead.submittedByName) === memberName) {
      return true;
    }
    return false;
  });
}
