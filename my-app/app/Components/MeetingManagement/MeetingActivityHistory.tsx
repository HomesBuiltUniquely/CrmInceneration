"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  loadMeetingActivityHistory,
  type MeetingActivity,
  type MeetingActivityAction,
} from "@/lib/meeting-management-api";
import { EASE } from "./motion";

const historyFocus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B6B45]";

type HistoryTone = {
  label: string;
  className: string;
  icon: "tick" | "refresh" | "cancel" | "quote" | "sent";
};

const TAG: Record<string, HistoryTone> = {
  SCHEDULED: { label: "Meeting scheduled", className: "bg-[#E3F3EA] text-[#0B6B45]", icon: "tick" },
  RESCHEDULED: { label: "Meeting rescheduled", className: "bg-[#FFF1D6] text-[#8A5300]", icon: "refresh" },
  CANCELLED: { label: "Meeting cancelled", className: "bg-[#FDECEC] text-[#9B1C1C]", icon: "cancel" },
  QUOTE_GENERATED: { label: "Quote generated", className: "bg-[#E6EDFF] text-[#1B3FA8]", icon: "quote" },
  QUOTE_SENT: { label: "Quote sent", className: "bg-[#E3F3EA] text-[#0B6B45]", icon: "sent" },
  QUOTE_FOLLOW: { label: "Quote follow-up", className: "bg-[#FFF1D6] text-[#8A5300]", icon: "refresh" },
};

export type HistoryFilter = "meeting" | "quote";

function actionKey(action: MeetingActivityAction | string): string {
  return String(action || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function historyTab(action: MeetingActivityAction | string): HistoryFilter {
  return actionKey(action).includes("QUOTE") ? "quote" : "meeting";
}

function tagFor(action: MeetingActivityAction | string, label: string): HistoryTone {
  const known = TAG[actionKey(action)];
  if (known) return known;
  if (label.trim()) return { label: label.trim(), className: "bg-[#F4F6F9] text-[#14171F]", icon: "tick" };
  return { label: "Activity", className: "bg-[#F4F6F9] text-[#14171F]", icon: "tick" };
}

function eventName(row: MeetingActivity): string {
  return tagFor(row.action, row.actionLabel).label;
}

function parsedTime(raw: string): number {
  const value = Date.parse(raw);
  return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
}

function byNewest(a: MeetingActivity, b: MeetingActivity): number {
  return parsedTime(b.performedAt) - parsedTime(a.performedAt);
}

function stampParts(raw: string): { date: string; time: string } | null {
  const text = raw.trim();
  if (!text) return null;
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return null;
  const date = new Date(parsed).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const time = new Date(parsed)
    .toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    })
    .replace(/\s+/g, " ")
    .toLowerCase();
  return { date, time };
}

function formatCardWhen(raw: string): string {
  const parts = stampParts(raw);
  if (parts) return `${parts.date} · ${parts.time}`;
  return raw.trim() || "—";
}

function formatLatestWhen(raw: string): string {
  const parts = stampParts(raw);
  if (parts) return `${parts.date}, ${parts.time}`;
  return raw.trim();
}

export function latestHistoryCaption(activities: MeetingActivity[]): string {
  const newest = [...activities].sort(byNewest)[0];
  if (!newest) return "Latest: No activity yet";
  const when = formatLatestWhen(newest.performedAt);
  return when ? `Latest: ${eventName(newest)} · ${when}` : `Latest: ${eventName(newest)}`;
}

function initialOf(name: string): string {
  const letter = name.trim().charAt(0).toUpperCase();
  return letter || "—";
}

