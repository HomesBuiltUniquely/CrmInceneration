"use client";

import { useCallback, useEffect, useState } from "react";
import PaymentLinkPendingBanner from "@/app/Components/BookingToken/components/PaymentLinkPendingBanner";
import {
  PAYMENT_LINK_POLL_MS,
  PAYMENT_LINK_UPDATED_EVENT,
  cancelPaymentLink,
  copyPaymentLinkToClipboard,
  editPaymentLinkAmount,
  fetchLeadPaymentLinkActive,
  isBannerPaymentLink,
  isStalePaymentLinkAction,
  notifyPaymentLinkUpdated,
  PaymentLinkApiError,
  readCachedPaymentLinkAttempt,
  resolveSwitchOfflineAmount,
  resendPaymentLink,
  switchPaymentLinkOffline,
  writeCachedPaymentLinkAttempt,
  markPaymentLinkOnlineSuccess,
  type PaymentLinkAttempt,
} from "@/lib/booking-payment-link-api";
import { dispatchCrmLeadsInvalidate } from "@/lib/crm-leads-invalidate";
import { shouldProbeActivePaymentLink } from "@/lib/lead-payment-link-probe";
import { canUsePaymentLinkIntegration } from "@/lib/roleUtils";
import {
  formatPaymentAmountInput,
  writePaymentAmount,
} from "@/lib/booking-done-payment-storage";
import { useLeadDetailV2 } from "./LeadDetailV2Context";

type Props = {
  leadType: string;
  leadId: string;
  onPaid?: () => void;
  onSwitchOffline?: () => void;
};

