"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchAvailabilityByDate,
  fetchAvailableDesignersForSlot,
  type AvailableDesignerRow,
} from "@/lib/appointment-client";
import DesignerEmailMissingDialog from "@/app/Components/Appointment/DesignerEmailMissingDialog";
import {
  buildHubMeetingDateTimeIso,
  formatHubTimeRange,
  HUB_MEETING_DURATION_MIN,
  listHubMeetingStartOptions,
  minutesToHubTimeLabel,
} from "@/lib/hub-meeting-schedule";
import { Button, FieldLabel, Textarea } from "./ui";
import { cn } from "@/lib/cn";

/** App root already loads Manrope — use font-sans / font-bold for Manrope Bold. */

const MEETING_TYPE_OPTIONS = [
  { label: "Showroom Visit", value: "SHOWROOM_VISIT", icon: "store" as const, hint: "In-person at showroom" },
  { label: "Virtual Meeting", value: "VIRTUAL_MEETING", icon: "video" as const, hint: "Link sent to customer" },
  { label: "Site Visit", value: "SITE_VISIT", icon: "map" as const, hint: "At customer property" },
] as const;

type StepId = "date" | "time" | "type" | "designer" | "notes";

const STEPS: { id: StepId; label: string }[] = [
  { id: "date", label: "Date" },
  { id: "time", label: "Time" },
  { id: "type", label: "Type" },
  { id: "designer", label: "Designer" },
  { id: "notes", label: "Notes" },
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Light green accent (previous Hub meeting look). */
const C = {
  primary: "#047857",
  dark: "#065F46",
  tint: "#E7F6EF",
  text: "#0F172A",
  muted: "#5B6778",
  border: "#E3E8EE",
  danger: "#B42318",
  dangerBg: "#FEF3F2",
  summaryBg: "#F4F7F6",
  backdrop: "#2B3140",
  focus: "#047857",
  softShadow: "0 8px 20px rgba(4, 120, 87, 0.22)",
};

export type ScheduleHubMeetingConfirmPayload = {
  designerName: string;
  designerEmail?: string;
  date: string;
  startTime: string;
  endTime: string;
  meetingType: "SHOWROOM_VISIT" | "VIRTUAL_MEETING" | "SITE_VISIT";
  notes: string;
};

export type ScheduleHubMeetingModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: ScheduleHubMeetingConfirmPayload) => Promise<void>;
  busy?: boolean;
  error?: string;
  leadCustomerName: string;
  leadDisplayId: string;
  status: string;
  path: string;
  feedback: string;
  hubMeetingPanelTitle: string;
  initialNote?: string;
  minDate: string;
  emailMissing?: boolean;
  scheduleInstruction?: ReactNode;
  onNotesChange?: (notes: string) => void;
};

function Icon({
  name,
  className,
}: {
  name:
    | "calendar"
    | "clock"
    | "person"
    | "check"
    | "close"
    | "store"
    | "video"
    | "map"
    | "note"
    | "chevronLeft"
    | "chevronRight"
    | "clear";
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    className: cn("h-5 w-5", className),
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "person":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19.5c1.8-3.2 4.2-4.8 7-4.8s5.2 1.6 7 4.8" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M5 12.5 10 17.5 19 7" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M7 7l10 10M17 7 7 17" />
        </svg>
      );
    case "store":
      return (
        <svg {...common}>
          <path d="M4 10h16l-1.2-4.5A2 2 0 0 0 16.9 4H7.1a2 2 0 0 0-1.9 1.5L4 10Z" />
          <path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9M10 20v-6h4v6" />
        </svg>
      );
    case "video":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="12" height="10" rx="2" />
          <path d="m15 10 5-2.5v9L15 14" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z" />
          <circle cx="12" cy="11" r="2" />
        </svg>
      );
    case "note":
      return (
        <svg {...common}>
          <path d="M7 4h7l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
          <path d="M14 4v4h4M8 12h8M8 16h6" />
        </svg>
      );
    case "chevronLeft":
      return (
        <svg {...common}>
          <path d="m15 5-6 7 6 7" />
        </svg>
      );
    case "chevronRight":
      return (
        <svg {...common}>
          <path d="m9 5 6 7-6 7" />
        </svg>
      );
    case "clear":
      return (
        <svg {...common}>
          <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7 7l1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12M10 11v6M14 11v6" />
        </svg>
      );
    default:
      return null;
  }
}

