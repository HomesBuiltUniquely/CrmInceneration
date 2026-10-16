"use client";

import { useRef, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { motion, useReducedMotion } from "framer-motion";
import {
  blankToEmpty,
  formatSlotClock,
  meetingTypeKind,
  slotAriaLabel,
  type SlotMeeting,
} from "@/lib/meeting-slot";
import { focusRing } from "../motion";
import { SLOT_EASE, SLOT_TYPE } from "../slot-constants";
import { MeetingDetailsPopover } from "./MeetingDetailsPopover";
import { StatusIcon } from "./StatusIcon";
import { TypeIcon } from "./TypeTag";

export function SlotPopover({
  meetings,
  heading,
  hourLabel,
  highlightId,
  onSchedule,
  onReschedule,
  onViewDetails,
  children,
}: {
  meetings: SlotMeeting[];
  heading: string;
  hourLabel: string;
  highlightId?: string;
  onSchedule: () => void;
  onReschedule?: (meeting: SlotMeeting) => void;
  onViewDetails?: (meeting: SlotMeeting) => void;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="slot-pop z-[70] w-[244px] rounded-2xl border border-[#E3E8EE] bg-white font-[family-name:var(--font-manrope)] shadow-[0_12px_32px_rgba(15,23,42,0.16)]"
          style={{ transformOrigin: "var(--radix-popover-content-transform-origin)" }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            const rows = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-slot-row]") ?? [])];
            const index = rows.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === "ArrowDown" ? index + 1 : index - 1;
            if (rows[next]) {
              event.preventDefault();
              rows[next].focus();
            }
          }}
        >
          <div className="flex items-center justify-between gap-2 px-3 pt-3">
            <p className="min-w-0 truncate text-[14px] font-bold text-[#0F172A]">{heading}</p>
            <span className="shrink-0 rounded-full bg-[#F0FDF4] px-2 py-0.5 text-[12px] font-semibold text-[#14532D]">{meetings.length}</span>
          </div>
          <div ref={listRef} className="slot-scroll mt-2 max-h-[280px] overflow-y-auto px-1.5">
            {meetings.map((meeting, index) => {
              const kind = meetingTypeKind(meeting.meetingType);
              const token = SLOT_TYPE[kind];
              const name = blankToEmpty(meeting.customer);
              const designer = blankToEmpty(meeting.designer);
              const time = formatSlotClock(meeting.startMin);
              const meta = [time, designer].filter(Boolean).join(" · ");
              return (
                <motion.div
                  key={meeting.id}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduce ? 0.12 : 0.2, delay: reduce ? 0 : index * 0.025, ease: SLOT_EASE }}
                >
                  <MeetingDetailsPopover meeting={meeting} onReschedule={onReschedule} onViewDetails={onViewDetails}>
                    <button
                      type="button"
                      data-slot-row
                      aria-label={slotAriaLabel(meeting)}
                      className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-1.5 py-1 text-left hover:bg-[#F8FAFC] ${focusRing} ${
                        highlightId === meeting.id ? "slot-flash" : ""
                      }`}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                        style={{ background: token.bg, borderColor: token.border, color: token.dot }}
                      >
                        <TypeIcon kind={kind} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold text-[#0F172A]">{name}</span>
                        {meta ? <span className="block truncate text-[12px] font-semibold text-[#5B6778]">{meta}</span> : null}
                      </span>
                      <StatusIcon status={meeting.status} />
                    </button>
                  </MeetingDetailsPopover>
                </motion.div>
              );
            })}
          </div>
          <div className="p-2">
            <button
              type="button"
              onClick={onSchedule}
              className={`flex h-11 w-full items-center justify-center rounded-xl border border-dashed border-[#94A3B8] text-[13px] font-semibold text-[#334155] ${focusRing}`}
            >
              + Schedule at {hourLabel}
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