export default function LeadPaymentLinkBanner({
  leadType,
  leadId,
  onPaid,
  onSwitchOffline,
}: Props) {
  const { lead, viewerRoleKey } = useLeadDetailV2();
  const canUsePaymentLinks = canUsePaymentLinkIntegration(viewerRoleKey);
  const shouldProbe = shouldProbeActivePaymentLink(lead);
  const [attempt, setAttempt] = useState<PaymentLinkAttempt | null>(() =>
    canUsePaymentLinks ? readCachedPaymentLinkAttempt(leadType, leadId) : null,
  );
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const applyAttempt = useCallback(
    (next: PaymentLinkAttempt | null | undefined) => {
      const paid = String(next?.status ?? "").toUpperCase() === "PAID";
      const bannerAttempt = isBannerPaymentLink(next) ? next ?? null : null;
      writeCachedPaymentLinkAttempt(leadType, leadId, bannerAttempt);
      if (paid) markPaymentLinkOnlineSuccess(leadType, leadId);
      setAttempt(bannerAttempt);
    },
    [leadId, leadType],
  );

  const loadActive = useCallback(async () => {
    if (!canUsePaymentLinkIntegration(viewerRoleKey)) {
      setAttempt(null);
      setLoading(false);
      return null;
    }
    if (!shouldProbeActivePaymentLink(lead) && !readCachedPaymentLinkAttempt(leadType, leadId)) {
      setAttempt(null);
      setLoading(false);
      return null;
    }
    try {
      const next = await fetchLeadPaymentLinkActive(leadType, leadId);
      applyAttempt(next);
      return next;
    } catch {
      applyAttempt(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [applyAttempt, lead, leadId, leadType, viewerRoleKey]);

  useEffect(() => {
    if (!canUsePaymentLinks) {
      setAttempt(null);
      setLoading(false);
      return;
    }

    const cached = readCachedPaymentLinkAttempt(leadType, leadId);
    if (cached) {
      setAttempt(cached);
      setLoading(false);
      return;
    }

    if (!shouldProbe) {
      setAttempt(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    void loadActive();
  }, [canUsePaymentLinks, leadId, leadType, loadActive, shouldProbe]);

  useEffect(() => {
    if (!canUsePaymentLinks) return;

    const onPaymentLinkUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{
        leadType?: string;
        leadId?: string;
        attempt?: PaymentLinkAttempt | null;
      }>).detail;
      if (detail?.leadType !== leadType || detail?.leadId !== leadId) return;
      if (isBannerPaymentLink(detail.attempt)) {
        applyAttempt(detail.attempt);
        setLoading(false);
        return;
      }
      void loadActive();
    };

    window.addEventListener(PAYMENT_LINK_UPDATED_EVENT, onPaymentLinkUpdated);
    return () => window.removeEventListener(PAYMENT_LINK_UPDATED_EVENT, onPaymentLinkUpdated);
  }, [applyAttempt, canUsePaymentLinks, leadId, leadType, loadActive]);

  useEffect(() => {
    if (!canUsePaymentLinks || !attempt?.id) return;
    const tick = window.setInterval(() => {
      void (async () => {
        const next = await loadActive();
        const paid = String(next?.status ?? "").toUpperCase() === "PAID";
        const bannerGone = !isBannerPaymentLink(next);
        if (paid || bannerGone) {
          dispatchCrmLeadsInvalidate();
          onPaid?.();
        }
      })();
    }, PAYMENT_LINK_POLL_MS);
    return () => window.clearInterval(tick);
  }, [attempt?.id, canUsePaymentLinks, loadActive, onPaid]);

  const handleCopy = useCallback(async () => {
    if (!attempt) return;
    setBusy(true);
    setError("");
    try {
      const result = await copyPaymentLinkToClipboard(attempt.id, attempt);
      if (result.attempt) {
        applyAttempt(result.attempt);
        notifyPaymentLinkUpdated(leadType, leadId, result.attempt);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to copy payment link.");
    } finally {
      setBusy(false);
    }
  }, [applyAttempt, attempt, leadId, leadType]);

  const handleResend = useCallback(async () => {
    if (!attempt) return;
    setBusy(true);
    setError("");
    try {
      const result = await resendPaymentLink(attempt.id);
      applyAttempt(result.attempt);
      notifyPaymentLinkUpdated(leadType, leadId, result.attempt);
    } catch (err) {
      if (isStalePaymentLinkAction(err)) await loadActive();
      setError(err instanceof Error ? err.message : "Unable to resend payment link.");
    } finally {
      setBusy(false);
    }
  }, [applyAttempt, attempt, leadId, leadType, loadActive]);

  const handleEdit = useCallback(
    async (amount: number) => {
      if (!attempt) return;
      setBusy(true);
      setError("");
      try {
        const result = await editPaymentLinkAmount(attempt.id, amount);
        applyAttempt(result.attempt);
        notifyPaymentLinkUpdated(leadType, leadId, result.attempt);
      } catch (err) {
        if (isStalePaymentLinkAction(err)) await loadActive();
        setError(err instanceof Error ? err.message : "Unable to edit payment link.");
      } finally {
        setBusy(false);
      }
    },
    [applyAttempt, attempt, leadId, leadType, loadActive],
  );

  const handleSwitchOffline = useCallback(async () => {
    if (!attempt) return;
    const confirmed = window.confirm(
      "Switch this payment to Offline? The online link will be cancelled. Record one cash/cheque/bank payment — not a second payment.",
    );
    if (!confirmed) return;
    setBusy(true);
    setError("");
    try {
      const result = await switchPaymentLinkOffline(attempt.id);
      const amount = resolveSwitchOfflineAmount(result, attempt);
      if (amount != null) {
        writePaymentAmount(leadType, leadId, formatPaymentAmountInput(amount));
      }
      notifyPaymentLinkUpdated(leadType, leadId, null);
      setAttempt(null);
      onSwitchOffline?.();
      window.dispatchEvent(new Event("crm-open-booking-done"));
    } catch (err) {
      if (err instanceof PaymentLinkApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Unable to switch to offline payment.");
      }
    } finally {
      setBusy(false);
    }
  }, [attempt, leadId, leadType, onSwitchOffline]);

  const handleDelete = useCallback(async () => {
    if (!attempt) return;
    setBusy(true);
    setError("");
    try {
      await cancelPaymentLink(attempt.id);
      notifyPaymentLinkUpdated(leadType, leadId, null);
      setAttempt(null);
      dispatchCrmLeadsInvalidate();
    } catch (err) {
      if (isStalePaymentLinkAction(err)) {
        await loadActive();
      }
      if (err instanceof PaymentLinkApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Unable to delete payment link.");
      }
    } finally {
      setBusy(false);
    }
  }, [attempt, leadId, leadType, loadActive]);

  if (!canUsePaymentLinks) return null;
  if (!isBannerPaymentLink(attempt) || !attempt) {
    if (!loading) return null;
    return (
      <div className="animate-pulse rounded-[10px] border border-slate-200 bg-white px-3.5 py-2.5">
        <div className="h-4 w-2/3 rounded bg-slate-100" />
        <div className="mt-2 h-[3px] rounded-full bg-slate-100" />
        <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="mt-3">
      <PaymentLinkPendingBanner
        attempt={attempt}
        busy={busy}
        onCopy={() => void handleCopy()}
        onResend={() => void handleResend()}
        onEdit={(amount) => void handleEdit(amount)}
        onSwitchOffline={() => void handleSwitchOffline()}
        onDelete={() => void handleDelete()}
      />
      {copied ? (
        <p className="mt-1 text-[12px] font-semibold text-emerald-700">Link copied</p>
      ) : null}
      {error ? (
        <p className="mt-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
