"use client";

import { FieldLabel } from "./ui";
import { formatCrmDateTime } from "@/lib/date-time-format";
import { cn } from "@/lib/cn";

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-4 w-4 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

type DateFieldProps = {
  label: string;
  value: string;
  hint?: string;
  accent?: "purple" | "blue";
};

function ScheduleDateDisplay({
  label,
  value,
  hint,
  accent = "purple",
}: DateFieldProps) {
  const trimmed = value.trim();
  const friendly = trimmed ? formatCrmDateTime(trimmed) : "";
  const accentIcon =
    accent === "purple" ? "text-violet-500" : "text-[var(--crm-accent)]";

  return (
    <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)]/60 p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--crm-surface)] shadow-sm",
            accentIcon,
          )}
        >
          <CalendarIcon />
        </span>
        <FieldLabel>{label}</FieldLabel>
      </div>
      {friendly && friendly !== "—" ? (
        <p className="text-[14px] font-semibold text-[var(--crm-text-primary)]">{friendly}</p>
      ) : (
        <p className="text-[13px] italic text-[var(--crm-text-muted)]">Not scheduled</p>
      )}
      {hint ? (
        <p className="mt-2 text-[11px] text-[var(--crm-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

type Props = {
  meetingDate: string;
  followUpDate: string;
  autoFromMilestone?: boolean;
};

export default function ScheduleFields({
  meetingDate,
  followUpDate,
  autoFromMilestone = false,
}: Props) {
  const meetingHint = autoFromMilestone
    ? "From Meeting Scheduled, Rescheduled, or Revisit (Complete Task)."
    : "Set when you schedule a meeting in Complete Task.";
  const followUpHint = "From milestone / next call date on the lead.";

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
      <ScheduleDateDisplay
        label="Meeting date"
        value={meetingDate}
        hint={meetingHint}
        accent="purple"
      />
      <ScheduleDateDisplay
        label="Follow-up date"
        value={followUpDate}
        hint={followUpHint}
        accent="blue"
      />
    </div>
  );
}
