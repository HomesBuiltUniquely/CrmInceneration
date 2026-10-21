"use client";

import { format } from "date-fns";
import { formatMeetingValue, type MeetingRecord, type MeetingStatus } from "@/lib/meeting-management-data";
import { focusRing } from "./motion";
import { RowActionsMenu } from "./RowActionsMenu";

const AVATAR: Record<MeetingRecord["avatarTone"], string> = {
  blue: "bg-[#E0ECFF] text-[#1E40AF]",
  green: "bg-[#F0FDF4] text-[#14532D]",
  violet: "bg-[#F3E8FF] text-[#6B21A8]",
  amber: "bg-[#FEF3C7] text-[#92400E]",
  rose: "bg-[#FEF3F2] text-[#B42318]",
};

function StatusChip({ tone }: { tone: { bg: string; text: string; dot: string; label: string } }) {
  return (
    <span
      className="inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold"
      style={{ background: tone.bg, color: tone.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.dot }} />
      {tone.label}
    </span>
  );
}

const STATUS: Record<MeetingStatus, { bg: string; text: string; dot: string; label: string }> = {
  SCHEDULED: { bg: "#E0ECFF", text: "#1E40AF", dot: "#1D4ED8", label: "Scheduled" },
  "IN PROGRESS": { bg: "#FEF3C7", text: "#92400E", dot: "#D97706", label: "In progress" },
  COMPLETED: { bg: "#F0FDF4", text: "#14532D", dot: "#15803D", label: "Completed" },
  RESCHEDULED: { bg: "#F3E8FF", text: "#6B21A8", dot: "#7C3AED", label: "Rescheduled" },
  CANCELLED: { bg: "#FEF3F2", text: "#B42318", dot: "#B42318", label: "Cancelled" },
};

const PROGRESS_CHIP: Record<NonNullable<MeetingRecord["progress"]>, { bg: string; text: string; dot: string; label: string }> = {
  SCHEDULED: { bg: "#E0ECFF", text: "#1E40AF", dot: "#1D4ED8", label: "Scheduled" },
  IN_PROGRESS: { bg: "#FEF3C7", text: "#92400E", dot: "#D97706", label: "In progress" },
  MEETING_SUCCESSFUL: { bg: "#F0FDF4", text: "#14532D", dot: "#15803D", label: "Meeting successful" },
};

export function MeetingRow({
  row,
  sequence,
  now,
  onView,
  onReschedule,
}: {
  row: MeetingRecord;
  sequence: number;
  now: number;
  onView: () => void;
  onReschedule: () => void;
}) {
  const progress = PROGRESS_CHIP[row.progress ?? "SCHEDULED"];
  const delay = row.quoteDelayed === true;
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
      <td className="border-b border-[#E3E8EE] py-2.5 pl-4 pr-1 align-middle">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-[#F4F6F8] px-1.5 text-[12px] font-bold text-[#334155]">
          {sequence}
        </span>
      </td>
      <td className="border-b border-[#E3E8EE] py-2.5 pl-1 pr-3 align-middle">
        <div className="flex items-center gap-2">
          <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${AVATAR[row.avatarTone]}`}>
            {row.initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-bold leading-tight text-[#0F172A]">{row.customer}</span>
            <span className="block truncate text-[13px] font-normal leading-tight text-[#5B6778]">{row.phone || "—"}</span>
          </span>
        </div>
      </td>
      <td className="border-b border-[#E3E8EE] px-3 py-2.5 align-middle">
        <StatusChip tone={progress} />
      </td>
      <td className="border-b border-[#E3E8EE] px-3 py-2.5 align-middle text-[13px] font-semibold text-[#0F172A]">
        <span className="block truncate">{row.assignedSalesName?.trim() || "—"}</span>
      </td>
      <td className="border-b border-[#E3E8EE] px-3 py-2.5 align-middle">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-[#0F172A]">
          <MeetingTypeIcon type={row.meetingType} />
          {row.meetingType || "—"}
        </span>
      </td>
      <td className="border-b border-[#E3E8EE] px-3 py-2.5 align-middle">
        <span className={`block whitespace-nowrap text-[13px] font-bold leading-tight ${dateGreen ? "text-[#047857]" : "text-[#0F172A]"}`}>{dateLabel}</span>
        <span className="block whitespace-nowrap text-[12px] font-normal leading-tight text-[#5B6778]">{clock(row.startMin)}</span>
      </td>
      <td className="border-b border-[#E3E8EE] px-3 py-2.5 align-middle text-[13px] font-bold tabular-nums text-[#0F172A]">{formatMeetingValue(row.budget)}</td>
      <td className="border-b border-[#E3E8EE] px-3 py-2.5 align-middle">
        {row.quoteValue > 0 ? (
          <span className="inline-flex h-7 items-center text-[13px] font-bold tabular-nums text-[#0F172A]">{formatMeetingValue(row.quoteValue)}</span>
        ) : (
          <span className="inline-flex h-7 items-center rounded-full bg-[#F4F6F8] px-2.5 text-[12px] font-semibold text-[#94A3B8]">No quote</span>
        )}
      </td>
      <td className="border-b border-[#E3E8EE] px-3 py-2.5 align-middle">
        {delay ? (
          <span className="inline-flex h-7 items-center whitespace-nowrap rounded-full bg-[#FEF3F2] px-2.5 text-[12px] font-bold text-[#B42318]">
            Delayed
          </span>
        ) : (
          <span className="inline-flex h-7 items-center whitespace-nowrap rounded-full bg-[#F0FDF4] px-2.5 text-[12px] font-semibold text-[#15803D]">On time</span>
        )}
      </td>
      <td className="border-b border-[#E3E8EE] px-3 py-2.5 align-middle">
        <RowActionsMenu customer={row.customer} onView={onView} onReschedule={onReschedule} />
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
