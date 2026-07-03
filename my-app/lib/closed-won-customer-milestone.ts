import type { BookingPaymentKind } from "@/lib/booking-done-payment-rules";
import type { CrmLeadType } from "@/lib/leads-filter";
import {
  getLeadDetail,
  putHubScheduleDates,
  putLeadDetail,
} from "@/lib/lead-details-client";
import { FOLLOW_UP_DATE_CLEAR_SENTINEL } from "@/lib/lead-schedule-payload";

export const CLOSED_WON_STAGE = "Closed";
export const CLOSED_WON_CATEGORY = "Closed Won";
export const BOOKING_DONE_SUBSTAGE = "Booking Done (Booking)";
export const TOKEN_DONE_SUBSTAGE = "Token Done";

export type ClosedWonCustomerSubstage =
  | typeof BOOKING_DONE_SUBSTAGE
  | typeof TOKEN_DONE_SUBSTAGE;

export function closedWonSubstageForPaymentKind(
  paymentKind: BookingPaymentKind,
): ClosedWonCustomerSubstage {
  return paymentKind === "FULL_10%" ? BOOKING_DONE_SUBSTAGE : TOKEN_DONE_SUBSTAGE;
}

function readStageBlock(detail: Record<string, unknown>): Record<string, unknown> {
  const stage = detail.stage;
  if (stage && typeof stage === "object" && !Array.isArray(stage)) {
    return { ...(stage as Record<string, unknown>) };
  }
  return {};
}

/** Persist Closed → Closed Won → Token Done | Booking Done (Booking) after B&T handoff or convert. */
export async function persistClosedWonCustomerMilestone(
  leadType: CrmLeadType,
  leadId: string,
  substage: ClosedWonCustomerSubstage,
): Promise<void> {
  const detail = await getLeadDetail(leadType, leadId);
  const prevStage = readStageBlock(detail);

  await putLeadDetail(leadType, leadId, {
    ...detail,
    followUpDate: null,
    status: substage,
    milestoneStage: CLOSED_WON_STAGE,
    milestoneStageCategory: CLOSED_WON_CATEGORY,
    milestoneSubStage: substage,
    stage: {
      ...prevStage,
      milestoneStage: CLOSED_WON_STAGE,
      milestoneStageCategory: CLOSED_WON_CATEGORY,
      milestoneSubStage: substage,
      substage: { substage },
    },
  });

  try {
    await putHubScheduleDates(leadType, leadId, {
      followUpDate: FOLLOW_UP_DATE_CLEAR_SENTINEL,
    });
  } catch {
    /* non-blocking — milestone already saved */
  }
}

export async function persistClosedWonCustomerMilestoneFromPayment(
  leadType: CrmLeadType,
  leadId: string,
  paymentKind: BookingPaymentKind,
): Promise<ClosedWonCustomerSubstage> {
  const substage = closedWonSubstageForPaymentKind(paymentKind);
  await persistClosedWonCustomerMilestone(leadType, leadId, substage);
  return substage;
}

export async function persistClosedWonBookingDoneMilestone(
  leadType: CrmLeadType,
  leadId: string,
): Promise<void> {
  await persistClosedWonCustomerMilestone(leadType, leadId, BOOKING_DONE_SUBSTAGE);
}
