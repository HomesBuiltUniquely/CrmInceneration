"use client";

import type { Lead } from "@/lib/data";
import type { BookingTokenRecord } from "@/lib/booking-done-api";
import type { BookingTokenLeadCancellation } from "@/lib/cancellation-milestone";
import { formatCrmDateTime } from "@/lib/date-time-format";

type Props = {
  open: boolean;
  onClose: () => void;
  lead: Lead;
  substage: string;
  cancellation: BookingTokenLeadCancellation | null;
  records: BookingTokenRecord[];
};

function statusBadge(status: string | undefined): string {
  const s = (status ?? "").trim().toUpperCase();
  if (s === "PENDING") return "Pending manager approval";
  if (s === "REJECTED") return "Rejected by manager";
  if (s === "APPROVED") return "Approved — refund processed";
  return status?.trim() || "—";
}

export default function BookingTokenCancellationViewModal({
  open,
  onClose,
  lead,
  substage,
  cancellation,
  records,
}: Props) {
  if (!open) return null;

  const latestRecord = records[0];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="bt-cancel-view-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--crm-border)] px-4 py-3">
          <h2 id="bt-cancel-view-title" className="text-[14px] font-bold text-[var(--crm-text-primary)]">
            Cancellation details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[18px] leading-none text-[var(--crm-text-muted)] hover:bg-[var(--crm-surface-subtle)]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 p-4 text-[13px]">
          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--crm-text-muted)]">
              Lead status
            </p>
            <dl className="grid gap-2 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3">
              <Row label="Customer" value={lead.name || "—"} />
              <Row label="Milestone substage" value={substage || "—"} />
              <Row
                label="Category"
                value={lead.stageBlock?.milestoneStageCategory?.trim() || "—"}
              />
              <Row label="Assignee" value={lead.assignee || "—"} />
            </dl>
          </section>

          <section>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--crm-text-muted)]">
              Cancellation
            </p>
            <dl className="grid gap-2 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3">
              <Row
                label="Approval status"
                value={statusBadge(cancellation?.btCancellationApprovalStatus ?? undefined)}
              />
              <Row
                label="Reason"
                value={
                  cancellation?.btCancellationReason?.trim() ||
                  latestRecord?.cancellationReason?.trim() ||
                  "—"
                }
              />
              <Row
                label="Requested at"
                value={
                  cancellation?.btCancellationRequestedAt
                    ? formatCrmDateTime(cancellation.btCancellationRequestedAt)
                    : "—"
                }
              />
              <Row
                label="Attempt"
                value={
                  cancellation?.btCancellationAttemptCount != null
                    ? `${cancellation.btCancellationAttemptCount} / 2`
                    : "—"
                }
              />
              {cancellation?.btCancellationRejectReason ? (
                <Row label="Reject reason" value={cancellation.btCancellationRejectReason} />
              ) : null}
              {cancellation?.btPreviousMilestoneSubstage ? (
                <Row label="Restore target" value={cancellation.btPreviousMilestoneSubstage} />
              ) : null}
            </dl>
          </section>

          {latestRecord ? (
            <section>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.6px] text-[var(--crm-text-muted)]">
                Deal snapshot
              </p>
              <dl className="grid gap-2 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] p-3">
                <Row label="Quote amount" value={String(latestRecord.quoteAmount ?? "—")} />
                <Row label="Amount received" value={String(latestRecord.amountReceived ?? "—")} />
                <Row label="Payment kind" value={String(latestRecord.paymentKind ?? "—")} />
                <Row label="Token status" value={latestRecord.tokenStatus || "—"} />
                <Row label="Booking status" value={latestRecord.bookingStatus || "—"} />
                {latestRecord.bookingDate ? (
                  <Row label="Booking date" value={latestRecord.bookingDate} />
                ) : null}
              </dl>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <dt className="text-[var(--crm-text-muted)]">{label}</dt>
      <dd className="break-words text-[var(--crm-text-primary)]">{value}</dd>
    </div>
  );
}
