"use client";

import { useEffect, useState } from "react";
import type { DealRow } from "@/app/Components/BookingToken/types";

type Props = {
  open: boolean;
  deal: DealRow | null;
  submitting: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

export default function RejectCancellationModal({
  open,
  deal,
  submitting,
  error,
  onClose,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) return;
    setReason("");
    setLocalError("");
  }, [open, deal?.id]);

  if (!open || !deal) return null;

  const displayError = localError || error;

  const handleSubmit = () => {
    if (!reason.trim()) {
      setLocalError("Enter a reason for rejecting this cancellation request.");
      return;
    }
    setLocalError("");
    onConfirm(reason.trim());
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[120] bg-black/25 backdrop-blur-[2px]"
        onClick={() => {
          if (!submitting) onClose();
        }}
        aria-hidden="true"
      />
      <div
        className="fixed left-1/2 top-1/2 z-[125] w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--bt-border)] bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Reject cancellation request"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--bt-text)]">
          Reject cancellation
        </h2>
        <p className="mt-1 text-sm text-[var(--bt-muted)]">
          {deal.customer} will return to active booking status.
        </p>
        {deal.cancellationRequestedByName ? (
          <p className="mt-2 text-xs text-[var(--bt-muted)]">
            Requested by {deal.cancellationRequestedByName}
          </p>
        ) : null}

        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-[var(--bt-muted)]">
          Rejection reason
        </label>
        <textarea
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            if (localError) setLocalError("");
          }}
          rows={3}
          disabled={submitting}
          placeholder="Why is this cancellation being rejected?"
          className="mt-1.5 w-full rounded-lg border border-[var(--bt-border)] px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:opacity-60"
        />

        {displayError ? (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {displayError}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="bt-btn bt-btn-modal bt-btn-modal-secondary disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="bt-btn bt-btn-modal bt-btn-modal-primary disabled:opacity-60"
          >
            {submitting ? "Rejecting…" : "Reject request"}
          </button>
        </div>
      </div>
    </>
  );
}
