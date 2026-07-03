import {
  createDefaultRequirements,
  getConfigurationScopeRequirements,
  mergeRequirementDefaults,
  putConfigurationScopeRequirements,
  toPutRequirementsBody,
} from "@/lib/configuration-scope-client";
import type { Lead } from "@/lib/data";
import type { CrmLeadType } from "@/lib/leads-filter";
import { pickPropertyLocationFromDetail } from "@/lib/lead-detail-mapper";

const DISCOVERY_STICKY_KEYS = [
  "propertyLocation",
  "propertyNotes",
  "budget",
  "language",
  "configuration",
  "bookingType",
] as const;

type DiscoveryStickyKey = (typeof DISCOVERY_STICKY_KEYS)[number];

export type DiscoveryPhaseSaveDraft = Pick<
  Lead,
  "propertyLocation" | "budget" | "language" | "configuration" | "propertyNotes" | "bookingType"
>;

/** Keep discovery-phase edits when a background refresh omits them from Hub. */
export function preserveDiscoveryFields(prev: Lead, next: Lead): Lead {
  const out: Lead = { ...next };
  for (const key of DISCOVERY_STICKY_KEYS) {
    const prevVal = String(prev[key as DiscoveryStickyKey] ?? "").trim();
    const nextVal = String(out[key as DiscoveryStickyKey] ?? "").trim();
    if (prevVal && !nextVal) {
      (out as Record<DiscoveryStickyKey, string>)[key] = prev[key as DiscoveryStickyKey] ?? "";
    }
  }
  return out;
}

const CONNECTION_STICKY_KEYS = ["meetingType", "designerName"] as const;
type ConnectionStickyKey = (typeof CONNECTION_STICKY_KEYS)[number];

function isUiPlaceholderToken(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "—" || trimmed === "-" || trimmed === "–";
}

/** Preserve connection-phase values when refresh/save round-trips drop them. */
export function preserveLeadStickyFields(prev: Lead, next: Lead): Lead {
  const out = preserveDiscoveryFields(prev, next);
  for (const key of CONNECTION_STICKY_KEYS) {
    const prevVal = String(prev[key as ConnectionStickyKey] ?? "").trim();
    const nextVal = String(out[key as ConnectionStickyKey] ?? "").trim();
    const nextMissing = !nextVal || isUiPlaceholderToken(nextVal);
    if (prevVal && !isUiPlaceholderToken(prevVal) && nextMissing) {
      (out as Record<ConnectionStickyKey, string>)[key] = prev[key as ConnectionStickyKey] ?? "";
    }
  }
  return out;
}

/** Property name lives in configuration_scope.property_name (walk-in also has walkinlead.property_name). */
export async function hydratePropertyNameFromConfigurationScope(
  lead: Lead,
  leadType: CrmLeadType,
  leadId: string,
  detail?: Record<string, unknown>,
): Promise<Lead> {
  if (lead.propertyLocation?.trim()) return lead;

  const fromDetail = detail ? pickPropertyLocationFromDetail(detail) : "";
  if (fromDetail.trim()) {
    return { ...lead, propertyLocation: fromDetail.trim() };
  }

  try {
    const data = await getConfigurationScopeRequirements(leadType, leadId);
    const { requirements } = mergeRequirementDefaults(data);
    const propertyName = requirements.propertyName?.trim() ?? "";
    if (!propertyName) return lead;
    return { ...lead, propertyLocation: propertyName };
  } catch {
    return lead;
  }
}

/** Discovery / lead save → configuration_scope.property_name (walk-in dual-write on Hub). */
export async function syncPropertyNameToConfigurationScope(
  propertyLocation: string,
  leadType: CrmLeadType,
  leadId: string,
): Promise<void> {
  const propertyName = propertyLocation.trim();

  const write = async (isRetry: boolean): Promise<void> => {
    let data;
    try {
      data = await getConfigurationScopeRequirements(leadType, leadId);
    } catch (loadErr) {
      if (isRetry) throw loadErr;
      data = createDefaultRequirements();
    }
    const { requirements } = mergeRequirementDefaults(data);
    const current = (requirements.propertyName ?? "").trim();
    const next = propertyName;
    if (current === next) return;

    try {
      await putConfigurationScopeRequirements(
        leadType,
        leadId,
        toPutRequirementsBody({
          ...requirements,
          propertyName: next || null,
        }),
      );
    } catch (saveErr) {
      const err = saveErr as Error & { status?: number };
      if (err.status === 409 && !isRetry) {
        await write(true);
        return;
      }
      throw saveErr;
    }
  };

  await write(false);
}

/** Seed configuration scope property name when lead detail already has it. */
export function seedPropertyNameFromLead(
  requirements: import("@/lib/configuration-scope-client").ConfigurationScopeRequirements,
  propertyLocation: string | undefined,
): {
  requirements: import("@/lib/configuration-scope-client").ConfigurationScopeRequirements;
  changed: boolean;
} {
  const propertyFromLead = propertyLocation?.trim() ?? "";
  if (!propertyFromLead) return { requirements, changed: false };
  if ((requirements.propertyName ?? "").trim()) return { requirements, changed: false };
  return {
    requirements: {
      ...requirements,
      propertyName: propertyFromLead,
    },
    changed: true,
  };
}

/** @deprecated Use hydratePropertyNameFromConfigurationScope */
export const hydratePropertyLocationFromRequirements = hydratePropertyNameFromConfigurationScope;

/** @deprecated Use syncPropertyNameToConfigurationScope */
export const syncPropertyLocationToRequirements = syncPropertyNameToConfigurationScope;

/** @deprecated Use seedPropertyNameFromLead */
export function seedProjectUnderstandingFromLead(
  requirements: import("@/lib/configuration-scope-client").ConfigurationScopeRequirements,
  propertyLocation: string | undefined,
): {
  requirements: import("@/lib/configuration-scope-client").ConfigurationScopeRequirements;
  changed: boolean;
} {
  return seedPropertyNameFromLead(requirements, propertyLocation);
}
