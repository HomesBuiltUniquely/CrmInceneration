"use client";

import type { ReactNode } from "react";
import type { Lead } from "@/lib/data";
import {
  LEAD_DETAIL_PHASE_ORDER,
  resolveLeadPhaseStates,
  type LeadPhaseId,
  type LeadPhaseStatus,
} from "@/lib/lead-details-phases";
import { leadHasFloorPlan } from "@/lib/floor-plan";
import { isMeetingScheduleSubstage } from "@/lib/milestone-substage-map";

function PhaseShell({
  phaseNumber,
  title,
  status,
  children,
}: {
  phaseNumber: number;
  title: string;
  status: LeadPhaseStatus;
  children: ReactNode;
}) {
  const isCurrent = status === "current";
  const isComplete = status === "complete";
  const isLocked = status === "locked";

  return (
    <section
      className={`rounded-2xl border bg-white transition-shadow ${
        isCurrent
          ? "border-lime-400 border-l-4 shadow-[0_0_0_1px_rgba(163,230,53,0.35),0_12px_32px_rgba(15,23,42,0.08)]"
          : isLocked
            ? "border-slate-200"
            : "border-slate-200/90 shadow-[0_4px_20px_rgba(15,23,42,0.05)]"
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold ${
              isComplete
                ? "bg-emerald-500 text-white"
                : isCurrent
                  ? "bg-lime-500 text-white"
                  : "bg-slate-200 text-slate-500"
            }`}
          >
            {isComplete ? "✓" : isLocked ? "🔒" : phaseNumber}
          </span>
          <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
        </div>
        {isCurrent ? (
          <span className="rounded-md bg-lime-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Current Phase
          </span>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DataChip({ label, value }: { label: string; value: string }) {
  const display = value.trim() || "—";
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] font-semibold text-slate-800">{display}</div>
    </div>
  );
}

function DiscoverySummary({ lead }: { lead: Lead }) {
  const propertyLabel =
    (lead.propertyLocation ?? "").trim() ||
    (lead.pincode ? `Pincode ${lead.pincode}` : "");

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <DataChip label="Property" value={propertyLabel} />
      <DataChip label="Pincode" value={lead.pincode} />
      <DataChip label="Budget" value={lead.budget} />
      <DataChip label="Configuration" value={lead.configuration} />
      <DataChip label="Possession" value={lead.possessionDate} />
    </div>
  );
}

function ConnectionSummary({ lead }: { lead: Lead }) {
  const meetingType = (lead.meetingType ?? "").trim() || "—";
  const meetingDate = (lead.meetingDate ?? "").trim() || "Not scheduled";
  const followUp = (lead.followUpDate ?? "").trim() || "—";
  const needsSiteVisit =
    isMeetingScheduleSubstage(lead.stageBlock?.milestoneSubStage ?? "") &&
    !(lead.meetingDate ?? "").trim();

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <DataChip label="Meeting Type" value={meetingType} />
        <DataChip label="Meeting Date" value={meetingDate} />
        <DataChip label="Follow-up" value={followUp} />
      </div>
      {needsSiteVisit ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-800">
          <span aria-hidden>⚠</span>
          <span>
            <strong>Action required:</strong> Site visit / meeting not scheduled. Use{" "}
            <strong>Complete Task</strong> to update schedule.
          </span>
        </div>
      ) : null}
    </>
  );
}

function ExperienceSummary({
  lead,
  onToggleDesignQa,
}: {
  lead: Lead;
  onToggleDesignQa?: () => void;
}) {
  const hasFloorPlan = leadHasFloorPlan(
    (lead.floorPlan ?? "").trim(),
    undefined,
    (lead.floorPlanPublicLink ?? "").trim(),
  );
  const hasScope = Boolean((lead.propertyNotes ?? "").trim());

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div
        className={`rounded-xl border-2 border-dashed px-4 py-4 text-center ${
          hasFloorPlan ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-slate-50"
        }`}
      >
        <div className="text-[11px] font-bold uppercase text-slate-500">Floor Plan</div>
        <p className="mt-1 text-[12px] text-slate-600">
          {hasFloorPlan ? "Uploaded" : "Not uploaded"}
        </p>
      </div>
      <div
        className={`rounded-xl border-2 border-dashed px-4 py-4 text-center ${
          hasScope ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-slate-50"
        }`}
      >
        <div className="text-[11px] font-bold uppercase text-slate-500">Scope of Work</div>
        <p className="mt-1 text-[12px] text-slate-600">
          {hasScope ? "Property notes added" : "Add in form below"}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggleDesignQa}
        className="rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/60 px-4 py-4 text-center transition hover:border-violet-300"
      >
        <div className="text-[11px] font-bold uppercase text-violet-700">Design Preferences</div>
        <p className="mt-1 text-[12px] text-violet-600">Open panel</p>
      </button>
    </div>
  );
}

const PHASE_META: Record<LeadPhaseId, { number: number; title: string }> = {
  discovery: { number: 1, title: "Discovery Phase" },
  connection: { number: 2, title: "Connection Phase" },
  experience: { number: 3, title: "Experience Phase" },
  decision: { number: 4, title: "Decision Phase" },
};

/**
 * Discovery phase: summary chips + all lead detail forms (`LeadInfoTab`).
 * Other phases: milestone summary for that stage.
 */
export default function LeadPhasesPanel({
  lead,
  formContent,
  assignmentsContent,
  onToggleDesignQa,
}: {
  lead: Lead;
  formContent: ReactNode;
  assignmentsContent?: ReactNode;
  onToggleDesignQa?: () => void;
}) {
  const states = resolveLeadPhaseStates(lead);

  return (
    <div className="space-y-4">
      {LEAD_DETAIL_PHASE_ORDER.map((id) => {
        const meta = PHASE_META[id];
        const status = states[id];

        if (id === "discovery") {
          return (
            <PhaseShell
              key={id}
              phaseNumber={meta.number}
              title={meta.title}
              status={status}
            >
              <div className="space-y-5">
                <DiscoverySummary lead={lead} />
                <div className="border-t border-slate-100 pt-5">{formContent}</div>
              </div>
            </PhaseShell>
          );
        }

        if (id === "connection") {
          return (
            <PhaseShell
              key={id}
              phaseNumber={meta.number}
              title={meta.title}
              status={status}
            >
              <ConnectionSummary lead={lead} />
            </PhaseShell>
          );
        }

        if (id === "experience") {
          return (
            <PhaseShell
              key={id}
              phaseNumber={meta.number}
              title={meta.title}
              status={status}
            >
              <ExperienceSummary lead={lead} onToggleDesignQa={onToggleDesignQa} />
            </PhaseShell>
          );
        }

        return (
          <PhaseShell
            key={id}
            phaseNumber={meta.number}
            title={meta.title}
            status={status}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <DataChip label="Final Budget" value={lead.budget} />
              <DataChip label="Status" value={lead.status} />
              <DataChip label="Follow-up" value={lead.followUpDate} />
            </div>
          </PhaseShell>
        );
      })}

      {assignmentsContent ? (
        <section className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.05)]">
          {assignmentsContent}
        </section>
      ) : null}
    </div>
  );
}
