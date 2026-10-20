"use client";

import { useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { formatMeetingValue, type MeetingRecord } from "@/lib/meeting-management-data";
import {
  ActivityHistorySheet,
  ActivityHistoryTrigger,
  latestHistoryCaption,
  useMeetingActivityHistory,
  type HistoryFilter,
} from "./MeetingActivityHistory";
import { focusRing } from "./motion";

const PROGRESS_TONE = {
  SCHEDULED: { label: "Scheduled", pill: "bg-[#E6EDFF] text-[#1B3FA8]", dot: "#1B3FA8" },
  IN_PROGRESS: { label: "In progress", pill: "bg-[#FFF1D6] text-[#8A5300]", dot: "#8A5300" },
  MEETING_SUCCESSFUL: { label: "Meeting successful", pill: "bg-[#E3F3EA] text-[#0B6B45]", dot: "#0B6B45" },
} as const;

const STATUS_TONE = {
  SCHEDULED: "bg-[#E6EDFF] text-[#1B3FA8]",
  RESCHEDULED: "bg-[#FFF1D6] text-[#8A5300]",
  CANCELLED: "bg-[#FDECEC] text-[#9B1C1C]",
} as const;

export function MeetingDetailsModal({
  row,
  onClose,
}: {
  row: MeetingRecord | null;
  onClose: () => void;
}) {
  const open = Boolean(row);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <AnimatePresence>
        {row ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-[80] bg-[#14171F]/40 backdrop-blur-[6px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="fixed inset-0 z-[81] overflow-y-auto"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) onClose();
                }}
              >
              <div
                className="flex min-h-full items-start justify-center p-4 sm:items-center"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) onClose();
                }}
              >
              <div className="relative w-[min(980px,calc(100vw-32px))] overflow-hidden rounded-[20px] bg-white font-[family-name:var(--font-manrope)] text-[#14171F] shadow-[0_24px_60px_rgba(20,23,31,0.16)]">
                <div className="p-5">
                  <Dialog.Description className="sr-only">Meeting details for {row.customer}</Dialog.Description>
                  <Header row={row} onClose={onClose} />
                  <DetailsBody row={row} />
                </div>
              </div>
              </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function Header({ row, onClose }: { row: MeetingRecord; onClose: () => void }) {
  const status = row.meetingStatus ?? "SCHEDULED";
  const statusLabel = status === "RESCHEDULED" ? "Rescheduled" : status === "CANCELLED" ? "Cancelled" : "Scheduled";
  return (
    <header className="flex items-start gap-3">
      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E3F3EA] text-[18px] font-bold text-[#0B6B45]">
        {initialOf(row.customer)}
      </span>
      <div className="min-w-0 flex-1">
        <Dialog.Title className="text-[12px] font-semibold text-[#5F6675]">Meeting details</Dialog.Title>
        <p className="truncate text-[22px] font-bold leading-tight text-[#14171F]">{row.customer || "—"}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${STATUS_TONE[status]}`}>
            {statusLabel.toUpperCase()}
          </span>
          {row.branch ? (
            <span className="inline-flex items-center rounded-full bg-[#FDECEC] px-2.5 py-1 text-[11px] font-bold tracking-wide text-[#9B1C1C]">
              EC · {ecName(row.branch)}
            </span>
          ) : null}
          <p className="text-[13px] font-medium text-[#5F6675]">{subtitle(row)}</p>
        </div>
      </div>
      <button
        type="button"
        aria-label="Close meeting details"
        onClick={onClose}
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#14171F] hover:bg-[#F4F6F8] ${focusRing}`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </header>
  );
}

