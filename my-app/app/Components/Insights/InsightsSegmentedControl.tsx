"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type InsightsSegment = {
  id: string;
  label: ReactNode;
  /** Mobile label when different from desktop. */
  shortLabel?: ReactNode;
  title?: string;
  badge?: ReactNode;
  /** Active pill background — defaults to slate-900. */
  activeClassName?: string;
  /** Active label color — defaults to white. */
  activeTextClassName?: string;
  inactiveTextClassName?: string;
};

type Props = {
  segments: InsightsSegment[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
  pillClassName?: string;
};

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

export default function InsightsSegmentedControl({
  segments,
  value,
  onChange,
  ariaLabel,
  className = "",
  pillClassName = "bg-slate-900 shadow-sm",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  const measure = useCallback(() => {
    const idx = segments.findIndex((s) => s.id === value);
    const btn = buttonRefs.current[idx];
    const container = containerRef.current;
    if (!btn || !container) return;
    const c = container.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    setPill({
      left: b.left - c.left,
      width: b.width,
      ready: true,
    });
  }, [segments, value]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const activeSeg = segments.find((s) => s.id === value);
  const resolvedPillClass = activeSeg?.activeClassName ?? pillClassName;

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center gap-0.5 rounded-xl border border-slate-200/90 bg-slate-50/90 p-1 shadow-sm transition-shadow duration-300 hover:shadow-md ${className}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute top-1 bottom-1 rounded-lg ${resolvedPillClass} ${
          pill.ready ? "opacity-100" : "opacity-0"
        }`}
        style={{
          left: pill.left,
          width: pill.width,
          transition: `left 320ms ${EASE}, width 320ms ${EASE}, opacity 200ms ease, background-color 280ms ${EASE}`,
        }}
      />
      {segments.map((seg, i) => {
        const active = seg.id === value;
        return (
          <button
            key={seg.id}
            ref={(el) => {
              buttonRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            title={seg.title}
            onClick={() => onChange(seg.id)}
            className={`group relative z-10 inline-flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold tracking-wide transition-[color,transform,opacity,background-color] duration-300 ease-out sm:px-3 sm:text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/80 focus-visible:ring-offset-1 ${
              active
                ? seg.activeTextClassName ?? "text-white"
                : `${seg.inactiveTextClassName ?? "text-slate-600 hover:text-slate-900"} hover:bg-white/60`
            } hover:scale-[1.02] active:scale-[0.97]`}
            style={{ transitionTimingFunction: EASE }}
          >
            <span className="sm:hidden">{seg.shortLabel ?? seg.label}</span>
            <span className="hidden sm:inline">{seg.label}</span>
            {seg.badge ? (
              <span
                className={`rounded px-1 py-0.5 text-[8px] font-extrabold uppercase tracking-wide transition-all duration-300 ${
                  active
                    ? "scale-100 bg-amber-400/95 text-amber-950"
                    : "scale-95 bg-amber-100/90 text-amber-800 group-hover:scale-100"
                }`}
                style={{ transitionTimingFunction: EASE }}
              >
                {seg.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
