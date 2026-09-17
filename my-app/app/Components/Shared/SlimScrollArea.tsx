"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type Props = {
  children: ReactNode;
  /** Classes on the outer relative wrapper (height constraints, bg, etc.). */
  className?: string;
  /** Classes on the scrollable content element. */
  contentClassName?: string;
  /** Forwarded to the scrollable element (e.g. id for scroll-restore). */
  contentId?: string;
  style?: CSSProperties;
  /** When true, locks html/body overflow while mounted (full-page shells). */
  lockDocumentScroll?: boolean;
};

const HIDE_MS = 900;
const THUMB_MIN = 28;

/**
 * Shared page/panel scroller: hides the native Chrome scrollbar and shows an
 * 8px overlay thumb that appears while scrolling / hovering, and supports drag.
 */
export default function SlimScrollArea({
  children,
  className = "",
  contentClassName = "",
  contentId,
  style,
  lockDocumentScroll = false,
}: Props) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ startY: number; startScrollTop: number } | null>(null);

  const [visible, setVisible] = useState(false);
  const [thumb, setThumb] = useState({ top: 0, height: 0, show: false });

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), HIDE_MS);
  }, []);

  const showThumb = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const measure = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const canScroll = scrollHeight > clientHeight + 1;
    if (!canScroll) {
      setThumb({ top: 0, height: 0, show: false });
      return;
    }
    const track = clientHeight;
    const height = Math.max(THUMB_MIN, (clientHeight / scrollHeight) * track);
    const maxTop = track - height;
    const top =
      maxTop <= 0
        ? 0
        : (scrollTop / (scrollHeight - clientHeight)) * maxTop;
    setThumb({ top, height, show: true });
  }, []);

  useEffect(() => {
    if (!lockDocumentScroll) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [lockDocumentScroll]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    measure();
    const onScroll = () => {
      measure();
      showThumb();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      window.removeEventListener("resize", measure);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [measure, showThumb]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      const el = contentRef.current;
      if (!drag || !el) return;
      const { scrollHeight, clientHeight } = el;
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll <= 0) return;
      const track = clientHeight - thumb.height;
      const delta = e.clientY - drag.startY;
      const next =
        drag.startScrollTop + (track > 0 ? (delta / track) * maxScroll : 0);
      el.scrollTop = Math.max(0, Math.min(maxScroll, next));
    };
    const onUp = () => {
      dragRef.current = null;
      scheduleHide();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [scheduleHide, thumb.height]);

  return (
    <div
      className={`relative min-h-0 ${className}`.trim()}
      style={style}
      onMouseEnter={() => {
        measure();
        if (thumb.show) showThumb();
      }}
      onMouseLeave={() => {
        if (!dragRef.current) scheduleHide();
      }}
    >
      <div
        ref={contentRef}
        id={contentId}
        className={`h-full max-h-full overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${contentClassName}`.trim()}
      >
        {children}
      </div>

      {thumb.show ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-1 right-1 z-20 w-2"
        >
          <div
            className={`pointer-events-auto absolute right-0 w-2 rounded-full bg-slate-500/55 transition-opacity duration-200 hover:bg-slate-600/70 ${
              visible || dragRef.current ? "opacity-100" : "opacity-0"
            }`}
            style={{ top: thumb.top, height: thumb.height }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const el = contentRef.current;
              if (!el) return;
              dragRef.current = {
                startY: e.clientY,
                startScrollTop: el.scrollTop,
              };
              setVisible(true);
              if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
