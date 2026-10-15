"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  formatMeetingValue,
  meetingBoardStats,
  MEETING_TYPES,
  type MeetingRecord,
} from "@/lib/meeting-management-data";
import { KpiCard } from "./KpiCard";
import { HourWeekGrid } from "./slot/HourWeekGrid";
import { EASE, fadeUp, focusRing, hoverLift } from "./motion";

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
  meetingType: string;
  value: number;
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
    row.status === "CANCELLED" ? "rose" : channel === "meet" ? "green" : channel === "site" ? "violet" : "blue";
  const badge =
    row.status === "CANCELLED"
      ? "CANCELLED"
      : row.status === "COMPLETED"
        ? "COMPLETED"
        : row.status === "RESCHEDULED"
          ? "RESCHEDULED"
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
    meetingType: row.meetingType,
    value: row.value,
    badge,
    badgeClass: BADGE_CLASS[badge] ?? BADGE_CLASS.SCHEDULED,
    tone,
    quote: row.quoteNo,
    scheduleNote: row.quoteNo ? `${row.assignee} • Quote ${row.quoteNo}` : row.assignee,
    phone: row.phone?.trim() ?? "",
    status: row.status,
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
  meetings,
  quoteSentCount = 0,
  loading,
  loadError,
  onReload,
}: {
  onShowTable: () => void;
  onShowQuoteSent: () => void;
  meetings: MeetingRecord[];
  quoteSentCount?: number;
  loading?: boolean;
  loadError?: string;
  onReload?: () => void;
}) {
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const [span, setSpan] = useState<Span>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [slideDir, setSlideDir] = useState(1);
  const [channel, setChannel] = useState<Channel>("all");
  const [designer, setDesigner] = useState("all");
  const [meetingType, setMeetingType] = useState("all");
  const [query, setQuery] = useState("");
  const events = useMemo(() => meetings.map(toCard), [meetings]);
  const stats = useMemo(() => meetingBoardStats(meetings), [meetings]);
  const channelCounts = useMemo(
    () => ({
      all: events.length,
      showroom: events.filter((event) => event.meetingType === "Showroom Visit").length,
      meet: events.filter((event) => event.meetingType === "Virtual Meeting").length,
      site: events.filter((event) => event.meetingType === "Site Visit").length,
    }),
    [events],
  );
  const reduce = useReducedMotion();
  const [filterOpen, setFilterOpen] = useState(false);
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
  const [detail, setDetail] = useState<CalEvent | null>(null);
  const [started, setStarted] = useState(false);
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
      if (designer !== "all" && event.designer !== designer) return false;
      if (meetingType !== "all" && event.meetingType !== meetingType) return false;
      if (!needle) return true;
      return `${event.customer} ${event.quote ?? ""} ${event.designer} ${event.line}`.toLowerCase().includes(needle);
    });
  }, [channel, designer, events, meetingType, query]);

  const shift = (dir: number) => {
    setSlideDir(dir);
    setAnchor((current) => {
      if (span === "month") return new Date(current.getFullYear(), current.getMonth() + dir, 1);
      if (span === "day") return addDays(current, dir);
      return addDays(current, dir * 7);
    });
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
  const nextUp = events
    .filter((event) => event.badge !== "CANCELLED" && event.badge !== "COMPLETED")
    .filter((event) => event.date > iso(today) || (event.date === iso(today) && event.startMin >= nowMin))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)[0];
  const liveToday = nextUp && nextUp.date === iso(today) ? nextUp : null;
  const startsIn = liveToday ? Math.max(0, liveToday.startMin - nowMin) : null;
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
      <motion.header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between" {...fadeUp(reduce, 8)}>
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-[-0.03em]">Meetings</h1>
          <p className="mt-1 text-[15px] font-normal text-[#5B6778]">Track, reschedule and follow up on every customer meeting.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative inline-flex h-8 items-center rounded-lg bg-[#E8ECF0] p-0.5" role="group" aria-label="Meetings view">
            <button type="button" onClick={onShowTable} className={`relative inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[12px] font-semibold text-[#334155] ${focusRing}`}>
              <IconTable />
              List
            </button>
            <button type="button" className={`relative inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[12px] font-semibold text-[#0F172A] ${focusRing}`}>
              <motion.span layoutId="meeting-view-pill" className="absolute inset-0 rounded-md bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)]" transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }} />
              <span className="relative inline-flex items-center gap-1">
                <IconCalendar />
                Calendar
              </span>
            </button>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((open) => !open)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-bold ${focusRing} ${
                filterOpen || designer !== "all" || meetingType !== "all"
                  ? "border-[#1D4ED8] bg-[#EFF6FF] text-[#1E40AF]"
                  : "border-[#CBD5E1] bg-white text-[#0F172A]"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
                <path d="M4 6H20L14 12.5V18L10 16.2V12.5L4 6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              </svg>
              Filter
              {designer !== "all" || meetingType !== "all" ? (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#22C55E] px-1 text-[10px] font-bold text-[#052E16]">
                  {(designer !== "all" ? 1 : 0) + (meetingType !== "all" ? 1 : 0)}
                </span>
              ) : null}
            </button>
            {filterOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-56 rounded-2xl border border-[#e2e8f0] bg-white p-3 shadow-xl">
                <label className="block text-[10px] font-bold tracking-[0.12em] text-[#94a3b8]">DESIGNER</label>
                <select value={designer} onChange={(e) => setDesigner(e.target.value)} className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs font-semibold">
                  <option value="all">All designers</option>
                  {designers.map((name) => <option key={name}>{name}</option>)}
                </select>
                <label className="mt-3 block text-[10px] font-bold tracking-[0.12em] text-[#94a3b8]">TYPE</label>
                <select value={meetingType} onChange={(e) => setMeetingType(e.target.value)} className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs font-semibold">
                  <option value="all">All meeting types</option>
                  {TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </div>
            ) : null}
          </div>
          <motion.button
            type="button"
            onClick={() => openSchedule(iso(anchor), "10:00")}
            className={`group inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#22C55E] px-3 text-[12px] font-bold text-[#052E16] ${focusRing}`}
            {...hoverLift(reduce)}
          >
            <PlusIcon />
            Schedule meeting
          </motion.button>
        </div>
      </motion.header>

      <section className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-2.5" aria-label="Meeting totals">
        <KpiCard ready={!loading} label="Scheduled" value={stats.scheduled} hint="Upcoming meetings" chip={`${numberFormat.format(stats.today)} today`} chipClass="bg-[#E0ECFF] text-[#1E40AF]" iconClass="bg-[#E0ECFF] text-[#1D4ED8]" icon={<CalIcon />} />
        <KpiCard ready={!loading} label="Meetings done" value={stats.meetingsDone} hint="Experience & design" chip="Successful" chipClass="bg-[#F0FDF4] text-[#14532D]" iconClass="bg-[#F0FDF4] text-[#15803D]" icon={<CheckIcon />} />
        <KpiCard ready={!loading} label="Cancelled" value={stats.cancelled} hint="Cancelled meetings" chip={`${stats.cancelledPct}%`} chipClass="bg-[#FEF3C7] text-[#92400E]" iconClass="bg-[#FEF3F2] text-[#B42318]" icon={<XIcon />} />
        <KpiCard ready={!loading} label="Quotes sent" value={quoteSentCount} hint="Sales Admin leads" chip="Won + lost" chipClass="bg-[#F0FDF4] text-[#15803D]" iconClass="bg-[#F0FDF4] text-[#15803D]" icon={<DocIcon />} onClick={onShowQuoteSent} />
      </section>

      {loading ? <p className="mt-3 text-[13px] font-semibold text-[#5B6778]">Loading meetings…</p> : null}
      {loadError ? <p className="mt-3 text-[13px] font-semibold text-[#B42318]">{loadError}</p> : null}
      {notice ? <p className="mt-3 text-[13px] font-semibold text-[#15803D]">{notice}</p> : null}

      <div className="mt-4 grid items-stretch gap-4 max-[1100px]:grid-cols-1 min-[1101px]:grid-cols-[minmax(0,1fr)_320px]">
        <motion.div className="flex h-full min-w-0 flex-col rounded-[18px] border border-[#E3E8EE] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]" {...fadeUp(reduce, 8, 0.08)}>
          <div className="mb-2 flex items-center gap-2">
            <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#E3E8EE] bg-white px-2.5">
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
            <div className="flex h-8 shrink-0 items-center rounded-lg bg-[#E8ECF0] p-0.5" role="group" aria-label="Calendar span">
              {(["day", "week", "month"] as Span[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSpan(item)}
                  className={cn(
                    "h-7 rounded-md px-2.5 text-[12px] font-semibold capitalize",
                    span === item ? "bg-white text-[#0F172A] shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-[#64748b]",
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
                    />
                  ) : (
                    <HourWeekGrid
                      days={days}
                      todayKey={iso(today)}
                      hours={HOURS}
                      events={visible}
                      loading={loading}
                      onOpen={(meeting) => setDetail(meeting as CalEvent)}
                      onCreate={(date, minutes) => openSchedule(date, `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`)}
                      onReschedule={(meeting) =>
                        openSchedule(
                          meeting.date,
                          `${String(Math.floor(meeting.startMin / 60)).padStart(2, "0")}:${String(meeting.startMin % 60).padStart(2, "0")}`,
                        )
                      }
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
          <article className="rounded-[20px] bg-[#0F172A] p-5 text-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#86EFAC]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22C55E]" />
                </span>
                {started ? "LIVE NOW" : "LIVE NEXT UP"}
              </span>
              <span className="rounded-full bg-[#14532D] px-2 py-0.5 text-[11px] font-bold text-[#86EFAC]">
                {started
                  ? "IN ROOM"
                  : liveToday && startsIn != null
                    ? `STARTS IN ${startsIn} MINS`
                    : nextUp
                      ? "NEXT"
                      : "NONE"}
              </span>
            </div>
            <h2 className="mt-3 text-[26px] font-bold leading-tight tracking-[-0.02em]">
              {(liveToday ?? nextUp)?.customer ?? "No upcoming meeting"}
            </h2>
            <p className="mt-1 text-[13px] font-semibold text-[#CBD5E1]">
              {liveToday || nextUp
                ? [((liveToday ?? nextUp)!).meetingType, ((liveToday ?? nextUp)!).designer].filter(Boolean).join(" · ")
                : "Nothing scheduled ahead of now."}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px] font-semibold">
              <span>Type: {(liveToday ?? nextUp)?.meetingType || "—"}</span>
              <span>
                Lead:{" "}
                {(liveToday ?? nextUp)?.value && (liveToday ?? nextUp)!.value > 0
                  ? formatMeetingValue((liveToday ?? nextUp)!.value)
                  : "—"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <motion.button
                type="button"
                disabled={!liveToday && !nextUp}
                onClick={() => {
                  setStarted(true);
                  setNotice("Marked started on this screen. The server record stays as booked.");
                }}
                className={`rounded-xl bg-[#22C55E] py-2.5 text-[13px] font-bold text-[#052E16] disabled:opacity-40 ${focusRing}`}
                {...hoverLift(reduce)}
              >
                Open room
              </motion.button>
              <button
                type="button"
                disabled={!liveToday && !nextUp}
                onClick={() => setDetail(liveToday ?? nextUp ?? null)}
                className={`rounded-xl border border-white/25 py-2.5 text-[13px] font-bold text-white disabled:opacity-40 ${focusRing}`}
              >
                Client dossier
              </button>
            </div>
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
                      <button
                        type="button"
                        onClick={() => setDetail(event)}
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

      {detail ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-extrabold text-[#0f172a]">{detail.customer}</h3>
              <button type="button" onClick={() => setDetail(null)} className="text-[11px] font-bold text-[#94a3b8]">CLOSE</button>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Info label="When" value={`${detail.date} · ${formatClock(detail.startMin)}`} />
              <Info label="Type" value={detail.meetingType} />
              <Info label="Designer" value={detail.designer} />
              {detail.phone?.trim() ? <Info label="Phone" value={detail.phone} /> : null}
              {detail.status ? <Info label="Status" value={detail.status} /> : null}
              <Info label="Location" value={detail.location} />
              <Info label="Value" value={formatMeetingValue(detail.value)} />
              <Info label="Note" value={detail.line} />
            </dl>
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
}: {
  anchor: Date;
  events: CalEvent[];
  today: Date;
  onPick: (date: Date) => void;
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
            <button
              key={key}
              type="button"
              onClick={() => onPick(day)}
              className={cn(
                "min-h-[88px] border-b border-r border-[#f8fafc] p-2 text-left",
                sameDay(day, today) && "bg-[#F0FDF4] ring-1 ring-inset ring-[#22C55E]",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-bold",
                  sameDay(day, today) ? "bg-[#22C55E] text-[#052E16]" : inMonth ? "text-[#334155]" : "text-[#cbd5e1]",
                )}
              >
                {day.getDate()}
              </span>
              <div className="mt-1 space-y-1">
                {items.slice(0, 2).map((event) => (
                  <div key={event.id} className="truncate rounded-md bg-[#f8fafc] px-1 py-0.5 text-[10px] font-bold text-[#334155]">
                    {formatClock(event.startMin).replace(/^0/, "")} {event.customer}
                  </div>
                ))}
              </div>
            </button>
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 transition-transform duration-150 group-hover:rotate-90" fill="none" aria-hidden>
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold tracking-[0.12em] text-[#94a3b8]">{label.toUpperCase()}</dt>
      <dd className="mt-0.5 font-semibold text-[#0f172a]">{value}</dd>
    </div>
  );
}
