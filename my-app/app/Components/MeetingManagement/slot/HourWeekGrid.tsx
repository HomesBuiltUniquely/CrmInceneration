"use client";

import { useEffect, useState } from "react";

import { formatMeetingValue } from "@/lib/meeting-management-data";
import {
  blankToEmpty,
  formatSlotClock,
  groupMeetingsByDayHour,
  meetingTypeKind,
  type SlotMeeting,
} from "@/lib/meeting-slot";
import { cn } from "@/lib/cn";
import { focusRing } from "../motion";
import { SlotCell } from "./SlotCell";

export function HourWeekGrid({
  days,
  todayKey,
  hours,
  events,
  loading,
  highlightId,
  onOpen,
  onCreate,
  onReschedule,
}: {
  days: Date[];
  todayKey: string;
  hours: number[];
  events: SlotMeeting[];
  loading?: boolean;
  highlightId?: string;
  onOpen: (meeting: SlotMeeting) => void;
  onCreate: (date: string, minutes: number) => void;
  onReschedule?: (meeting: SlotMeeting) => void;
}) {
  const grouped = groupMeetingsByDayHour(events);
  const [nowMin, setNowMin] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setNowMin(now.getHours() * 60 + now.getMinutes());
    };
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  const nowHour = Math.floor(nowMin / 60);
  const todayVisible = days.some((day) => isoDay(day) === todayKey);
  const shownHours = todayVisible && nowHour >= 0 && nowHour <= 23 && !hours.includes(nowHour)
    ? [...hours, nowHour].sort((a, b) => a - b)
    : hours;
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e6edf5] bg-white font-[family-name:var(--font-manrope)]">
      <SlotMotionStyles />
      <div className="grid" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="border-b border-r border-[#f1f5f9] px-2 py-3 text-[10px] font-bold text-[#94a3b8]">GMT+5:30</div>
        {days.map((day) => {
          const key = isoDay(day);
          const active = key === todayKey;
          const count = events.filter((event) => event.date === key).length;
          return (
            <div key={key} className={cn("border-b border-[#f1f5f9] px-2 py-2 text-center", active && "bg-[#F0FDF4]")}>
              <div className={cn("text-[10px] font-bold tracking-[0.14em]", active ? "text-[#15803D]" : "text-[#94a3b8]")}>
                {active ? "TODAY" : day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
              </div>
              {active ? (
                <div className="mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#22C55E] text-[13px] font-bold text-[#052E16]">
                  {day.getDate()}
                </div>
              ) : (
                <div className="text-[13px] font-bold text-[#334155]">
                  {day.getDate()} {day.toLocaleDateString("en-US", { month: "short" })}
                </div>
              )}
              <div className={cn("text-[11px] font-semibold", active ? "text-[#15803D]" : "text-[#5B6778]")}>
                {active ? day.toLocaleDateString("en-US", { month: "short" }) : count > 0 ? `${count} ${count === 1 ? "meeting" : "meetings"}` : ""}
              </div>
              {active && count > 0 ? <div className="text-[11px] font-semibold text-[#5B6778]">{count} {count === 1 ? "meeting" : "meetings"}</div> : null}
            </div>
          );
        })}
        {shownHours.map((hour) => (
          <HourRow key={hour} hour={hour} days={days} todayKey={todayKey} nowMin={shownHours.includes(nowHour) ? nowMin : null} grouped={grouped} loading={loading} highlightId={highlightId} onOpen={onOpen} onCreate={onCreate} onReschedule={onReschedule} />
        ))}
      </div>
    </div>
  );
}

