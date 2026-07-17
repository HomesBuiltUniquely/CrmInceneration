"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLeadDetailV2 } from "./LeadDetailV2Context";
import { getConfigurationScopeRequirements } from "@/lib/configuration-scope-client";
import { CONFIGURATION_SCOPE_UPDATED_EVENT } from "@/lib/configuration-scope-events";
import {
  configurationScopeMeetingCompletion,
  hasLeadFloorPlan,
  type ScopeMeetingChecklistItem,
} from "@/lib/configuration-scope-validation";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import type { CrmLeadType } from "@/lib/leads-filter";
import { V2_CARD_LINK } from "./lead-detail-v2-motion";

type Props = {
  canInteract: boolean;
  onOpen: (highlightMissing: boolean) => void;
};

function CompletenessRing({
  percent,
  meetingReady,
  loading,
}: {
  percent: number;
  meetingReady: boolean;
  loading: boolean;
}) {
  const size = 92;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;
  const fullyDone = clamped >= 100;
  const ringColor = fullyDone ? "#1ed760" : meetingReady ? "#2c7a53" : clamped >= 40 ? "#f59e0b" : "#f59e0b";
  const labelColor = fullyDone
    ? "text-[#16a34a]"
    : meetingReady
      ? "text-[#2c7a53]"
      : "text-[#d97706]";

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-label={loading ? "Loading scope completion" : `Scope ${clamped}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#d8f3e4"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={loading ? circumference : offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-[20px] font-bold leading-none ${labelColor}`}>
          {loading ? "…" : `${clamped}%`}
        </span>
        <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#7a8b9a]">
          {fullyDone ? "Done" : "Filled"}
        </span>
      </div>
    </div>
  );
}