function parseYmd(value: string): { year: number; month: number; day: number } | null {
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

function toYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function parseFreeStartToMin(value: string, dateIso: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hm = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (hm) {
    let h = Number(hm[1]);
    const mins = Number(hm[2]);
    const ap = hm[3]?.toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h * 60 + mins;
  }
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) {
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (dateIso && local !== dateIso) return null;
    return d.getHours() * 60 + d.getMinutes();
  }
  const iso = trimmed.match(/T(\d{2}):(\d{2})/);
  if (iso) return Number(iso[1]) * 60 + Number(iso[2]);
  return null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function Stepper({
  step,
  stepIndex,
  unlocked,
  busy,
  onSelect,
}: {
  step: StepId;
  stepIndex: number;
  unlocked: (id: StepId) => boolean;
  busy: boolean;
  onSelect: (id: StepId) => void;
}) {
  return (
    <nav aria-label="Meeting schedule steps" className="flex items-center gap-0 px-0.5">
      {STEPS.map((s, i) => {
        const active = s.id === step;
        const done = i < stepIndex;
        const can = unlocked(s.id);
        return (
          <div key={s.id} className="flex min-w-0 flex-1 items-center">
            <button
              type="button"
              disabled={!can || busy}
              onClick={() => can && onSelect(s.id)}
              className={cn(
                "group flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-0.5 transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]",
                !can ? "cursor-not-allowed opacity-55" : "hover:-translate-y-0.5",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold transition duration-200",
                  active || done ? "text-white shadow-sm" : "border-2 bg-white text-[#5B6778]",
                  can && !active ? "group-hover:border-[#047857] group-hover:text-[#047857]" : "",
                )}
                style={
                  active || done
                    ? { backgroundColor: C.primary }
                    : { borderColor: C.border }
                }
              >
                {done && !active ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "truncate text-[13px] leading-none sm:text-[14px]",
                  active
                    ? "font-bold text-[#0F172A]"
                    : done
                      ? "font-bold text-[#0F172A]"
                      : "font-semibold text-[#5B6778]",
                )}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 ? (
              <div
                className="mx-0.5 mb-4 hidden h-px flex-1 transition-colors duration-300 sm:block"
                style={{ backgroundColor: done ? C.primary : C.border }}
                aria-hidden
              />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

function InfoCard({
  icon,
  label,
  value,
  sub,
  valueClassName,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  valueClassName?: string;
}) {
  return (
    <div
      className="hub-meet-card flex items-start gap-2.5 rounded-[14px] border bg-white px-3 py-2.5"
      style={{ borderColor: C.border }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition duration-200"
        style={{ backgroundColor: C.tint, color: C.primary }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: C.muted }}>
          {label}
        </p>
        <p
          className={cn("mt-0.5 truncate text-[13px] font-bold", valueClassName)}
          style={{ color: valueClassName ? undefined : C.text }}
        >
          {value}
        </p>
        <p className="mt-0.5 text-[11px] font-medium" style={{ color: C.muted }}>
          {sub}
        </p>
      </div>
    </div>
  );
}

function SummaryPanel({
  appointmentDate,
  meetingDateParts,
  timeLabel,
  meetingTypeLabel,
  meetingTypeHint,
  designerName,
  canClear,
  busy,
  onClearRequest,
}: {
  appointmentDate: string;
  meetingDateParts: { day: string; weekday: string; monthYear: string } | null;
  timeLabel: string;
  meetingTypeLabel: string;
  meetingTypeHint: string;
  designerName: string;
  canClear: boolean;
  busy: boolean;
  onClearRequest: () => void;
}) {
  return (
    <aside
      className="flex w-full flex-col gap-2 overflow-hidden p-3.5 lg:w-[300px] lg:shrink-0"
      style={{ backgroundColor: C.summaryBg }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: C.muted }}>
          Appointment summary
        </p>
        <button
          type="button"
          onClick={onClearRequest}
          disabled={busy || !canClear}
          aria-label="Delete appointment"
          title="Clear appointment"
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-xl transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B42318]",
            canClear && !busy
              ? "hover:scale-105 hover:shadow-sm active:scale-95"
              : "cursor-not-allowed opacity-40",
          )}
          style={{ backgroundColor: C.dangerBg, color: C.danger }}
        >
          <Icon name="clear" className="h-4 w-4" />
        </button>
      </div>

      <div
        className="animate-hub-meet-pop rounded-[16px] px-3.5 py-3 text-white shadow-sm transition duration-300"
        style={{ backgroundColor: C.dark }}
        key={appointmentDate || "empty"}
      >
        {meetingDateParts && appointmentDate ? (
          <div className="flex items-end gap-2.5">
            <p className="text-[36px] font-extrabold leading-none tracking-tight">
              {meetingDateParts.day}
            </p>
            <div className="min-w-0 pb-0.5">
              <p className="text-[12px] font-bold uppercase tracking-wide opacity-90">
                {meetingDateParts.weekday}
              </p>
              <p className="text-[13px] font-semibold opacity-90">{meetingDateParts.monthYear}</p>
              <span className="mt-1.5 inline-flex rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">
                Date selected
              </span>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[14px] font-bold">No date selected</p>
            <p className="mt-0.5 text-[11px] font-medium opacity-80">Pick a day to begin</p>
          </div>
        )}
      </div>

      <InfoCard
        icon={<Icon name="clock" className="h-4 w-4" />}
        label="Time"
        value={timeLabel || "Not set"}
        sub={timeLabel ? `${HUB_MEETING_DURATION_MIN} min · within hub hours` : "Choose in step 2"}
        valueClassName={timeLabel ? undefined : "text-amber-700"}
      />
      <InfoCard
        icon={<Icon name="video" className="h-4 w-4" />}
        label="Type"
        value={meetingTypeLabel || "Not set"}
        sub={meetingTypeLabel ? meetingTypeHint : "Choose in step 3"}
        valueClassName={meetingTypeLabel ? undefined : "text-amber-700"}
      />
      <InfoCard
        icon={<Icon name="person" className="h-4 w-4" />}
        label="Designer"
        value={designerName || "Not assigned"}
        sub={designerName ? "Assigned for this slot" : "Choose in step 4"}
        valueClassName={designerName ? undefined : "text-amber-700"}
      />
    </aside>
  );
}

function MeetingCalendar({
  minDate,
  appointmentDate,
  viewMonth,
  todayYmd,
  busy,
  onViewMonth,
  onSelectDate,
}: {
  minDate: string;
  appointmentDate: string;
  viewMonth: { year: number; month: number };
  todayYmd: string;
  busy: boolean;
  onViewMonth: (next: { year: number; month: number }) => void;
  onSelectDate: (ymd: string) => void;
}) {
  const monthTitle = useMemo(
    () =>
      new Date(viewMonth.year, viewMonth.month - 1, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [viewMonth.month, viewMonth.year],
  );

  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(viewMonth.year, viewMonth.month - 1, 1).getDay();
    const daysInMonth = new Date(viewMonth.year, viewMonth.month, 0).getDate();
    const cells: Array<{ day: number | null; ymd: string }> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, ymd: "" });
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ day, ymd: toYmd(viewMonth.year, viewMonth.month, day) });
    }
    return cells;
  }, [viewMonth.month, viewMonth.year]);

  return (
    <div className="w-full max-w-[520px]">
      <div className="mb-3">
        <h3 className="text-[20px] font-extrabold tracking-tight" style={{ color: C.text }}>
          Choose a date
        </h3>
        <p className="mt-0.5 text-[13px] font-medium" style={{ color: C.muted }}>
          Tap a day and we&apos;ll take you straight to the next step.
        </p>
      </div>

      <div className="mb-2.5 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onViewMonth(shiftMonth(viewMonth.year, viewMonth.month, -1))}
          aria-label="Previous month"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#E7F6EF] hover:shadow-sm active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]"
          style={{ borderColor: C.border, color: C.text }}
        >
          <Icon name="chevronLeft" />
        </button>
        <p className="text-[15px] font-extrabold" style={{ color: C.text }}>
          {monthTitle}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => onViewMonth(shiftMonth(viewMonth.year, viewMonth.month, 1))}
          aria-label="Next month"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#E7F6EF] hover:shadow-sm active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]"
          style={{ borderColor: C.border, color: C.text }}
        >
          <Icon name="chevronRight" />
        </button>
      </div>

      <div
        className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide"
        style={{ color: C.muted }}
      >
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="py-0.5">
            {label}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {calendarCells.map((cell, index) => {
          if (cell.day == null) {
            return <span key={`empty-${index}`} className="h-11" aria-hidden />;
          }
          const isSelected = cell.ymd === appointmentDate;
          const isPast = cell.ymd < minDate;
          const isToday = cell.ymd === todayYmd;
          const disabled = isPast || busy;
          return (
            <button
              key={cell.ymd}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={`Select ${cell.ymd}`}
              onClick={() => !disabled && onSelectDate(cell.ymd)}
              className={cn(
                "hub-meet-day flex h-11 w-full items-center justify-center rounded-[12px] text-[14px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]",
                isSelected
                  ? "text-white shadow-[0_8px_18px_rgba(4,120,87,0.3)]"
                  : isPast
                    ? "cursor-not-allowed text-[#C5CCD6] line-through"
                    : isToday
                      ? "bg-white text-[#047857] ring-2 ring-[#047857] hover:bg-[#E7F6EF] hover:shadow-md"
                      : "bg-white text-[#0F172A] hover:bg-[#E7F6EF] hover:shadow-md",
              )}
              style={isSelected ? { backgroundColor: C.primary } : undefined}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div
        className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px] font-medium"
        style={{ color: C.muted }}
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: C.primary }} />
          Selected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border-2 border-[#047857] bg-white" />
          Today
        </span>
        <span className="font-semibold">
          Hub hours 11:00 AM – 7:00 PM · {HUB_MEETING_DURATION_MIN} min
        </span>
      </div>
    </div>
  );
}

