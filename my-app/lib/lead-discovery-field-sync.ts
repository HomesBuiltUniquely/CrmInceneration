import {
  createDefaultRequirements,
  getConfigurationScopeRequirements,
  joinProjectUnderstanding,
  mergeRequirementDefaults,
  putConfigurationScopeRequirements,
  splitProjectUnderstanding,
  toPutRequirementsBody,
} from "@/lib/configuration-scope-client";
import type { Lead } from "@/lib/data";
import type { CrmLeadType } from "@/lib/leads-filter";

const DISCOVERY_STICKY_KEYS = [
  "propertyLocation",
  "propertyNotes",
  "budget",
  "language",
  "configuration",
  "bookingType",
] as const;

type DiscoveryStickyKey = (typeof DISCOVERY_STICKY_KEYS)[number];

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

/** Hub stores property name in configuration-scope `projectUnderstanding`, not `propertyLocation` on addlead. */
export async function hydratePropertyLocationFromRequirements(
  lead: Lead,
  leadType: CrmLeadType,
  leadId: string,
): Promise<Lead> {
  if (lead.propertyLocation?.trim()) return lead;
  try {
    const data = await getConfigurationScopeRequirements(leadType, leadId);
    const { requirements } = mergeRequirementDefaults(data);
    const { propertyNameSite } = splitProjectUnderstanding(requirements.projectUnderstanding);
    if (!propertyNameSite.trim()) return lead;
    return { ...lead, propertyLocation: propertyNameSite };
  } catch {
    return lead;
  }
}

/** Discovery save → Basic Understanding property name (same value in both UIs). */
export async function syncPropertyLocationToRequirements(
  propertyLocation: string,
  leadType: CrmLeadType,
  leadId: string,
): Promise<void> {
  const propertyName = propertyLocation.trim();
  if (!propertyName) return;

  try {
    let data;
    try {
      data = await getConfigurationScopeRequirements(leadType, leadId);
    } catch {
      data = createDefaultRequirements();
    }
    const { requirements } = mergeRequirementDefaults(data);
    const { familySizeDetails } = splitProjectUnderstanding(requirements.projectUnderstanding);
    const nextUnderstanding = joinProjectUnderstanding(propertyName, familySizeDetails);
    const current = (requirements.projectUnderstanding ?? "").trim();
    const next = (nextUnderstanding ?? "").trim();
    if (current === next) return;

    await putConfigurationScopeRequirements(
      leadType,
      leadId,
      toPutRequirementsBody({
        ...requirements,
        projectUnderstanding: nextUnderstanding,
      }),
    );
  } catch {
    /* non-blocking — lead PUT already saved notes/budget */
  }
}

/** Seed configuration scope §1 when lead detail already has property name. */
export function seedProjectUnderstandingFromLead(
  requirements: import("@/lib/configuration-scope-client").ConfigurationScopeRequirements,
  propertyLocation: string | undefined,
): {
  requirements: import("@/lib/configuration-scope-client").ConfigurationScopeRequirements;
  changed: boolean;
} {
  const propertyFromLead = propertyLocation?.trim() ?? "";
  if (!propertyFromLead) return { requirements, changed: false };

  const { propertyNameSite, familySizeDetails } = splitProjectUnderstanding(
    requirements.projectUnderstanding,
  );
  if (propertyNameSite.trim()) return { requirements, changed: false };

  return {
    requirements: {
      ...requirements,
      projectUnderstanding: joinProjectUnderstanding(propertyFromLead, familySizeDetails),
    },
    changed: true,
  };
}