function DetailsBody({ row }: { row: MeetingRecord }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>("meeting");
  const history = useMeetingActivityHistory(row.leadId, row.leadTypeCode);

  useEffect(() => {
    setHistoryOpen(false);
    setFilter("meeting");
  }, [row.id]);

  return (
    <>
      <div className="mt-4 flex flex-col items-stretch gap-4 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <SummaryCards row={row} />
          <FieldSection title="Client">
            <Field label="Phone" value={phoneValue(row.phone)} />
            <Field label="Email" value={emailValue(row.customerEmail)} />
            <Field label="Progress" value={<ProgressPill progress={row.progress ?? "SCHEDULED"} />} />
            <Field label="Lead budget" value={formatMeetingValue(row.budget)} />
            <Field label="Source" value={textOrDash(row.appointmentSource)} />
            <Field label="Lead quote" value={formatMeetingValue(row.quoteValue)} />
          </FieldSection>
          <FieldSection title="Team and meeting">
            <Field label="Meeting level" value={textOrDash(row.meetingLevel)} />
            <Field label="Sales email" value={emailValue(row.salesEmail)} />
            <Field label="Designer email" value={emailValue(row.designerEmail)} />
            <Field label="Scheduled on" value={textOrDash(row.scheduledAt)} />
            <Field label="Quote link" value={quoteLinkValue(row)} />
            <Field label="Scheduled by" value={scheduledByLine(row)} />
          </FieldSection>
          <ActivityHistoryTrigger
            open={historyOpen}
            count={history.activities.length}
            loading={history.loading}
            latest={latestHistoryCaption(history.activities)}
            onToggle={() => setHistoryOpen((open) => !open)}
          />
        </div>
        <div className="flex w-full self-stretch lg:w-[320px]">
          <LeadJourney row={row} />
        </div>
      </div>
      <ActivityHistorySheet
        open={historyOpen}
        filter={filter}
        onFilter={setFilter}
        onClose={() => setHistoryOpen(false)}
        ready={history.ready}
        loading={history.loading}
        error={history.error}
        activities={history.activities}
      />
    </>
  );
}

function SummaryCards({ row }: { row: MeetingRecord }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <article className="rounded-[14px] border border-[#E1E4EB] bg-[#E3F3EA] px-3 py-3">
        <p className="text-[12px] font-semibold text-[#5F6675]">When</p>
        <p className="mt-1 text-[14px] font-bold text-[#0B6B45]">{textOrDash(row.whenLabel)}</p>
        <p className="mt-0.5 text-[12px] font-semibold text-[#5F6675]">{untilLine(row)}</p>
      </article>
      <article className="rounded-[14px] border border-[#E1E4EB] bg-white px-3 py-3">
        <p className="text-[12px] font-semibold text-[#5F6675]">Sales</p>
        <p className="mt-1 text-[14px] font-bold text-[#14171F]">{textOrDash(row.assignedSalesName)}</p>
      </article>
      <article className="rounded-[14px] border border-[#E1E4EB] bg-white px-3 py-3">
        <p className="text-[12px] font-semibold text-[#5F6675]">Designer</p>
        <p className="mt-1 text-[14px] font-bold text-[#14171F]">{textOrDash(row.assignee)}</p>
      </article>
    </div>
  );
}

function FieldSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[11px] font-bold tracking-[0.08em] text-[#5F6675]">{title.toUpperCase()}</h2>
      <div className="mt-2 grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-3">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-semibold text-[#5F6675]">{label}</p>
      <div className="mt-0.5 text-[14px] font-bold text-[#14171F]">{value}</div>
    </div>
  );
}

function ProgressPill({ progress }: { progress: keyof typeof PROGRESS_TONE }) {
  const tone = PROGRESS_TONE[progress];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${tone.pill}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.dot }} />
      {tone.label}
    </span>
  );
}

