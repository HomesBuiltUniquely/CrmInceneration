/**
 * Builds Discovery + Connection summary payloads for Design Module upsert / intake.
 * Config scope is a designer-focused summary (not the full scope document).
 */
import type { Lead } from "@/lib/data";
import type { CrmLeadType } from "@/lib/leads-filter";
import {
  getConfigurationScopeReferences,
  getConfigurationScopeRequirements,
  mergeRequirementDefaults,
  referenceDisplayName,
  referenceViewUrlToProxy,
  splitProjectUnderstanding,
  type ConfigurationScopeRequirements,
  type ScopeSelectedRoom,
} from "@/lib/configuration-scope-client";
import {
  readConfigurationScopeFrontendPrefs,
  type ConfigurationScopeFrontendPrefs,
} from "@/lib/configuration-scope-frontend-prefs";
import { formatInvestmentRangeLabel } from "@/lib/lead-budget-display";

export type DesignModuleRoomUnitSummary = {
  label: string;
  selected: boolean;
};

export type DesignModuleRoomSummary = {
  roomName: string;
  units: DesignModuleRoomUnitSummary[];
  /** Selected unit labels only (quick display). */
  unitsRequired: string[];
  falseCeilingRequired: boolean;
  notes: string | null;
};

export type DesignModuleReferenceFileSummary = {
  id: string;
  fileName: string;
  mimeType: string | null;
  viewUrl: string | null;
};

export type DesignModuleConfigScopeSummary = {
  propertyName: string | null;
  bookingType: string | null;
  designStylePreference: string | null;
  expectedTimeline: string | null;
  /** Raw Hub field (legacy). Prefer familySizeDetails for UI. */
  projectUnderstanding: string | null;
  /** CRM label: "Family Size & Details" */
  familySizeDetails: string | null;
  kitchenLayout: string | null;
  materialFinish: string | null;
  /** @deprecated use selectedRooms */
  selectedRoomNames: string[];
  selectedRooms: DesignModuleRoomSummary[];
  familyContactName: string | null;
  familyContactRelationship: string | null;
  familyContactPhone: string | null;
  designHandoffNotes: string | null;
  salesRiskNotes: string | null;
  miscAddOns: string[];
  wfhSetup: boolean;
  petFriendly: boolean;
  referenceInspiration: {
    aestheticNotes: string | null;
    references: DesignModuleReferenceFileSummary[];
  };
  financialGuardrails: {
    investmentRange: string | null;
    sensitivity: string | null;
    financing: string | null;
  };
  internalExecutiveNotes: {
    personalityType: string | null;
    competition: string | null;
    executiveSummary: string | null;
    internalNotes: string | null;
    closureProbability: string | null;
  };
};

export type DesignModuleDiscoveryPayload = {
  propertyLocation: string | null;
  budget: string | null;
  language: string | null;
  configuration: string | null;
  bookingType: string | null;
  propertyNotes: string | null;
};

export type DesignModuleConnectionPayload = {
  floorPlanPublicLink: string | null;
  floorPlanUrl: string | null;
  meetingType: string | null;
  designerName: string | null;
  configurationScope: DesignModuleConfigScopeSummary | null;
};

function trimOrNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || s === "—" || s === "-" || s === "–") return null;
  return s;
}

function absoluteAppUrl(pathOrUrl: string | null | undefined): string | null {
  const raw = trimOrNull(pathOrUrl);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (typeof window === "undefined") return raw;
  try {
    return new URL(raw, window.location.origin).toString();
  } catch {
    return raw;
  }
}

function summarizeRooms(rooms: ScopeSelectedRoom[]): DesignModuleRoomSummary[] {
  return rooms
    .map((room) => {
      const roomName = room.roomName?.trim() || "";
      if (!roomName) return null;
      const units = (room.units ?? []).map((u) => ({
        label: String(u.label ?? "").trim(),
        selected: u.selected !== false,
      })).filter((u) => u.label);
      const unitsRequired = units.filter((u) => u.selected).map((u) => u.label);
      return {
        roomName,
        units,
        unitsRequired,
        falseCeilingRequired: Boolean(room.falseCeilingRequired),
        notes: trimOrNull(room.notes),
      };
    })
    .filter((r): r is DesignModuleRoomSummary => Boolean(r));
}

