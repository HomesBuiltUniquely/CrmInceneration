"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";
import {
  formatInr,
  formatMeetingValue,
  meetingDetailsSubtitleLevel,
  MEETING_TIME_ZONE,
  type MeetingRecord,
} from "@/lib/meeting-management-data";
import {
  isMeetingQuotePendingProgress,
  isMeetingSuccessfulProgress,
  isQuoteSentSuccessfulProgress,
  meetingProgressTone,
} from "@/lib/meeting-progress";
import {
  emptyQuoteTimeline,
  formatQuoteTimelineWhen,
  latestQuoteVersionLabel,
  loadQuoteTimeline,
  type QuoteTimeline,
  type QuoteTimelineSend,
  type QuoteTimelineVersion,
} from "@/lib/quote-timeline-api";
import {
  canViewCustomerQuoteOpenCount,
  canViewDesignerMeetingFeedback,
} from "@/lib/roleUtils";
import {
  ActivityHistorySheet,
  ActivityHistoryTrigger,
  latestHistoryCaption,
  useMeetingActivityHistory,
  type HistoryFilter,
} from "./MeetingActivityHistory";
import { focusRing } from "./motion";

const INVISIBLE_SCROLL =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

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
  const [canViewFeedback, setCanViewFeedback] = useState(false);
  const [canViewQuoteOpenCount, setCanViewQuoteOpenCount] = useState(false);
  const history = useMeetingActivityHistory(row.leadId, row.leadTypeCode);

  useEffect(() => {
    setHistoryOpen(false);
    setFilter("meeting");
  }, [row.id]);

  useEffect(() => {
    const role = normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "");
    setCanViewFeedback(canViewDesignerMeetingFeedback(role));
    setCanViewQuoteOpenCount(canViewCustomerQuoteOpenCount(role));
  }, []);

  return (
    <>
      <div className="mt-4 flex flex-col items-stretch gap-4 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <SummaryCards row={row} />
          <section>
            <h2 className="text-[11px] font-bold tracking-[0.08em] text-[#5F6675]">CLIENT</h2>
            <div className="mt-2 grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-3">
              <Field label="Phone" value={phoneValue(row.phone)} />
              <Field label="Email" value={emailValue(row.customerEmail)} />
              <Field label="Progress" value={<ProgressPill row={row} />} />
              <Field label="Lead budget" value={formatMeetingValue(row.budget)} />
              <Field label="Source" value={textOrDash(row.appointmentSource)} />
              <Field label="Lead quote" value={formatMeetingValue(row.quoteValue)} />
            </div>
            {canViewFeedback ? <DesignerFeedbackView row={row} /> : null}
          </section>
          <FieldSection title="Team and meeting">
            <Field label="Meeting level" value={textOrDash(row.meetingLevel)} />
            <Field label="Quote link" value={quoteLinkValue(row)} />
            {canViewQuoteOpenCount ? (
              <>
                <Field
                  label="Quote link opens"
                  value={quoteOpenCountValue(row, row.customer)}
                />
                <Field
                  label="Last quote open"
                  value={textOrDash(row.lastCustomerQuoteOpenAt)}
                />
              </>
            ) : null}
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

/** View-only. Hidden when board has no feedback text. */
function DesignerFeedbackView({ row }: { row: MeetingRecord }) {
  const text = row.feedbackDesigner?.trim() ?? "";
  if (!text) return null;
  const meta = [row.feedbackDesignerBy, formatFeedbackWhen(row.feedbackDesignerAt)]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="mt-3 rounded-[14px] border border-[#E0E7FF] bg-gradient-to-br from-[#F8FAFF] to-white px-3.5 py-3">
      <p className="text-[12px] font-bold tracking-[0.04em] text-[#4338CA]">DESIGNER FEEDBACK</p>
      <p className="mt-2 text-[14px] font-bold leading-snug text-[#14171F] whitespace-pre-wrap break-words">{text}</p>
      {meta ? <p className="mt-1.5 text-[12px] font-medium text-[#5F6675]">{meta}</p> : null}
    </div>
  );
}

function formatFeedbackWhen(raw?: string): string {
  const text = raw?.trim() ?? "";
  if (!text) return "";
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return text;
  return new Date(parsed).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: MEETING_TIME_ZONE,
  });
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

function ProgressPill({ row }: { row: MeetingRecord }) {
  const tone = meetingProgressTone(row.progress, row.progressLabel);
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${tone.pill}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tone.dot }} />
      <span className="truncate">{tone.label}</span>
    </span>
  );
}

