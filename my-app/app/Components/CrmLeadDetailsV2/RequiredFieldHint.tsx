"use client";

import type { ReactNode } from "react";
import { REQUIRED_FIELD_HINTS } from "@/lib/required-field-hints";

export { REQUIRED_FIELD_HINTS };

/**
 * Red * with a friendly hover message (not a harsh system error).
 */
export function RequiredAsterisk({
  message,
  className = "",
}: {
  message: string;
  className?: string;
}) {
  return (
    <span
      className={`group/req relative ml-0.5 inline-flex cursor-help align-middle ${className}`.trim()}
      tabIndex={0}
      aria-label={message}
    >
      <span className="text-[13px] font-bold leading-none text-[#e11d48]" aria-hidden="true">
        *
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-40 mt-1.5 w-56 -translate-x-1/2 rounded-lg border border-[#f0d9b5] bg-[#fffaf3] px-2.5 py-2 text-left text-[11px] font-medium normal-case tracking-normal text-[#7a5530] shadow-md opacity-0 transition-opacity duration-150 group-hover/req:opacity-100 group-focus-within/req:opacity-100"
      >
        {message}
      </span>
    </span>
  );
}

export function withRequiredLabel(
  label: ReactNode,
  required: boolean | undefined,
  message: string | undefined,
): ReactNode {
  if (!required || !message) return label;
  return (
    <>
      {label}
      <RequiredAsterisk message={message} />
    </>
  );
}
