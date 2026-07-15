"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Hide title/subtitle bar (lead detail / config scope already have their own chrome). */
  hideHeader?: boolean;
  /** Run before close (e.g. auto-save). Close still proceeds afterward. */
  onBeforeClose?: () => void | Promise<void>;
  /** Stacking context — raise for nested modals (e.g. config scope over lead detail). */
  zOverlay?: number;
  zPanel?: number;
  /** When true, Escape does not close (child may own Escape). Default true. */
  closeOnEscape?: boolean;
  /** When true, clicking the dimmed backdrop closes. Default true. */
  closeOnBackdrop?: boolean;
  /** Optional window event name that requests close (e.g. empty-space double-click). */
  closeEventName?: string;
};

/**
 * Full-viewport centered dialog (Design Preferences–style chrome).
 */
export default function CrmFullscreenOverlayModal({
  open,
  onClose,
  title = "Dialog",
  subtitle,
  children,
  hideHeader = false,
  onBeforeClose,
  zOverlay = 80,
  zPanel = 85,
  closeOnEscape = true,
  closeOnBackdrop = true,
  closeEventName,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelEntered, setPanelEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const onBeforeCloseRef = useRef(onBeforeClose);
  onBeforeCloseRef.current = onBeforeClose;

  const closePanel = useCallback(async () => {
    if (closing) return;
    setClosing(true);
    try {
      await onBeforeCloseRef.current?.();
    } catch {
      /* still close */
    }
    setPanelEntered(false);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, 280);
  }, [closing, onClose]);

  useEffect(() => {
    if (!open || !closeEventName) return;
    const onRequestClose = () => {
      void closePanel();
    };
    window.addEventListener(closeEventName, onRequestClose);
    return () => window.removeEventListener(closeEventName, onRequestClose);
  }, [open, closeEventName, closePanel]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelEntered(false);
      setClosing(false);
      return;
    }
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelEntered(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void closePanel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeOnEscape, closePanel]);

  if (!open) return null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 ${
          panelEntered ? "opacity-100" : "opacity-0"
        }`}
        style={{ zIndex: zOverlay }}
        onClick={closeOnBackdrop ? () => void closePanel() : undefined}
        aria-hidden="true"
      />
      {/* pointer-events-none so empty chrome outside the panel does not steal clicks;
          panel uses pointer-events-auto so header empty space stays inside the dialog. */}
      <div
        className="pointer-events-none fixed inset-0 flex items-center justify-center px-3 sm:px-4"
        style={{ zIndex: zPanel }}
      >
        <div
          ref={panelRef}
          className={`pointer-events-auto relative flex h-[100dvh] w-full max-h-[100dvh] max-w-[1520px] flex-col overflow-hidden rounded-xl border border-[#e0e5ec] bg-white shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            panelEntered ? "scale-100 opacity-100" : "scale-[0.98] opacity-0"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {hideHeader ? (
            <button
              type="button"
              onClick={() => void closePanel()}
              disabled={closing}
              aria-label={`Close ${title}`}
              className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#e0e5ec] bg-white/95 text-[#475467] shadow-sm transition hover:bg-[#f8fafc] hover:text-[#101828] disabled:opacity-60"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          ) : (
            <div className="flex shrink-0 items-center justify-between border-b border-[#eef1f5] px-4 py-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <h2 className="truncate text-[16px] font-extrabold tracking-tight text-[#101828] sm:text-[18px]">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="mt-0.5 truncate text-[12px] font-medium text-[#8b97a8]">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void closePanel()}
                disabled={closing}
                aria-label={`Close ${title}`}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e0e5ec] bg-white text-[#475467] transition hover:bg-[#f8fafc] hover:text-[#101828] disabled:opacity-60"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#eef1f5]">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
