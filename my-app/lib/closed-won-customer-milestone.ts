import type { BookingPaymentKind } from "@/lib/booking-done-payment-rules";
import type { CrmLeadType } from "@/lib/leads-filter";
import {
  getLeadDetail,
  putHubScheduleDates,
  putLeadDetail,
} from "@/lib/lead-details-client";
import { FOLLOW_UP_DATE_CLEAR_SENTINEL } from "@/lib/lead-schedule-payload";

export const DECISION_STAGE = "Decision";
export const DECISION_WON_CATEGORY = "Decision Won";
export const BOOKING_TOKEN_PENDING_SUBSTAGE = "Booking/Token Pending";

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

/** Persist Decision → Decision Won → Booking/Token Pending when an online payment link is created. */
export async function persistBookingTokenPendingMilestone(
  leadType: CrmLeadType,
  leadId: string,
): Promise<void> {
  const detail = await getLeadDetail(leadType, leadId);
  const prevStage = readStageBlock(detail);

  await putLeadDetail(leadType, leadId, {
    ...detail,
    status: BOOKING_TOKEN_PENDING_SUBSTAGE,
    milestoneStage: DECISION_STAGE,
    milestoneStageCategory: DECISION_WON_CATEGORY,
    milestoneSubStage: BOOKING_TOKEN_PENDING_SUBSTAGE,
    stage: {
      ...prevStage,
      milestoneStage: DECISION_STAGE,
      milestoneStageCategory: DECISION_WON_CATEGORY,
      milestoneSubStage: BOOKING_TOKEN_PENDING_SUBSTAGE,
      substage: { substage: BOOKING_TOKEN_PENDING_SUBSTAGE },
    },
  });
}

/** Persist Decision → Decision Won stage when Mark As Won is clicked. */
export async function persistDecisionWonStage(
  leadType: CrmLeadType,
  leadId: string,
): Promise<void> {
  const detail = await getLeadDetail(leadType, leadId);
  const prevStage = readStageBlock(detail);

  await putLeadDetail(leadType, leadId, {
    ...detail,
    milestoneStage: DECISION_STAGE,
    milestoneStageCategory: DECISION_WON_CATEGORY,
    stage: {
      ...prevStage,
      milestoneStage: DECISION_STAGE,
      milestoneStageCategory: DECISION_WON_CATEGORY,
    },
  });
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