function LeadJourney({ row }: { row: MeetingRecord }) {
  const timeline = useQuoteTimeline(row.leadId, row.leadTypeCode);
  const steps = useMemo(
    () => journeySteps(row, timeline.data),
    [row, timeline.data],
  );
  const done = steps.filter((step) => step.state === "done").length;
  return (
    <aside className="flex h-full min-h-[420px] w-full flex-col rounded-[14px] bg-[#0F3D2B] p-4 text-white">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[13px] font-bold tracking-[0.08em]">LEAD JOURNEY</h2>
        <p className="text-[12px] font-semibold text-[#D7E8DE]">{done} of 6 steps</p>
      </div>
      <ol className={`relative mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pr-0.5 ${INVISIBLE_SCROLL}`}>
        <span className="absolute bottom-3 left-[11px] top-3 border-l border-dashed border-white/40" aria-hidden />
        {steps.map((step) => (
          <li key={step.title} className="relative flex gap-3">
            <StepMark state={step.state} />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] font-bold leading-tight">{step.title}</p>
              {step.detail ? (
                <p className="mt-0.5 text-[12px] font-medium leading-snug text-[#D7E8DE]">{step.detail}</p>
              ) : null}
              {step.tag ? (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#E3F3EA] px-2 py-0.5 text-[11px] font-bold text-[#0B6B45]">
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
                    <path d="M3.5 8.2l2.6 2.6 6-6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  {step.tag}
                </span>
              ) : null}
              {step.extra}
            </div>
          </li>
        ))}
      </ol>
      {timeline.loading ? (
        <p className="mt-3 text-[11px] font-medium text-[#D7E8DE]/80">Syncing quote timeline…</p>
      ) : null}
    </aside>
  );
}