function HourRow({
  hour,
  days,
  todayKey,
  nowMin,
  grouped,
  loading,
  highlightId,
  onOpen,
  onCreate,
  onReschedule,
}: {
  hour: number;
  days: Date[];
  todayKey: string;
  nowMin: number | null;
  grouped: ReturnType<typeof groupMeetingsByDayHour<SlotMeeting>>;
  loading?: boolean;
  highlightId?: string;
  onOpen: (meeting: SlotMeeting) => void;
  onCreate: (date: string, minutes: number) => void;
  onReschedule?: (meeting: SlotMeeting) => void;
}) {
  return (
    <>
      <div className="flex min-h-[52px] items-start justify-end border-b border-r border-[#f1f5f9] pr-2 pt-1 text-[10px] font-bold text-[#94a3b8]">
        {formatSlotClock(hour * 60)}
      </div>
      {days.map((day) => {
        const key = isoDay(day);
        const meetings = grouped[key]?.[hour] ?? [];
        return (
          <SlotCell
            key={`${key}-${hour}`}
            dayKey={key}
            hour={hour}
            heading={slotHeading(key, hour)}
            meetings={meetings}
            today={key === todayKey}
            nowLabel={key === todayKey && nowMin != null && Math.floor(nowMin / 60) === hour ? formatSlotClock(nowMin) : undefined}
            nowOffset={key === todayKey && nowMin != null && Math.floor(nowMin / 60) === hour ? (nowMin % 60) / 60 : undefined}
            loading={loading}
            highlightId={highlightId}
            onCreate={onCreate}
            onReschedule={onReschedule}
            onViewDetails={onOpen}
            renderSingle={(meeting) => <StandardMeetingCard meeting={meeting} highlightId={highlightId} onOpen={onOpen} />}
          />
        );
      })}
    </>
  );
}

function StandardMeetingCard({
  meeting,
  highlightId,
  onOpen,
}: {
  meeting: SlotMeeting;
  highlightId?: string;
  onOpen: (meeting: SlotMeeting) => void;
}) {
  const kind = meetingTypeKind(meeting.meetingType);
  const box =
    kind === "virtual"
      ? "border-[#86efac] bg-[#f0fdf4]"
      : kind === "unset"
        ? "border-[#d8b4fe] bg-[#faf5ff]"
        : "border-[#60a5fa] bg-white shadow-[0_8px_18px_rgba(37,99,235,0.08)]";
  const time = kind === "virtual" ? "text-[#16a34a]" : kind === "unset" ? "text-[#7c3aed]" : "text-[#2563eb]";
  const name = blankToEmpty(meeting.customer);
  const type = blankToEmpty(meeting.meetingType);
  const designer = blankToEmpty(meeting.designer);
  const value = Number.isFinite(meeting.value) && (meeting.value ?? 0) > 0 ? formatMeetingValue(meeting.value ?? 0) : "";
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(meeting);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      className={cn("w-full overflow-hidden rounded-lg border px-1.5 py-1 text-left", box, highlightId === meeting.id && "slot-flash", focusRing)}
    >
      <div className={cn("truncate text-[10px] font-bold leading-tight", time)}>{formatSlotClock(meeting.startMin)}</div>
      <div className="truncate text-[12px] font-bold leading-tight text-[#0f172a]">{name}</div>
      {type ? <div className="truncate text-[10px] font-semibold leading-tight text-[#64748b]">{type}</div> : null}
      {value || designer ? <div className="mt-0.5 truncate text-[10px] font-semibold text-[#64748b]">{value || designer}</div> : null}
    </button>
  );
}

function slotHeading(dayKey: string, hour: number): string {
  const [year, month, date] = dayKey.split("-").map(Number);
  const day = new Date(year, (month ?? 1) - 1, date ?? 1);
  const label = day.toLocaleDateString("en-US", { weekday: "short" });
  return `${label} ${date} · ${formatSlotClock(hour * 60)}`;
}

function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function SlotMotionStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
        .slot-pop[data-state="open"]{animation:slot-pop-in 200ms cubic-bezier(0.2,0.8,0.2,1)}
        .slot-pop[data-state="closed"]{animation:slot-pop-out 120ms cubic-bezier(0.2,0.8,0.2,1)}
        @keyframes slot-pop-in{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
        @keyframes slot-pop-out{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(0.95)}}
        .slot-status-pulse{animation:slot-status-pulse 2s ease-in-out infinite}
        @keyframes slot-status-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.8)}}
        .slot-flash{animation:slot-flash 1.2s ease-out}
        @keyframes slot-flash{0%{box-shadow:0 0 0 2px #22C55E}100%{box-shadow:0 0 0 0 transparent}}
        .slot-scroll{scrollbar-width:thin;scrollbar-color:#94A3B8 transparent}
        .slot-scroll::-webkit-scrollbar{width:8px}
        .slot-scroll::-webkit-scrollbar-thumb{background:#94A3B8;border-radius:999px}
        @media (prefers-reduced-motion: reduce){
          .slot-pop[data-state="open"],.slot-pop[data-state="closed"]{animation-duration:120ms}
          .slot-status-pulse,.slot-flash{animation:none}
        }
      `,
      }}
    />
  );
}
