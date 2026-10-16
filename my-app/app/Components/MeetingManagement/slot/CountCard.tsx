"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { blankToEmpty, meetingTypeKind, type SlotMeeting } from "@/lib/meeting-slot";
import { focusRing } from "../motion";
import { SLOT_EASE, SLOT_TYPE } from "../slot-constants";

export function CountCard({
  meetings,
  label,
}: {
  meetings: SlotMeeting[];
  label: string;
}) {
  const reduce = useReducedMotion();
  const dots = meetings.slice(0, 3).map((meeting) => meetingTypeKind(meeting.meetingType));
  const names = meetings.map((meeting) => blankToEmpty(meeting.customer)).filter(Boolean);
  const preview = names.slice(0, 2).join(", ");
  const extra = meetings.length - 2;
  const summary = extra > 0 && preview ? `${preview} +${extra} more` : preview;
  return (
    <motion.span
      className={`flex h-16 w-full flex-col justify-center rounded-xl border-[1.5px] border-[#94A3B8] bg-white px-3 py-2.5 text-left hover:border-[#475569] ${focusRing}`}
      whileHover={reduce ? undefined : { y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.18, ease: SLOT_EASE }}
    >
      <span className="flex items-center gap-2">
        <span className="flex items-center">
          {dots.map((kind, index) => (
            <span
              key={`${kind}-${index}`}
              className="h-3.5 w-3.5 rounded-full ring-2 ring-white"
              style={{ background: SLOT_TYPE[kind].dot, marginLeft: index === 0 ? 0 : -5 }}
            />
          ))}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={meetings.length}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: SLOT_EASE }}
            className="min-w-0 flex-1 truncate text-[14px] font-bold text-[#0F172A]"
          >
            {label}
          </motion.span>
        </AnimatePresence>
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-[#64748B] transition-transform duration-150 group-hover:translate-x-0.5" fill="none" aria-hidden>
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {summary ? <span className="mt-1 block truncate text-[12px] font-semibold text-[#5B6778]">{summary}</span> : null}
    </motion.span>
  );
}
