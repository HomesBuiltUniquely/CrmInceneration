"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLeadDetailV2 } from "./LeadDetailV2Context";
import { getConfigurationScopeRequirements } from "@/lib/configuration-scope-client";
import { CONFIGURATION_SCOPE_UPDATED_EVENT } from "@/lib/configuration-scope-events";
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
  const [scopeReady, setScopeReady] = useState(false);
  const requestRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const validLeadType = isCrmLeadType(leadType) ? (leadType as CrmLeadType) : null;

  const loadScopeStatus = useCallback(
    async (background = false) => {
      if (!validLeadType) {
        setScopeOfWorkComplete(false);
        setScopeReady(true);
        return;
      }

      const requestId = ++requestRef.current;
      if (!background && !hasLoadedOnceRef.current) {
        setScopeReady(false);
      }

      try {
        const requirements = await getConfigurationScopeRequirements(validLeadType, leadId);
        if (requestId !== requestRef.current) return;
        const hasRooms = requirements.selectedRooms.length > 0;
        const persisted = (requirements.version ?? 0) > 0 || Boolean(requirements.updatedAt);
        setScopeOfWorkComplete(hasRooms && persisted);
      } catch {
        if (requestId === requestRef.current) setScopeOfWorkComplete(false);
      } finally {
        if (requestId === requestRef.current) {
          hasLoadedOnceRef.current = true;
          setScopeReady(true);
        }
      }
    },
    [leadId, validLeadType],
  );

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    void loadScopeStatus();

    const onFocus = () => {
      void loadScopeStatus(true);
    };
    const onScopeUpdated = () => {
      void loadScopeStatus(true);
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener(CONFIGURATION_SCOPE_UPDATED_EVENT, onScopeUpdated);

    return () => {
      requestRef.current += 1;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(CONFIGURATION_SCOPE_UPDATED_EVENT, onScopeUpdated);
    };
  }, [loadScopeStatus]);

  const { percent, items, missingLabels } = useMemo(
    () =>
      computeLeadDataCompleteness(lead, {
        scopeOfWorkComplete: scopeReady ? scopeOfWorkComplete : false,
      }),
    [lead, scopeOfWorkComplete, scopeReady],
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
          {!scopeReady ? "…" : `${percent}%`}
        </p>
      </div>
      <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-[#d6dbe3]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {scopeReady && missingLabels.length > 0 ? (
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
      ) : scopeReady && percent >= 100 ? (
        <p className="mt-2 text-[13px] font-semibold text-[#16a34a]">All key fields complete</p>
      ) : null}
    </div>
  );
}
