"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchDesignerAppointments,
  fetchDesignersFromDesignModule,
  type DesignModuleDesigner,
} from "@/lib/appointment-client";
import {
  appointmentToBookedBlock,
  buildHubMeetingDateTimeIso,
  computeHubTimelineStats,
  findEarliestAvailableStart,
  formatHubMeetingDateLabel,
  formatHubTimeRange,
  HUB_MEETING_DURATION_MIN,
  HUB_MEETING_TIMELINE_END_MIN,
  HUB_MEETING_TIMELINE_START_MIN,
  isHubMeetingStartAvailable,
  listHubMeetingStartOptions,
  minutesToHubTimeLabel,
  type BookedTimelineBlock,
} from "@/lib/hub-meeting-schedule";
import { Button, FieldLabel, Select, Textarea } from "./ui";
import { cn } from "@/lib/cn";

const MEETING_TYPE_OPTIONS = [
  { label: "Showroom Visit", value: "SHOWROOM_VISIT" },
  { label: "Virtual Meeting", value: "VIRTUAL_MEETING" },
  { label: "Site Visit", value: "SITE_VISIT" },
] as const;

const PX_PER_MIN = 0.95;

export type ScheduleHubMeetingConfirmPayload = {
  designerName: string;
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
  /** Keep Complete Task note field in sync while user edits in this popup. */
  onNotesChange?: (notes: string) => void;
};

function CalendarCheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-5 w-5", className)} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
      <path d="M9 15l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white" aria-hidden>
      ✓
    </span>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex h-[40px] items-center rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3.5 text-[13px] font-medium text-[var(--crm-text-primary)]">
        {value || "—"}
      </div>
    </div>
  );
}

function SummaryIconBox({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 text-slate-500">
      {children}
    </span>
  );
}

