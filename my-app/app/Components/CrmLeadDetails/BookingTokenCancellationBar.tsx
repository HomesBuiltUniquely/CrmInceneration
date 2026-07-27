"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lead } from "@/lib/data";
import type { CrmLeadType } from "@/lib/leads-filter";
import {
  fetchBookingDoneRecords,
  resubmitBookingTokenCancellation,
  type BookingTokenRecord,
} from "@/lib/booking-done-api";
import {
  clearLegacyBookingTokenStorage,
  fetchBookingTokenLeadCancellation,
  resolveCancellationActionVisibility,
  restoreBookingTokenCancellation,
  type BookingTokenLeadCancellation,
} from "@/lib/cancellation-milestone";
import { formatCrmDateTime } from "@/lib/date-time-format";
import BookingTokenCancellationViewModal from "./BookingTokenCancellationViewModal";

type Props = {
  leadType: CrmLeadType;
  leadId: string;
  lead: Lead;
  onLeadReload: () => void | Promise<void>;
  onActivitiesRefresh: () => void | Promise<void>;
};

export default function BookingTokenCancellationBar({
  leadType,
  leadId,
  lead,
  onLeadReload,
  onActivitiesRefresh,
}: Props) {
  const [cancellation, setCancellation] = useState<BookingTokenLeadCancellation | null>(null);
  const [records, setRecords] = useState<BookingTokenRecord[]>([]);
  const [viewOpen, setViewOpen] = useState(false);
  const [busy, setBusy] = useState<"restore" | "send" | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const substage = lead.stageBlock?.milestoneSubStage?.trim() || lead.status?.trim() || "";

  const loadCancellation = useCallback(async () => {
    setLoading(true);
    try {
      clearLegacyBookingTokenStorage(leadType, leadId);
      const data = await fetchBookingTokenLeadCancellation(leadType, leadId);
      setCancellation(data);
    } catch {
      setCancellation(null);
    } finally {
      setLoading(false);
    }
  }, [leadType, leadId]);

  useEffect(() => {
    void loadCancellation();
  }, [loadCancellation, substage]);

  useEffect(() => {
    let cancelled = false;
    void fetchBookingDoneRecords(leadType, leadId)
      .then((res) => {
        if (!cancelled) setRecords(res.records ?? []);
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      });
    return () => {
      cancelled = true;
    };
  }, [leadType, leadId, substage]);

  const visibility = useMemo(
    () => resolveCancellationActionVisibility(substage, cancellation),
    [substage, cancellation],
  );

  if (loading || !visibility.showBar) return null;

  const approval = cancellation?.btCancellationApprovalStatus?.trim().toUpperCase() ?? "PENDING";
  const approvalLabel =
    approval === "REJECTED"
      ? cancellation?.btCancellationRejectReason?.trim()
        ? `Rejected — ${cancellation.btCancellationRejectReason.trim()}`
        : "Rejected — you can restore or send again (if allowed)"
      : approval === "PENDING"
        ? "Pending manager approval"
        : "Cancellation in progress";

  const handleRestore = async () => {
    setBusy("restore");
    setError("");
    try {
      await restoreBookingTokenCancellation(leadType, leadId);
      await loadCancellation();
      await onLeadReload();
      await onActivitiesRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to restore lead.");
    } finally {
      setBusy(null);
    }
  };

  const handleSendAgain = async () => {
    const dealId = cancellation?.btCancellationDealId?.trim();
    if (!dealId) {
      setError("No active deal id for resubmit.");
      return;
    }
    setBusy("send");
    setError("");
    try {
      await resubmitBookingTokenCancellation(dealId);
      await loadCancellation();
      await onLeadReload();
      await onActivitiesRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="mx-auto mb-3 max-w-[1440px] rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.7px] text-amber-700">
              Booking & Token cancellation
            </p>
            <p className="mt-0.5 text-[13px] text-[var(--crm-text-primary)]">{approvalLabel}</p>
            {cancellation?.btCancellationRequestedAt ? (
              <p className="mt-0.5 font-mono text-[11px] text-[var(--crm-text-muted)]">
                Requested {formatCrmDateTime(cancellation.btCancellationRequestedAt)}
                {(cancellation.btCancellationAttemptCount ?? 0) > 1
                  ? ` · Attempt ${cancellation.btCancellationAttemptCount}/2`
                  : ""}
              </p>
            ) : null}
            {error ? <p className="mt-1 text-[12px] text-rose-600">{error}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {visibility.showView ? (
              <button
                type="button"
                onClick={() => setViewOpen(true)}
                className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--crm-text-primary)] hover:bg-[var(--crm-surface-subtle)]"
              >
                View
              </button>
            ) : null}
            {visibility.showRestore ? (
              <button
                type="button"
                disabled={busy != null}
                onClick={() => void handleRestore()}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-60"
              >
                {busy === "restore" ? "Restoring…" : "Restore"}
              </button>
            ) : null}
            {visibility.showSendAgain ? (
              <button
                type="button"
                disabled={busy != null}
                onClick={() => void handleSendAgain()}
                className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-[12px] font-semibold text-blue-700 hover:bg-blue-500/20 disabled:opacity-60"
              >
                {busy === "send" ? "Sending…" : "Send again to manager"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <BookingTokenCancellationViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        lead={lead}
        substage={substage}
        cancellation={cancellation}
        records={records}
      />
    </>
  );
}
