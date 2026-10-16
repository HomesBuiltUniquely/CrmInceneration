"use client";

import { motion, useReducedMotion } from "framer-motion";
import { format } from "date-fns";
import { formatMeetingValue, type MeetingRecord, type MeetingStatus } from "@/lib/meeting-management-data";
import { focusRing, hoverLift } from "./motion";
import { RowActionsMenu } from "./RowActionsMenu";

const AVATAR: Record<MeetingRecord["avatarTone"], string> = {
  blue: "bg-[#E0ECFF] text-[#1E40AF]",
  green: "bg-[#F0FDF4] text-[#14532D]",
  violet: "bg-[#F3E8FF] text-[#6B21A8]",
  amber: "bg-[#FEF3C7] text-[#92400E]",
  rose: "bg-[#FEF3F2] text-[#B42318]",
};

const STATUS: Record<MeetingStatus, { bg: string; text: string; dot: string; label: string }> = {
  SCHEDULED: { bg: "#E0ECFF", text: "#1E40AF", dot: "#1D4ED8", label: "Scheduled" },
  "IN PROGRESS": { bg: "#FEF3C7", text: "#92400E", dot: "#D97706", label: "In progress" },
  COMPLETED: { bg: "#F0FDF4", text: "#14532D", dot: "#15803D", label: "Completed" },
  RESCHEDULED: { bg: "#F3E8FF", text: "#6B21A8", dot: "#7C3AED", label: "Rescheduled" },
  CANCELLED: { bg: "#FEF3F2", text: "#B42318", dot: "#B42318", label: "Cancelled" },
};

export function MeetingRow({
  row,
  sequence,
  onView,
  onReschedule,
  onCancel,
}: {
  row: MeetingRecord;
  sequence: number;
  onView: () => void;
  onReschedule: () => void;
  onCancel: () => void;
}) {
  const reduce = useReducedMotion();
  const status = STATUS[row.status];
  const dateLabel = row.dayOffset === 0 ? "Today" : row.dayOffset === 1 ? "Tomorrow" : format(new Date(`${row.date}T00:00:00`), "d MMM yyyy");
  const dateGreen = row.dayOffset === 0 || row.dayOffset === 1;
  return (
    <tr
      tabIndex={0}
      onClick={onView}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onView();
        }
      }}
      className={`meeting-row group relative z-0 cursor-pointer outline-none hover:z-10 focus-visible:z-10 ${focusRing}`}
    >
      <td className="border-b border-[#E3E8EE] px-3 py-2">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-[#F4F6F8] px-1.5 text-[12px] font-bold text-[#334155]">
          {sequence}
        </span>
      </td>
      <td className="border-b border-[#E3E8EE] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${AVATAR[row.avatarTone]}`}>
            {row.initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-bold text-[#0F172A]">{row.customer}</span>
            <span className="block truncate text-[13px] font-normal text-[#5B6778]">{row.phone || "—"}</span>
          </span>
        </div>
      </td>
      <td className="border-b border-[#E3E8EE] px-3 py-2">
        <span
          className="inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold"
          style={{ background: status.bg, color: status.text }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.dot }} />
          {status.label}
        </span>
      </td>
      <td className="border-b border-[#E3E8EE] px-3 py-2 text-[13px] font-semibold text-[#0F172A]">{row.assignee || "—"}</td>
      <td className="border-b border-[#E3E8EE] px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0F172A]">
          <MeetingTypeIcon type={row.meetingType} />
          {row.meetingType || "—"}
        </span>
      </td>
      <td className="border-b border-[#E3E8EE] px-3 py-2">
        <span className={`block text-[13px] font-bold ${dateGreen ? "text-[#047857]" : "text-[#0F172A]"}`}>{dateLabel}</span>
        <span className="block text-[12px] font-normal text-[#5B6778]">{clock(row.startMin)}</span>
      </td>
      <td className="border-b border-[#E3E8EE] px-3 py-2 text-[13px] font-bold text-[#0F172A]">{formatMeetingValue(row.budget)}</td>
      <td className="border-b border-[#E3E8EE] px-3 py-2 text-[13px] font-bold text-[#0F172A]">{formatMeetingValue(row.quoteValue)}</td>
      <td className="border-b border-[#E3E8EE] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <motion.button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onReschedule();
            }}
            className={`inline-flex h-8 items-center rounded-lg border border-[#8FD3B5] bg-[#F3FBF7] px-2.5 text-[12px] font-semibold text-[#065F46] hover:border-[#065F46] hover:bg-[#E7F8EE] ${focusRing}`}
            {...hoverLift(reduce)}
          >
            Reschedule
          </motion.button>
          <RowActionsMenu customer={row.customer} onView={onView} onCancel={onCancel} />
        </div>
      </td>
    </tr>
  );
}

function clock(startMin: number) {
  const hour = Math.floor(startMin / 60);
  const minute = startMin % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function MeetingTypeIcon({ type }: { type: string }) {
  if (type.toLowerCase().includes("virtual")) {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#1D4ED8]" fill="none" aria-hidden>
        <rect x="3" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M15 10.5L20 8v8l-5-2.5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#14532D]" fill="none" aria-hidden>
      <path d="M4 20V9l8-5 8 5v11" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 20v-6h4v6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
