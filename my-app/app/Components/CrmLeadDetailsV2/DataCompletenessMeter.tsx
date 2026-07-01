"use client";

import { useEffect, useMemo, useState } from "react";
import { useLeadDetailV2 } from "./LeadDetailV2Context";
import { getConfigurationScopeRequirements } from "@/lib/configuration-scope-client";
import { computeLeadDataCompleteness } from "@/lib/lead-data-completeness";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import type { CrmLeadType } from "@/lib/leads-filter";
import { V2_LINK_TEXT } from "./lead-detail-v2-motion";

function scrollToTarget(targetId: string) {
  document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function DataCompletenessMeter() {
  const { lead, leadType, leadId } = useLeadDetailV2();
  const [scopeOfWorkComplete, setScopeOfWorkComplete] = useState(false);
  const [scopeLoading, setScopeLoading] = useState(true);

  const validLeadType = isCrmLeadType(leadType) ? (leadType as CrmLeadType) : null;

  useEffect(() => {
    if (!validLeadType) {
      setScopeOfWorkComplete(false);
      setScopeLoading(false);
      return;
    }

    let cancelled = false;

    const loadScopeStatus = async () => {
      setScopeLoading(true);
      try {
        const requirements = await getConfigurationScopeRequirements(validLeadType, leadId);
        if (cancelled) return;
        const hasRooms = requirements.selectedRooms.length > 0;
        const persisted = (requirements.version ?? 0) > 0 || Boolean(requirements.updatedAt);
        setScopeOfWorkComplete(hasRooms && persisted);
      } catch {
        if (!cancelled) setScopeOfWorkComplete(false);
      } finally {
        if (!cancelled) setScopeLoading(false);
      }
    };

    void loadScopeStatus();

    const onFocus = () => {
      void loadScopeStatus();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [
    validLeadType,
    leadId,
    lead.floorPlan,
    lead.floorPlanPublicLink,
    lead.floorPlanViewPath,
    lead.budget,
    lead.configuration,
    lead.bookingType,
    lead.propertyLocation,
    lead.pincode,
    lead.phone,
    lead.email,
  ]);

  const { percent, items, missingLabels } = useMemo(
    () => computeLeadDataCompleteness(lead, { scopeOfWorkComplete }),
    [lead, scopeOfWorkComplete],
  );

  const percentColor =
    percent >= 100 ? "text-[#1acb5a]" : percent >= 50 ? "text-[#1acb5a]" : "text-[#f59e0b]";
  const barColor = percent >= 100 ? "bg-[#1ed760]" : percent >= 50 ? "bg-[#1ed760]" : "bg-[#f59e0b]";

  return (
    <div className="mt-3 max-w-[560px]">
      <div className="flex items-end justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8a96a8]">
          Data Completeness
        </p>
        <p className={`text-[30px] font-bold leading-none ${percentColor}`}>
          {scopeLoading ? "…" : `${percent}%`}
        </p>
      </div>
      <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-[#d6dbe3]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: scopeLoading ? "0%" : `${percent}%` }}
        />
      </div>
      {!scopeLoading && missingLabels.length > 0 ? (
        <p className="mt-2 text-[13px] font-semibold text-[#ee5454]">
          <span aria-hidden="true">△ </span>
          Missing:{" "}
          {items
            .filter((item) => !item.complete)
            .map((item, index, missingItems) => (
              <span key={item.id}>
                {item.scrollTargetId ? (
                  <button
                    type="button"
                    onClick={() => scrollToTarget(item.scrollTargetId!)}
                    className={`underline decoration-[#fca5a5] underline-offset-2 ${V2_LINK_TEXT}`}
                  >
                    {item.label}
                  </button>
                ) : (
                  item.label
                )}
                {index < missingItems.length - 1 ? ", " : null}
              </span>
            ))}
        </p>
      ) : !scopeLoading && percent >= 100 ? (
        <p className="mt-2 text-[13px] font-semibold text-[#16a34a]">All key fields complete</p>
      ) : null}
    </div>
  );
}