export default function ScheduleHubMeetingModal({
  open,
  onClose,
  onConfirm,
  busy = false,
  error = "",
  leadCustomerName,
  leadDisplayId,
  status: _status,
  path: _path,
  feedback: _feedback,
  hubMeetingPanelTitle: _hubMeetingPanelTitle,
  initialNote = "",
  minDate,
  emailMissing = false,
  scheduleInstruction: _scheduleInstruction,
  onNotesChange,
}: ScheduleHubMeetingModalProps) {
  const wasOpenRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [step, setStep] = useState<StepId>("date");
  const [outgoingStep, setOutgoingStep] = useState<StepId | null>(null);
  const [slideDir, setSlideDir] = useState<"forward" | "back">("forward");
  const [isSliding, setIsSliding] = useState(false);
  const [notes, setNotes] = useState(initialNote);
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SLIDE_MS = 580;
  const [meetingType, setMeetingType] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(minDate);
  const [selectedStartMin, setSelectedStartMin] = useState<number | null>(null);
  const [designer, setDesigner] = useState<AvailableDesignerRow | null>(null);
  const [availableDesigners, setAvailableDesigners] = useState<AvailableDesignerRow[]>([]);
  const [designersLoading, setDesignersLoading] = useState(false);
  const [dayLoading, setDayLoading] = useState(false);
  const [freeStartMins, setFreeStartMins] = useState<Set<number> | null>(null);
  const [showNoteError, setShowNoteError] = useState(false);
  const [localError, setLocalError] = useState("");
  const [emailMissingOpen, setEmailMissingOpen] = useState(false);
  const [emailMissingDesignerName, setEmailMissingDesignerName] = useState("");
  const [entered, setEntered] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const parsed = parseYmd(minDate);
    return parsed
      ? { year: parsed.year, month: parsed.month }
      : { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  });

  const startOptions = useMemo(() => listHubMeetingStartOptions(), []);
  const selectedEndMin =
    selectedStartMin !== null ? selectedStartMin + HUB_MEETING_DURATION_MIN : null;
  const meetingTypeOption = MEETING_TYPE_OPTIONS.find((o) => o.value === meetingType);
  const meetingTypeLabel = meetingTypeOption?.label ?? "";
  const meetingTypeHint = meetingTypeOption?.hint ?? "";
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const stepNumber = Math.max(1, stepIndex + 1);

  const todayYmd = useMemo(() => {
    const now = new Date();
    return toYmd(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }, []);

  const meetingDateParts = useMemo(() => {
    const parsed = parseYmd(appointmentDate);
    if (!parsed) return null;
    const d = new Date(parsed.year, parsed.month - 1, parsed.day);
    return {
      day: String(parsed.day),
      weekday: d.toLocaleDateString(undefined, { weekday: "long" }).toUpperCase(),
      monthYear: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    };
  }, [appointmentDate]);

  const timeLabel =
    selectedStartMin !== null && selectedEndMin !== null
      ? formatHubTimeRange(selectedStartMin, selectedEndMin)
      : "";

  const clearAdvanceTimer = () => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  const clearSlideTimer = () => {
    if (slideTimerRef.current) {
      clearTimeout(slideTimerRef.current);
      slideTimerRef.current = null;
    }
  };

  const goToStep = (next: StepId) => {
    if (isSliding) return;
    const from = STEPS.findIndex((s) => s.id === step);
    const to = STEPS.findIndex((s) => s.id === next);
    if (to === from || to < 0) return;
    const dir: "forward" | "back" = to > from ? "forward" : "back";
    setSlideDir(dir);
    setOutgoingStep(step);
    setStep(next);
    setIsSliding(true);
    clearSlideTimer();
    slideTimerRef.current = setTimeout(() => {
      setOutgoingStep(null);
      setIsSliding(false);
      slideTimerRef.current = null;
    }, SLIDE_MS);
  };

  const goNextSoon = (next: StepId) => {
    clearAdvanceTimer();
    // Short beat so the selection highlight shows, then smooth slide
    advanceTimerRef.current = setTimeout(() => goToStep(next), 160);
  };

  useEffect(() => {
    return () => {
      clearAdvanceTimer();
      clearSlideTimer();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      setEntered(false);
      clearAdvanceTimer();
      return;
    }
    if (!wasOpenRef.current) {
      setNotes(initialNote);
      setMeetingType("");
      setAppointmentDate(minDate);
      setSelectedStartMin(null);
      setDesigner(null);
      setAvailableDesigners([]);
      setFreeStartMins(null);
      setShowNoteError(false);
      setLocalError("");
      setClearConfirmOpen(false);
      setSlideDir("forward");
      setOutgoingStep(null);
      setIsSliding(false);
      setStep("date");
      const parsed = parseYmd(minDate);
      if (parsed) setViewMonth({ year: parsed.year, month: parsed.month });
      wasOpenRef.current = true;
      requestAnimationFrame(() => setEntered(true));
    }
  }, [open, initialNote, minDate]);

  useEffect(() => {
    if (!open || !appointmentDate.trim()) {
      setFreeStartMins(null);
      return;
    }
    let cancelled = false;
    setDayLoading(true);
    void fetchAvailabilityByDate({
      date: appointmentDate.trim(),
      durationMinutes: HUB_MEETING_DURATION_MIN,
    })
      .then((data) => {
        if (cancelled) return;
        const mins = new Set<number>();
        const rows = Array.isArray(data.designers) ? data.designers : [];
        for (const row of rows) {
          const starts = Array.isArray(row?.freeStarts) ? row.freeStarts : [];
          for (const start of starts) {
            const m = parseFreeStartToMin(String(start ?? ""), appointmentDate.trim());
            if (m != null) mins.add(m);
          }
        }
        setFreeStartMins(mins.size > 0 ? mins : null);
      })
      .catch(() => {
        if (!cancelled) setFreeStartMins(null);
      })
      .finally(() => {
        if (!cancelled) setDayLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentDate, open]);

  useEffect(() => {
    if (!open || !appointmentDate.trim() || selectedStartMin === null) {
      setAvailableDesigners([]);
      setDesigner(null);
      return;
    }
    let cancelled = false;
    setDesignersLoading(true);
    setDesigner(null);
    const startTime = buildHubMeetingDateTimeIso(appointmentDate.trim(), selectedStartMin);
    const endTime = buildHubMeetingDateTimeIso(
      appointmentDate.trim(),
      selectedStartMin + HUB_MEETING_DURATION_MIN,
    );
    void fetchAvailableDesignersForSlot({
      date: appointmentDate.trim(),
      startTime,
      endTime,
      durationMinutes: HUB_MEETING_DURATION_MIN,
      meetingType: meetingType || undefined,
    })
      .then((data) => {
        if (cancelled) return;
        const raw = Array.isArray(data.designers) ? data.designers : [];
        const list: AvailableDesignerRow[] = raw
          .map((d, index) => {
            const name = String(d?.name ?? "").trim();
            const email = String(d?.email ?? "").trim();
            const id =
              typeof d?.id === "number" && Number.isFinite(d.id) ? d.id : index + 1;
            return {
              id,
              name,
              email,
              available: d?.available !== false,
              conflictCount: typeof d?.conflictCount === "number" ? d.conflictCount : 0,
              conflictReason:
                typeof d?.conflictReason === "string" ? d.conflictReason : undefined,
            };
          })
          .filter((d) => d.available && d.name.length > 0);
        setAvailableDesigners(list);
        setLocalError(
          typeof data.error === "string" && data.error.trim() ? data.error.trim() : "",
        );
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setAvailableDesigners([]);
        setLocalError(e instanceof Error ? e.message : "Could not load available designers.");
      })
      .finally(() => {
        if (!cancelled) setDesignersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentDate, selectedStartMin, meetingType, open]);

  if (!open) return null;

  const canGoTime = Boolean(appointmentDate.trim());
  const canGoType = canGoTime && selectedStartMin !== null;
  const canGoDesigner = canGoType && Boolean(meetingType.trim());
  const canGoNotes = canGoDesigner && Boolean(designer?.name?.trim());
  const canSchedule = Boolean(
    notes.trim() &&
      appointmentDate.trim() &&
      selectedStartMin !== null &&
      designer?.name?.trim() &&
      designer.email?.trim() &&
      meetingType.trim() &&
      !emailMissing,
  );
  const canClear = Boolean(
    meetingType.trim() ||
      selectedStartMin !== null ||
      designer ||
      (notes.trim() && notes.trim() !== initialNote.trim()) ||
      (appointmentDate.trim() && appointmentDate.trim() !== minDate.trim()),
  );

  const stepUnlocked = (id: StepId) => {
    if (id === "date") return true;
    if (id === "time") return canGoTime;
    if (id === "type") return canGoType;
    if (id === "designer") return canGoDesigner;
    return canGoNotes;
  };

  const handleClear = () => {
    setMeetingType("");
    setSelectedStartMin(null);
    setDesigner(null);
    setAvailableDesigners([]);
    setLocalError("");
    setShowNoteError(false);
    setNotes(initialNote);
    setAppointmentDate(minDate);
    const parsed = parseYmd(minDate);
    if (parsed) setViewMonth({ year: parsed.year, month: parsed.month });
    clearSlideTimer();
    setOutgoingStep(null);
    setIsSliding(false);
    setSlideDir("back");
    setStep("date");
    setClearConfirmOpen(false);
  };

  const selectDate = (ymd: string) => {
    if (ymd < minDate) return;
    setAppointmentDate(ymd);
    setSelectedStartMin(null);
    setDesigner(null);
    const parsed = parseYmd(ymd);
    if (parsed) setViewMonth({ year: parsed.year, month: parsed.month });
    goNextSoon("time");
  };

  const handleConfirm = async () => {
    try {
      setShowNoteError(true);
      setLocalError("");
      if (emailMissing) {
        setLocalError("Add a valid customer email on the lead (Lead tab) before scheduling.");
        return;
      }
      if (!appointmentDate.trim()) {
        setLocalError("Select a date.");
        goToStep("date");
        return;
      }
      if (selectedStartMin === null || selectedEndMin === null) {
        setLocalError("Select a time.");
        goToStep("time");
        return;
      }
      if (!meetingType.trim()) {
        setLocalError("Select a meeting type.");
        goToStep("type");
        return;
      }
      if (!designer?.name?.trim()) {
        setLocalError("Select an available designer.");
        goToStep("designer");
        return;
      }
      if (!notes.trim()) {
        setLocalError("Notes are required.");
        goToStep("notes");
        return;
      }
      const email = designer.email?.trim();
      if (!email) {
        setEmailMissingDesignerName(designer.name.trim());
        setEmailMissingOpen(true);
        return;
      }
      await onConfirm({
        designerName: designer.name.trim(),
        designerEmail: email,
        date: appointmentDate.trim(),
        startTime: buildHubMeetingDateTimeIso(appointmentDate.trim(), selectedStartMin),
        endTime: buildHubMeetingDateTimeIso(appointmentDate.trim(), selectedEndMin),
        meetingType: meetingType as ScheduleHubMeetingConfirmPayload["meetingType"],
        notes: notes.trim(),
      });
    } catch (e: unknown) {
      setLocalError(e instanceof Error ? e.message : "Could not schedule meeting.");
    }
  };

  const displayError = error || localError;
  const customerInitials = initials(leadCustomerName || "C");
  const stepTitle =
    step === "date"
      ? "Choose a date"
      : step === "time"
        ? "Pick a time"
        : step === "type"
          ? "Meeting type"
          : step === "designer"
            ? "Available designers"
            : "Add meeting notes";

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[80] flex items-end justify-center font-sans sm:items-center sm:px-4 sm:py-5",
          "transition-opacity duration-300",
          entered ? "opacity-100" : "opacity-0",
        )}
        style={{ backgroundColor: `${C.backdrop}CC` }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-hub-meeting-title"
        onClick={onClose}
      >
        <div
          className={cn(
            "flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-[0_40px_100px_rgba(15,23,42,0.35)] transition duration-300 sm:h-[min(88vh,640px)] sm:max-w-[980px] sm:rounded-[22px]",
            entered ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.98] opacity-0 sm:translate-y-0",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="shrink-0 border-b px-4 py-3 sm:px-5" style={{ borderColor: C.border }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition duration-200 hover:scale-105"
                  style={{ backgroundColor: C.tint, color: C.primary }}
                >
                  <Icon name="calendar" className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2
                    id="schedule-hub-meeting-title"
                    className="text-[18px] font-extrabold tracking-tight sm:text-[19px]"
                    style={{ color: C.text }}
                  >
                    Schedule hub meeting
                  </h2>
                  <p className="mt-0.5 text-[12px] font-medium" style={{ color: C.muted }}>
                    Step {stepNumber} of 5 · {stepTitle}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div
                  className="hidden items-center gap-2 rounded-full border bg-white py-0.5 pl-0.5 pr-2.5 transition duration-200 hover:-translate-y-0.5 hover:shadow-sm sm:flex"
                  style={{ borderColor: C.border }}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                    style={{ backgroundColor: C.primary }}
                  >
                    {customerInitials}
                  </span>
                  <div className="min-w-0">
                    <p className="max-w-[130px] truncate text-[12px] font-bold" style={{ color: C.text }}>
                      {leadCustomerName || "Customer"}
                    </p>
                    <p className="truncate text-[10px] font-medium" style={{ color: C.muted }}>
                      {leadDisplayId || "—"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white transition duration-200 hover:scale-105 hover:bg-slate-50 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]"
                  style={{ borderColor: C.border, color: C.muted }}
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>

            <div className="mt-3">
              <Stepper
                step={step}
                stepIndex={stepIndex}
                unlocked={stepUnlocked}
                busy={busy || isSliding}
                onSelect={goToStep}
              />
            </div>
          </div>

          {/* Body */}
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="relative min-h-0 min-w-0 overflow-hidden bg-white">
              {(() => {
                const renderStepContent = (panelStep: StepId, interactive: boolean) => {
                  const locked = !interactive || busy || isSliding;
                  if (panelStep === "date") {
                    return (
                      <MeetingCalendar
                        minDate={minDate}
                        appointmentDate={appointmentDate}
                        viewMonth={viewMonth}
                        todayYmd={todayYmd}
                        busy={locked}
                        onViewMonth={setViewMonth}
                        onSelectDate={selectDate}
                      />
                    );
                  }
                  if (panelStep === "time") {
                    return (
                      <div className="mx-auto w-full max-w-3xl">
                        <h3 className="text-[20px] font-extrabold tracking-tight" style={{ color: C.text }}>
                          Pick a start time
                        </h3>
                        <p className="mt-0.5 text-[13px] font-medium" style={{ color: C.muted }}>
                          {meetingDateParts
                            ? `${meetingDateParts.weekday}, ${meetingDateParts.day} ${meetingDateParts.monthYear}`
                            : "Select a date first"}
                          {" · "}
                          {HUB_MEETING_DURATION_MIN} minutes
                          {dayLoading ? " · Checking day…" : ""}
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                          {startOptions.map((m) => {
                            const selected = selectedStartMin === m;
                            const anyoneFree = freeStartMins == null || freeStartMins.has(m);
                            return (
                              <button
                                key={m}
                                type="button"
                                disabled={locked || !anyoneFree}
                                onClick={() => {
                                  if (!anyoneFree || locked) return;
                                  setSelectedStartMin(m);
                                  setDesigner(null);
                                  goNextSoon("type");
                                }}
                                className={cn(
                                  "hub-meet-card min-h-[48px] rounded-2xl border px-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]",
                                  selected
                                    ? "border-transparent text-white shadow-[0_8px_20px_rgba(4,120,87,0.28)]"
                                    : anyoneFree
                                      ? "bg-white hover:border-[#047857]/40 hover:bg-[#E7F6EF]"
                                      : "cursor-not-allowed bg-slate-50 text-[#C5CCD6]",
                                )}
                                style={
                                  selected
                                    ? { backgroundColor: C.primary }
                                    : anyoneFree
                                      ? { borderColor: C.border, color: C.text }
                                      : undefined
                                }
                              >
                                <p className="text-[14px] font-extrabold">{minutesToHubTimeLabel(m)}</p>
                                <p
                                  className="mt-0.5 text-[11px] font-medium"
                                  style={{ color: selected ? "rgba(255,255,255,0.85)" : C.muted }}
                                >
                                  → {minutesToHubTimeLabel(m + HUB_MEETING_DURATION_MIN)}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  if (panelStep === "type") {
                    return (
                      <div className="mx-auto w-full max-w-lg">
                        <h3 className="text-[20px] font-extrabold tracking-tight" style={{ color: C.text }}>
                          Meeting type
                        </h3>
                        <p className="mt-0.5 text-[13px] font-medium" style={{ color: C.muted }}>
                          How will this Hub meeting happen?
                        </p>
                        <div className="mt-4 grid gap-2.5">
                          {MEETING_TYPE_OPTIONS.map((opt) => {
                            const selected = meetingType === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                disabled={locked}
                                onClick={() => {
                                  if (locked) return;
                                  setMeetingType(opt.value);
                                  goNextSoon("designer");
                                }}
                                className={cn(
                                  "hub-meet-card flex min-h-[52px] items-center gap-3 rounded-2xl border px-3.5 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]",
                                  selected
                                    ? "shadow-[0_8px_20px_rgba(4,120,87,0.14)]"
                                    : "bg-white hover:border-[#047857]/40 hover:bg-[#E7F6EF]",
                                )}
                                style={{
                                  borderColor: selected ? C.primary : C.border,
                                  backgroundColor: selected ? C.tint : undefined,
                                }}
                              >
                                <span
                                  className="flex h-10 w-10 items-center justify-center rounded-xl transition duration-200"
                                  style={{
                                    backgroundColor: selected ? C.primary : C.tint,
                                    color: selected ? "#fff" : C.primary,
                                  }}
                                >
                                  <Icon name={opt.icon} />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-[14px] font-extrabold" style={{ color: C.text }}>
                                    {opt.label}
                                  </span>
                                  <span className="mt-0.5 block text-[11px] font-medium" style={{ color: C.muted }}>
                                    {opt.hint}
                                  </span>
                                </span>
                                {selected ? (
                                  <Icon name="check" className="ml-auto h-5 w-5" style={{ color: C.primary }} />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  if (panelStep === "designer") {
                    return (
                      <div className="mx-auto w-full max-w-3xl">
                        <h3 className="text-[20px] font-extrabold tracking-tight" style={{ color: C.text }}>
                          Available designers
                        </h3>
                        <p className="mt-0.5 text-[13px] font-medium" style={{ color: C.muted }}>
                          {timeLabel ? `${timeLabel}` : "Select a time first"}
                          {meetingTypeLabel ? ` · ${meetingTypeLabel}` : ""}
                        </p>
                        {designersLoading ? (
                          <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            {[0, 1, 2, 3].map((i) => (
                              <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-slate-100" />
                            ))}
                          </div>
                        ) : availableDesigners.length === 0 ? (
                          <div
                            className="mt-5 rounded-2xl border border-dashed px-6 py-12 text-center"
                            style={{ borderColor: C.border }}
                          >
                            <p className="text-[15px] font-semibold" style={{ color: C.text }}>
                              No designers free for this slot
                            </p>
                            <p className="mt-1 text-[13px]" style={{ color: C.muted }}>
                              Try another time — Hub window is 11:00 AM – 7:00 PM.
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              className="mt-5 !rounded-full"
                              disabled={locked}
                              onClick={() => goToStep("time")}
                            >
                              Pick another time
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            {availableDesigners.map((row) => {
                              const selected =
                                designer?.id === row.id && designer?.name === row.name;
                              const hasEmail = Boolean(row.email?.trim());
                              return (
                                <button
                                  key={`${row.id}-${row.name}`}
                                  type="button"
                                  disabled={locked || !hasEmail}
                                  onClick={() => {
                                    if (!hasEmail || locked) return;
                                    setDesigner(row);
                                    goNextSoon("notes");
                                  }}
                                  className={cn(
                                    "hub-meet-card flex min-h-[64px] items-center gap-3 rounded-2xl border px-3.5 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]",
                                    selected
                                      ? "shadow-[0_8px_20px_rgba(4,120,87,0.14)]"
                                      : hasEmail
                                        ? "bg-white hover:border-[#047857]/40 hover:bg-[#E7F6EF]"
                                        : "cursor-not-allowed opacity-60",
                                  )}
                                  style={{
                                    borderColor: selected ? C.primary : C.border,
                                    backgroundColor: selected ? C.tint : undefined,
                                  }}
                                >
                                  <span
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[13px] font-extrabold text-white"
                                    style={{ backgroundColor: C.primary }}
                                  >
                                    {initials(row.name)}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate text-[14px] font-extrabold" style={{ color: C.text }}>
                                      {row.name}
                                    </p>
                                    <p className="mt-0.5 truncate text-[11px] font-medium" style={{ color: C.muted }}>
                                      {hasEmail ? row.email : "Email missing in Design Module"}
                                    </p>
                                    <p
                                      className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                      style={{ backgroundColor: C.tint, color: C.primary }}
                                    >
                                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: C.primary }} />
                                      Available
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div className="mx-auto w-full max-w-lg">
                      <span
                        className="mb-2.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl transition duration-200 hover:scale-105"
                        style={{ backgroundColor: C.tint, color: C.primary }}
                      >
                        <Icon name="note" className="h-5 w-5" />
                      </span>
                      <h3 className="text-[20px] font-extrabold tracking-tight" style={{ color: C.text }}>
                        Add meeting notes
                      </h3>
                      <p className="mt-0.5 text-[13px] font-medium" style={{ color: C.muted }}>
                        Context, expectations, or preferences for the designer.
                      </p>
                      <div
                        className="mt-4 rounded-2xl border bg-white p-3.5 shadow-sm transition duration-200 hover:shadow-md"
                        style={{ borderColor: C.border }}
                      >
                        <FieldLabel required>Notes</FieldLabel>
                        <Textarea
                          value={notes}
                          onChange={(e) => {
                            setNotes(e.target.value);
                            onNotesChange?.(e.target.value);
                          }}
                          placeholder="Context, expectations, preferences…"
                          missing={showNoteError && !notes.trim()}
                          disabled={locked}
                          className="mt-2 min-h-[120px] rounded-xl text-[13px] font-medium"
                        />
                        {emailMissing ? (
                          <p className="mt-2 text-[12px] font-medium" style={{ color: C.danger }}>
                            Add a valid customer email on the Lead tab before scheduling.
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button
                          type="button"
                          variant="success"
                          icon={<Icon name="calendar" className="h-4 w-4" />}
                          disabled={locked || !canSchedule}
                          className="!h-10 !rounded-full !px-5 !font-bold transition hover:!brightness-110 active:!scale-[0.98]"
                          style={{ backgroundColor: C.primary }}
                          onClick={() => void handleConfirm()}
                        >
                          {busy ? "Scheduling…" : "Schedule Meeting"}
                        </Button>
                      </div>
                    </div>
                  );
                };

                const panelClass = (panelStep: StepId) =>
                  cn(
                    "absolute inset-0 overflow-x-hidden p-4 sm:p-5",
                    panelStep === "designer" ? "overflow-y-auto" : "overflow-hidden",
                    panelStep === "designer" ? "" : "flex flex-col justify-center",
                  );

                const exitClass =
                  slideDir === "forward"
                    ? "animate-hub-meet-exit-right"
                    : "animate-hub-meet-exit-left";
                const enterClass =
                  slideDir === "forward"
                    ? "animate-hub-meet-enter-left"
                    : "animate-hub-meet-enter-right";

                return (
                  <>
                    {outgoingStep ? (
                      <div
                        key={`out-${outgoingStep}-${slideDir}`}
                        className={cn(
                          panelClass(outgoingStep),
                          exitClass,
                          "pointer-events-none z-[1]",
                        )}
                        aria-hidden
                        style={{ transformOrigin: "center center" }}
                      >
                        {renderStepContent(outgoingStep, false)}
                      </div>
                    ) : null}
                    <div
                      key={`in-${step}-${outgoingStep ? `${slideDir}-move` : "idle"}`}
                      className={cn(
                        panelClass(step),
                        outgoingStep ? enterClass : "animate-hub-meet-pop",
                        "z-[2]",
                      )}
                      style={{ transformOrigin: "center center" }}
                    >
                      {renderStepContent(step, !isSliding)}
                    </div>
                  </>
                );
              })()}
            </div>

            <SummaryPanel
              appointmentDate={appointmentDate}
              meetingDateParts={meetingDateParts}
              timeLabel={timeLabel}
              meetingTypeLabel={meetingTypeLabel}
              meetingTypeHint={meetingTypeHint}
              designerName={designer?.name || ""}
              canClear={canClear}
              busy={busy}
              onClearRequest={() => setClearConfirmOpen(true)}
            />
          </div>

          {displayError ? (
            <p
              className="shrink-0 border-t px-6 py-2.5 text-[13px]"
              style={{ borderColor: C.dangerBg, backgroundColor: C.dangerBg, color: C.danger }}
            >
              {displayError}
            </p>
          ) : null}
        </div>
      </div>

      {clearConfirmOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(15,23,42,0.45)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-appointment-title"
          onClick={() => setClearConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 font-sans shadow-xl animate-hub-meet-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="clear-appointment-title" className="text-[16px] font-extrabold" style={{ color: C.text }}>
              Delete this appointment?
            </h3>
            <p className="mt-1.5 text-[13px]" style={{ color: C.muted }}>
              This clears the selected date, time, type, designer, and notes in this popup.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="!rounded-full"
                onClick={() => setClearConfirmOpen(false)}
              >
                Keep
              </Button>
              <Button
                type="button"
                className="!rounded-full !text-white"
                style={{ backgroundColor: C.danger }}
                onClick={handleClear}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <DesignerEmailMissingDialog
        open={emailMissingOpen}
        designerName={emailMissingDesignerName}
        onClose={() => setEmailMissingOpen(false)}
      />
    </>
  );
}
