"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import SlimScrollArea from "./SlimScrollArea";

export type OverlayOriginRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

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
  /** Screen rect to zoom out of (Mac-style app open). */
  originRect?: OverlayOriginRect | null;
  /** Query for the source element so close can zoom back into it. */
  originSelector?: string;
};

const OPEN_MS = 520;
const CLOSE_MS = 420;
const OPEN_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const CLOSE_EASE = "cubic-bezier(0.45, 0, 1, 1)";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function resolveOrigin(
  selector: string | undefined,
  fallback: OverlayOriginRect | null | undefined,
): OverlayOriginRect | null {
  if (selector) {
    const el = document.querySelector(selector);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) {
        return { top: r.top, left: r.left, width: r.width, height: r.height };
      }
    }
  }
  return fallback ?? null;
}

function transformFromOrigin(origin: OverlayOriginRect, panel: DOMRect) {
  const originCx = origin.left + origin.width / 2;
  const originCy = origin.top + origin.height / 2;
  const panelCx = panel.left + panel.width / 2;
  const panelCy = panel.top + panel.height / 2;
  const scale = Math.max(
    0.018,
    Math.min(origin.width / panel.width, origin.height / panel.height),
  );
  return `translate(${originCx - panelCx}px, ${originCy - panelCy}px) scale(${scale})`;
}

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
  originRect = null,
  originSelector,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const zoomAnimRef = useRef<Animation | null>(null);
  const originRectRef = useRef(originRect);
  const originSelectorRef = useRef(originSelector);
  originRectRef.current = originRect;
  originSelectorRef.current = originSelector;
  const [closing, setClosing] = useState(false);
  const [exiting, setExiting] = useState(false);
  const onBeforeCloseRef = useRef(onBeforeClose);
  onBeforeCloseRef.current = onBeforeClose;
  const useMacZoom = Boolean(originRect || originSelector);

  const playCloseZoom = useCallback(async () => {
    const panel = panelRef.current;
    if (!panel || prefersReducedMotion()) return;
    const origin = resolveOrigin(originSelectorRef.current, originRectRef.current);
    if (!origin) return;
    const target = panel.getBoundingClientRect();
    if (target.width < 2 || target.height < 2) return;
    zoomAnimRef.current?.cancel();
    const anim = panel.animate(
      [
        { transform: "translate(0px, 0px) scale(1)", opacity: 1, borderRadius: "12px" },
        {
          transform: transformFromOrigin(origin, target),
          opacity: 0,
          borderRadius: "18px",
        },
      ],
      { duration: CLOSE_MS, easing: CLOSE_EASE, fill: "forwards" },
    );
    zoomAnimRef.current = anim;
    try {
      await anim.finished;
    } catch {
      /* cancelled */
    }
  }, []);

  const closePanel = useCallback(async () => {
    if (closing) return;
    setClosing(true);
    try {
      await onBeforeCloseRef.current?.();
    } catch {
      /* still close */
    }
    setExiting(true);
    if (useMacZoom) {
      await playCloseZoom();
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 320));
    }
    onClose();
  }, [closing, onClose, playCloseZoom, useMacZoom]);

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
      setClosing(false);
      setExiting(false);
      zoomAnimRef.current?.cancel();
      return;
    }
    const panel = panelRef.current;
    const origin = resolveOrigin(originSelector, originRect);
    if (!panel || !origin || prefersReducedMotion()) return;
    const target = panel.getBoundingClientRect();
    if (target.width < 2 || target.height < 2) return;
    zoomAnimRef.current?.cancel();
    zoomAnimRef.current = panel.animate(
      [
        {
          transform: transformFromOrigin(origin, target),
          opacity: 0.55,
          borderRadius: "18px",
        },
        { transform: "translate(0px, 0px) scale(1)", opacity: 1, borderRadius: "12px" },
      ],
      { duration: OPEN_MS, easing: OPEN_EASE, fill: "both" },
    );
  }, [open, originRect, originSelector]);

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
        className={`fixed inset-0 bg-black/30 backdrop-blur-[3px] ${
          exiting ? "crm-overlay-backdrop-out" : "crm-overlay-backdrop-in"
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
          className={`pointer-events-auto relative flex h-[100dvh] w-full max-h-[100dvh] max-w-[1520px] flex-col overflow-hidden rounded-xl border border-[#e0e5ec] bg-white shadow-2xl ${
            useMacZoom
              ? "origin-center will-change-transform"
              : exiting
                ? "crm-overlay-panel-out"
                : "crm-overlay-panel-in"
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
          <SlimScrollArea
            className="min-h-0 flex-1"
            contentClassName="overscroll-contain bg-[#eef1f5]"
          >
            {children}
          </SlimScrollArea>
        </div>
      </div>
    </>
  );
}
