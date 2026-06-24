import type { Lead } from "@/lib/data";
import { pipelineSubStageLabel } from "@/lib/milestone-substage-map";

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