export function useMeetingActivityHistory(leadId?: number, leadType?: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activities, setActivities] = useState<MeetingActivity[]>([]);
  const ready = leadId != null && leadId > 0 && Boolean(leadType?.trim());

  useEffect(() => {
    if (!ready || leadId == null || !leadType?.trim()) {
      setActivities([]);
      setError("");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    void loadMeetingActivityHistory(leadId, leadType.trim())
      .then((rows) => {
        if (!cancelled) setActivities([...rows].sort(byNewest));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setActivities([]);
          setError(err instanceof Error ? err.message : "Could not load activity history.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, leadType, ready]);

  return { ready, loading, error, activities };
}

export function ActivityHistoryTrigger({
  open,
  count,
  loading,
  latest,
  onToggle,
}: {
  open: boolean;
  count: number;
  loading: boolean;
  latest: string;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="meeting-activity-history"
        onClick={onToggle}
        className={`flex min-h-12 w-full items-center gap-2 rounded-[12px] border border-[#D5D9E2] bg-white px-3 text-left hover:bg-[#F8F9FB] ${historyFocus}`}
      >
        <span className="text-[14px] font-bold text-[#14171F]">Activity history</span>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#14171F] px-1.5 text-[11px] font-bold text-white">
          {loading ? "…" : count}
        </span>
        <svg viewBox="0 0 20 20" className="ml-auto h-4 w-4 shrink-0 text-[#5F6675]" fill="none" aria-hidden>
          <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <p className="mt-1.5 text-[12.5px] font-medium leading-snug text-[#5F6675]">{loading ? "Latest: Loading…" : latest}</p>
    </div>
  );
}

export function ActivityHistorySheet({
  open,
  filter,
  onFilter,
  onClose,
  ready,
  loading,
  error,
  activities,
}: {
  open: boolean;
  filter: HistoryFilter;
  onFilter: (filter: HistoryFilter) => void;
  onClose: () => void;
  ready: boolean;
  loading: boolean;
  error: string;
  activities: MeetingActivity[];
}) {
  const reduce = useReducedMotion();
  const meeting = useMemo(() => activities.filter((row) => historyTab(row.action) === "meeting"), [activities]);
  const quote = useMemo(() => activities.filter((row) => historyTab(row.action) === "quote"), [activities]);
  const visible = filter === "quote" ? quote : meeting;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          id="meeting-activity-history"
          role="region"
          aria-label="Activity history"
          className="absolute inset-0 z-20 flex flex-col overflow-hidden bg-white font-[family-name:var(--font-manrope)] shadow-[0_16px_40px_rgba(20,23,31,0.16)] sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px] sm:border-l sm:border-[#E1E4EB]"
          initial={reduce ? { opacity: 0 } : { y: "-100%" }}
          animate={reduce ? { opacity: 1 } : { y: "0%" }}
          exit={reduce ? { opacity: 0 } : { y: "-100%" }}
          transition={reduce ? { duration: 0.2 } : { duration: 0.48, ease: EASE }}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-[#E1E4EB] px-5 py-3">
            <button
              type="button"
              aria-label="Close activity history"
              onClick={onClose}
              className={`inline-flex h-11 shrink-0 items-center gap-1 rounded-xl bg-[#F4F6F9] px-3 text-[13px] font-bold text-[#14171F] sm:hidden ${historyFocus}`}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
                <path d="M12 5L7 10l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
            <h3 className="text-[17px] font-bold text-[#14171F]">Activity history</h3>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#14171F] px-1.5 text-[11px] font-bold text-white">
              {loading ? "…" : activities.length}
            </span>
            <button
              type="button"
              aria-label="Close activity history"
              onClick={onClose}
              className={`ml-auto hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F4F6F9] text-[#14171F] hover:bg-[#E8EBF0] sm:inline-flex ${historyFocus}`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="shrink-0 px-5 py-3">
            <div className="flex gap-1 rounded-[12px] bg-[#F4F6F9] p-1" role="tablist" aria-label="History type">
              <HistoryTab
                label="Meeting"
                count={meeting.length}
                selected={filter === "meeting"}
                onSelect={() => onFilter("meeting")}
              />
              <HistoryTab
                label="Quote"
                count={quote.length}
                selected={filter === "quote"}
                onSelect={() => onFilter("quote")}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 [scrollbar-color:#C5CBD6_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#C5CBD6]">
            <ActivityList
              filter={filter}
              ready={ready}
              loading={loading}
              error={error}
              activities={visible}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function HistoryTab({
  label,
  count,
  selected,
  onSelect,
}: {
  label: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-[10px] px-3 text-[13px] font-bold ${
        selected ? "bg-[#14171F] text-white" : "text-[#14171F] hover:bg-white/70"
      } ${historyFocus}`}
    >
      {label} {count}
    </button>
  );
}

function ActivityList({
  filter,
  ready,
  loading,
  error,
  activities,
}: {
  filter: HistoryFilter;
  ready: boolean;
  loading: boolean;
  error: string;
  activities: MeetingActivity[];
}) {
  if (!ready) return <p className="text-[13px] font-semibold leading-snug text-[#5F6675]">This row has no lead to load history for.</p>;
  if (error) return <p className="text-[13px] font-semibold leading-snug text-[#9B1C1C]">{error}</p>;
  if (loading && activities.length === 0) return <p className="text-[13px] font-semibold text-[#5F6675]">Loading history…</p>;
  if (activities.length === 0) {
    return (
      <p className="text-[13px] font-semibold text-[#5F6675]">
        {filter === "quote" ? "No quote activity yet" : "No meeting activity yet"}
      </p>
    );
  }
  return (
    <ol>
      {activities.map((row, index) => (
        <TimelineItem key={row.activityId || `${row.action}-${row.performedAt}-${index}`} row={row} latest={index === 0} connected={index < activities.length - 1} />
      ))}
    </ol>
  );
}

function TimelineItem({ row, latest, connected }: { row: MeetingActivity; latest: boolean; connected: boolean }) {
  const tag = tagFor(row.action, row.actionLabel);
  const name = row.performedByName || row.performedBy || "—";
  const key = actionKey(row.action);
  return (
    <li className="relative flex gap-3 pb-3 last:pb-0">
      {connected ? <span className="absolute bottom-0 left-[16px] top-[34px] w-0.5 bg-[#E1E4EB]" aria-hidden /> : null}
      <span className="relative z-[1] inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#14171F] text-[13px] font-bold text-white">
        {initialOf(name)}
      </span>
      <article className="min-w-0 flex-1 rounded-[14px] border border-[#E1E4EB] bg-white p-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[14px] font-bold leading-snug break-words text-[#14171F]">{name}</p>
          {latest ? (
            <span className="shrink-0 rounded-full bg-[#E3F3EA] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#0B6B45]">
              LATEST
            </span>
          ) : null}
        </div>
        <time className="mt-0.5 block text-[12px] font-medium leading-snug break-words text-[#5F6675]">{formatCardWhen(row.performedAt)}</time>
        <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${tag.className}`}>
          <TagIcon name={tag.icon} />
          {tag.label}
        </span>
        {key === "RESCHEDULED" ? (
          <div className="mt-2.5 grid grid-cols-1 gap-2 rounded-[12px] bg-[#F4F6F9] px-3 py-2.5 sm:grid-cols-2">
            <div>
              <p className="text-[11.5px] font-semibold text-[#5F6675]">Was</p>
              <p className="text-[13.5px] font-medium leading-snug break-words text-[#5F6675] line-through">{formatCardWhen(row.previousMeetingAt)}</p>
            </div>
            <div>
              <p className="text-[11.5px] font-semibold text-[#5F6675]">Now</p>
              <p className="text-[15px] font-bold leading-snug break-words text-[#0B6B45]">{formatCardWhen(row.meetingAt)}</p>
            </div>
          </div>
        ) : (
          <div className="mt-2.5 rounded-[12px] bg-[#F4F6F9] px-3 py-2.5">
            <p className="text-[11.5px] font-semibold text-[#5F6675]">Meeting time</p>
            <p className="text-[13.5px] font-bold leading-snug break-words text-[#14171F]">{formatCardWhen(row.meetingAt)}</p>
          </div>
        )}
        <dl className="mt-2.5 grid grid-cols-2 gap-3">
          <HistoryCell label="Designer" value={row.designerName || "—"} />
          <HistoryCell label="Type" value={row.meetingType || "—"} />
        </dl>
      </article>
    </li>
  );
}

function HistoryCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11.5px] font-semibold text-[#5F6675]">{label}</dt>
      <dd className="text-[13.5px] font-bold leading-snug break-words text-[#14171F]">{value}</dd>
    </div>
  );
}

function TagIcon({ name }: { name: HistoryTone["icon"] }) {
  if (name === "refresh") {
    return (
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
        <path d="M13 8a5 5 0 0 1-8.5 3.5M3 8a5 5 0 0 1 8.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M13 4.5V8h-3.2M3 11.5V8h3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "cancel") {
    return (
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
        <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "quote") {
    return (
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
        <path d="M4.5 2.5h5L12 5v8.5h-7.5v-11z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9.5 2.5V5H12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "sent") {
    return (
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
        <path d="M3 8.2l2.4 2.4 7-7.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
      <path d="M3.5 8.2l2.6 2.6 6-6.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
