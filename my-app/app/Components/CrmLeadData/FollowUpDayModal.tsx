"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import type { FollowUpBriefRow } from "@/lib/sales-executive-followup-day-brief";
import type { FollowUpDayApiResponse } from "@/lib/sales-executive-followup-day-client";
import { followUpModalTitle } from "@/lib/se-followup-modal-titles";
import styles from "./FollowUpDayModal.module.css";

type Props = {
  open: boolean;
  variant: "morning" | "evening";
  firstName: string;
  quote: string;
  apiPayload: FollowUpDayApiResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  onStartFollowUps: () => void;
};

const MIN_GAP_MINUTES = 15;

function formatClock12(now: Date): string {
  const h = now.getHours();
  const m = now.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function minutesLocal(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function minutesFromFollowUpMs(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

function allTodayRowsSorted(rows: FollowUpBriefRow[]): FollowUpBriefRow[] {
  return [...rows]
    .filter((r) => Number.isFinite(r.followUpMs))
    .sort((a, b) => a.followUpMs - b.followUpMs);
}

function formatDur(mins: number): string {
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  if (h) return r ? `${h}h ${r}m` : `${h}h`;
  return `${r} min`;
}

function segmentTag(segment: FollowUpBriefRow["segment"]): string {
  return segment === "closure" ? "Opportunity" : "Lead";
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2 2l10 10M12 2L2 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GapClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 3v3l2 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ProgressDonut({ completed, total }: { completed: number; total: number }) {
  const size = 88;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safeTotal = Math.max(total, 1);
  const ratio = Math.min(1, Math.max(0, completed / safeTotal));
  const doneLen = c * ratio;
  const pendingLen = c - doneLen;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className={styles.donutLeft}
        strokeWidth={stroke}
        opacity={0.2}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className={styles.donutDone}
        strokeWidth={stroke}
        strokeDasharray={`${doneLen} ${pendingLen}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className={styles.donutLeft}
        strokeWidth={stroke}
        strokeDasharray={`${pendingLen} ${doneLen}`}
        strokeDashoffset={-doneLen}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        className={styles.donutLabel}
      >
        {completed}/{total}
      </text>
    </svg>
  );
}

function MorningTimeline({ rows, now }: { rows: FollowUpBriefRow[]; now: Date }) {
  const sorted = useMemo(() => allTodayRowsSorted(rows), [rows]);
  const nowMs = now.getTime();
  const nowMins = minutesLocal(now);
  const past = sorted.filter((r) => r.followUpMs < nowMs);
  const upcoming = sorted.filter((r) => r.followUpMs >= nowMs);

  if (sorted.length === 0) {
    return <p className={styles.status}>No follow-ups scheduled for today.</p>;
  }

  const nodes: ReactNode[] = [];

  for (const row of past) {
    nodes.push(
      <div key={row.leadKey} className={styles.nd}>
        <div className={styles.dt} aria-hidden />
        <div className={styles.row}>
          <div className="min-w-0">
            <span className={styles.tm}>{row.timeLabel}</span>
            <div className={styles.nm}>{row.name}</div>
            <div className={styles.sub}>{row.stageLabel}</div>
          </div>
          <span
            className={
              row.segment === "closure" ? `${styles.tag} ${styles.tagOpp}` : styles.tag
            }
          >
            {segmentTag(row.segment)}
          </span>
        </div>
      </div>,
    );
  }

  nodes.push(
    <div key="now" className={styles.nd}>
      <div className={`${styles.dt} ${styles.dtNow}`} aria-hidden />
      <div className={`${styles.tm} ${styles.tmNow}`}>NOW · {formatClock12(now)}</div>
    </div>,
  );

  let prevMins = nowMins;
  for (const row of upcoming) {
    const itemMins = minutesFromFollowUpMs(row.followUpMs);
    const gap = itemMins - prevMins;
    if (gap >= MIN_GAP_MINUTES) {
      nodes.push(
        <div key={`gap-${row.leadKey}`} className={`${styles.nd} ${styles.ndGap}`}>
          <span className={styles.gapPill}>
            <GapClockIcon />
            {formatDur(gap)} free · call overdue leads
          </span>
        </div>,
      );
    }
    nodes.push(
      <div key={row.leadKey} className={styles.nd}>
        <div className={styles.dt} aria-hidden />
        <div className={styles.row}>
          <div className="min-w-0">
            <span className={styles.tm}>{row.timeLabel}</span>
            <div className={styles.nm}>{row.name}</div>
            <div className={styles.sub}>{row.stageLabel}</div>
          </div>
          <span
            className={
              row.segment === "closure" ? `${styles.tag} ${styles.tagOpp}` : styles.tag
            }
          >
            {segmentTag(row.segment)}
          </span>
        </div>
      </div>,
    );
    prevMins = itemMins;
  }

  return <div className={styles.tl}>{nodes}</div>;
}

function EveningBody({
  counts,
  pending,
}: {
  counts: FollowUpDayApiResponse["counts"];
  pending: FollowUpBriefRow[];
}) {
  const completed = counts?.completed ?? 0;
  const left = counts?.left ?? 0;
  const totalDue = Math.max(counts?.totalDue ?? 0, 1);
  const olderCleared = counts?.olderOverdueCleared ?? 0;

  return (
    <>
      <div className={styles.eveProgress}>
        <ProgressDonut completed={completed} total={totalDue} />
        <div>
          <p className={styles.eveStatsTitle}>{completed} followed up</p>
          <p className={styles.eveStatsSub}>
            <b>{left} left</b>
            {olderCleared > 0 ? ` · ${olderCleared} older overdue cleared` : null}
          </p>
        </div>
      </div>

      {left > 0 ? (
        <div className={styles.warnBanner}>
          <b>{left} left</b> will become overdue tonight unless followed up
        </div>
      ) : null}

      {pending.length > 0 ? (
        <ul className={styles.evList}>
          {pending.map((row) => (
            <li key={row.leadKey} className={styles.evRow}>
              <span className={styles.evTime}>{row.timeLabel}</span>
              <div className="min-w-0 flex-1">
                <div className={styles.nm}>{row.name}</div>
                <div className={styles.sub}>{row.stageLabel}</div>
              </div>
              <span
                className={
                  row.segment === "closure" ? `${styles.tag} ${styles.tagOpp}` : styles.tag
                }
              >
                {segmentTag(row.segment)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.status} style={{ color: "var(--se-pop-cy)" }}>
          No pending follow-ups for today — great work.
        </p>
      )}
    </>
  );
}

function MorningScrollBody({
  rows,
  now,
  counts,
}: {
  rows: FollowUpBriefRow[];
  now: Date;
  counts: FollowUpDayApiResponse["counts"] | undefined;
}) {
  return (
    <>
      <MorningTimeline rows={rows} now={now} />
      {(counts?.overdueTotal ?? 0) > 0 ? (
        <div className={styles.ov}>
          <span>
            <b>{counts?.overdueTotal ?? 0} overdue</b> waiting
          </span>
          <span className={styles.ovMuted}>
            {counts?.overdueActive ?? 0} leads · {counts?.overdueClosure ?? 0} opps
          </span>
        </div>
      ) : null}
    </>
  );
}

export default function FollowUpDayModal({
  open,
  variant,
  firstName,
  quote,
  apiPayload,
  loading,
  error,
  onClose,
  onRetry,
  onStartFollowUps,
}: Props) {
  const now = useMemo(() => new Date(), [open, apiPayload?.generatedAt]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const counts = apiPayload?.counts;
  const ready = Boolean(apiPayload?.ok) && !loading && !error;
  const title = followUpModalTitle(variant, firstName);
  const morningTotalDue = counts?.totalDue ?? 0;
  const morningSubtitle = `${morningTotalDue} follow-ups due today`;
  const morningCtaCount = morningTotalDue;
  const morningRows = apiPayload?.firstUp ?? [];
  const pending = apiPayload?.pending ?? [];

  const headerBlock = (
    <div className={styles.hd}>
      <div className="min-w-0">
        <h2 id="se-followup-day-title" className={styles.gr}>
          {title}
        </h2>
        <p className={styles.sb}>
          {variant === "morning" ? morningSubtitle : "Your follow-up report for today"}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className={styles.closeBtn}
        aria-label="Close"
      >
        <CloseIcon />
      </button>
    </div>
  );

  const loadingBlock = (
    <div role="status" aria-busy="true">
      <p className={styles.status}>Loading today&apos;s follow-ups…</p>
      <div className={styles.skel} />
    </div>
  );

  const errorBlock = (
    <div>
      <p className={styles.err}>{error}</p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        Retry
      </button>
    </div>
  );

  return (
    <div
      className={`${styles.root} ${styles.backdrop}`}
      onClick={onClose}
      role="presentation"
    >
      {variant === "morning" ? (
        <div
          className={`${styles.pop} ${styles.popMorning}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="se-followup-day-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.mornTop}>
            {headerBlock}
            {loading || error || !ready ? null : quote ? (
              <div className={styles.quote}>{quote}</div>
            ) : null}
          </div>

          <div className={styles.mornList}>
            {loading
              ? loadingBlock
              : error
                ? errorBlock
                : ready ? (
                    <MorningScrollBody rows={morningRows} now={now} counts={counts} />
                  ) : null}
          </div>

          {ready && !loading && !error ? (
            <div className={styles.mornFoot}>
              <button
                type="button"
                className={styles.cta}
                onClick={onStartFollowUps}
                disabled={
                  (counts?.totalDue ?? 0) === 0 && (counts?.overdueTotal ?? 0) === 0
                }
              >
                Start follow-ups ({morningCtaCount})
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className={styles.pop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="se-followup-day-title"
          onClick={(e) => e.stopPropagation()}
        >
          {headerBlock}

          {loading ? (
            loadingBlock
          ) : error ? (
            errorBlock
          ) : ready && counts ? (
            <>
              <EveningBody counts={counts} pending={pending} />
              <button
                type="button"
                className={styles.cta}
                onClick={onStartFollowUps}
                disabled={(counts?.left ?? 0) === 0 && pending.length === 0}
              >
                Follow up now
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}