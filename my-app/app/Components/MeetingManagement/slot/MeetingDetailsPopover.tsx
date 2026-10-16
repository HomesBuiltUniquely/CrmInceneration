"use client";

import type { ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { formatMeetingValue } from "@/lib/meeting-management-data";
import {
  blankToEmpty,
  formatSlotClock,
  knownSlotStatus,
  meetingTypeKind,
  type SlotMeeting,
} from "@/lib/meeting-slot";
import { focusRing } from "../motion";
import { StatusIcon } from "./StatusIcon";
import { TypeTag } from "./TypeTag";

export function MeetingDetailsPopover({
  meeting,
  children,
  onReschedule,
  onViewDetails,
}: {
  meeting: SlotMeeting;
  children: ReactNode;
  onReschedule?: (meeting: SlotMeeting) => void;
  onViewDetails?: (meeting: SlotMeeting) => void;
}) {
  const name = blankToEmpty(meeting.customer);
  const phone = blankToEmpty(meeting.phone);
  const designer = blankToEmpty(meeting.designer);
  const type = meetingTypeKind(meeting.meetingType) === "unset" ? "" : blankToEmpty(meeting.meetingType);
  const status = knownSlotStatus(meeting.status);
  const value = Number.isFinite(meeting.value) && (meeting.value ?? 0) > 0 ? formatMeetingValue(meeting.value ?? 0) : "";
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="slot-pop z-[80] w-[244px] rounded-2xl border border-[#E3E8EE] bg-white p-3 font-[family-name:var(--font-manrope)] shadow-[0_12px_32px_rgba(15,23,42,0.16)]"
          style={{ transformOrigin: "var(--radix-popover-content-transform-origin)" }}
        >
          <p className="text-[14px] font-bold text-[#0F172A]">{name}</p>
          <p className="mt-0.5 text-[12px] font-semibold text-[#5B6778]">{formatSlotClock(meeting.startMin)}</p>
          <dl className="mt-3 space-y-1.5 text-[13px]">
            {phone ? <Detail label="Phone" value={phone} /> : null}
            {type ? (
              <div className="flex items-center justify-between gap-2">
                <dt className="font-normal text-[#5B6778]">Type</dt>
                <dd><TypeTag type={meeting.meetingType} /></dd>
              </div>
            ) : null}
            {designer ? <Detail label="Designer" value={designer} /> : null}
            {value ? <Detail label="Value" value={value} /> : null}
            {status ? (
              <div className="flex items-center justify-between gap-2">
                <dt className="font-normal text-[#5B6778]">Status</dt>
                <dd className="inline-flex items-center gap-1 font-semibold text-[#0F172A]">
                  <StatusIcon status={status} />
                  {status === "IN PROGRESS" ? "In progress" : status === "COMPLETED" ? "Completed" : "Scheduled"}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`h-11 rounded-xl border border-[#E3E8EE] text-[13px] font-semibold text-[#0F172A] ${focusRing}`}
              onClick={() => onReschedule?.(meeting)}
            >
              Reschedule
            </button>
            <button
              type="button"
              className={`h-11 rounded-xl bg-[#22C55E] text-[13px] font-bold text-[#052E16] ${focusRing}`}
              onClick={() => onViewDetails?.(meeting)}
            >
              View details
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="font-normal text-[#5B6778]">{label}</dt>
      <dd className="truncate font-semibold text-[#0F172A]">{value}</dd>
    </div>
  );
}
