"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { focusRing, hoverLift } from "./motion";

export function RowActionsMenu({
  customer,
  onView,
  onReschedule,
}: {
  customer: string;
  onView: () => void;
  onReschedule: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-center justify-center gap-1">
      <ActionButton label={`Reschedule ${customer}`} title="Reschedule" tone="green" reduce={Boolean(reduce)} onClick={onReschedule}>
        <RescheduleIcon />
      </ActionButton>
      <ActionButton label={`View details for ${customer}`} title="View details" tone="amber" reduce={Boolean(reduce)} onClick={onView}>
        <ViewDetailsIcon />
      </ActionButton>
    </div>
  );
}

function ActionButton({
  label,
  title,
  tone,
  reduce,
  onClick,
  children,
}: {
  label: string;
  title: string;
  tone: "green" | "amber";
  reduce: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const hover =
    tone === "green"
      ? "hover:border-[#86EFAC] hover:bg-[#F0FDF4] hover:text-[#047857] hover:shadow-[0_6px_14px_rgba(22,163,74,0.16)]"
      : "hover:border-[#FDBA74] hover:bg-[#FFF7ED] hover:shadow-[0_6px_14px_rgba(234,88,12,0.14)]";
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={title}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`group inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6EAF0] bg-white text-[#334155] transition-colors duration-150 ${hover} ${focusRing}`}
      {...hoverLift(reduce, -2)}
    >
      <span className="transition-transform duration-150 group-hover:scale-110">{children}</span>
    </motion.button>
  );
}

function RescheduleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden>
      <rect x="2.5" y="3.5" width="12" height="11" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 7h12M5.5 2.8v2M11.5 2.8v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 9.2h2.2M8.2 9.2h2.2M5 11.6h2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="16.2" cy="16.2" r="4.3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16.2 14.2v2.1l1.4.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.6 13.2a5.6 5.6 0 0 1 .7 2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M20.2 12.4l-.6 1.5-1.5-.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ViewDetailsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden>
      <rect x="2.5" y="3.5" width="13" height="11" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 6.5h13" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="5" cy="5" r="0.6" fill="currentColor" />
      <path d="M5 9.2h5.5M5 11.4h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M8.2 10.2c.5-1 1.4-1.6 2.4-1.6s1.9.6 2.4 1.6c-.5 1-1.4 1.6-2.4 1.6s-1.9-.6-2.4-1.6Z" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10.6" cy="10.2" r="0.7" fill="currentColor" />
      <circle cx="16.4" cy="16.2" r="3.3" stroke="#C2410C" strokeWidth="1.6" />
      <path d="M18.8 18.6 21 20.8" stroke="#C2410C" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M15.2 16.2h2.4M16.4 15v2.4" stroke="#C2410C" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
