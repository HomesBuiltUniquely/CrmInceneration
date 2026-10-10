"use client";

import { useEffect, type ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, only the confirm/OK button is shown (replaces window.alert). */
  noticeOnly?: boolean;
  danger?: boolean;
  submitting?: boolean;
  error?: string;
  children?: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
};

export default function AppConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  noticeOnly = false,
  danger = false,
  submitting = false,
  error,
  children,
  onClose,
  onConfirm,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

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
        aria-labelledby="app-confirm-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="app-confirm-modal-title"
          className="text-center text-lg font-bold text-[#111827]"
        >
          {title}
        </h2>
        <div className="mt-2 text-center text-sm leading-relaxed text-[#6b7280]">
          {message}
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className={`mt-5 flex flex-col gap-2 ${noticeOnly ? "" : "sm:flex-row"}`}>
          {noticeOnly ? null : (
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="bt-btn bt-btn-modal bt-btn-modal-secondary disabled:opacity-60"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={`bt-btn bt-btn-modal disabled:opacity-60 ${
              danger ? "bt-btn-modal-danger" : "bt-btn-modal-primary"
            }`}
          >
            {submitting ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
