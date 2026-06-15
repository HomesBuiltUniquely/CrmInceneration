import type { Lead } from "@/lib/data";

export type LeadPhaseId = "discovery" | "connection" | "experience" | "decision";
export type LeadPhaseStatus = "complete" | "current" | "locked";

export const LEAD_DETAIL_PHASE_ORDER: LeadPhaseId[] = [
  "discovery",
  "connection",
  "experience",
  "decision",
];

function normStage(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export function milestoneStageToPhase(stageRaw: string): LeadPhaseId {
  const s = normStage(stageRaw);
  if (!s || s === "fresh lead" || s === "fresh data" || s.includes("discovery")) {
    return "discovery";
  }
  if (s.includes("connection") && !s.includes("experience") && !s.includes("design")) {
    return "connection";
  }
  if (s.includes("experience") || s.includes("design")) {
    return "experience";
  }
  if (s.includes("decision") || s.includes("closed")) {
    return "decision";
  }
  if (s === "pipeline") return "discovery";
  return "discovery";
}

export function resolveLeadPhaseStates(lead: Lead): Record<LeadPhaseId, LeadPhaseStatus> {
  const stage = lead.stageBlock?.milestoneStage ?? lead.stageBlock?.stage ?? "";
  const current = milestoneStageToPhase(String(stage));
  const idx = Math.max(0, LEAD_DETAIL_PHASE_ORDER.indexOf(current));

  const states: Record<LeadPhaseId, LeadPhaseStatus> = {
    discovery: "locked",
    connection: "locked",
    experience: "locked",
    decision: "locked",
  };

  for (let i = 0; i < LEAD_DETAIL_PHASE_ORDER.length; i += 1) {
    const id = LEAD_DETAIL_PHASE_ORDER[i];
    if (i < idx) states[id] = "complete";
    else if (i === idx) states[id] = "current";
    else states[id] = "locked";
  }
  return states;
}

export function formatRelativeUpdated(isoOrLabel: string): string {
  const raw = isoOrLabel.trim();
  if (!raw) return "Recently";
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return raw;
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `Updated ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Updated ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `Updated ${days}d ago`;
}
