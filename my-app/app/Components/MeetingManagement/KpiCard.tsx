"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

const numberFormat = new Intl.NumberFormat("en-IN");

export function KpiCard({
  label,
  value,
  hint,
  chip,
  chipClass,
  icon,
  iconClass,
  ready,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  chip: string;
  chipClass: string;
  icon: ReactNode;
  iconClass: string;
  ready: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const reduce = useReducedMotion();
  const shown = useCountUp(value, ready, Boolean(reduce));
  const className = `flex w-full items-center gap-3 rounded-2xl border bg-white px-3.5 py-2.5 text-left shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${
    active ? "border-[#15803D] ring-2 ring-[#15803D]" : "border-[#E3E8EE]"
  } ${onClick ? "cursor-pointer" : ""}`;
  const body = (
    <>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[12px] font-semibold text-[#334155]">{label}</p>
          <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold ${chipClass}`}>{chip}</span>
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <p className="text-[26px] font-bold leading-none tracking-[-0.03em] text-[#0F172A]">{numberFormat.format(shown)}</p>
          <p className="truncate text-[12px] font-normal text-[#5B6778]">{hint}</p>
        </div>
      </div>
    </>
  );
  if (!onClick) return <article className={className}>{body}</article>;
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={className}>
      {body}
    </button>
  );
}

function useCountUp(value: number, ready: boolean, reduce: boolean) {
  const [shown, setShown] = useState(reduce ? value : 0);
  const started = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (reduce || started.current) {
      setShown(value);
      started.current = true;
      return;
    }
    started.current = true;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, reduce, value]);
  return shown;
}
