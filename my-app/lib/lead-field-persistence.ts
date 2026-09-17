import type { CrmLeadType } from "@/lib/leads-filter";
import { BOOKING_TYPE_OPTIONS, CONFIGURATION_OPTIONS } from "@/lib/data";

export type ConfigurationDbColumn = "interior_setup" | "booking_type" | "property_type" | "configuration";

const BOOKING_TYPE_VALUE_SET = new Set(
  BOOKING_TYPE_OPTIONS.map((value) => value.trim().toLowerCase()),
);

const BHK_OPTION_SET = new Set(
  CONFIGURATION_OPTIONS.map((value) => value.trim().toLowerCase()),
);

/** True when the value is a Scope "Type" (APARTMENT / RENOVATION / KITCHEN), not BHK. */
export function isLeadBookingTypeValue(raw: string): boolean {
  return BOOKING_TYPE_VALUE_SET.has(raw.trim().toLowerCase());
}

/** True when the value looks like BHK (2 BHK, 5 BHK /Villa, …). */
export function isBhkLikeConfigurationValue(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (!v || isLeadBookingTypeValue(v)) return false;
  if (BHK_OPTION_SET.has(v)) return true;
  return /\bbhk\b/.test(v) || v.includes("villa");
}

/** Which lead-table column stores CRM UI `configuration` (BHK). */
export function configurationDbColumnForLeadType(leadType: CrmLeadType): ConfigurationDbColumn {
  switch (leadType) {
    case "glead":
    case "mlead":
    case "websitelead":
      return "interior_setup";
    case "addlead":
    case "ivrlead":
    case "walkinlead":
      return "property_type";
    case "whatsapplead":
    case "formlead":
      // BHK is lead `configuration`. `booking_type` is Scope "Type" (APARTMENT / …).
      return "configuration";
    default:
      return "configuration";
  }
}

function clearConfigurationAliases(body: Record<string, unknown>): void {
  delete body.interiorSetup;
  delete body.interior_setup;
  delete body.propertyType;
  delete body.property_type;
  delete body.propertyConfiguration;
  delete body.property_configuration;
}

/** Write UI configuration to the single correct DB column for this lead type. */
export function applyConfigurationToDetailPayload(
  leadType: CrmLeadType,
  body: Record<string, unknown>,
  configuration: string,
): void {
  const cfg = configuration.trim();
  clearConfigurationAliases(body);
  body.configuration = cfg;

  switch (configurationDbColumnForLeadType(leadType)) {
    case "interior_setup":
      body.interiorSetup = cfg;
      body.interior_setup = cfg;
      break;
    case "booking_type":
      body.bookingType = cfg;
      body.booking_type = cfg;
      break;
    case "property_type":
      body.propertyType = cfg;
      body.property_type = cfg;
      break;
    case "configuration":
      break;
  }
}

/** Property notes → lead `property_details` (plain text only). */
export function applyPropertyNotesToDetailPayload(
  body: Record<string, unknown>,
  notes: string,
): void {
  const value = notes.trim();
  body.propertyDetails = value;
  body.propertyNotes = value;
  body.property_detail = value;
}

/** Legacy read: extract notes from old JSON blobs in property_details. */
export function readPropertyNotesFromRawPropertyDetails(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("{")) return trimmed;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const fromJson =
      typeof parsed.propertyNotes === "string"
        ? parsed.propertyNotes
        : typeof parsed.property_detail === "string"
          ? parsed.property_detail
          : typeof parsed.notes === "string"
            ? parsed.notes
            : "";
    return fromJson.trim();
  } catch {
    return trimmed;
  }
}

/** Apply walk-in lead fields on PUT body. */
export function applyWalkinLeadFieldsToDetailPayload(
  body: Record<string, unknown>,
  opts: {
    configuration?: string;
    propertyNotes?: string;
    propertyName?: string;
  },
): void {
  if (opts.configuration !== undefined) {
    const cfg = opts.configuration.trim();
    body.propertyType = cfg;
    body.property_type = cfg;
    body.configuration = cfg;
  }
  if (opts.propertyNotes !== undefined) {
    const notes = opts.propertyNotes.trim();
    body.propertyDetails = notes;
    body.propertyNotes = notes;
  }
  if (opts.propertyName !== undefined) {
    const name = opts.propertyName.trim();
    body.propertyName = name;
    body.property_name = name;
    body.propertyLocation = name;
  }
}
