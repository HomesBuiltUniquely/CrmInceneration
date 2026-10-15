"use client";

import { motion, useReducedMotion } from "framer-motion";
import { focusRing, hoverLift } from "./motion";

export function EmptyState({ onClear }: { onClear: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="flex flex-col items-center justify-center px-6 py-16 text-center"
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.22 }}
    >
      <p className="text-[16px] font-semibold text-[#0F172A]">No meetings match these filters</p>
      <p className="mt-1 text-[14px] font-normal text-[#5B6778]">Try a wider date range or clear the people and label filters.</p>
      <motion.button
        type="button"
        onClick={onClear}
        className={`mt-4 inline-flex h-11 items-center rounded-xl bg-[#22C55E] px-4 text-[14px] font-bold text-[#052E16] shadow-[0_6px_14px_rgba(34,197,94,0.35)] ${focusRing}`}
        {...hoverLift(reduce)}
      >
        Clear filters
      </motion.button>
    </motion.div>
  );
}
