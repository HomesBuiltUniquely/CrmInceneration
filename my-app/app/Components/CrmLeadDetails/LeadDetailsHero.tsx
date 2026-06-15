"use client";

import type { Lead } from "@/lib/data";
import { computeLeadDataCompleteness } from "@/lib/lead-details-completeness";
import { formatRelativeUpdated } from "@/lib/lead-details-phases";
import { formatCrmDateTime } from "@/lib/date-time-format";
import { isLeadHandedOffToSales } from "@/lib/presales-milestone";
import {
  canViewBothMilestonePipelines,
  isPresalesRole,
} from "@/lib/roleUtils";

function WonTrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4h12v2a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 14v4M15 14v4M8 22h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M4 6H2v1a3 3 0 0 0 3 3h1M20 6h2v1a3 3 0 0 1-3 3h-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function LeadDetailsHero({
  lead,
  userRole = "",
  presalesHandedOff = false,
  completeTaskDisabled = false,
  onCompleteTask,
  onOpenStageRollback,
  canStageRollback = false,
  onCallClosed,
  showCallClosed = false,
  onOpenSalesClosure,
  showSalesClosure = false,
  salesClosureLoading = false,
  onGetQuote,
  quoteFetching = false,
  showGetQuote = false,
}: {
  lead: Lead;
  userRole?: string;
  presalesHandedOff?: boolean;
  completeTaskDisabled?: boolean;
  onCompleteTask: () => void;
  onOpenStageRollback?: () => void;
  canStageRollback?: boolean;
  onCallClosed?: () => void;
  showCallClosed?: boolean;
  onOpenSalesClosure?: () => void;
  showSalesClosure?: boolean;
  salesClosureLoading?: boolean;
  onGetQuote?: () => void;
  quoteFetching?: boolean;
  showGetQuote?: boolean;
}) {
  const { percent, missingLabels } = computeLeadDataCompleteness(lead);
  const inSalesPhase = isLeadHandedOffToSales(lead);
  const showPresalesMilestone =
    !inSalesPhase &&
    (isPresalesRole(userRole) || canViewBothMilestonePipelines(userRole));
  const milestoneStageLabel = showPresalesMilestone
    ? lead.stageBlock?.presalesMilestoneStage?.trim() || "Fresh Data"
    : lead.stageBlock?.milestoneStage?.trim() || "—";
  const milestoneSubLabel = showPresalesMilestone
    ? lead.stageBlock?.presalesMilestoneSubStage?.trim() ||
      lead.stageBlock?.presalesMilestoneCategory?.trim() ||
      "—"
    : lead.stageBlock?.milestoneSubStage?.trim() || "—";

  const followUpLabel = (lead.followUpDate ?? "").trim()
    ? formatCrmDateTime(lead.followUpDate)
    : "Not set";

  const priority =
    lead.verified ||
    (lead.budget ?? "").includes("50") ||
    (lead.budget ?? "").toLowerCase().includes("lakh");

  return (
    <section className="mb-5 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {priority ? (
              <span className="rounded-md bg-orange-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Priority Lead
              </span>
            ) : null}
            <span className="text-[12px] font-medium text-slate-500">
              {formatRelativeUpdated(lead.createdAt)}
            </span>
          </div>
          <h1 className="text-[26px] font-bold tracking-tight text-slate-900 md:text-[28px]">
            Lead Information
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
              Stage: {milestoneStageLabel}
            </span>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
              Sub-stage: {milestoneSubLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showCallClosed && onCallClosed ? (
            <button
              type="button"
              onClick={onCallClosed}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-md transition hover:bg-emerald-700"
            >
              <WonTrophyIcon className="h-4 w-4" />
              Mark as Won
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCompleteTask}
            disabled={completeTaskDisabled}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden>✓</span>
            Complete Task
          </button>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Next Follow Up
            </div>
            <div className="text-[13px] font-bold text-slate-900">{followUpLabel}</div>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              title="Log call"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Phone"
            >
              📞
            </button>
            <button
              type="button"
              title="WhatsApp"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Message"
            >
              💬
            </button>
            <button
              type="button"
              title="Schedule"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Calendar"
            >
              📅
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <span>Data Completeness</span>
          <span className="text-emerald-600">{percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        {missingLabels.length > 0 ? (
          <p className="mt-2 text-[12px] text-rose-600">
            <span className="font-semibold">Missing:</span>{" "}
            {missingLabels.slice(0, 4).join(", ")}
            {missingLabels.length > 4 ? ` +${missingLabels.length - 4} more` : ""}
          </p>
        ) : null}
      </div>

      {(showSalesClosure ||
        canStageRollback ||
        showGetQuote ||
        presalesHandedOff) && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {presalesHandedOff ? (
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
              Handed off — read only
            </span>
          ) : null}
          {showSalesClosure && onOpenSalesClosure ? (
            <button
              type="button"
              onClick={onOpenSalesClosure}
              disabled={salesClosureLoading}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-800"
            >
              {salesClosureLoading ? "Opening…" : "Sales closure"}
            </button>
          ) : null}
          {canStageRollback && onOpenStageRollback ? (
            <button
              type="button"
              onClick={onOpenStageRollback}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] font-semibold text-amber-900"
            >
              Stage rollback
            </button>
          ) : null}
          {showGetQuote && onGetQuote ? (
            <button
              type="button"
              onClick={onGetQuote}
              disabled={quoteFetching}
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[12px] font-semibold text-violet-900"
            >
              {quoteFetching ? "Getting quote…" : "Get quote"}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