function SummaryColumn({
  leading,
  label,
  value,
  meta,
  trailing,
}: {
  leading: ReactNode;
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex min-h-[80px] flex-col justify-center px-4 py-3 sm:px-5">
      <span className="mb-2 text-[11px] leading-none text-[var(--crm-text-muted)]">{label}</span>
      <div className="flex items-center gap-3">
        <div className="shrink-0">{leading}</div>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[14px] font-bold leading-snug text-[var(--crm-text-primary)]">
              {value}
            </div>
            {meta ? (
              <div className="mt-0.5 text-[11px] leading-snug text-[var(--crm-text-muted)]">{meta}</div>
            ) : null}
          </div>
          {trailing ? <div className="shrink-0 self-center">{trailing}</div> : null}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "green" | "gray" | "blue";
  icon: React.ReactNode;
}) {
  const toneMap = {
    green: "border-emerald-100 bg-emerald-50/80 text-emerald-700",
    gray: "border-slate-200 bg-slate-50 text-slate-600",
    blue: "border-sky-100 bg-sky-50/80 text-sky-700",
  };
  return (
    <div className={cn("flex flex-1 items-center gap-2.5 rounded-xl border px-3 py-2.5", toneMap[tone])}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-sm">{icon}</span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
        <p className="text-[15px] font-bold leading-tight">{value}</p>
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
  status,
  path,
  feedback,
  hubMeetingPanelTitle,
  initialNote = "",
  minDate,
  emailMissing = false,
  scheduleInstruction,
  onNotesChange,
}: ScheduleHubMeetingModalProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const [notes, setNotes] = useState(initialNote);
  const [meetingType, setMeetingType] = useState("");
  const [designerName, setDesignerName] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(minDate);
  const [selectedStartMin, setSelectedStartMin] = useState<number | null>(null);
  const [showNoteError, setShowNoteError] = useState(false);
  const [localError, setLocalError] = useState("");
  const [designers, setDesigners] = useState<DesignModuleDesigner[]>([]);
  const [designersLoading, setDesignersLoading] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [bookedBlocks, setBookedBlocks] = useState<BookedTimelineBlock[]>([]);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (!wasOpenRef.current) {
      setNotes(initialNote);
      setMeetingType("");
      setDesignerName("");
      setAppointmentDate(minDate);
      setSelectedStartMin(null);
      setShowNoteError(false);
      setLocalError("");
      wasOpenRef.current = true;
    }
  }, [open, initialNote, minDate]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDesignersLoading(true);
    void fetchDesignersFromDesignModule()
      .then((list) => {
        if (!cancelled) setDesigners(list);
      })
      .catch(() => {
        if (!cancelled) setDesigners([]);
      })
      .finally(() => {
        if (!cancelled) setDesignersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !designerName.trim() || !appointmentDate.trim()) {
      setBookedBlocks([]);
      setSelectedStartMin(null);
      return;
    }
    let cancelled = false;
    setAppointmentsLoading(true);
    void fetchDesignerAppointments(designerName.trim())
      .then((rows) => {
        if (cancelled) return;
        const blocks = rows
          .map((row, i) => appointmentToBookedBlock(row, appointmentDate.trim(), i))
          .filter((b): b is BookedTimelineBlock => Boolean(b));
        setBookedBlocks(blocks);
        const earliest = findEarliestAvailableStart(blocks);
        setSelectedStartMin((prev) => {
          if (prev !== null && isHubMeetingStartAvailable(prev, blocks)) return prev;
          return earliest;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setBookedBlocks([]);
          setSelectedStartMin(null);
        }
      })
      .finally(() => {
        if (!cancelled) setAppointmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentDate, designerName, open]);

  const meetingTypeLabel =
    MEETING_TYPE_OPTIONS.find((o) => o.value === meetingType)?.label ?? "Select type";
  const meetingDateLabel = formatHubMeetingDateLabel(appointmentDate);
  const timelineStats = useMemo(() => computeHubTimelineStats(bookedBlocks), [bookedBlocks]);
  const startOptions = useMemo(() => listHubMeetingStartOptions(), []);
  const selectedEndMin =
    selectedStartMin !== null ? selectedStartMin + HUB_MEETING_DURATION_MIN : null;
  const timelineHeight = (HUB_MEETING_TIMELINE_END_MIN - HUB_MEETING_TIMELINE_START_MIN) * PX_PER_MIN;
  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let m = HUB_MEETING_TIMELINE_START_MIN; m <= HUB_MEETING_TIMELINE_END_MIN; m += 30) {
      marks.push(m);
    }
    return marks;
  }, []);

  if (!open) return null;

  const handleConfirm = async () => {
    setShowNoteError(true);
    setLocalError("");
    if (emailMissing) {
      setLocalError("Add a valid customer email on the lead (Lead tab) before scheduling.");
      return;
    }
    if (!notes.trim()) {
      setLocalError("Notes are required.");
      return;
    }
    if (!designerName.trim()) {
      setLocalError("Select a designer.");
      return;
    }
    if (!appointmentDate.trim()) {
      setLocalError("Select a date.");
      return;
    }
    if (!meetingType.trim()) {
      setLocalError("Select a meeting type.");
      return;
    }
    if (selectedStartMin === null || !isHubMeetingStartAvailable(selectedStartMin, bookedBlocks)) {
      setLocalError("Pick an available 90-minute slot.");
      return;
    }
    const startTime = buildHubMeetingDateTimeIso(appointmentDate.trim(), selectedStartMin);
    const endTime = buildHubMeetingDateTimeIso(
      appointmentDate.trim(),
      selectedStartMin + HUB_MEETING_DURATION_MIN,
    );
    await onConfirm({
      designerName: designerName.trim(),
      date: appointmentDate.trim(),
      startTime,
      endTime,
      meetingType: meetingType as ScheduleHubMeetingConfirmPayload["meetingType"],
      notes: notes.trim(),
    });
  };

  const displayError = error || localError;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 px-3 py-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-hub-meeting-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[96vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--crm-border)] px-6 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CalendarCheckIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 id="schedule-hub-meeting-title" className="text-[18px] font-bold text-[var(--crm-text-primary)]">
                Schedule Hub Meeting
              </h2>
              <p className="mt-0.5 text-[12px] text-[var(--crm-text-muted)]">
                Book a designer meeting and automatically block the selected slot.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[18px] text-[var(--crm-text-muted)] transition hover:bg-[var(--crm-surface-subtle)]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-[var(--crm-border)] border-b border-[var(--crm-border)] bg-white sm:grid-cols-4 sm:divide-y-0">
          <SummaryColumn
            leading={
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-[15px] font-bold text-emerald-700">
                {designerName ? designerName.charAt(0) : "D"}
              </span>
            }
            label="Designer"
            value={
              <>
                <span className="truncate">{designerName || "Select designer"}</span>
                {designerName ? <VerifiedBadge /> : null}
              </>
            }
          />
          <SummaryColumn
            leading={
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-[15px] font-bold text-violet-700">
                {leadCustomerName.charAt(0) || "C"}
              </span>
            }
            label="Customer"
            value={<span className="truncate">{leadCustomerName}</span>}
            meta={leadDisplayId ? <span className="font-mono">{leadDisplayId}</span> : undefined}
          />
          <SummaryColumn
            leading={
              <SummaryIconBox>
                <CalendarCheckIcon className="h-[18px] w-[18px]" />
              </SummaryIconBox>
            }
            label="Meeting Type"
            value={<span className="truncate">{meetingTypeLabel}</span>}
          />
          <SummaryColumn
            leading={
              <SummaryIconBox>
                <CalendarCheckIcon className="h-[18px] w-[18px]" />
              </SummaryIconBox>
            }
            label="Date"
            value={<span className="truncate">{meetingDateLabel}</span>}
            trailing={
              <>
                <input
                  ref={dateInputRef}
                  type="date"
                  min={minDate}
                  value={appointmentDate}
                  onChange={(e) => {
                    setAppointmentDate(e.target.value);
                    setSelectedStartMin(null);
                  }}
                  className="sr-only"
                  tabIndex={-1}
                />
                <button
                  type="button"
                  onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
                  className="whitespace-nowrap text-[12px] font-semibold text-emerald-600 hover:underline"
                >
                  Change Date
                </button>
              </>
            }
          />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden px-6 py-4 lg:grid-cols-[300px_1fr]">
          <div className="overflow-y-auto rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)]/50 p-4">
            <h3 className="mb-3 text-[14px] font-bold text-[var(--crm-text-primary)]">Meeting Details</h3>
            <div className="space-y-3">
              <ReadOnlyField label="Status" value={status} />
              <ReadOnlyField label="Path" value={path} />
              <ReadOnlyField label="Feedback" value={feedback} />

              <h4 className="pt-1 text-[13px] font-bold text-[var(--crm-text-primary)]">{hubMeetingPanelTitle}</h4>
              {scheduleInstruction ? (
                <div className="space-y-2 text-[11px] text-[var(--crm-text-muted)]">{scheduleInstruction}</div>
              ) : null}

              <div>
                <FieldLabel required>Designer</FieldLabel>
                <Select
                  value={designerName}
                  onChange={(e) => {
                    setDesignerName(e.target.value);
                    setSelectedStartMin(null);
                  }}
                  disabled={designersLoading || busy}
                  className="h-[40px] text-[13px]"
                >
                  <option value="">
                    {designersLoading ? "Loading designers…" : "Select designer"}
                  </option>
                  {designers.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <FieldLabel required>Meeting Type</FieldLabel>
                <Select
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value)}
                  disabled={busy}
                  className="h-[40px] text-[13px]"
                >
                  <option value="">Select meeting type</option>
                  {MEETING_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <FieldLabel required>Notes</FieldLabel>
                <Textarea
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    onNotesChange?.(e.target.value);
                  }}
                  placeholder="Add meeting context, customer expectations, preferences or important discussion points..."
                  missing={showNoteError && !notes.trim()}
                  disabled={busy}
                  className="min-h-[100px] text-[13px]"
                />
              </div>
              {emailMissing ? (
                <p className="text-[12px] text-rose-600">
                  Add a valid customer email on the Lead tab before scheduling.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--crm-border)] bg-white">
            <div className="border-b border-[var(--crm-border)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[14px] font-bold text-[var(--crm-text-primary)]">Designer Availability</h3>
                <div className="flex items-center gap-4 text-[11px] text-[var(--crm-text-muted)]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-emerald-400 bg-emerald-50" />
                    Available
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" />
                    Booked
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm border-2 border-emerald-500 bg-emerald-50" />
                    Selected
                  </span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <StatCard
                  label="Available"
                  value={timelineStats.availableLabel}
                  tone="green"
                  icon={<CalendarCheckIcon className="h-4 w-4 text-emerald-600" />}
                />
                <StatCard
                  label="Booked"
                  value={timelineStats.bookedLabel}
                  tone="gray"
                  icon={<CalendarCheckIcon className="h-4 w-4 text-slate-500" />}
                />
                <StatCard
                  label="Utilization"
                  value={`${timelineStats.utilizationPct}%`}
                  tone="blue"
                  icon={<span className="text-sm">📊</span>}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {!designerName.trim() || !appointmentDate.trim() ? (
                <p className="py-8 text-center text-[13px] text-[var(--crm-text-muted)]">
                  Select designer and date to view availability.
                </p>
              ) : appointmentsLoading ? (
                <p className="py-8 text-center text-[13px] text-[var(--crm-text-muted)]">Loading availability…</p>
              ) : (
                <>
                  <p className="mb-3 text-center text-[12px] text-[var(--crm-text-muted)]">
                    Click a start time to book {HUB_MEETING_DURATION_MIN} minutes (11:00 AM – 7:00 PM)
                  </p>
                  <div className="flex gap-3">
                    <div className="relative w-[72px] shrink-0" style={{ height: timelineHeight }}>
                      {startOptions.map((m) => {
                        const available = isHubMeetingStartAvailable(m, bookedBlocks);
                        const isSelected = selectedStartMin === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            disabled={!available || busy}
                            onClick={() => available && setSelectedStartMin(m)}
                            className={cn(
                              "absolute right-0 -translate-y-1/2 rounded px-1 py-0.5 text-[10px] font-semibold transition",
                              isSelected
                                ? "bg-emerald-600 text-white"
                                : available
                                  ? "text-emerald-700 hover:bg-emerald-50"
                                  : "cursor-not-allowed text-slate-300",
                            )}
                            style={{ top: (m - HUB_MEETING_TIMELINE_START_MIN) * PX_PER_MIN }}
                          >
                            {minutesToHubTimeLabel(m)}
                          </button>
                        );
                      })}
                    </div>
                    <div
                      className="relative flex-1 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)]/40"
                      style={{ height: timelineHeight }}
                    >
                      {hourMarks.map((m) => (
                        <div
                          key={`line-${m}`}
                          className="absolute left-0 right-0 border-t border-dashed border-slate-200/80"
                          style={{ top: (m - HUB_MEETING_TIMELINE_START_MIN) * PX_PER_MIN }}
                        />
                      ))}

                      {bookedBlocks.map((block) => {
                        const top = (block.startMin - HUB_MEETING_TIMELINE_START_MIN) * PX_PER_MIN;
                        const height = (block.endMin - block.startMin) * PX_PER_MIN;
                        return (
                          <div
                            key={block.id}
                            className="absolute left-3 right-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100/90 px-3 py-2"
                            style={{ top, height: Math.max(height, 48) }}
                          >
                            <span className="text-slate-400" aria-hidden>
                              🔒
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-semibold text-slate-700">{block.label}</p>
                              {block.sublabel ? (
                                <p className="truncate text-[10px] text-slate-500">({block.sublabel})</p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}

                      {selectedStartMin !== null && selectedEndMin !== null ? (
                        <div
                          className="absolute left-3 right-2 overflow-hidden rounded-lg border-2 border-emerald-500 bg-emerald-50 px-3 py-2 shadow-[inset_4px_0_0_#16a34a]"
                          style={{
                            top: (selectedStartMin - HUB_MEETING_TIMELINE_START_MIN) * PX_PER_MIN,
                            height: Math.max(
                              (selectedEndMin - selectedStartMin) * PX_PER_MIN,
                              52,
                            ),
                          }}
                        >
                          <div className="flex h-full flex-col justify-center gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white">
                                SELECTED
                              </span>
                              <span className="text-emerald-600" aria-hidden>
                                ✓
                              </span>
                            </div>
                            <p className="text-[12px] font-semibold text-emerald-800">
                              {formatHubTimeRange(selectedStartMin, selectedEndMin)} ({HUB_MEETING_DURATION_MIN} mins)
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-[var(--crm-border)] bg-[var(--crm-surface-subtle)]/60 px-4 py-3">
              <h4 className="mb-2.5 text-[13px] font-bold text-[var(--crm-text-primary)]">Selected Appointment</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {[
                  { icon: "👤", label: "Designer", value: designerName || "—" },
                  { icon: "👤", label: "Customer", value: leadCustomerName },
                  { icon: "📅", label: "Date", value: meetingDateLabel },
                  { icon: "🚩", label: "Lead ID", value: leadDisplayId },
                  {
                    icon: "🕐",
                    label: "Time",
                    value:
                      selectedStartMin !== null && selectedEndMin !== null
                        ? formatHubTimeRange(selectedStartMin, selectedEndMin)
                        : "—",
                  },
                  { icon: "⏳", label: "Duration", value: `${HUB_MEETING_DURATION_MIN} Minutes` },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-[12px]">
                    <span className="text-base leading-none opacity-70" aria-hidden>
                      {item.icon}
                    </span>
                    <div>
                      <p className="text-[10px] font-medium text-[var(--crm-text-muted)]">{item.label}</p>
                      <p className="font-semibold text-[var(--crm-text-primary)]">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {displayError ? (
          <p className="px-6 pb-2 text-[13px] text-rose-600">{displayError}</p>
        ) : null}

        <div className="flex items-center justify-between border-t border-[var(--crm-border)] px-6 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedStartMin(null)}
              disabled={busy || selectedStartMin === null}
            >
              Clear Selection
            </Button>
            <Button
              type="button"
              variant="success"
              icon={<CalendarCheckIcon className="h-4 w-4" />}
              onClick={() => void handleConfirm()}
              disabled={busy}
              className="!bg-gradient-to-br !from-emerald-500 !to-emerald-600"
            >
              {busy ? "Scheduling…" : "Schedule Meeting"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
