"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  blankToEmpty,
  formatSlotTime,
  meetingTypeKind,
  slotAriaLabel,
  type SlotMeeting,
} from "@/lib/meeting-slot";
import { focusRing } from "../motion";
import { COMPACT_VISIBLE, SLOT_EASE, SLOT_TYPE } from "../slot-constants";
import { MeetingDetailsPopover } from "./MeetingDetailsPopover";
import { StatusIcon } from "./StatusIcon";

export function CompactRows({
  meetings,
  highlightId,
  onReschedule,
  onViewDetails,
}: {
  meetings: SlotMeeting[];
  highlightId?: string;
  onReschedule?: (meeting: SlotMeeting) => void;
  onViewDetails?: (meeting: SlotMeeting) => void;
}) {
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const hidden = Math.max(0, meetings.length - COMPACT_VISIBLE);
  const shown = expanded || hidden === 0 ? meetings : meetings.slice(0, COMPACT_VISIBLE);
  return (
    <div className="flex flex-col gap-1">
      {shown.map((meeting, index) => {
        const kind = meetingTypeKind(meeting.meetingType);
        const token = SLOT_TYPE[kind];
        const name = blankToEmpty(meeting.customer);
        return (
          <MeetingDetailsPopover key={meeting.id} meeting={meeting} onReschedule={onReschedule} onViewDetails={onViewDetails}>
            <motion.button
              type="button"
              layout
              aria-label={slotAriaLabel(meeting)}
              onDoubleClick={(event) => event.stopPropagation()}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
              whileHover={reduce ? undefined : { y: -1 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: reduce ? 0.15 : 0.2, delay: reduce ? 0 : index * 0.02, ease: SLOT_EASE }}
              className={`group flex h-[30px] w-full items-center gap-1.5 rounded-lg border px-1.5 text-left hover:brightness-[0.97] hover:shadow-[0_4px_10px_rgba(15,23,42,0.10)] ${focusRing} ${
                highlightId === meeting.id ? "slot-flash" : ""
              }`}
              style={{ background: token.bg, borderColor: token.border, color: token.text }}
            >
              <span className="h-2 w-2 shrink-0 rounded-full transition-transform duration-150 group-hover:scale-125" style={{ background: token.dot }} />
              <span className="shrink-0 text-[12px] font-bold">{formatSlotTime(meeting.startMin)}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#0F172A]">{name}</span>
              <StatusIcon status={meeting.status} />
            </motion.button>
          </MeetingDetailsPopover>
        );
      })}
      {hidden > 0 ? (
        <button
          type="button"
          className={`h-[30px] rounded-lg bg-[#F0FDF4] text-[12px] font-bold text-[#14532D] ${focusRing}`}
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? "Show less" : `+${hidden} more`}
        </button>
      ) : null}
    </div>
  );
}
