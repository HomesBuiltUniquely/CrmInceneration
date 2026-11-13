"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import {
  fetchCallEventsByLead,
  fetchCallRecordingsByLead,
} from "@/lib/recording-call-logs/api";
import { formatDurationLabel, formatWhenLabel } from "@/lib/recording-call-logs/format";
import {
  callEventsToRows,
  recordingsToRows,
} from "@/lib/recording-call-logs/stats";
import type {
  ActivityListRow,
  CallDirection,
  HubCallEvent,
  HubCallRecording,
} from "@/lib/recording-call-logs/types";
import RecordingPlayerModal, {
  type RecordingPlayerTarget,
} from "@/app/Components/Shared/RecordingPlayerModal";
import { V2_BTN_FILTER_PILL, V2_BTN_GHOST_ICON, V2_BTN_SECONDARY } from "./lead-detail-v2-motion";

type Props = {
  leadType: string;
  leadId: string;
  onBack?: () => void;
};

type SubTab = "calls" | "recordings";
type CallFilter = "all" | "incoming" | "outgoing" | "missed";

type DaySection = {
  title: string;
  rows: ActivityListRow[];
};

function isListableRecording(r: HubCallRecording): boolean {
  if (r.status === "rejected_filter") return false;
  const code = (r.errorCode || "").toUpperCase();
  if (
    ["NOT_A_LEAD", "STAFF_NUMBER", "AMBIGUOUS_LEAD", "NOT_CONNECTED", "FILTER_REJECTED"].includes(
      code,
    )
  ) {
    return false;
  }
  if (r.leadId <= 0 || r.leadType.toLowerCase() === "unknown") return false;
  return true;
}

