"use client";

import { useCallback, useEffect, useState } from "react";
import PaymentLinkPendingBanner from "@/app/Components/BookingToken/components/PaymentLinkPendingBanner";
import {
  formatPaymentAmountInput,
  writePaymentAmount,
} from "@/lib/booking-done-payment-storage";
import {
  PAYMENT_LINK_POLL_MS,
  copyPaymentLink,
  editPaymentLinkAmount,
  fetchLeadPaymentLinkActive,
  isBannerPaymentLink,
  isStalePaymentLinkAction,
  PaymentLinkApiError,
  resolveCopiedPaymentLinkUrl,
  resolveSwitchOfflineAmount,
  resendPaymentLink,
  switchPaymentLinkOffline,
  type PaymentLinkAttempt,
} from "@/lib/booking-payment-link-api";
import { dispatchCrmLeadsInvalidate } from "@/lib/crm-leads-invalidate";

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
  const [attempt, setAttempt] = useState<PaymentLinkAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const applyAttempt = useCallback((next: PaymentLinkAttempt | null | undefined) => {
    setAttempt(isBannerPaymentLink(next) ? next ?? null : null);
  }, []);

  const loadActive = useCallback(async () => {
    try {
      const next = await fetchLeadPaymentLinkActive(leadType, leadId);
      applyAttempt(next);
      return next;
    } catch {
      setAttempt(null);
      return null;
    }
  }, [applyAttempt, leadId, leadType]);

  useEffect(() => {
    void loadActive();
  }, [loadActive]);

  useEffect(() => {
    if (!attempt?.id) return;
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
  }, [attempt?.id, loadActive, onPaid]);

  const handleCopy = useCallback(async () => {
    if (!attempt) return;
    setBusy(true);
    setError("");
    try {
      const result = await copyPaymentLink(attempt.id);
      const url = resolveCopiedPaymentLinkUrl(result, attempt);
      if (result.attempt) applyAttempt(result.attempt);
      if (!url) {
        setError("Payment link URL is not available yet.");
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to copy payment link.");
    } finally {
      setBusy(false);
    }
  }, [applyAttempt, attempt]);

  const handleResend = useCallback(async () => {
    if (!attempt) return;
    setBusy(true);
    setError("");
    try {
      const result = await resendPaymentLink(attempt.id);
      applyAttempt(result.attempt);
    } catch (err) {
      if (isStalePaymentLinkAction(err)) await loadActive();
      setError(err instanceof Error ? err.message : "Unable to resend payment link.");
    } finally {
      setBusy(false);
    }
  }, [applyAttempt, attempt, loadActive]);

  const handleEdit = useCallback(
    async (amount: number) => {
      if (!attempt) return;
      setBusy(true);
      setError("");
      try {
        const result = await editPaymentLinkAmount(attempt.id, amount);
        applyAttempt(result.attempt);
      } catch (err) {
        if (isStalePaymentLinkAction(err)) await loadActive();
        setError(err instanceof Error ? err.message : "Unable to edit payment link.");
      } finally {
        setBusy(false);
      }
    },
    [applyAttempt, attempt, loadActive],
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

  if (!isBannerPaymentLink(attempt) || !attempt) return null;

  return (
    <div className="mt-3 mb-3">
      <PaymentLinkPendingBanner
        attempt={attempt}
        busy={busy}
        onCopy={() => void handleCopy()}
        onResend={() => void handleResend()}
        onEdit={(amount) => void handleEdit(amount)}
        onSwitchOffline={() => void handleSwitchOffline()}
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
