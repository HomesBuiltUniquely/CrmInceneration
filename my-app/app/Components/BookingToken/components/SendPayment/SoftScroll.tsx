"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Extra class on the inner pad wrapper (optional). */
  padClassName?: string;
  /** When false, skip the pad wrapper and render children directly. */
  withPad?: boolean;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "className">;

/**
 * Invisible scroll region: no scrollbar. Soft-edge fade only appears when
 * content actually overflows (e.g. many quote versions / history on laptop).
 */
export default function SoftScroll({
  children,
  className = "",
  padClassName = "",
  withPad = true,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 1px tolerance avoids flicker from subpixel rounding
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    // Watch content size too (list items mounting / filters)
    if (el.firstElementChild) ro.observe(el.firstElementChild);

    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure, children]);

  return (
    <div
      ref={ref}
      className={`sp-scroll-fade${overflows ? " sp-scroll-fade--active" : ""} ${className}`.trim()}
      data-overflow={overflows ? "true" : "false"}
      {...rest}
    >
      {withPad ? (
        <div className={`sp-scroll-fade-pad min-h-0 ${padClassName}`.trim()}>
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
