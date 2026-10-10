"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import "./send-payment-motion.css";

export type SendPaymentModalProps = {
  open: boolean;
  entered?: boolean;
  customer: string;
  quoteId?: string | null;
  bookingRef?: string | null;
  onClose: () => void;
  children: ReactNode;
  /** When provided, modal is positioned (draggable shell). */
  panelRef?: RefObject<HTMLDivElement | null>;
  position?: { x: number; y: number };
  isDragging?: boolean;
  onDragStart?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDragMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

function buildSubtitle(
  customer: string,
  quoteId?: string | null,
  bookingRef?: string | null,
): string {
  const quote = quoteId?.trim() || "";
  const ref = bookingRef?.trim() || "";
  const refLooksLikeQuote =
    Boolean(quote) &&
    (ref === quote ||
      ref === `Quote ${quote}` ||
      ref.toLowerCase() === `quote ${quote}`.toLowerCase());

  return [
    customer.trim() || null,
    quote ? `Quote ${quote}` : null,
    ref && !refLooksLikeQuote ? ref : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Desktop: ~1120×640 dialog, vertically centered with top/bottom margin.
 * Mobile (&lt;768px): full-screen sheet.
 * Rendered via portal so the dim overlay covers the full viewport
 * (avoids white bottom strip from page overflow shells).
 */
export default function SendPaymentModal({
  open,
  entered = true,
  customer,
  quoteId,
  bookingRef,
  onClose,
  children,
  panelRef,
  position,
  isDragging = false,
  onDragStart,
  onDragMove,
  onDragEnd,
}: SendPaymentModalProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const dialogRef = panelRef ?? localRef;
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    if (!node) return;

    const focusables = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

    const first = focusables()[0];
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [dialogRef, onClose, open]);

  if (!open || !mounted) return null;

  const subtitle = buildSubtitle(customer, quoteId, bookingRef);
  const positioned = isDesktop && position != null;

  const node = (
    <>
      <div
        className={`sp-backdrop fixed inset-0 z-[200] bg-black/25 backdrop-blur-[2px] ${
          entered ? "opacity-100" : "opacity-0"
        }`}
        style={{ top: 0, right: 0, bottom: 0, left: 0 }}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Send payment"
        className={`sp-sheet font-sans fixed z-[210] flex flex-col overflow-hidden border border-[#E3E8EE] bg-white shadow-2xl ${
          entered ? "sp-sheet-enter" : "sp-sheet-exit"
        } inset-0 h-[100dvh] max-h-[100dvh] w-full rounded-none md:inset-auto md:h-[min(640px,calc(100dvh-80px))] md:max-h-[calc(100dvh-80px)] md:w-[min(1120px,calc(100vw-48px))] md:rounded-[24px]`}
        style={positioned ? { left: position.x, top: position.y } : undefined}
      >
        <header
          className={`flex shrink-0 items-center justify-between border-b border-[#E3E8EE] px-4 py-2 select-none ${
            onDragStart ? "touch-none md:cursor-grab" : ""
          } ${isDragging ? "md:cursor-grabbing" : ""}`}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E7F6EF] text-[15px] font-bold text-[#047857]"
              aria-hidden
            >
              ₹
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold leading-tight tracking-tight text-[#0F172A]">
                Send payment
              </h2>
              {subtitle ? (
                <p className="mt-0.5 truncate text-[11px] leading-tight text-[#5B6778]">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="sp-icon-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E3E8EE] bg-white text-[16px] leading-none text-[#5B6778] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/40"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </>
  );

  return createPortal(node, document.body);
}