function ChecklistRow({ item }: { item: ScopeMeetingChecklistItem }) {
  return (
    <li className="flex items-center gap-1.5 text-[11px] font-semibold leading-tight">
      {item.complete ? (
        <span
          className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#1ed760] text-white"
          aria-hidden="true"
        >
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2.5 6.2 4.8 8.5 9.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : (
        <span
          className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 border-[#f59e0b] bg-[#fff7ed]"
          aria-hidden="true"
        >
          <span className="h-1 w-1 rounded-full bg-[#f59e0b]" />
        </span>
      )}
      <span className={item.complete ? "text-[#5f8d73]" : "text-[#b45309]"}>
        {item.label}
        {!item.complete && item.mandatory ? (
          <span className="ml-1 rounded bg-[#fff7ed] px-1 py-px text-[9px] font-bold uppercase tracking-wide text-[#c2410c]">
            Required
          </span>
        ) : null}
        {!item.complete && !item.mandatory ? (
          <span className="ml-1 rounded bg-[#f1f5f9] px-1 py-px text-[9px] font-bold uppercase tracking-wide text-[#64748b]">
            Optional
          </span>
        ) : null}
      </span>
    </li>
  );
}

export default function ScopeOfWorkCompletenessCard({ canInteract, onOpen }: Props) {
  const { lead, leadType, leadId } = useLeadDetailV2();
  const [loading, setLoading] = useState(true);
  const [requirements, setRequirements] = useState<Awaited<
    ReturnType<typeof getConfigurationScopeRequirements>
  > | null>(null);
  const requestRef = useRef(0);
  const validLeadType = isCrmLeadType(leadType) ? (leadType as CrmLeadType) : null;

  const load = useCallback(
    async (background = false) => {
      if (!validLeadType) {
        setRequirements(null);
        setLoading(false);
        return;
      }
      const requestId = ++requestRef.current;
      if (!background) setLoading(true);
      try {
        const next = await getConfigurationScopeRequirements(validLeadType, leadId);
        if (requestId !== requestRef.current) return;
        setRequirements(next);
      } catch {
        if (requestId === requestRef.current) setRequirements(null);
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    },
    [leadId, validLeadType],
  );

  useEffect(() => {
    void load();
    const onFocus = () => void load(true);
    const onScopeUpdated = () => void load(true);
    window.addEventListener("focus", onFocus);
    window.addEventListener(CONFIGURATION_SCOPE_UPDATED_EVENT, onScopeUpdated);
    return () => {
      requestRef.current += 1;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(CONFIGURATION_SCOPE_UPDATED_EVENT, onScopeUpdated);
    };
  }, [load]);

  const completion = useMemo(() => {
    if (!requirements) {
      return {
        percent: 0,
        items: [] as ScopeMeetingChecklistItem[],
        pendingLabels: [] as string[],
        pendingMandatoryLabels: [] as string[],
        ready: false,
        mandatoryDone: 0,
        mandatoryTotal: 7,
      };
    }
    return configurationScopeMeetingCompletion({
      requirements,
      configuration: lead.configuration,
      bookingType: lead.bookingType || requirements.bookingType,
      hasFloorPlan: hasLeadFloorPlan(lead),
    });
  }, [
    lead.bookingType,
    lead.configuration,
    lead.floorPlan,
    lead.floorPlanPublicLink,
    lead.floorPlanViewPath,
    requirements,
  ]);

  const pendingMandatory = completion.items.filter((item) => item.mandatory && !item.complete);
  const pendingOptional = completion.items.filter((item) => !item.mandatory && !item.complete);
  const showPending = [...pendingMandatory, ...pendingOptional];
  const fullyFilled = !loading && completion.percent >= 100;

  return (
    <div id="deal-scope-of-work" className="scroll-mt-24">
      <div
        className={`rounded-lg border border-dashed border-[#8ee2b4] bg-white p-3.5 ${
          !canInteract ? "opacity-60" : ""
        }`}
      >
        <div className="flex items-start gap-3.5">
          <CompletenessRing
            percent={completion.percent}
            meetingReady={completion.ready}
            loading={loading}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-[12px] font-bold uppercase tracking-wide text-[#2c7a53]">
                Configure Scope
              </p>
              {completion.ready && !loading ? (
                <span className="rounded-full bg-[#e8faf0] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-[#16a34a]">
                  Meeting gate ok
                </span>
              ) : (
                <span className="rounded-full bg-[#fff7ed] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-[#c2410c]">
                  Needed for Meeting Scheduled
                </span>
              )}
            </div>

            <p className="mt-1 text-[11px] leading-snug text-[#5f8d73]">
              {loading
                ? "Checking scope details…"
                : fullyFilled
                  ? "All tracked scope fields are filled. You can schedule the meeting."
                  : completion.ready
                    ? `${completion.mandatoryDone}/${completion.mandatoryTotal} mandatory done · meeting can be scheduled. ${pendingOptional.length} optional still empty.`
                    : `${completion.mandatoryDone}/${completion.mandatoryTotal} mandatory done · ${completion.percent}% overall. Finish required fields for Meeting Scheduled.`}
            </p>

            {!loading && showPending.length > 0 ? (
              <ul className="mt-2 grid max-h-[120px] grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                {showPending.map((item) => (
                  <ChecklistRow key={item.id} item={item} />
                ))}
              </ul>
            ) : null}

            {!loading && fullyFilled ? (
              <ul className="mt-2 grid grid-cols-2 gap-1">
                {completion.items.filter((item) => item.mandatory).map((item) => (
                  <ChecklistRow key={item.id} item={item} />
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          disabled={!canInteract}
          onClick={() => onOpen(pendingMandatory.length > 0)}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#8ee2b4] bg-[#f4fff9] px-3 py-2.5 text-[12px] font-bold uppercase tracking-wide text-[#2c7a53] ${V2_CARD_LINK} ${
            !canInteract ? "pointer-events-none" : ""
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          {pendingMandatory.length > 0
            ? "Complete Mandatory Fields"
            : fullyFilled
              ? "Review Scope"
              : "Fill Remaining Details"}
        </button>
      </div>
    </div>
  );
}
