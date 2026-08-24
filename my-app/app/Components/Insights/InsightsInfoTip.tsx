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

/** Hover pop: plain words first, then math when provided. */
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
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-40 w-[268px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left opacity-0 shadow-[0_10px_28px_rgba(15,23,42,0.14)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${
          side === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"
        } ${align === "right" ? "right-0" : "left-0"}`}
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
