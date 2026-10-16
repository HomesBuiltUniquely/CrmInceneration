"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { formatSlotClock, getSlotMode, type SlotMeeting } from "@/lib/meeting-slot";
import { HOUR_MIN_PX, SLOT_EASE } from "../slot-constants";
import { CompactRows } from "./CompactRows";
import { CountCard } from "./CountCard";
import { SlotPopover } from "./SlotPopover";

export function SlotCell({
  dayKey,
  hour,
  heading,
  meetings,
  today,
  nowLabel,
  nowOffset,
  loading,
  highlightId,
  renderSingle,
  onCreate,
  onReschedule,
  onViewDetails,
}: {
  dayKey: string;
  hour: number;
  heading: string;
  meetings: SlotMeeting[];
  today?: boolean;
  /** 0–1 position inside this hour. Set only on today's current hour. */
  nowOffset?: number;
  nowLabel?: string;
  loading?: boolean;
  highlightId?: string;
  renderSingle: (meeting: SlotMeeting) => ReactNode;
  onCreate: (date: string, minutes: number) => void;
  onReschedule?: (meeting: SlotMeeting) => void;
  onViewDetails?: (meeting: SlotMeeting) => void;
}) {
  const reduce = useReducedMotion();
  const mode = loading ? "single" : getSlotMode(meetings.length);
  const hourLabel = formatSlotClock(hour * 60);
  return (
    <motion.div
      layout
      transition={{ duration: reduce ? 0.12 : 0.22, ease: SLOT_EASE }}
      className="relative min-h-[52px] border-b border-l border-[#F1F5F9] p-1"
              style={{ minHeight: HOUR_MIN_PX, background: today ? "#F0FDF4" : undefined }}
      onDoubleClick={() => onCreate(dayKey, hour * 60)}
    >
      {loading ? (
        <motion.div
          className="h-[52px] rounded-lg bg-[#F1F4F7]"
          animate={{ opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
      {!loading && mode === "single" && meetings[0] ? renderSingle(meetings[0]) : null}
      {!loading && mode === "compact" ? (
        <CompactRows meetings={meetings} highlightId={highlightId} onReschedule={onReschedule} onViewDetails={onViewDetails} />
      ) : null}
      {!loading && mode === "count" ? (
        <SlotPopover
          meetings={meetings}
          heading={heading}
          hourLabel={hourLabel}
          highlightId={highlightId}
          onSchedule={() => onCreate(dayKey, hour * 60)}
          onReschedule={onReschedule}
          onViewDetails={onViewDetails}
        >
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`${meetings.length} meetings, ${heading}`}
            onDoubleClick={(event) => event.stopPropagation()}
            className="group w-full"
          >
            <CountCard meetings={meetings} label={`${meetings.length} meetings`} />
          </button>
        </SlotPopover>
      ) : null}
      {nowLabel != null && nowOffset != null ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
          style={{ top: `calc(${nowOffset * 100}% )` }}
          role="presentation"
        >
          <span className="absolute -left-1 h-2 w-2 -translate-y-1/2 rounded-full bg-[#EF4444]" />
          <span className="h-0.5 w-full bg-[#EF4444]" />
          <span className="absolute left-2 -translate-y-1/2 rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {nowLabel}
          </span>
        </div>
      ) : null}
    </motion.div>
  );
}