function sectionTitle(iso: string | null, now = new Date()): string {
  if (!iso) return "Unknown date";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "Unknown date";
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startThat = new Date(dt);
  startThat.setHours(0, 0, 0, 0);
  const dayDiff = Math.round(
    (startToday.getTime() - startThat.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function groupByDay(rows: ActivityListRow[]): DaySection[] {
  const map = new Map<string, ActivityListRow[]>();
  const order: string[] = [];
  for (const row of rows) {
    const key = sectionTitle(row.startedAt);
    if (!map.has(key)) {
      order.push(key);
      map.set(key, []);
    }
    map.get(key)!.push(row);
  }
  return order.map((title) => ({ title, rows: map.get(title)! }));
}

function matchesCallFilter(direction: CallDirection, filter: CallFilter): boolean {
  if (filter === "all") return true;
  if (filter === "incoming") return direction === "Incoming";
  if (filter === "outgoing") return direction === "Outgoing";
  return direction === "Missed" || direction === "Client rejected" || direction === "Sales rejected";
}

function DirectionIcon({ direction }: { direction: CallDirection }) {
  const missed =
    direction === "Missed" ||
    direction === "Client rejected" ||
    direction === "Sales rejected";
  const color = missed ? "text-[#B91C1C]" : "text-[#1D4ED8]";
  const bg = missed ? "bg-[#FDECEC]" : "bg-[#E8F0FE]";
  return (
    <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full", bg, color)}>
      {direction === "Incoming" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 8l-8 8M8 10v6h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : direction === "Outgoing" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 16l8-8M16 14V8h-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 8l-8 8M15 16H9v-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

export default function LeadCallsRecordingsPanel({ leadType, leadId, onBack }: Props) {
  const numericLeadId = Number(leadId);
  const [subTab, setSubTab] = useState<SubTab>("calls");
  const [callFilter, setCallFilter] = useState<CallFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<HubCallEvent[]>([]);
  const [recordings, setRecordings] = useState<HubCallRecording[]>([]);
  const [playerTarget, setPlayerTarget] = useState<RecordingPlayerTarget | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(numericLeadId) || numericLeadId <= 0 || !leadType.trim()) {
      setLoading(false);
      setError("Refresh lead to load calls and recordings.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [ev, rec] = await Promise.all([
        fetchCallEventsByLead({ leadType, leadId: numericLeadId }).catch(() => [] as HubCallEvent[]),
        fetchCallRecordingsByLead({ leadType, leadId: numericLeadId }).catch(
          () => [] as HubCallRecording[],
        ),
      ]);
      setEvents(ev);
      setRecordings(rec.filter(isListableRecording));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load calls");
    } finally {
      setLoading(false);
    }
  }, [leadType, numericLeadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const callRows = useMemo(() => {
    const fromEvents = callEventsToRows(events);
    if (fromEvents.length > 0) return fromEvents;
    // Mobile fallback: show recordings as call rows when events are empty.
    return recordingsToRows(recordings);
  }, [events, recordings]);

  const filteredCallRows = useMemo(
    () => callRows.filter((r) => matchesCallFilter(r.direction, callFilter)),
    [callRows, callFilter],
  );

  const callSections = useMemo(() => groupByDay(filteredCallRows), [filteredCallRows]);
  const recordingRows = useMemo(() => recordingsToRows(recordings), [recordings]);
  const recordingSections = useMemo(() => groupByDay(recordingRows), [recordingRows]);

  const openPlayer = (row: ActivityListRow) => {
    if (!row.recordingId) return;
    setPlayerTarget({
      recordingId: row.recordingId,
      title: row.direction || "Call recording",
      subtitle: [
        formatWhenLabel(row.startedAt),
        formatDurationLabel(row.durationSec),
        row.executive && row.executive !== "—" ? row.executive : null,
      ]
        .filter(Boolean)
        .join(" · "),
      durationSec: row.durationSec,
    });
  };

  const filterChips: { id: CallFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "incoming", label: "Incoming" },
    { id: "outgoing", label: "Outgoing" },
    { id: "missed", label: "Missed" },
  ];

  return (
    <div id="deal-calls" className="scroll-mt-24 rounded-xl border border-[#e1e6ed] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6EAF0] px-4 py-3">
        <div>
          <h2 className="text-[16px] font-bold text-[#14171F]">Calls & Recordings</h2>
          <p className="mt-0.5 text-[12px] font-medium text-[#8A94A6]">
            Same as mobile lead · Calls and Recording tabs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className={cn(V2_BTN_SECONDARY, "h-9 rounded-lg px-3 text-[12px] font-semibold")}
          >
            Refresh
          </button>
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className={cn(V2_BTN_GHOST_ICON, "h-9 rounded-lg px-3 text-[12px] font-semibold text-[#5B6778]")}
            >
              Back to overview
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex gap-1 border-b border-[#E6EAF0] px-3 pt-2">
        {(
          [
            { id: "calls" as const, label: "Calls", count: callRows.length },
            { id: "recordings" as const, label: "Recording", count: recordingRows.length },
          ] as const
        ).map((tab) => {
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={cn(
                "relative px-3 pb-2.5 pt-1.5 text-[13px] font-semibold transition",
                active ? "text-[#1D4ED8]" : "text-[#6b7280] hover:text-[#111827]",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                  active ? "bg-[#DBEAFE] text-[#1D4ED8]" : "bg-[#F1F5F9] text-[#64748B]",
                )}
              >
                {tab.count}
              </span>
              {active ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#1D4ED8]" />
              ) : null}
            </button>
          );
        })}
      </div>

      {subTab === "calls" ? (
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {filterChips.map((chip) => {
            const selected = callFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setCallFilter(chip.id)}
                className={cn(
                  V2_BTN_FILTER_PILL,
                  "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                  selected
                    ? "border-[#93B4F5] bg-[#EFF6FF] text-[#1D4ED8]"
                    : "border-[#E6EAF0] bg-white text-[#5B6778] hover:bg-[#F8FAFC]",
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="px-4 pb-2">
        <p className="text-[12px] font-medium text-[#8A94A6]">
          {subTab === "calls"
            ? `${filteredCallRows.length} logged call${filteredCallRows.length === 1 ? "" : "s"} on this lead`
            : `${recordingRows.length} recording${recordingRows.length === 1 ? "" : "s"} for this lead`}
        </p>
      </div>

      <div className="max-h-[min(70vh,640px)] overflow-y-auto px-2 pb-4">
        {loading ? (
          <div className="px-4 py-16 text-center text-[13px] font-medium text-[#8A94A6]">
            Loading {subTab === "calls" ? "calls" : "recordings"}…
          </div>
        ) : error ? (
          <div className="px-4 py-12 text-center">
            <p className="text-[14px] font-bold text-[#14171F]">Could not load</p>
            <p className="mt-1 text-[12px] text-[#8A94A6]">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className={cn(V2_BTN_SECONDARY, "mt-4 h-9 rounded-lg px-4 text-[12px] font-semibold")}
            >
              Retry
            </button>
          </div>
        ) : subTab === "calls" && filteredCallRows.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-[14px] font-bold text-[#14171F]">No calls yet</p>
            <p className="mt-1 text-[12px] text-[#8A94A6]">
              No Hub calls logged for this lead yet (team calls appear here).
            </p>
          </div>
        ) : subTab === "recordings" && recordingRows.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-[14px] font-bold text-[#14171F]">No recordings yet</p>
            <p className="mt-1 text-[12px] text-[#8A94A6]">No recordings for this lead yet.</p>
          </div>
        ) : (
          (subTab === "calls" ? callSections : recordingSections).map((section) => (
            <div key={section.title} className="mb-2">
              <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[#8A94A6]">
                {section.title}
              </p>
              <ul className="divide-y divide-[#EEF1F5] overflow-hidden rounded-xl border border-[#E6EAF0] bg-[#FBFCFD]">
                {section.rows.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 px-3 py-3">
                    <DirectionIcon direction={row.direction} />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-[13px] font-semibold",
                          row.direction === "Missed" ||
                            row.direction === "Client rejected" ||
                            row.direction === "Sales rejected"
                            ? "text-[#B91C1C]"
                            : "text-[#14171F]",
                        )}
                      >
                        {row.direction}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-[#5B6778]">
                        {[
                          formatWhenLabel(row.startedAt),
                          formatDurationLabel(row.durationSec),
                          row.executive && row.executive !== "—" ? row.executive : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {subTab === "recordings" || (row.hasRecording && row.recordingId) ? (
                      <button
                        type="button"
                        disabled={!row.recordingId}
                        onClick={() => openPlayer(row)}
                        className={cn(
                          V2_BTN_GHOST_ICON,
                          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#1D4ED8] hover:bg-[#EFF6FF] disabled:opacity-50",
                        )}
                        title="Play recording"
                        aria-label="Play recording"
                      >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                          <path d="M8 5.5v13l11-6.5L8 5.5z" />
                        </svg>
                      </button>
                    ) : (
                      <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[#8A94A6]">
                        {formatDurationLabel(row.durationSec)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      <RecordingPlayerModal
        target={playerTarget}
        onClose={() => setPlayerTarget(null)}
      />
    </div>
  );
}