function useQuoteTimeline(leadId?: number, leadType?: string) {
  const [data, setData] = useState<QuoteTimeline>(() => emptyQuoteTimeline());
  const [loading, setLoading] = useState(false);
  const ready = leadId != null && leadId > 0 && Boolean(leadType?.trim());

  useEffect(() => {
    if (!ready || leadId == null || !leadType?.trim()) {
      setData(emptyQuoteTimeline());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadQuoteTimeline(leadId, leadType.trim())
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .catch(() => {
        if (!cancelled) setData(emptyQuoteTimeline());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, leadType, ready]);

  return { ready, loading, data };
}

function QuoteGeneratedDetail({ timeline }: { timeline: QuoteTimeline }) {
  const label = latestQuoteVersionLabel(timeline);
  const when = formatQuoteTimelineWhen(
    timeline.latestQuoteGeneratedAt || timeline.latestVersion?.generatedAt,
  );
  if (!label && !when) return null;
  return (
    <div className="mt-1.5 rounded-[10px] border border-white/15 bg-white/[0.06] px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-bold leading-tight text-white">{label || "Latest version"}</p>
        {timeline.latestVersion?.quotedAmount ? (
          <p className="shrink-0 text-[11px] font-semibold text-[#B8F0D0]">
            {formatInr(timeline.latestVersion.quotedAmount)}
          </p>
        ) : null}
      </div>
      {when ? <p className="mt-0.5 text-[11px] font-medium text-[#D7E8DE]">{when}</p> : null}
    </div>
  );
}

function QuoteSentFlow({ timeline }: { timeline: QuoteTimeline }) {
  const rows = quoteSentFlowRows(timeline);
  if (rows.length === 0 && timeline.quoteSentCount <= 0) return null;
  const openCount = timeline.customerQuoteOpenCount;
  return (
    <div className="mt-1.5 min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#E3F3EA] px-2 py-0.5 text-[11px] font-bold text-[#0B6B45]">
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
            <path d="M3.5 8.2l2.6 2.6 6-6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Sent{timeline.quoteSentCount > 1 ? ` · ${timeline.quoteSentCount}×` : ""}
        </span>
        {openCount > 0 ? (
          <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-[#D7E8DE]">
            Opened {openCount} {openCount === 1 ? "time" : "times"}
          </span>
        ) : null}
      </div>
      {rows.length > 0 ? (
        <div
          className={`mt-2 max-h-[112px] space-y-1.5 overflow-y-auto overscroll-contain pr-0.5 ${INVISIBLE_SCROLL}`}
          aria-label="Quote send history"
        >
          {rows.map((row) => (
            <div
              key={row.key}
              className="rounded-[10px] border border-white/12 bg-gradient-to-r from-white/[0.09] to-white/[0.03] px-2.5 py-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-bold leading-tight text-white">{row.title}</p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-[#D7E8DE]">{row.subtitle}</p>
                </div>
                {row.meta ? (
                  <p className="shrink-0 text-right text-[10px] font-semibold uppercase tracking-wide text-[#B8F0D0]">
                    {row.meta}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type SentFlowRow = { key: string; title: string; subtitle: string; meta?: string };

function quoteSentFlowRows(timeline: QuoteTimeline): SentFlowRow[] {
  if (timeline.sends.length > 0) {
    return timeline.sends.map((send, index) => sentRowFromSend(send, index));
  }
  const sentVersions = timeline.versions.filter((version) => version.sentToCustomer || version.sentCount > 0);
  return sentVersions.map((version, index) => sentRowFromVersion(version, index));
}

function sentRowFromSend(send: QuoteTimelineSend, index: number): SentFlowRow {
  const when = formatQuoteTimelineWhen(send.sentAt);
  const who = [send.sentBy, send.recipient].filter(Boolean).join(" → ");
  return {
    key: `send-${send.quoteId || send.versionNumber}-${send.sentAt}-${index}`,
    title: send.versionLabel || (send.versionNumber > 0 ? `Version ${send.versionNumber}` : "Quote sent"),
    subtitle: [when, who].filter(Boolean).join(" · ") || "Sent to customer",
    meta: "Sent",
  };
}

function sentRowFromVersion(version: QuoteTimelineVersion, index: number): SentFlowRow {
  const when = formatQuoteTimelineWhen(version.lastSentAt || version.firstSentAt);
  const opens =
    version.openCount > 0
      ? `${version.openCount} open${version.openCount === 1 ? "" : "s"}`
      : undefined;
  return {
    key: `version-${version.quoteId || version.versionNumber}-${index}`,
    title: version.versionLabel || `Version ${version.versionNumber}`,
    subtitle: [
      when,
      version.sentCount > 1 ? `Sent ${version.sentCount}×` : null,
      version.quotedAmount > 0 ? formatInr(version.quotedAmount) : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Sent to customer",
    meta: opens,
  };
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

type JourneyStep = {
  title: string;
  state: "done" | "current" | "pending";
  detail?: string;
  tag?: string;
  extra?: ReactNode;
};

function journeySteps(row: MeetingRecord, timeline?: QuoteTimeline): JourneyStep[] {
  const progress = row.progress ?? "SCHEDULED";
  const successDone = isMeetingSuccessfulProgress(progress) || row.meetingSuccessful === true;
  const visitDone = progress === "IN_PROGRESS" || successDone;
  const timelineHasQuote =
    Boolean(timeline?.latestVersion) ||
    (timeline?.versions.length ?? 0) > 0 ||
    Boolean(timeline?.latestQuoteGeneratedAt);
  const quoteDone = row.quoteGenerated === true || timelineHasQuote || successDone;
  const followDone =
    isQuoteSentSuccessfulProgress(progress) ||
    row.quoteFollow === true ||
    row.quoteSent === true ||
    (timeline?.quoteSentCount ?? 0) > 0;
  const quotePending = successDone && !followDone && isMeetingQuotePendingProgress(progress);
  const doneFlags = [true, visitDone, successDone, quoteDone, followDone, false];
  const currentIndex = doneFlags.findIndex((done) => !done);
  const when = textOrDash(row.whenLabel);
  const progressTone = meetingProgressTone(progress, row.progressLabel);
  const visitDetail =
    progress === "IN_PROGRESS"
      ? `In Progress · ${when}`
      : progress === "MEETING_ABANDONED"
        ? `Meeting Never Happened · ${when}`
        : successDone
          ? when
          : `Up next · ${when}`;
  const person = row.salesName || row.assignee || "";
  const scheduledDetail = [row.scheduledAt && row.scheduledAt !== "—" ? row.scheduledAt : "", person].filter(Boolean).join(" · ");
  const visitTitle = row.meetingType && row.meetingType !== "—" ? row.meetingType : "Showroom visit";
  const successDetail = successDone
    ? quotePending
      ? progressTone.label
      : followDone
        ? "Yes · Quote sent"
        : "Yes"
    : undefined;

  const versionLabel = timeline ? latestQuoteVersionLabel(timeline) : "";
  const generatedWhen = formatQuoteTimelineWhen(
    timeline?.latestQuoteGeneratedAt || timeline?.latestVersion?.generatedAt,
  );
  const hasGeneratedMeta = Boolean(versionLabel || generatedWhen);

  const steps: Array<Omit<JourneyStep, "state">> = [
    { title: "Meeting scheduled", detail: scheduledDetail || undefined },
    { title: visitTitle, detail: visitDetail },
    { title: "Meeting successful", detail: successDetail },
    {
      title: "Quote generated",
      detail:
        quoteDone && !hasGeneratedMeta
          ? "Yes"
          : undefined,
      extra:
        quoteDone && timeline && hasGeneratedMeta ? (
          <QuoteGeneratedDetail timeline={timeline} />
        ) : undefined,
    },
    {
      title: "Quote follow-up",
      tag: followDone
        ? timeline &&
          (timeline.quoteSentCount > 0 ||
            timeline.sends.length > 0 ||
            timeline.versions.some((v) => v.sentToCustomer || v.sentCount > 0))
          ? undefined
          : "Quote sent"
        : quotePending
          ? "Quote pending"
          : undefined,
      extra:
        followDone && timeline ? (
          <QuoteSentFlow timeline={timeline} />
        ) : undefined,
    },
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
  const level = meetingDetailsSubtitleLevel(row) ?? row.meetingLevel;
  return [row.meetingType, level, row.leadType].map((part) => (part && part !== "—" ? part : "")).filter(Boolean).join(" · ") || "—";
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

function quoteOpenCountValue(row: MeetingRecord, customerName?: string): ReactNode {
  const n = row.customerQuoteOpenCount ?? 0;
  const who = customerName?.trim() || "customer";
  if (n <= 0) return `${who} hasn't opened yet`;
  if (n === 1) return `Opened once by ${who}`;
  return `Opened ${n} times by ${who}`;
}
