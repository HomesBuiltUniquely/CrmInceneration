"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { pickRandomQuoteSentMotivateLine } from "@/lib/quote-sent-motivate";

const CONFETTI_COLORS = ["#34d399", "#10b981", "#fbbf24", "#38bdf8", "#f97316", "#a78bfa"];

type Props = {
  open: boolean;
  onDone: () => void;
  motivateLine?: string;
};

export default function QuoteSentCelebrationOverlay({
  open,
  onDone,
  motivateLine,
}: Props) {
  const [portalReady, setPortalReady] = useState(false);
  const quote = useMemo(
    () => motivateLine?.trim() || pickRandomQuoteSentMotivateLine(),
    [motivateLine, open],
  );

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onDone, 3200);
    return () => window.clearTimeout(timer);
  }, [open, onDone]);

  if (!open || !portalReady) return null;

  return createPortal(
    <div
      className="quote-sent-celebrate fixed inset-0 z-[220] flex items-center justify-center bg-emerald-950/45 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-label="Quote sent celebration"
      onClick={onDone}
    >
      <style>{`
        @keyframes qs-celebrate-pop {
          0% { opacity: 0; transform: scale(0.82) translateY(12px); }
          60% { opacity: 1; transform: scale(1.04) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes qs-celebrate-ring {
          0% { transform: scale(0.85); opacity: 0.9; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        @keyframes qs-confetti-drop {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(72vh) rotate(520deg); opacity: 0; }
        }
        @keyframes qs-sparkle {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        .qs-celebrate-card { animation: qs-celebrate-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .qs-celebrate-ring { animation: qs-celebrate-ring 1.15s ease-out infinite; }
        .qs-celebrate-check { animation: qs-sparkle 1.2s ease-in-out infinite; }
        .qs-confetti-piece { animation: qs-confetti-drop 1.55s ease-in forwards; }
      `}</style>

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {CONFETTI_COLORS.flatMap((color, colorIndex) =>
          Array.from({ length: 7 }, (_, pieceIndex) => (
            <span
              key={`${color}-${pieceIndex}`}
              className="qs-confetti-piece absolute top-[10%] h-2.5 w-2.5 rounded-sm"
              style={{
                left: `${6 + colorIndex * 15 + pieceIndex * 2.5}%`,
                backgroundColor: color,
                animationDelay: `${pieceIndex * 0.07 + colorIndex * 0.035}s`,
              }}
            />
          )),
        )}
      </div>

      <div
        className="qs-celebrate-card relative mx-4 max-w-md rounded-2xl border border-emerald-200 bg-white px-8 py-9 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <span className="qs-celebrate-ring absolute inset-0 rounded-full border-2 border-emerald-400" />
          <span className="qs-celebrate-check relative flex h-16 w-16 items-center justify-center rounded-full bg-[#1dde63] text-3xl font-bold text-[#05220f]">
            ✓
          </span>
        </div>
        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600">
          Quote Sent to Customer ⭐
        </p>
        <h3 className="mt-2 text-xl font-bold text-[#111827]">Nice work — quote delivered!</h3>
        <p className="mt-3 text-[15px] font-semibold leading-snug text-emerald-800">{quote}</p>
        <p className="mt-3 text-[12px] text-[#6b7280]">
          Stay sharp — follow up while the moment is yours.
        </p>
        <button
          type="button"
          onClick={onDone}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-5 text-[12px] font-bold uppercase tracking-wide text-white transition hover:bg-emerald-700"
        >
          Keep going
        </button>
      </div>
    </div>,
    document.body,
  );
}
