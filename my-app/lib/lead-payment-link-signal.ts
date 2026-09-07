import type { ActivityItem } from "@/lib/data";
import {
  attemptHasPaymentFailures,
  attemptPaymentFailureCount,
  isBannerPaymentLink,
  type PaymentLinkAttempt,
} from "@/lib/booking-payment-link-api";
import { isOnlinePaymentReceivedActivity } from "@/lib/payment-received-motivate";

export type LeadPaymentLinkSignalKind = "pending" | "pending_failed" | "success";

export type LeadPaymentLinkSignal = {
  kind: LeadPaymentLinkSignalKind;
  failureCount?: number;
};

function hasPaidOnlineActivity(activities?: ActivityItem[] | null): boolean {
  return (activities ?? []).some((activity) =>
    isOnlinePaymentReceivedActivity(
      activity.rawActivityType,
      activity.description,
      activity.note,
    ),
  );
}

/** pending+failures > pending > success. Hide when none apply. */
export function resolveLeadPaymentLinkSignal(args: {
  attempt?: PaymentLinkAttempt | null;
  activities?: ActivityItem[] | null;
  hasEasebuzzHistory?: boolean;
  successFlag?: boolean;
}): LeadPaymentLinkSignal | null {
  const attempt = isBannerPaymentLink(args.attempt) ? args.attempt ?? null : null;
  if (attempt) {
    if (attemptHasPaymentFailures(attempt)) {
      return {
        kind: "pending_failed",
        failureCount: Math.max(1, attemptPaymentFailureCount(attempt)),
      };
    }
    return { kind: "pending" };
  }

  if (args.successFlag || args.hasEasebuzzHistory || hasPaidOnlineActivity(args.activities)) {
    return { kind: "success" };
  }

  return null;
}
