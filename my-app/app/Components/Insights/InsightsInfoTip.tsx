"use client";

import type { ReactNode } from "react";

type Props = {
  label: string;
  children: ReactNode;
  /** Optional formula block under the plain-language copy. */
  math?: ReactNode;
  /** Prefer left on right-edge badges so the pop stays on-card. */
  align?: "left" | "right";
  /** Table headers — open above so the pop isn’t clipped. */
  side?: "bottom" | "top";
  /**
   * Hover target. If omitted, a small “i” is shown (card titles).
   * Pass the field name to explain on hover with no extra icon.
   */
  trigger?: ReactNode;
};

/**
 * Hover pop: plain words first, then math when provided.
 * Tip stays interactive on hover so long content can scroll.
 */
export default function InsightsInfoTip({
  label,
  children,
  math,
  align = "left",
  side = "bottom",
  trigger,
}: Props) {
  return (
    <span className="group relative inline-flex max-w-full shrink-0 align-middle">
      {trigger ? (
        <span
          tabIndex={0}
          aria-label={label}
          className="cursor-help outline-none"
        >
          {trigger}
        </span>
      ) : (
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white text-[9px] font-bold leading-none text-gray-500 outline-none transition hover:border-gray-400 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          i
        </button>
      )}
      {/* Invisible bridge so pointer can move from icon → pop without closing */}
      <span
        aria-hidden
        className={`pointer-events-none absolute left-0 right-0 z-30 hidden h-3 group-hover:block group-focus-within:block ${
          side === "top" ? "bottom-full" : "top-full"
        }`}
      />
      <span
        role="tooltip"
        className={`absolute z-40 hidden max-h-[min(70vh,420px)] w-[min(320px,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left shadow-[0_10px_28px_rgba(15,23,42,0.14)] group-hover:block group-focus-within:block ${
          side === "top" ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]"
        } ${align === "right" ? "right-0" : "left-0"}`}
        onWheel={(e) => {
          // Keep page from stealing scroll while reading the tip.
          e.stopPropagation();
        }}
      >
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
          In simple words
        </span>
        <span className="block text-[12px] font-medium leading-relaxed text-gray-600">
          {children}
        </span>
        {math ? (
          <span className="mt-2 block border-t border-gray-100 pt-2">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
              How the number is made
            </span>
            <span className="block text-[11px] font-medium leading-relaxed text-gray-500">
              {math}
            </span>
          </span>
        ) : null}
      </span>
    </span>
  );
}
