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
  const sales = blankToEmpty(meeting.sales);
  const type = meetingTypeKind(meeting.meetingType) === "unset" ? "" : blankToEmpty(meeting.meetingType);
  const progress = progressLabel(meeting.status);
  const ec = blankToEmpty(meeting.ec);
  const budget = Number.isFinite(meeting.budget) ? formatMeetingValue(meeting.budget ?? 0) : "";
  const quote = Number.isFinite(meeting.quoteValue) && (meeting.quoteValue ?? 0) > 0 ? formatMeetingValue(meeting.quoteValue ?? 0) : "";
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          side="right"
          sideOffset={8}
          collisionPadding={16}
          className="slot-pop z-[200] w-[244px] rounded-2xl border border-[#E3E8EE] bg-white p-3 font-[family-name:var(--font-manrope)] shadow-[0_12px_32px_rgba(15,23,42,0.16)]"
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
            <Detail label="Sales" value={sales || "—"} />
            {progress ? (
              <div className="flex items-center justify-between gap-2">
                <dt className="font-normal text-[#5B6778]">Progress</dt>
                <dd className="inline-flex items-center gap-1 font-semibold text-[#0F172A]">
                  {knownSlotStatus(meeting.status) ? <StatusIcon status={knownSlotStatus(meeting.status)!} /> : null}
                  {progress}
                </dd>
              </div>
            ) : null}
            <Detail
              label="EC"
              value={ec ? <span className="inline-flex h-5 items-center rounded-full bg-[#FDECEC] px-2 text-[11px] font-semibold text-[#9B1C1C]">{ec}</span> : "—"}
            />
            {budget ? <Detail label="Budget" value={budget} /> : null}
            {quote ? <Detail label="Quote" value={quote} /> : null}
          </dl>
          <div className={`mt-3 grid gap-2 ${onViewDetails ? "grid-cols-2" : "grid-cols-1"}`}>
            <button
              type="button"
              className={`h-11 rounded-xl border border-[#E3E8EE] text-[13px] font-semibold text-[#0F172A] ${focusRing}`}
              onClick={() => onReschedule?.(meeting)}
            >
              Reschedule
            </button>
            {onViewDetails ? (
              <button
                type="button"
                className={`h-11 rounded-xl bg-[#22C55E] text-[13px] font-bold text-[#052E16] ${focusRing}`}
                onClick={() => onViewDetails(meeting)}
              >
                View details
              </button>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function progressLabel(status: string | undefined): string {
  const known = knownSlotStatus(status);
  if (known === "IN PROGRESS") return "In progress";
  if (known === "COMPLETED") return "Completed";
  if (known === "SCHEDULED") return "Scheduled";
  return blankToEmpty(status);
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="shrink-0 font-normal text-[#5B6778]">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-[#0F172A]">{value}</dd>
    </div>
  );
}
