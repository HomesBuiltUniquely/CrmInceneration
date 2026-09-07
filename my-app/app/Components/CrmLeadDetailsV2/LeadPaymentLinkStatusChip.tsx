"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActivityItem } from "@/lib/data";
import {
  PAYMENT_LINK_STATE_EVENT,
  isBannerPaymentLink,
  readCachedPaymentLinkAttempt,
  readPaymentLinkOnlineSuccess,
  type PaymentLinkAttempt,
} from "@/lib/booking-payment-link-api";
import {
  resolveLeadPaymentLinkSignal,
  type LeadPaymentLinkSignal,
} from "@/lib/lead-payment-link-signal";

type Props = {
  leadType: string;
  leadId: string;
  activities?: ActivityItem[] | null;
  hasEasebuzzHistory?: boolean;
  /** Token Pay panel: banner already shows pending/fail — only keep the success pill. */
  successOnly?: boolean;
};

export function PaymentLinkStatusChipView({ signal }: { signal: LeadPaymentLinkSignal }) {
  if (signal.kind === "pending_failed") {
    const n = signal.failureCount ?? 1;
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
        Payment attempts failed {n}× · link open
      </span>
    );
  }

  if (signal.kind === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
        Payment link pending
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
      Online payment successful
    </span>
  );
}

export default function LeadPaymentLinkStatusChip({
  leadType,
  leadId,
  activities,
  hasEasebuzzHistory = false,
  successOnly = false,
}: Props) {
  const [attempt, setAttempt] = useState<PaymentLinkAttempt | null>(() =>
    readCachedPaymentLinkAttempt(leadType, leadId),
  );
  const [successFlag, setSuccessFlag] = useState(() =>
    readPaymentLinkOnlineSuccess(leadType, leadId),
  );

  useEffect(() => {
    setAttempt(readCachedPaymentLinkAttempt(leadType, leadId));
    setSuccessFlag(readPaymentLinkOnlineSuccess(leadType, leadId));
  }, [leadId, leadType]);

  useEffect(() => {
    const onState = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          leadType?: string;
          leadId?: string;
          attempt?: PaymentLinkAttempt | null;
        }>
      ).detail;
      if (detail?.leadType !== leadType || detail?.leadId !== leadId) return;
      setAttempt(isBannerPaymentLink(detail.attempt) ? detail.attempt ?? null : null);
      setSuccessFlag(readPaymentLinkOnlineSuccess(leadType, leadId));
    };
    window.addEventListener(PAYMENT_LINK_STATE_EVENT, onState);
    return () => window.removeEventListener(PAYMENT_LINK_STATE_EVENT, onState);
  }, [leadId, leadType]);

  const signal = useMemo(
    () =>
      resolveLeadPaymentLinkSignal({
        attempt,
        activities,
        hasEasebuzzHistory,
        successFlag,
      }),
    [activities, attempt, hasEasebuzzHistory, successFlag],
  );

  if (!signal) return null;
  if (successOnly && signal.kind !== "success") return null;

  return <PaymentLinkStatusChipView signal={signal} />;
}
