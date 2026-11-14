"use client";

import { useEffect } from "react";

const MESSAGE = "Send the new sales executive information to the customer?";

type Props = {
  open: boolean;
  /** Yes → notifyCustomer true */
  onYes: () => void;
  /** No → notifyCustomer false */
  onNo: () => void;
  /** Backdrop / Escape / dismiss without choosing → abort assign */
  onDismiss: () => void;
};

/**
 * Reassign / bulk-assign WhatsApp prompt (sales assignee only).
 * Verify flow must not use this modal.
 */
export default function AssignNotifyCustomerModal({
  open,
  onYes,
  onNo,
  onDismiss,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[130] bg-black/35 backdrop-blur-[1px]"
        onClick={onDismiss}
        aria-hidden="true"
      />
      <div
        className="fixed left-1/2 top-1/2 z-[135] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-notify-customer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="assign-notify-customer-title"
          className="text-center text-base font-semibold leading-relaxed text-[#111827] sm:text-lg"
        >
          {MESSAGE}
        </h2>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onNo}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-[#d1d5db] bg-white px-4 text-[14px] font-semibold text-[#374151] transition hover:bg-[#f9fafb] sm:flex-none sm:min-w-[120px]"
          >
            No
          </button>
          <button
            type="button"
            onClick={onYes}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-[#3b82f6] bg-[#3b82f6] px-4 text-[14px] font-semibold text-white transition hover:bg-[#2563eb] sm:flex-none sm:min-w-[120px]"
          >
            Yes
          </button>
        </div>
      </div>
    </>
  );
}

export { MESSAGE as ASSIGN_NOTIFY_CUSTOMER_MESSAGE };
