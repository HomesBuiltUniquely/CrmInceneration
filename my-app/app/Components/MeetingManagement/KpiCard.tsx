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
  const className = `flex w-full items-center gap-2.5 rounded-xl border bg-white px-3 py-2 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
    active ? "border-[#15803D] ring-2 ring-[#15803D]" : "border-[#E6EAF0]"
  } ${onClick ? "cursor-pointer transition-shadow hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]" : ""}`;
  const body = (
    <>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] font-semibold text-[#5F6675]">{label}</p>
          {chip ? (
            <span className={`inline-flex h-5 shrink-0 items-center rounded-full px-1.5 text-[10px] font-semibold ${chipClass}`}>{chip}</span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <p className="text-[20px] font-bold leading-none tracking-[-0.03em] text-[#14171F]">{numberFormat.format(shown)}</p>
          <p className="truncate text-[11px] font-normal text-[#5B6778]">{hint}</p>
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
