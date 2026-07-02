import type { Lead } from "@/lib/data";
import type { CrmLeadType } from "@/lib/leads-filter";
import type { DiscoveryPhaseSaveDraft } from "@/lib/lead-discovery-field-sync";

export type LeadDiscoveryFrontendPrefs = DiscoveryPhaseSaveDraft & {
  designerName?: string;
};

const STORAGE_PREFIX = "crm-lead-discovery-prefs";

function storageKey(leadType: string, leadId: string): string {
  return `${STORAGE_PREFIX}:${leadType.trim()}:${leadId.trim()}`;
}

function isBlank(value: string | null | undefined): boolean {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return true;
  return trimmed === "—" || trimmed === "-" || trimmed === "–";
}

export function readLeadDiscoveryPrefs(
  leadType: string,
  leadId: string,
): LeadDiscoveryFrontendPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(leadType, leadId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const row = parsed as Record<string, unknown>;
    const pick = (key: keyof LeadDiscoveryFrontendPrefs): string =>
      typeof row[key] === "string" ? row[key].trim() : "";

    const prefs: LeadDiscoveryFrontendPrefs = {
      propertyLocation: pick("propertyLocation"),
      budget: pick("budget"),
      language: pick("language"),
      configuration: pick("configuration"),
      propertyNotes: pick("propertyNotes"),
      bookingType: pick("bookingType"),
      designerName: pick("designerName"),
    };

    const hasAny = Object.values(prefs).some((value) => !isBlank(value));
    return hasAny ? prefs : null;
  } catch {
    return null;
  }
}

export function writeLeadDiscoveryPrefs(
  leadType: string,
  leadId: string,
  patch: Partial<LeadDiscoveryFrontendPrefs>,
): void {
  if (typeof window === "undefined") return;
  const current = readLeadDiscoveryPrefs(leadType, leadId) ?? {
    propertyLocation: "",
    budget: "",
    language: "",
    configuration: "",
    propertyNotes: "",
    bookingType: "",
    designerName: "",
  };
  const next: LeadDiscoveryFrontendPrefs = { ...current };
  for (const [key, value] of Object.entries(patch) as Array<
    [keyof LeadDiscoveryFrontendPrefs, string | undefined]
  >) {
    if (value === undefined) continue;
    next[key] = value.trim();
  }
  const hasAny = Object.values(next).some((value) => !isBlank(value));
  const key = storageKey(leadType, leadId);
  if (!hasAny) {
    window.localStorage.removeItem(key);
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

/** Fill discovery/connection fields Hub omitted on GET (survives dashboard refresh). */
export function mergeLeadWithDiscoveryPrefs(
  lead: Lead,
  leadType: CrmLeadType,
  leadId: string,
): Lead {
  const prefs = readLeadDiscoveryPrefs(leadType, leadId);
  if (!prefs) return lead;

  const out: Lead = { ...lead };
  const fields: Array<keyof LeadDiscoveryFrontendPrefs> = [
    "propertyLocation",
    "propertyNotes",
    "budget",
    "language",
    "configuration",
    "bookingType",
    "designerName",
  ];

  for (const field of fields) {
    const prefVal = prefs[field]?.trim() ?? "";
    if (!prefVal) continue;
    const current = String(out[field as keyof Lead] ?? "").trim();
    if (isBlank(current)) {
      (out as unknown as Record<string, string>)[field] = prefVal;
    }
  }
  return out;
}

export function persistDiscoveryPrefsFromLead(
  lead: Lead,
  leadType: CrmLeadType,
  leadId: string,
): void {
  writeLeadDiscoveryPrefs(leadType, leadId, {
    propertyLocation: lead.propertyLocation ?? "",
    budget: lead.budget ?? "",
    language: lead.language ?? "",
    configuration: lead.configuration ?? "",
    propertyNotes: lead.propertyNotes ?? "",
    bookingType: lead.bookingType ?? "",
    designerName: lead.designerName ?? "",
  });
}
