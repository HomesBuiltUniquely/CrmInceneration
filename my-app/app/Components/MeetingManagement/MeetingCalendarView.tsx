"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  formatMeetingValue,
  isQuoteDelayed,
  meetingBoardStats,
  MEETING_TYPES,
  type MeetingRecord,
} from "@/lib/meeting-management-data";
import { KpiCard } from "./KpiCard";
import { HourWeekGrid } from "./slot/HourWeekGrid";
import { MeetingDetailsPopover } from "./slot/MeetingDetailsPopover";
import { EASE, fadeUp, focusRing } from "./motion";

const numberFormat = new Intl.NumberFormat("en-IN");
const ALERTS_HIDE_KEY = "hub-meetings-alerts-hide-until";

type Span = "day" | "week" | "month";
type Channel = "all" | "showroom" | "meet" | "site";

type CalEvent = {
  id: string;
  date: string;
  startMin: number;
  duration: number;
  customer: string;
  line: string;
  sub: string;
  channel: Exclude<Channel, "all">;
  location: string;
  designer: string;
  sales: string;
  meetingType: string;
  value: number;
  budget: number;
  quoteValue: number;
  ec: string;
  badge?: string;
  badgeClass?: string;
  tone: "blue" | "green" | "violet" | "rose" | "teal";
  showStart?: boolean;
  quote?: string;
  scheduleNote?: string;
  phone?: string;
  status?: string;
};

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17];
const HOUR_PX = 84;
const START_MIN = 9 * 60;
const TYPES = [...MEETING_TYPES];

const BADGE_CLASS: Record<string, string> = {
  "HIGH INTENT": "bg-[#dcfce7] text-[#15803d]",
  WARM: "bg-[#ffedd5] text-[#c2410c]",
  "TOKEN PAID": "bg-[#f3e8ff] text-[#7c3aed]",
  RESCHEDULED: "bg-[#f3e8ff] text-[#7c3aed]",
  CANCELLED: "bg-[#fee2e2] text-[#dc2626]",
  COMPLETED: "bg-[#dcfce7] text-[#15803d]",
  "IN PROGRESS": "bg-[#ffedd5] text-[#c2410c]",
  SCHEDULED: "bg-[#e0f2fe] text-[#0369a1]",
};

function channelOf(type: string): CalEvent["channel"] {
  const key = type.toUpperCase();
  if (key.includes("VIRTUAL") || key.includes("MEET")) return "meet";
  if (key.includes("SITE")) return "site";
  return "showroom";
}

function toCard(row: MeetingRecord): CalEvent {
  const channel = row.meetingType === "—" ? "showroom" : channelOf(row.meetingType);
  const tone: CalEvent["tone"] =
    row.meetingStatus === "CANCELLED" ? "rose" : channel === "meet" ? "green" : channel === "site" ? "violet" : "blue";
  const badge =
    row.meetingStatus === "CANCELLED"
      ? "CANCELLED"
      : row.meetingStatus === "RESCHEDULED"
        ? "RESCHEDULED"
        : row.status === "COMPLETED"
          ? "COMPLETED"
          : row.status === "IN PROGRESS"
            ? "IN PROGRESS"
            : "SCHEDULED";
  return {
    id: String(row.id),
    date: row.date,
    startMin: row.startMin,
    duration: row.durationMin ?? 90,
    customer: row.customer,
    line: row.meetingType,
    sub: row.assignee,
    channel,
    location: row.meetingType,
    designer: row.assignee,
    sales: row.assignedSalesName?.trim() ?? "",
    meetingType: row.meetingType,
    value: row.value,
    budget: row.budget,
    quoteValue: row.quoteValue,
    ec: ecLabel(row.branch),
    badge,
    badgeClass: BADGE_CLASS[badge] ?? BADGE_CLASS.SCHEDULED,
    tone,
    quote: row.quoteNo,
    scheduleNote: row.quoteNo ? `${row.assignee} • Quote ${row.quoteNo}` : row.assignee,
    phone: row.phone?.trim() ?? "",
    status: row.status === "IN PROGRESS" ? "In progress" : row.status === "COMPLETED" ? "Completed" : "Scheduled",
  };
}

