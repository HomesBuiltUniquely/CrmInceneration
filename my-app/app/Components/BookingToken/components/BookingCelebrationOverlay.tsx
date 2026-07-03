"use client";

import { useEffect } from "react";

const CONFETTI_COLORS = ["#00e676", "#059669", "#fbbf24", "#3b82f6", "#f97316"];

type Props = {
  title: string;
  subtitle: string;
  detail?: string;
  onDone: () => void;
};

export default function BookingCelebrationOverlay({ title, subtitle, detail, onDone }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2800);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-emerald-950/50 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {CONFETTI_COLORS.flatMap((color, colorIndex) =>
          Array.from({ length: 6 }, (_, pieceIndex) => (
            <span
              key={`${color}-${pieceIndex}`}
              className="bt-confetti-piece absolute top-[18%] h-2 w-2 rounded-sm"
              style={{
                left: `${8 + colorIndex * 18 + pieceIndex * 3}%`,
                backgroundColor: color,
                animationDelay: `${pieceIndex * 0.08 + colorIndex * 0.04}s`,
              }}
            />
          )),
        )}
      </div>
      <div className="bt-celebrate-overlay relative rounded-2xl border border-emerald-200 bg-white px-10 py-9 text-center shadow-2xl">
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <span className="bt-celebrate-ring absolute inset-0 rounded-full border-2 border-emerald-400" />
          <span className="bt-celebrate-check relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bt-green,#1dde63)] text-3xl font-bold text-[var(--bt-navy,#05220f)]">
            ✓
          </span>
        </div>
        <h3 className="mt-5 text-xl font-bold text-[#111827]">{title}</h3>
        <p className="mt-2 text-sm text-[#6b7280]">{subtitle}</p>
        {detail ? <p className="mt-1 text-xs text-emerald-700">{detail}</p> : null}
      </div>
    </div>
  );
}
