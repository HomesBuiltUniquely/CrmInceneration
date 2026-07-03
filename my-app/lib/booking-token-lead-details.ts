import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { detailJsonToLead } from "@/lib/lead-detail-mapper";
import { getLeadDetail } from "@/lib/lead-details-client";
import type { CrmLeadType } from "@/lib/leads-filter";

export type BookingLeadDetails = {
  name: string;
  pincode: string;
  assignee: string;
  designerName: string;
  email: string;
  phone: string;
};

export const EMPTY_BOOKING_LEAD_DETAILS: BookingLeadDetails = {
  name: "—",
  pincode: "—",
  assignee: "—",
  designerName: "—",
  email: "—",
  phone: "—",
};

function displayOrDash(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

export async function fetchBookingLeadDetails(input: {
  leadType: string;
  leadId: number;
  fallbackName?: string;
}): Promise<BookingLeadDetails> {
  if (!isCrmLeadType(input.leadType)) {
    return {
      ...EMPTY_BOOKING_LEAD_DETAILS,
      name: displayOrDash(input.fallbackName),
    };
  }

  try {
    const detail = await getLeadDetail(input.leadType as CrmLeadType, String(input.leadId));
    const lead = detailJsonToLead(detail, input.leadType as CrmLeadType);
    return {
      name: displayOrDash(lead.name || input.fallbackName),
      pincode: displayOrDash(lead.pincode),
      assignee: displayOrDash(lead.assignee === "—" ? "" : lead.assignee),
      designerName: displayOrDash(lead.designerName === "—" ? "" : lead.designerName),
      email: displayOrDash(lead.email),
      phone: displayOrDash(lead.phone),
    };
  } catch {
    return {
      ...EMPTY_BOOKING_LEAD_DETAILS,
      name: displayOrDash(input.fallbackName),
    };
  }
}