function LeadJourney({ row }: { row: MeetingRecord }) {
  const steps = journeySteps(row);
  const done = steps.filter((step) => step.state === "done").length;
  return (
    <aside className="flex h-full min-h-[420px] w-full flex-col rounded-[14px] bg-[#0F3D2B] p-4 text-white">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[13px] font-bold tracking-[0.08em]">LEAD JOURNEY</h2>
        <p className="text-[12px] font-semibold text-[#D7E8DE]">{done} of 6 steps</p>
      </div>
      <ol className="relative mt-4 flex flex-1 flex-col justify-between gap-3">
        <span className="absolute bottom-3 left-[11px] top-3 border-l border-dashed border-white/40" aria-hidden />
        {steps.map((step) => (
          <li key={step.title} className="relative flex gap-3">
            <StepMark state={step.state} />
            <div className="min-w-0 pt-0.5">
              <p className="text-[13px] font-bold leading-tight">{step.title}</p>
              {step.detail ? <p className="mt-0.5 text-[12px] font-medium text-[#D7E8DE]">{step.detail}</p> : null}
              {step.tag ? (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#E3F3EA] px-2 py-0.5 text-[11px] font-bold text-[#0B6B45]">
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
                    <path d="M3.5 8.2l2.6 2.6 6-6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  {step.tag}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function StepMark({ state }: { state: "done" | "current" | "pending" }) {
  if (state === "done") {
    return (
      <span className="relative z-[1] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#148F5B] text-white">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
          <path d="M3.5 8.2l2.6 2.6 6-6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="relative z-[1] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[#B8F0D0] bg-[#0F3D2B] shadow-[0_0_0_4px_rgba(184,240,208,0.35)]" />
    );
  }
  return <span className="relative z-[1] inline-flex h-6 w-6 shrink-0 rounded-full border border-dashed border-white/55 bg-[#0F3D2B]" />;
}

function journeySteps(row: MeetingRecord): Array<{ title: string; state: "done" | "current" | "pending"; detail?: string; tag?: string }> {
  const progress = row.progress ?? "SCHEDULED";
  const visitDone = progress === "IN_PROGRESS" || progress === "MEETING_SUCCESSFUL";
  const successDone = row.meetingSuccessful === true;
  const quoteDone = row.quoteGenerated === true;
  const followDone = row.quoteFollow === true || row.quoteSent === true;
  const doneFlags = [true, visitDone, successDone, quoteDone, followDone, false];
  const currentIndex = doneFlags.findIndex((done) => !done);
  const when = textOrDash(row.whenLabel);
  const visitDetail = progress === "IN_PROGRESS" ? `In progress · ${when}` : progress === "MEETING_SUCCESSFUL" ? when : `Up next · ${when}`;
  const person = row.salesName || row.assignee || "";
  const scheduledDetail = [row.scheduledAt && row.scheduledAt !== "—" ? row.scheduledAt : "", person].filter(Boolean).join(" · ");
  const visitTitle = row.meetingType && row.meetingType !== "—" ? row.meetingType : "Showroom visit";
  const steps: Array<{ title: string; detail?: string; tag?: string }> = [
    { title: "Meeting scheduled", detail: scheduledDetail || undefined },
    { title: visitTitle, detail: visitDetail },
    { title: "Meeting successful", detail: successDone ? "Yes" : undefined },
    { title: "Quote generated", detail: quoteDone ? "Yes" : undefined },
    { title: "Quote follow-up", tag: followDone ? "Quote sent" : undefined },
    { title: "Converted to booking", detail: "Booking done · Pending" },
  ];
  return steps.map((step, index) => ({
    ...step,
    state: doneFlags[index] ? "done" : index === currentIndex ? "current" : "pending",
  }));
}

const EC_NAMES: Record<string, string> = {
  HBR: "HBR",
  JP_NAGAR: "JP Nagar",
  SARJAPUR: "Sarjapur",
};

function ecName(branch?: string): string {
  const raw = (branch ?? "").trim();
  if (!raw) return "—";
  const key = raw.toUpperCase().replace(/[\s-]+/g, "_");
  return EC_NAMES[key] ?? raw.replace(/_/g, " ");
}

function subtitle(row: MeetingRecord): string {
  return [row.meetingType, row.meetingLevel, row.leadType].map((part) => (part && part !== "—" ? part : "")).filter(Boolean).join(" · ") || "—";
}

function scheduledByLine(row: MeetingRecord): string {
  const name = row.salesName?.trim();
  const source = row.appointmentSource && row.appointmentSource !== "—" ? row.appointmentSource : "";
  if (name && source) return `${name} · ${source}`;
  return name || source || "—";
}

function untilLine(row: MeetingRecord): string {
  if (!row.date) return "—";
  const [year, month, day] = row.date.split("-").map(Number);
  if (!year || !month || !day) return "—";
  const date = new Date(year, month - 1, day);
  const dateText = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const endMin = row.startMin + (row.durationMin && row.durationMin > 0 ? row.durationMin : 90);
  return `${dateText} · until ${clockLabel(endMin)}`;
}

function clockLabel(totalMin: number): string {
  const hour = Math.floor(totalMin / 60) % 24;
  const minute = totalMin % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function textOrDash(value?: string): string {
  const text = value?.trim();
  return text && text !== "—" ? text : "—";
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "—";
}

function phoneValue(phone?: string): ReactNode {
  const text = phone?.trim();
  if (!text) return "—";
  const href = `tel:${text.replace(/[^\d+]/g, "")}`;
  return (
    <a href={href} className={`text-[14px] font-bold text-[#1B3FA8] underline ${focusRing}`}>
      {text}
    </a>
  );
}

function emailValue(email?: string): ReactNode {
  const text = email?.trim();
  if (!text || text === "—") return "—";
  return (
    <a href={`mailto:${text}`} className={`block truncate text-[14px] font-bold text-[#1B3FA8] underline ${focusRing}`}>
      {text}
    </a>
  );
}

function quoteLinkValue(row: MeetingRecord): ReactNode {
  if (!row.quoteGenerated || !row.quoteLink) return "—";
  return (
    <a href={row.quoteLink} target="_blank" rel="noreferrer" className={`text-[14px] font-bold text-[#1B3FA8] underline ${focusRing}`}>
      Open quote
    </a>
  );
}
