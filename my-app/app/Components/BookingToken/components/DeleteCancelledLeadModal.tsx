"use client";

import type { DealRow } from "@/app/Components/BookingToken/types";

type Props = {
  open: boolean;
  deal: DealRow | null;
  submitting: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export default function DeleteCancelledLeadModal({
  open,
  deal,
  submitting,
  error,
  onClose,
  onConfirm,
}: Props) {
  if (!open || !deal) return null;

  const leadLabel = deal.leadIdentifier?.trim() || `#${deal.leadId}`;

  return (
    <>
      <div
        className="fixed inset-0 z-[120] bg-black/30 backdrop-blur-[1px]"
        onClick={() => {
          if (!submitting) onClose();
        }}
        aria-hidden="true"
      />
      <div
        className="fixed left-1/2 top-1/2 z-[125] w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-cancelled-lead-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <TrashIcon />
        </div>
        <h2
          id="delete-cancelled-lead-title"
          className="mt-4 text-center text-lg font-bold text-[#111827]"
        >
          Remove from Booking &amp; Token?
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-[#6b7280]">
          <span className="font-semibold text-[#111827]">{deal.customer}</span> ({leadLabel}) will
          be removed from the Booking &amp; Token dashboard. The CRM lead will stay in the pipeline
          unchanged. Payment proofs stored for this deal will be deleted.
        </p>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          This action cannot be undone.
        </p>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
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
            onClick={() => void onConfirm()}
            disabled={submitting}
            className="bt-btn bt-btn-modal bt-btn-modal-danger disabled:opacity-60"
          >
            {submitting ? "Removing…" : "Remove deal"}
          </button>
        </div>
      </div>
    </>
  );
}

function TrashIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
