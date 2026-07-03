import type { Lead } from "@/lib/data";
import { normalizeSalesMilestoneStageForPipeline } from "@/lib/complete-task-pipeline";
import { normalizeStageKey } from "@/lib/milestone-progress";
import { pipelineSubStageLabel } from "@/lib/milestone-substage-map";

const SALES_PIPELINE_AFTER_EXPERIENCE_DESIGN = ["Decision", "Closed"] as const;

export function getGetQuoteUnlockStorageKey(leadRouteId: string): string {
  return `crm-get-quote-unlocked:${leadRouteId.trim()}`;
}

export function readPersistedGetQuoteUnlock(leadRouteId: string): boolean {
  if (typeof window === "undefined") return false;
  const id = leadRouteId.trim();
  if (!id) return false;
  return sessionStorage.getItem(getGetQuoteUnlockStorageKey(id)) === "1";
}

export function persistGetQuoteUnlock(leadRouteId: string): void {
  if (typeof window === "undefined") return;
  const id = leadRouteId.trim();
  if (!id) return;
  sessionStorage.setItem(getGetQuoteUnlockStorageKey(id), "1");
}

function readLeadQuoteLink(lead: Lead): string {
  return (lead.quoteLink ?? "").trim();
}

/** Lead has moved past Experience & Design (e.g. Decision, Closed). */
export function isSalesStagePastExperienceDesign(lead: Lead): boolean {
  const stage = normalizeSalesMilestoneStageForPipeline(
    lead.stageBlock?.milestoneStage ?? lead.status ?? "",
  );
  const key = normalizeStageKey(stage);
  return SALES_PIPELINE_AFTER_EXPERIENCE_DESIGN.some(
    (name) => normalizeStageKey(name) === key,
  );
}

/** Status (milestone stage) dropdown in Complete Task — e.g. "Experience & Design". */
export function isExperienceDesignStageName(stageName: string): boolean {
  const s = stageName.trim().toLowerCase();
  return (
    s === "experience and design" ||
    s.includes("experience & design") ||
    (s.includes("experience") && s.includes("design"))
  );
}

/** Feedback (substage) used to unlock quote follow-up UI (Meeting Successful). */
export function isQuoteSentFeedbackName(feedback: string): boolean {
  const f = pipelineSubStageLabel(feedback).toLowerCase();
  return (
    f === "meeting successful" ||
    /\bmeeting\s*successful\b/.test(f) ||
    // Backward compatibility for old saved leads.
    f === "quote sent" ||
    /\bquote\s*sent\b/.test(f)
  );
}

/** Open quote popup in Complete Task when both match. */
export function shouldOpenQuoteSentPanelInCompleteTask(status: string, feedback: string): boolean {
  return isExperienceDesignStageName(status) && isQuoteSentFeedbackName(feedback);
}

/**
 * Show quote link + send-quote UI only when pipeline is **Experience and Design**
 * with substage **MEETING SUCCESSFUL** (matches CRM milestone labels).
 */
export function isExperienceDesignQuoteSentStage(lead: Lead): boolean {
  if (lead.quoteLink?.trim()) {
    return true;
  }

  const ms = (lead.stageBlock?.milestoneStage ?? "").trim().toLowerCase();
  const msub = (lead.stageBlock?.milestoneSubStage ?? "").toLowerCase();
  const st = (lead.status ?? "").toLowerCase();

  // Keep visible in subsequent pipeline stages
  if (ms === "decision" || ms === "closed") {
    return true;
  }

  if (isExperienceDesignStageName(ms)) {
    // Current requirement: "Meeting Successful"
    if (isQuoteSentFeedbackName(msub) || isQuoteSentFeedbackName(st)) {
      return true;
    }
    // Also keep visible if they advance to design refinement within the same stage
    if (msub.includes("design refinement") || st.includes("design refinement")) {
      return true;
    }
  }

  return false;
}

/**
 * Header **Get Quote** + Lead Info quote panel visibility.
 * Stays visible after first unlock (Meeting Successful) even if stage moves forward/back,
 * or once a quote link exists, or after progressing past Experience & Design.
 */
export function canShowGetQuoteButton(
  lead: Lead,
  options?: { quoteUnlockedInSession?: boolean },
): boolean {
  if (isExperienceDesignQuoteSentStage(lead)) return true;
  if (readLeadQuoteLink(lead)) return true;
  if (isSalesStagePastExperienceDesign(lead)) return true;
  if (options?.quoteUnlockedInSession) return true;
  return false;
}
