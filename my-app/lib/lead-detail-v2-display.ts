import type { Lead } from "@/lib/data";
import { formatCrmDateTime } from "@/lib/date-time-format";
import { isLostCategory, isWonCategory } from "@/lib/crm-pipeline";
import {
  isLeadHandedOffToSales,
} from "@/lib/presales-milestone";
import { shouldShowDesignQaLink } from "@/lib/lead-design-qa-visibility";
import {
  canViewBothMilestonePipelines,
  isPresalesRole,
} from "@/lib/roleUtils";
import {
  resolveDisplayFollowUpDate,
  resolveDisplayMeetingDate,
} from "@/lib/lead-schedule-display";

const DESIGN_QA_BASE_URL = "https://design.hubinterior.com/DesignQA?id=";

export function meetingTypeDisplay(value: string): string {
  const raw = value.trim();
  if (!raw) return "—";
  const key = raw.toUpperCase().replace(/[\s-]+/g, "_");
  if (key === "SHOWROOM_VISIT") return "Showroom Visit";
  if (key === "VIRTUAL_MEETING") return "Virtual Meeting";
  if (key === "SITE_VISIT") return "Site Visit";
  return raw;
}

export function bookingTypeDisplay(value: string): string {
  const raw = value.trim();
  if (!raw) return "—";
  return raw
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export type LeadDetailUiPhaseId = "discovery" | "connection" | "experience" | "decision";

export const LEAD_DETAIL_PHASE_ORDER: readonly LeadDetailUiPhaseId[] = [
  "discovery",
  "connection",
  "experience",
  "decision",
] as const;

export type PhaseAccessState = "current" | "completed" | "locked";

/** Previous phases are accessible; the current phase is active; later phases stay locked. */
export function resolvePhaseAccessState(
  currentPhaseId: LeadDetailUiPhaseId,
  phaseId: LeadDetailUiPhaseId,
): PhaseAccessState {
  const currentIdx = LEAD_DETAIL_PHASE_ORDER.indexOf(currentPhaseId);
  const phaseIdx = LEAD_DETAIL_PHASE_ORDER.indexOf(phaseId);
  if (phaseIdx < currentIdx) return "completed";
  if (phaseIdx === currentIdx) return "current";
  return "locked";
}

/** Maps CRM milestone stage to the detail-page phase card that should show the active border. */
export function resolveLeadDetailUiPhase(lead: Lead): LeadDetailUiPhaseId {
  const stage = (lead.stageBlock?.milestoneStage ?? lead.stageBlock?.stage ?? "")
    .trim()
    .toLowerCase();

  if (stage.includes("experience") || stage.includes("design")) return "experience";
  if (stage.includes("decision") || stage.includes("closed")) return "decision";
  if (stage.includes("connection")) return "connection";
  if (stage.includes("discovery") || stage.includes("fresh")) return "discovery";

  return "discovery";
}

function isDiscoveryStage(lead: Lead): boolean {
  const normalizeLabel = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, " ");
  const milestoneStage = normalizeLabel(lead.stageBlock?.milestoneStage ?? "");
  const legacyStage = normalizeLabel(lead.stageBlock?.stage ?? "");
  return milestoneStage.includes("discovery") || legacyStage.includes("discovery");
}

function buildDesignQaLink(lead: Lead, version = 1): string | null {
  const id = lead.leadId?.trim() || lead.id?.trim();
  if (!id) return null;
  return `${DESIGN_QA_BASE_URL}${encodeURIComponent(id)}&v=${version}`;
}

export function resolveDesignQaLink(lead: Lead): {
  designQaLink: string;
  apiDesignQaLink: string;
} {
  const apiDesignQaLink = (lead.designQaLink ?? "").trim();
  const computedDesignQaLink =
    !apiDesignQaLink && shouldShowDesignQaLink(lead) && !isDiscoveryStage(lead)
      ? buildDesignQaLink(lead, 1) ?? ""
      : "";
  return {
    apiDesignQaLink,
    designQaLink: apiDesignQaLink || computedDesignQaLink,
  };
}

export function formatMilestoneCategoryDisplay(category: string): string {
  const raw = category.trim();
  if (!raw) return "—";
  if (isLostCategory(raw)) return "LOST";
  if (isWonCategory(raw)) return "WON";
  const key = raw.toUpperCase().replace(/\s+/g, " ");
  if (key === "PIPELINE") return "PIPELINE";
  return key;
}

export function resolveMilestoneLabels(
  lead: Lead,
  viewerRoleKey: string,
): { stage: string; subStage: string; category: string } {
  const inSalesPhase = isLeadHandedOffToSales(lead);
  const showPresalesMilestone =
    !inSalesPhase &&
    (isPresalesRole(viewerRoleKey) || canViewBothMilestonePipelines(viewerRoleKey));

  if (showPresalesMilestone) {
    const categoryRaw =
      lead.stageBlock?.presalesMilestoneCategory?.trim() ||
      lead.stageBlock?.milestoneStageCategory?.trim() ||
      "";
    return {
      stage:
        lead.stageBlock?.presalesMilestoneStage?.trim() ||
        lead.stageBlock?.milestoneStage?.trim() ||
        "Fresh Data",
      subStage:
        lead.stageBlock?.presalesMilestoneSubStage?.trim() ||
        lead.stageBlock?.milestoneSubStage?.trim() ||
        "—",
      category: formatMilestoneCategoryDisplay(categoryRaw || "PIPELINE"),
    };
  }

  const categoryRaw = lead.stageBlock?.milestoneStageCategory?.trim() || "PIPELINE";
  return {
    stage: lead.stageBlock?.milestoneStage?.trim() || "—",
    subStage: lead.stageBlock?.milestoneSubStage?.trim() || "—",
    category: formatMilestoneCategoryDisplay(categoryRaw),
  };
}

export function formatScheduleDisplay(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Not scheduled";
  const friendly = formatCrmDateTime(trimmed);
  return friendly && friendly !== "—" ? friendly : trimmed;
}

export function resolveScheduleDisplays(lead: Lead): {
  meetingDateDisplay: string;
  followUpDateDisplay: string;
} {
  const meetingRaw = resolveDisplayMeetingDate(lead);
  const followUpRaw = resolveDisplayFollowUpDate(lead);
  return {
    meetingDateDisplay: formatScheduleDisplay(meetingRaw),
    followUpDateDisplay: formatScheduleDisplay(followUpRaw),
  };
}

/** Business lead id for UI (`lead_identifier` / BLR-A0010), not numeric Hub row id. */
export function resolveLeadDisplayIdentifier(
  sources: {
    externalReferenceId?: string | null;
    leadIdentifier?: string | null;
    leadId?: string | null;
    customerId?: string | null;
  },
  fallbackNumericId?: string,
): string {
  const candidates = [
    sources.externalReferenceId,
    sources.leadIdentifier,
    sources.leadId,
    sources.customerId,
    fallbackNumericId,
  ];
  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (value && value !== "—") return value;
  }
  return "—";
}