function iso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIso(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const min = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(min).padStart(2, "0")} ${suffix}`;
}

function formatHourLabel(hour: number): string {
  return formatClock(hour * 60);
}

function IconTable() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 10H20M10 10V19" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3.5V6.5M16 3.5V6.5M4 9.5H20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default function MeetingCalendarView({
  onShowTable,
  onShowQuoteSent,
  onShowQuoteDelayed,
  onShowMeetingSuccessful,
  meetings,
  quoteSentMeetings = [],
  loading,
  loadError,
  onReload,
  onRescheduleMeeting,
}: {
  onShowTable: () => void;
  onShowQuoteSent: () => void;
  onShowQuoteDelayed: () => void;
  onShowMeetingSuccessful: () => void;
  meetings: MeetingRecord[];
  quoteSentMeetings?: MeetingRecord[];
  loading?: boolean;
  loadError?: string;
  onReload?: () => void;
  onRescheduleMeeting?: (meetingId: string) => void;
}) {
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const [span, setSpan] = useState<Span>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [slideDir, setSlideDir] = useState(1);
  const [channel, setChannel] = useState<Channel>("all");
  const [query, setQuery] = useState("");
  const events = useMemo(() => meetings.map(toCard), [meetings]);
  const monthKey = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}`;
  const viewingCurrentMonth = anchor.getFullYear() === today.getFullYear() && anchor.getMonth() === today.getMonth();
  const monthLabel = anchor.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  const monthTitle = anchor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const monthMeetings = useMemo(
    () => meetings.filter((row) => row.date.startsWith(monthKey)),
    [meetings, monthKey],
  );
  const stats = useMemo(() => meetingBoardStats(monthMeetings), [monthMeetings]);
  const quoteDelayedCount = useMemo(() => monthMeetings.filter((row) => isQuoteDelayed(row)).length, [monthMeetings]);
  const monthQuoteSent = useMemo(
    () => (quoteSentMeetings ?? []).filter((row) => row.date.startsWith(monthKey)).length,
    [monthKey, quoteSentMeetings],
  );
  const monthEvents = useMemo(() => events.filter((event) => event.date.startsWith(monthKey)), [events, monthKey]);
  const channelCounts = useMemo(
    () => ({
      all: monthEvents.length,
      showroom: monthEvents.filter((event) => event.meetingType === "Showroom Visit").length,
      meet: monthEvents.filter((event) => event.meetingType === "Virtual Meeting").length,
      site: monthEvents.filter((event) => event.meetingType === "Site Visit").length,
    }),
    [monthEvents],
  );
  const reduce = useReducedMotion();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [draftDate, setDraftDate] = useState("2026-10-13");
  const [draftTime, setDraftTime] = useState("09:00");
  const [draftName, setDraftName] = useState("");
  const designers = useMemo(
    () => [...new Set(meetings.map((row) => row.assignee).filter((name) => name && name !== "Unassigned"))].sort(),
    [meetings],
  );
  const [draftDesigner, setDraftDesigner] = useState("");
  const [draftType, setDraftType] = useState(TYPES[0]);
  const [draftLocation, setDraftLocation] = useState<CalEvent["channel"]>("showroom");
  const [alertsOn, setAlertsOn] = useState(true);
  const [notice, setNotice] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [scheduleAtBottom, setScheduleAtBottom] = useState(false);
  const scheduleListRef = useRef<HTMLUListElement>(null);

  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: span === "day" ? 1 : 7 }, (_, index) =>
    addDays(span === "day" ? anchor : weekStart, index),
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (channel === "showroom" && event.meetingType !== "Showroom Visit") return false;
      if (channel === "meet" && event.meetingType !== "Virtual Meeting") return false;
      if (channel === "site" && event.meetingType !== "Site Visit") return false;
      if (!needle) return true;
      return `${event.customer} ${event.quote ?? ""} ${event.designer} ${event.line}`.toLowerCase().includes(needle);
    });
  }, [channel, events, query]);

  const shift = (dir: number) => {
    setSlideDir(dir);
    setAnchor((current) => {
      if (span === "month") return new Date(current.getFullYear(), current.getMonth() + dir, 1);
      if (span === "day") return addDays(current, dir);
      return addDays(current, dir * 7);
    });
  };

  const stepMonth = (dir: number) => {
    setSlideDir(dir);
    setAnchor((current) => new Date(current.getFullYear(), current.getMonth() + dir, 1));
  };

  const requestReschedule = (meeting: { id: string; date: string; startMin: number }) => {
    if (onRescheduleMeeting) {
      onRescheduleMeeting(meeting.id);
      return;
    }
    openSchedule(meeting.date, clockInput(meeting.startMin));
  };

  const openSchedule = (date: string, time: string) => {
    setDraftDate(date);
    setDraftTime(time);
    setDraftName("");
    setScheduleOpen(true);
  };

  const saveSchedule = () => {
    setScheduleOpen(false);
    setNotice("Schedule the meeting on the lead. This board only shows appointments saved on the server.");
  };

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      const until = window.localStorage.getItem(ALERTS_HIDE_KEY);
      if (until && until >= iso(today)) setAlertsOn(false);
    } catch {
      /* ignore */
    }
  }, [today]);

  const todayEvents = visible
    .filter((event) => event.date === iso(today))
    .sort((a, b) => a.startMin - b.startMin);
  const nowMin = (() => {
    const n = new Date(nowTick);
    return n.getHours() * 60 + n.getMinutes();
  })();
  const openEvents = events.filter((event) => event.badge !== "CANCELLED" && event.badge !== "COMPLETED");
  const running = openEvents
    .filter((event) => event.date === iso(today) && event.startMin <= nowMin && nowMin < event.startMin + Math.max(event.duration, 1))
    .sort((a, b) => a.startMin - b.startMin)[0];
  const nextUp = openEvents
    .filter((event) => event.id !== running?.id)
    .filter((event) => event.date > iso(today) || (event.date === iso(today) && event.startMin > nowMin))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)[0];
  const liveToday = running ?? (nextUp && nextUp.date === iso(today) ? nextUp : null);
  const remainingToday = todayEvents.filter(
    (event) => event.badge !== "CANCELLED" && event.badge !== "COMPLETED" && event.startMin >= nowMin,
  );
  const soon = todayEvents.filter(
    (event) => event.badge !== "CANCELLED" && event.badge !== "COMPLETED" && event.startMin >= nowMin && event.startMin - nowMin <= 30,
  );
  const showroomToday = todayEvents.filter((event) => event.channel === "showroom").length;
  const nextIndex = Math.max(
    0,
    todayEvents.findIndex((event) => event.id === liveToday?.id),
  );

  useEffect(() => {
    const list = scheduleListRef.current;
    if (!list || nextIndex < 0) return;
    const row = list.children[nextIndex] as HTMLElement | undefined;
    if (!row) return;
    const top = row.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
    list.scrollTop = Math.max(0, top - 8);
  }, [nextIndex, todayEvents.length]);

  const hideAlerts = () => {
    setAlertsOn(false);
    try {
      window.localStorage.setItem(ALERTS_HIDE_KEY, iso(today));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="w-full font-[family-name:var(--font-manrope)] text-[#0F172A]">
      <motion.header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between" {...fadeUp(reduce, 8)}>
        <div>
          <h1 className="text-[26px] font-bold leading-none tracking-[-0.03em]">Meetings</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-normal text-[#5B6778]">Track, reschedule and follow up on every customer meeting.</p>
            <span
              title={viewingCurrentMonth ? "These numbers are for the current month" : "These numbers follow the month on the calendar"}
              className={`inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-semibold ${
                viewingCurrentMonth ? "bg-[#E8F1FF] text-[#1B3FA8]" : "bg-[#F1F5F9] text-[#334155]"
              }`}
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
                <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              {monthLabel}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="inline-flex items-center rounded-2xl border border-[#E6EAF0] bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="relative inline-flex h-8 items-center rounded-xl bg-[#F3F5F8] p-0.5" role="group" aria-label="Meetings view">
            <button type="button" onClick={onShowTable} className={`relative inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold text-[#5F6675] transition-colors hover:text-[#14171F] ${focusRing}`}>
              <IconTable />
              List
            </button>
            <button type="button" className={`relative inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold text-[#0B6B45] ${focusRing}`}>
              <motion.span layoutId="meeting-view-pill" className="absolute inset-0 rounded-lg bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]" transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }} />
              <span className="relative inline-flex items-center gap-1.5">
                <IconCalendar />
                Calendar
              </span>
            </button>
          </div>
          </div>
        </div>
      </motion.header>

      <section className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2" aria-label="Meeting totals">
        <KpiCard ready={!loading} label="Scheduled" value={stats.scheduled} hint="Upcoming meetings" chip={`${numberFormat.format(stats.today)} today`} chipClass="bg-[#E0ECFF] text-[#1E40AF]" iconClass="bg-[#E0ECFF] text-[#1D4ED8]" icon={<CalIcon />} />
        <KpiCard ready={!loading} label="Meeting successful" value={stats.meetingSuccessful} hint="Successful meetings" chip="Yes" chipClass="bg-[#E0ECFF] text-[#1E40AF]" iconClass="bg-[#E0ECFF] text-[#1D4ED8]" icon={<CheckIcon />} onClick={onShowMeetingSuccessful} />
        <KpiCard ready={!loading} label="Cancelled" value={stats.cancelled} hint="Cancelled meetings" chip={`${stats.cancelledPct}%`} chipClass="bg-[#FEF3C7] text-[#92400E]" iconClass="bg-[#FEF3F2] text-[#B42318]" icon={<XIcon />} />
        <KpiCard ready={!loading} label="Quotes sent" value={monthQuoteSent} hint="Sales Admin leads" chip="Won + lost" chipClass="bg-[#F0FDF4] text-[#15803D]" iconClass="bg-[#F0FDF4] text-[#15803D]" icon={<DocIcon />} onClick={onShowQuoteSent} />
        <KpiCard ready={!loading} label="Quote delayed" value={quoteDelayedCount} hint="After meeting successful" chip="Over 4 hours" chipClass="bg-[#FEF3F2] text-[#B42318]" iconClass="bg-[#FEF3F2] text-[#B42318]" icon={<DelayIcon />} onClick={onShowQuoteDelayed} />
      </section>

      {loading ? <p className="mt-3 text-[13px] font-semibold text-[#5B6778]">Loading meetings…</p> : null}
      {loadError ? <p className="mt-3 text-[13px] font-semibold text-[#B42318]">{loadError}</p> : null}
      {notice ? <p className="mt-3 text-[13px] font-semibold text-[#15803D]">{notice}</p> : null}

      <div className="mt-4 grid items-stretch gap-4 max-[1100px]:grid-cols-1 min-[1101px]:grid-cols-[minmax(0,1fr)_320px]">
        <motion.div className="flex h-full min-w-0 flex-col rounded-[18px] border border-[#E3E8EE] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]" {...fadeUp(reduce, 8, 0.08)}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="inline-flex h-8 shrink-0 items-center rounded-xl bg-[#F3F5F8] p-0.5" aria-label="Visible month">
              <button type="button" onClick={() => stepMonth(-1)} aria-label="Previous month" className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-[16px] font-semibold text-[#334155] hover:bg-white ${focusRing}`}>
                ‹
              </button>
              <span className="min-w-[128px] px-1 text-center text-[12px] font-semibold text-[#14171F]">{monthTitle}</span>
              <button type="button" onClick={() => stepMonth(1)} aria-label="Next month" className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-[16px] font-semibold text-[#334155] hover:bg-white ${focusRing}`}>
                ›
              </button>
            </div>
            <label className="flex h-8 min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-[#E3E8EE] bg-white px-2.5 focus-within:border-[#334155] focus-within:ring-2 focus-within:ring-[#334155]/15">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[#94a3b8]" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16 16.5L20 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search customer or designer"
                className="w-full bg-transparent text-[12px] font-medium outline-none placeholder:text-[#94a3b8]"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setSlideDir(anchor.getTime() <= today.getTime() ? 1 : -1);
                setSpan("week");
                setAnchor(new Date(today));
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#B6E6C6] bg-[#F0FDF4] px-2.5 text-[12px] font-semibold text-[#14532D]"
            >
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden>
                <rect x="3" y="4.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3 8h14M7 3.2v2.6M13 3.2v2.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="10" cy="12.2" r="1.4" fill="currentColor" />
              </svg>
              Today
            </button>
            <div className="flex h-8 shrink-0 items-center rounded-xl bg-[#F3F5F8] p-0.5" role="group" aria-label="Calendar span">
              {(["day", "week", "month"] as Span[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSpan(item)}
                  className={cn(
                    "h-7 rounded-lg px-2.5 text-[12px] font-semibold capitalize transition-colors",
                    span === item ? "bg-white text-[#0B6B45] shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-[#5F6675] hover:text-[#14171F]",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Chip active={channel === "all"} onClick={() => setChannel("all")}>All {numberFormat.format(channelCounts.all)}</Chip>
            <Chip active={channel === "showroom"} onClick={() => setChannel("showroom")} dot="bg-[#1D4ED8]">Showroom visit {channelCounts.showroom}</Chip>
            <Chip active={channel === "meet"} onClick={() => setChannel("meet")} dot="bg-[#15803D]">Virtual meeting {channelCounts.meet}</Chip>
            <Chip active={channel === "site"} onClick={() => setChannel("site")} dot="bg-[#64748B]">Site visit {channelCounts.site}</Chip>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => shift(-1)}
              aria-label="Previous range"
              className="absolute left-0 top-1/2 z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#E3E8EE] bg-white text-[18px] font-semibold text-[#334155] shadow-[0_2px_8px_rgba(15,23,42,0.12)] transition-transform duration-150 hover:scale-105"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => shift(1)}
              aria-label="Next range"
              className="absolute right-0 top-1/2 z-20 flex h-9 w-9 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#E3E8EE] bg-white text-[18px] font-semibold text-[#334155] shadow-[0_2px_8px_rgba(15,23,42,0.12)] transition-transform duration-150 hover:scale-105"
            >
              ›
            </button>
            <div className="overflow-hidden">
              <AnimatePresence mode="wait" initial={false} custom={slideDir}>
                <motion.div
                  key={`${span}-${iso(days[0] ?? anchor)}`}
                  custom={slideDir}
                  variants={{
                    enter: (dir: number) => ({ x: reduce ? 0 : dir >= 0 ? 72 : -72, opacity: reduce ? 1 : 0 }),
                    center: { x: 0, opacity: 1 },
                    exit: (dir: number) => ({ x: reduce ? 0 : dir >= 0 ? -72 : 72, opacity: reduce ? 1 : 0 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={reduce ? { duration: 0 } : { duration: 0.32, ease: EASE }}
                >
                  {span === "month" ? (
                    <MonthGrid
                      anchor={anchor}
                      events={visible}
                      today={today}
                      onPick={(date) => {
                        setSlideDir(1);
                        setAnchor(date);
                        setSpan("day");
                      }}
                      onReschedule={(meeting) => requestReschedule(meeting)}
                    />
                  ) : (
                    <HourWeekGrid
                      days={days}
                      todayKey={iso(today)}
                      hours={HOURS}
                      monthDate={anchor}
                      events={visible}
                      loading={loading}
                      onCreate={(date, minutes) => openSchedule(date, `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`)}
                      onReschedule={(meeting) => requestReschedule(meeting)}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 text-[11px] font-semibold text-[#64748b]">
            <div className="flex flex-wrap items-center gap-3">
              <Legend icon={<BuildingIcon />} label="Showroom" />
              <Legend icon={<VideoIcon />} label="Virtual" />
              <Legend icon={<CheckCircleIcon />} label="Completed" />
              <Legend icon={<AmberDotIcon />} label="In progress" />
              <Legend icon={<ClockIcon />} label="Scheduled" />
            </div>
            <span>Double-click any open slot to schedule a meeting.</span>
          </div>
        </motion.div>

        <aside className="flex h-full flex-col gap-4">
          <article className="overflow-hidden rounded-[20px] bg-[linear-gradient(165deg,#0C1424_0%,#111C33_48%,#0B1220_100%)] p-4 text-white shadow-[0_12px_28px_rgba(15,23,42,0.16)] ring-1 ring-white/10">
            {running || nextUp ? (
              <div className="flex flex-col gap-3">
                {running ? (
                  <SpotlightRow
                    kind="live"
                    event={running}
                    why={liveWhy(running, nowMin)}
                    chip={nowMin - running.startMin < 1 ? "Just started" : `${nowMin - running.startMin} min in`}
                    onReschedule={(meeting) => requestReschedule(meeting)}
                  />
                ) : null}
                {running && nextUp ? <div className="h-px bg-white/10" /> : null}
                {nextUp ? (
                  <SpotlightRow
                    kind="next"
                    event={nextUp}
                    why={nextWhy(nextUp, iso(today), nowMin)}
                    chip={nextChip(nextUp, iso(today), nowMin)}
                    onReschedule={(meeting) => requestReschedule(meeting)}
                  />
                ) : null}
              </div>
            ) : (
              <div>
                <p className="text-[12px] font-bold tracking-[0.04em] text-[#94A3B8]">QUIET</p>
                <h2 className="mt-2 text-[20px] font-bold tracking-[-0.02em]">No meeting on the clock</h2>
                <p className="mt-1 text-[13px] text-[#94A3B8]">Nothing is running, and nothing is booked ahead of now.</p>
              </div>
            )}
          </article>

          <article className="rounded-[18px] border border-[#E3E8EE] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[14px] font-bold text-[#0F172A]">
                Today&apos;s schedule · {today.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </h2>
              <span className="text-[13px] font-bold text-[#15803D]">{remainingToday.length} remaining</span>
            </div>
            <ul
              ref={scheduleListRef}
              tabIndex={0}
              aria-label="Today's schedule"
              onScroll={(event) => {
                const el = event.currentTarget;
                setScheduleAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
              }}
              className="meeting-schedule-scroll mt-3 max-h-[300px] overflow-y-scroll pr-1"
            >
              {todayEvents.length === 0 ? (
                <li className="flex h-[60px] items-center text-[13px] font-semibold text-[#5B6778]">No meetings today</li>
              ) : (
                todayEvents.map((event) => {
                  const isNext = event.id === liveToday?.id;
                  return (
                    <li key={event.id} className="h-[60px]">
                      <MeetingDetailsPopover meeting={event} onReschedule={(meeting) => requestReschedule(meeting)}>
                      <button
                        type="button"
                        className={cn(
                          "flex h-full w-full items-center justify-between gap-2 rounded-xl px-2 text-left transition-colors duration-150 hover:bg-[#F5FAF8]",
                          isNext && "bg-[#F0FDF4]",
                          focusRing,
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-bold text-[#0F172A]">
                            {formatClock(event.startMin)} · {event.customer}
                          </span>
                          <span className="mt-0.5 block truncate text-[13px] font-normal text-[#5B6778]">{event.designer || "—"}</span>
                        </span>
                        <TypeTag type={event.meetingType} />
                      </button>
                      </MeetingDetailsPopover>
                    </li>
                  );
                })
              )}
            </ul>
            {todayEvents.length > 5 ? (
              <p
                className={cn(
                  "mt-2 flex items-center justify-between text-[12px] font-semibold text-[#5B6778] transition-opacity duration-150",
                  scheduleAtBottom ? "opacity-70" : "opacity-100",
                )}
              >
                <span>Showing 5 of {todayEvents.length} · scroll for more</span>
                <span className={cn("inline-block transition-transform duration-150", scheduleAtBottom && "rotate-180")}>↓</span>
              </p>
            ) : null}
          </article>

          <article className="rounded-[18px] border border-[#E3E8EE] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[14px] font-bold text-[#0F172A]">Urgent prep & alerts</h2>
              <span className="rounded-full bg-[#FFF6DA] px-2 py-0.5 text-[12px] font-bold text-[#78350F]">
                {alertsOn ? soon.length : 0} starting soon
              </span>
            </div>
            {alertsOn && soon.length > 0 ? (
              <div className="mt-3 space-y-2">
                {soon.map((event) => (
                  <motion.div
                    key={event.id}
                    layout
                    className="rounded-xl border border-[#F3DF9A] bg-[#FFF6DA] px-3 py-2"
                  >
                    <p className="text-[13px] font-bold text-[#78350F]">{event.customer}</p>
                    <p className="text-[12px] font-semibold text-[#92400E]">
                      {[formatClock(event.startMin), event.meetingType, event.designer].filter(Boolean).join(" · ")}
                    </p>
                  </motion.div>
                ))}
                <button type="button" onClick={hideAlerts} className={`pt-1 text-[12px] font-bold text-[#1D4ED8] ${focusRing}`}>
                  Hide for now →
                </button>
              </div>
            ) : (
              <p className="mt-3 text-[13px] font-semibold text-[#5B6778]">No meetings start in the next 30 minutes.</p>
            )}
          </article>

          <article className="mt-auto rounded-[18px] border border-[#E3E8EE] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <h2 className="text-[14px] font-bold text-[#0F172A]">Showroom / room status</h2>
            <p className="mt-2 text-[13px] font-semibold text-[#334155]">
              Showroom visits today: {showroomToday}. Room inventory is not on this feed.
            </p>
          </article>
        </aside>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .meeting-stack-scroll{scrollbar-width:thin;scrollbar-color:#cbd5e1 transparent}
        .meeting-stack-scroll::-webkit-scrollbar{width:4px}
        .meeting-stack-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:999px}
        .meeting-schedule-scroll{scrollbar-width:thin;scrollbar-color:#94a3b8 #f1f4f7}
        .meeting-schedule-scroll::-webkit-scrollbar{width:8px}
        .meeting-schedule-scroll::-webkit-scrollbar-track{background:#f1f4f7;border-radius:999px}
        .meeting-schedule-scroll::-webkit-scrollbar-thumb{background:#94a3b8;border-radius:999px}
        .meeting-schedule-scroll::-webkit-scrollbar-thumb:hover{background:#64748b}
      `,
        }}
      />

      {scheduleOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setScheduleOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-[#0f172a]">Schedule meeting</h3>
            <div className="mt-3 grid gap-3">
              <Field label="Customer"><input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm font-semibold" /></Field>
              <Field label="Date"><input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm font-semibold" /></Field>
              <Field label="Time"><input type="time" value={draftTime} onChange={(e) => setDraftTime(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm font-semibold" /></Field>
              <Field label="Designer">
                <select value={draftDesigner} onChange={(e) => setDraftDesigner(e.target.value)} className="mt-1 w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm font-semibold">
                  {designers.map((name) => <option key={name}>{name}</option>)}
                </select>
              </Field>
              <Field label="Meeting type">
                <select value={draftType} onChange={(e) => setDraftType(e.target.value as (typeof TYPES)[number])} className="mt-1 w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm font-semibold">
                  {TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </Field>
              <Field label="Location">
                <select value={draftLocation} onChange={(e) => setDraftLocation(e.target.value as CalEvent["channel"])} className="mt-1 w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm font-semibold">
                  <option value="showroom">Showroom Visit</option>
                  <option value="meet">Virtual Meeting</option>
                  <option value="site">Site Visit</option>
                </select>
              </Field>
              <button type="button" disabled={!draftName.trim()} onClick={saveSchedule} className="rounded-xl bg-[#16a34a] py-2.5 text-xs font-extrabold text-white disabled:opacity-40">
                SAVE MEETING
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

function MonthGrid({
  anchor,
  events,
  today,
  onPick,
  onReschedule,
}: {
  anchor: Date;
  events: CalEvent[];
  today: Date;
  onPick: (date: Date) => void;
  onReschedule: (meeting: { id: string; date: string; startMin: number }) => void;
}) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => addDays(first, index - lead));
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e6edf5] bg-white">
      <div className="grid grid-cols-7 border-b border-[#f1f5f9] text-center text-[10px] font-extrabold tracking-[0.12em] text-[#94a3b8]">
        {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
          <div key={day} className="px-2 py-2">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const inMonth = day.getMonth() === anchor.getMonth();
          const key = iso(day);
          const items = events.filter((event) => event.date === key);
          return (
            <div
              key={key}
              className={cn(
                "min-h-[88px] border-b border-r border-[#f8fafc] p-2 text-left",
                sameDay(day, today) && "bg-[#F0FDF4] ring-1 ring-inset ring-[#22C55E]",
              )}
            >
              <button
                type="button"
                onClick={() => onPick(day)}
                className={cn(
                  "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-bold",
                  sameDay(day, today) ? "bg-[#22C55E] text-[#052E16]" : inMonth ? "text-[#334155]" : "text-[#cbd5e1]",
                )}
              >
                {day.getDate()}
              </button>
              <div className="mt-1 space-y-1">
                {items.slice(0, 2).map((event) => (
                  <MeetingDetailsPopover key={event.id} meeting={event} onReschedule={onReschedule}>
                    <button type="button" className="block w-full truncate rounded-md bg-[#F4F6F8] px-1 py-0.5 text-left text-[10px] font-semibold text-[#334155] hover:bg-[#E8EEF6]">
                      {formatClock(event.startMin).replace(/^0/, "")} {event.customer}
                    </button>
                  </MeetingDetailsPopover>
                ))}
                {items.length > 2 ? (
                  <button type="button" onClick={() => onPick(day)} className="px-1 text-[10px] font-semibold text-[#64748B]">
                    +{items.length - 2} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children, dot }: { active: boolean; onClick: () => void; children: ReactNode; dot?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-[border-color,background-color,transform] duration-150",
        active
          ? "border-[1.5px] border-[#22C55E] bg-[#F0FDF4] text-[#14532D]"
          : "border border-[#E3E8EE] bg-white text-[#475569] hover:-translate-y-px",
        focusRing,
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dot)} /> : null}
      {children}
    </button>
  );
}

function TypeTag({ type }: { type: string }) {
  if (!type || type === "—") {
    return <span className="shrink-0 rounded-full border border-[#DDE3EA] bg-[#F1F4F7] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]">—</span>;
  }
  if (type.toLowerCase().includes("virtual")) {
    return <span className="shrink-0 rounded-full border border-[#B6E6C6] bg-[#E5F7EC] px-2 py-0.5 text-[11px] font-semibold text-[#15803D]">{type}</span>;
  }
  if (type.toLowerCase().includes("site")) {
    return <span className="shrink-0 rounded-full border border-[#DDE3EA] bg-[#F1F4F7] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]">{type}</span>;
  }
  return <span className="shrink-0 rounded-full border border-[#BFD6FF] bg-[#E6F0FF] px-2 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">{type}</span>;
}

function Legend({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[#475569]">
      {icon}
      {label}
    </span>
  );
}

function CalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M6 12.5L10 16.5L18 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function DelayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14 3.5V9h5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
function BuildingIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#1D4ED8]" fill="none" aria-hidden>
      <path d="M3 14V4.5L8 2l5 2.5V14M3 14h10M6 7h1M9 7h1M6 10h1M9 10h1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function VideoIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#15803D]" fill="none" aria-hidden>
      <rect x="2" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10 7l4-2v6l-4-2V7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#15803D]" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 8.2l1.7 1.7 3.3-3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function AmberDotIcon() {
  return (
    <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center" role="img" aria-label="In progress">
      <span className="absolute h-3 w-3 rounded-full bg-[#F59E0B]/25" />
      <span className="relative h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
    </span>
  );
}
function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[#1D4ED8]" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5v3.2L10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="text-[11px] font-bold text-[#64748b]">{label}{children}</label>;
}

function liveWhy(event: CalEvent, nowMin: number): string {
  const elapsed = Math.max(0, nowMin - event.startMin);
  const until = formatClock(event.startMin + event.duration);
  if (elapsed < 1) return `This meeting just started and is still inside its slot until ${until}.`;
  return `This meeting is running. It started ${elapsed} min ago and stays booked until ${until}.`;
}

function nextWhy(event: CalEvent, todayIso: string, nowMin: number): string {
  const at = formatClock(event.startMin);
  if (event.date === todayIso) {
    const mins = Math.max(0, event.startMin - nowMin);
    if (mins <= 1) return `This is the next meeting, and it starts at ${at}.`;
    return `This is the next meeting still ahead. It starts in ${mins} min, at ${at}.`;
  }
  const when = parseIso(event.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `Nothing else is left today. The next meeting is ${when} at ${at}.`;
}

function nextChip(event: CalEvent, todayIso: string, nowMin: number): string {
  if (event.date !== todayIso) return parseIso(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const mins = Math.max(0, event.startMin - nowMin);
  if (mins < 60) return `In ${mins} min`;
  return formatClock(event.startMin);
}

function SpotlightRow({
  kind,
  event,
  why,
  chip,
  onReschedule,
}: {
  kind: "live" | "next";
  event: CalEvent;
  why: string;
  chip: string;
  onReschedule: (meeting: { id: string; date: string; startMin: number }) => void;
}) {
  const live = kind === "live";
  const lead = event.value > 0 ? formatMeetingValue(event.value) : "";
  const meta = [event.meetingType, event.designer].filter(Boolean).join(" · ");
  return (
    <MeetingDetailsPopover meeting={event} onReschedule={onReschedule}>
      <button type="button" className={`w-full rounded-xl text-left ${focusRing}`}>
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.06em] ${live ? "text-[#86EFAC]" : "text-[#93C5FD]"}`}>
            {live ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22C55E]" />
              </span>
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-[#60A5FA]" />
            )}
            {live ? "LIVE NOW" : "NEXT"}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${live ? "bg-[#14532D] text-[#86EFAC]" : "bg-white/10 text-[#DBEAFE]"}`}>
            {chip}
          </span>
        </div>
        <p className={`mt-2 font-bold leading-tight tracking-[-0.02em] ${live ? "text-[22px]" : "text-[18px]"}`}>{event.customer}</p>
        {meta ? <p className="mt-0.5 truncate text-[12px] font-semibold text-[#CBD5E1]">{meta}</p> : null}
        <p className={`mt-1.5 text-[12px] leading-snug ${live ? "text-[#86EFAC]" : "text-[#BFDBFE]"}`}>{why}</p>
        <div className="mt-2 flex items-center justify-between gap-2 text-[12px] font-semibold text-[#E2E8F0]">
          <span>
            {formatClock(event.startMin)}
            {event.duration > 0 ? ` – ${formatClock(event.startMin + event.duration)}` : ""}
          </span>
          {lead ? <span>Lead {lead}</span> : null}
        </div>
      </button>
    </MeetingDetailsPopover>
  );
}

function clockInput(startMin: number): string {
  return `${String(Math.floor(startMin / 60)).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}`;
}

function ecLabel(branch?: string): string {
  const raw = (branch ?? "").trim();
  if (!raw) return "";
  const key = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (key === "HBR" || key.startsWith("HBR")) return "HBR";
  if (key.includes("JP") && key.includes("NAGAR")) return "JP Nagar";
  if (key.includes("SARJAPUR")) return "Sarjapur";
  return raw.replace(/_/g, " ");
}
