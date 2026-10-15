"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  submitting?: boolean;
  onKeepEditing: () => void;
  onSave: () => void;
  onClear: () => void;
};

/**
 * Sits above Send Payment (z-210) so close/X can always present Save vs Clear.
 */
export default function ClosePaymentChoiceModal({
  open,
  submitting = false,
  onKeepEditing,
  onSave,
  onClear,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        event.preventDefault();
        event.stopPropagation();
        onKeepEditing();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, submitting, onKeepEditing]);

  if (!open || !mounted) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[230] bg-black/40 backdrop-blur-[2px]"
        onClick={() => {
          if (!submitting) onKeepEditing();
        }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sp-close-choice-title"
        className="fixed left-1/2 top-1/2 z-[240] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#E3E8EE] bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <h2
          id="sp-close-choice-title"
          className="text-center text-[17px] font-bold text-[#0F172A]"
        >
          Save or clear?
        </h2>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-[#5B6778]">
          You have payment details that aren&apos;t finished. Save this payment, or
          clear everything and close.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={submitting}
            className="inline-flex min-h-11 items-center justify-center rounded-[14px] bg-[#047857] px-4 text-[14px] font-bold text-white hover:bg-[#036649] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40 disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save payment"}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={submitting}
            className="inline-flex min-h-11 items-center justify-center rounded-[14px] border border-[#FECACA] bg-[#FEF2F2] px-4 text-[14px] font-bold text-[#B91C1C] hover:bg-[#FEE2E2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B91C1C]/30 disabled:opacity-60"
          >
            Clear &amp; close
          </button>
          <button
            type="button"
            onClick={onKeepEditing}
            disabled={submitting}
            className="inline-flex min-h-10 items-center justify-center rounded-[14px] px-4 text-[13px] font-semibold text-[#5B6778] hover:bg-[#F7F9FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/30 disabled:opacity-60"
          >
            Keep editing
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
