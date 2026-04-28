import type { Lead } from "@/lib/data";

/** Status (milestone stage) dropdown in Complete Task — e.g. "Experience & Design". */
export function isExperienceDesignStageName(stageName: string): boolean {
  const s = stageName.trim().toLowerCase();
  return (
    s === "experience and design" ||
    s.includes("experience & design") ||
    (s.includes("experience") && s.includes("design"))
  );
}

/** Feedback (substage) used to unlock quote follow-up UI. */
export function isQuoteSentFeedbackName(feedback: string): boolean {
  const f = feedback.trim().toLowerCase();
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
  const ms = (lead.stageBlock?.milestoneStage ?? "").trim().toLowerCase();
  const msub = lead.stageBlock?.milestoneSubStage ?? "";
  const st = lead.status ?? "";

  return isExperienceDesignStageName(ms) && (isQuoteSentFeedbackName(msub) || isQuoteSentFeedbackName(st));
}