function financingLabel(value: string | null | undefined): string | null {
  if (value === "self_funded") return "Self Funded";
  if (value === "looking_for_emi") return "Looking For EMI";
  return trimOrNull(value);
}

function sensitivityLabel(value: string | null | undefined): string | null {
  const v = trimOrNull(value);
  if (!v) return null;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export function buildConfigScopeSummary(
  requirements: ConfigurationScopeRequirements | null | undefined,
  extras?: {
    budget?: string | null;
    prefs?: ConfigurationScopeFrontendPrefs | null;
    aestheticNotes?: string | null;
    references?: DesignModuleReferenceFileSummary[];
  },
): DesignModuleConfigScopeSummary | null {
  if (!requirements) return null;
  const prefs = extras?.prefs ?? null;
  const selectedRooms = summarizeRooms(requirements.selectedRooms ?? []);
  const familySplit = splitProjectUnderstanding(requirements.projectUnderstanding);
  const familySizeDetails =
    trimOrNull(familySplit.familySizeDetails) ||
    trimOrNull(requirements.projectUnderstanding);

  return {
    propertyName: trimOrNull(requirements.propertyName),
    bookingType: trimOrNull(requirements.bookingType),
    designStylePreference: trimOrNull(requirements.designStylePreference),
    expectedTimeline: trimOrNull(requirements.expectedTimeline),
    projectUnderstanding: trimOrNull(requirements.projectUnderstanding),
    familySizeDetails,
    kitchenLayout: trimOrNull(requirements.kitchenLayout),
    materialFinish: trimOrNull(requirements.materialFinish),
    selectedRoomNames: selectedRooms.map((r) => r.roomName),
    selectedRooms,
    familyContactName: trimOrNull(requirements.familyContactName),
    familyContactRelationship: trimOrNull(
      requirements.familyContactRelationship ?? prefs?.familyContactRelationship,
    ),
    familyContactPhone: trimOrNull(requirements.familyContactPhone),
    designHandoffNotes: trimOrNull(requirements.designHandoffNotes),
    salesRiskNotes: trimOrNull(requirements.salesRiskNotes),
    miscAddOns: (requirements.miscAddOns ?? [])
      .map((x) => String(x).trim())
      .filter(Boolean),
    wfhSetup: Boolean(prefs?.wfhSetup),
    petFriendly: Boolean(prefs?.petFriendly),
    referenceInspiration: {
      aestheticNotes: trimOrNull(extras?.aestheticNotes),
      references: extras?.references ?? [],
    },
    financialGuardrails: {
      investmentRange:
        trimOrNull(extras?.budget) != null
          ? formatInvestmentRangeLabel(String(extras?.budget))
          : trimOrNull(extras?.budget),
      sensitivity: sensitivityLabel(prefs?.financialSensitivity),
      financing: financingLabel(prefs?.financingPreference),
    },
    internalExecutiveNotes: {
      personalityType: trimOrNull(requirements.designStylePreference),
      competition: trimOrNull(requirements.salesRiskNotes),
      executiveSummary: trimOrNull(requirements.designHandoffNotes),
      internalNotes: trimOrNull(requirements.internalExecutiveNotes),
      closureProbability: trimOrNull(prefs?.closureProbability),
    },
  };
}

export function buildDiscoveryPayload(lead: Lead): DesignModuleDiscoveryPayload {
  return {
    propertyLocation: trimOrNull(lead.propertyLocation),
    budget: trimOrNull(lead.budget),
    language: trimOrNull(lead.language),
    configuration: trimOrNull(lead.configuration),
    bookingType: trimOrNull(lead.bookingType),
    propertyNotes: trimOrNull(lead.propertyNotes),
  };
}

export function buildConnectionPayload(
  lead: Lead,
  scopeSummary: DesignModuleConfigScopeSummary | null,
): DesignModuleConnectionPayload {
  const floorPlan =
    trimOrNull(lead.floorPlanPublicLink) ||
    trimOrNull((lead as { floorPlan?: string }).floorPlan);
  return {
    floorPlanPublicLink: floorPlan,
    floorPlanUrl: floorPlan,
    meetingType: trimOrNull(lead.meetingType),
    designerName: trimOrNull(lead.designerName),
    configurationScope: scopeSummary,
  };
}

export async function fetchConfigScopeSummary(
  leadType: CrmLeadType,
  leadId: string,
  options?: { budget?: string | null },
): Promise<DesignModuleConfigScopeSummary | null> {
  try {
    const data = await getConfigurationScopeRequirements(leadType, leadId);
    const { requirements } = mergeRequirementDefaults(data);
    const prefs = readConfigurationScopeFrontendPrefs(leadType, leadId);

    let aestheticNotes: string | null = null;
    let references: DesignModuleReferenceFileSummary[] = [];
    try {
      const refData = await getConfigurationScopeReferences(leadType, leadId);
      aestheticNotes = trimOrNull(refData.aestheticNotes);
      references = (refData.references ?? []).map((ref) => {
        const proxyOrUrl = referenceViewUrlToProxy(
          ref.viewUrl,
          leadType,
          leadId,
          ref.id,
        );
        return {
          id: ref.id,
          fileName: referenceDisplayName(ref),
          mimeType: trimOrNull(ref.mimeType),
          viewUrl: absoluteAppUrl(proxyOrUrl),
        };
      });
    } catch {
      /* references optional */
    }

    return buildConfigScopeSummary(requirements, {
      budget: options?.budget,
      prefs,
      aestheticNotes,
      references,
    });
  } catch {
    return null;
  }
}

/** Flat + nested fields to merge into Design Module upsert / external-intake bodies. */
export function buildPhaseFieldsForDesignModule(args: {
  lead: Lead;
  scopeSummary?: DesignModuleConfigScopeSummary | null;
  schedule?: {
    appointmentDate?: string;
    appointmentSlot?: string;
    scheduleTimezone?: string;
    designerName?: string;
  };
  salesExecutive?: string;
  salesExecutiveEmail?: string;
  pincode?: string;
  leadSource?: string;
  possessionDate?: string;
  altPhone?: string;
}): Record<string, unknown> {
  const discovery = buildDiscoveryPayload(args.lead);
  const connection = buildConnectionPayload(args.lead, args.scopeSummary ?? null);
  const designerName =
    trimOrNull(args.schedule?.designerName) ||
    trimOrNull(args.lead.designerName) ||
    connection.designerName;

  const out: Record<string, unknown> = {
    discovery,
    connection,
    propertyNotes: discovery.propertyNotes,
    configuration: discovery.configuration,
    budget: discovery.budget,
    language: discovery.language,
    bookingType: discovery.bookingType,
    propertyLocation: discovery.propertyLocation,
    meetingType: connection.meetingType,
    floorPlanPublicLink: connection.floorPlanPublicLink,
    floorPlanUrl: connection.floorPlanUrl,
  };

  if (designerName) out.designerName = designerName;
  if (args.schedule?.appointmentDate?.trim()) {
    out.appointmentDate = args.schedule.appointmentDate.trim();
  }
  if (args.schedule?.appointmentSlot?.trim()) {
    out.appointmentSlot = args.schedule.appointmentSlot.trim();
  }
  if (args.schedule?.scheduleTimezone?.trim()) {
    out.scheduleTimezone = args.schedule.scheduleTimezone.trim();
  }
  if (trimOrNull(args.salesExecutive)) out.salesExecutive = trimOrNull(args.salesExecutive);
  if (trimOrNull(args.salesExecutiveEmail)) {
    out.salesExecutiveEmail = trimOrNull(args.salesExecutiveEmail);
  }
  if (trimOrNull(args.pincode)) out.pincode = trimOrNull(args.pincode);
  if (trimOrNull(args.leadSource)) out.leadSource = trimOrNull(args.leadSource);
  if (trimOrNull(args.possessionDate)) out.possessionDate = trimOrNull(args.possessionDate);
  if (trimOrNull(args.altPhone)) out.altPhone = trimOrNull(args.altPhone);

  return out;
}

/**
 * Push latest Discovery + Connection + config-scope summary to Design Module.
 * Safe to call after CRM saves (Discovery, Configuration Scope, Meeting Schedule).
 * Creates or updates the Design lead via upsert.
 */
export async function syncCrmLeadToDesignModule(args: {
  leadType: CrmLeadType;
  /** Route/URL lead id (string). */
  leadId: string;
  lead: Lead;
  baseDetail?: Record<string, unknown> | null;
  schedule?: {
    appointmentDate?: string;
    appointmentSlot?: string;
    scheduleTimezone?: string;
  };
  designerName?: string;
}): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const detail = args.baseDetail ?? {};
  const pick = (v: unknown): string =>
    typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";

  const leadIdentifier =
    (() => {
      const candidates = [
        typeof args.lead.externalReferenceId === "string"
          ? args.lead.externalReferenceId.trim()
          : "",
        pick(detail.leadIdentifier),
        pick(detail.externalLeadId),
        pick(detail.uniqueId),
        typeof args.lead.leadId === "string" ? args.lead.leadId.trim() : "",
        pick(detail.leadId),
      ];
      const business = candidates.find((v) => v && !/^\d+$/.test(v));
      return business || candidates.find((v) => Boolean(v)) || "";
    })();

  const rawNumericId =
    detail.id ??
    (typeof detail.hubLeadId === "number" ? detail.hubLeadId : undefined) ??
    (typeof args.lead.id === "number" && args.lead.id > 0 ? args.lead.id : undefined) ??
    (/^\d+$/.test(String(args.leadId || "").trim()) ? Number(args.leadId) : undefined);
  const numericLeadId = Number(rawNumericId);

  if (!Number.isFinite(numericLeadId) || numericLeadId < 1 || !leadIdentifier) {
    return {
      ok: false,
      skipped: true,
      reason: "Missing Design upsert ids (numeric leadId / leadIdentifier)",
    };
  }

  const scopeSummary = await fetchConfigScopeSummary(args.leadType, args.leadId, {
    budget: args.lead.budget,
  });

  const body: Record<string, unknown> = {
    leadType: args.leadType,
    leadId: numericLeadId,
    leadIdentifier,
    externalLeadId: leadIdentifier,
    projectName:
      args.lead.name?.trim() ||
      pick(detail.fullName) ||
      pick(detail.customerName) ||
      pick(detail.name),
    contactNo:
      pick(detail.phone) ||
      pick(detail.phoneNumber) ||
      pick(detail.mobile) ||
      args.lead.phone ||
      "",
    clientEmail:
      pick(detail.email) ||
      pick(detail.emailAddress) ||
      args.lead.email ||
      "",
    designerName:
      trimOrNull(args.designerName) ||
      trimOrNull(args.lead.designerName) ||
      "",
    ...buildPhaseFieldsForDesignModule({
      lead: args.lead,
      scopeSummary,
      schedule: {
        ...args.schedule,
        designerName: args.designerName || args.lead.designerName,
      },
      pincode: args.lead.pincode,
      leadSource: args.lead.leadSource,
      possessionDate: args.lead.possessionDate,
      altPhone: args.lead.altPhone,
    }),
  };

  if (args.schedule?.appointmentDate?.trim()) {
    body.appointmentDate = args.schedule.appointmentDate.trim();
  }
  if (args.schedule?.appointmentSlot?.trim()) {
    body.appointmentSlot = args.schedule.appointmentSlot.trim();
  }
  if (args.schedule?.scheduleTimezone?.trim()) {
    body.scheduleTimezone = args.schedule.scheduleTimezone.trim();
  }

  const res = await fetch("/api/crm/design-module/crm-lead/upsert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(
      `Design Module CRM lead upsert failed (${res.status})${msg ? `: ${msg}` : ""}`,
    );
  }
  return { ok: true };
}
