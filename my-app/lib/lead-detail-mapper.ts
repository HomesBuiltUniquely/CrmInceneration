import { asCrmLeadType, type CrmLeadType } from "@/lib/leads-filter";
import type { ActivityItem, ActivityType, Lead } from "@/lib/data";
import { isCrmLeadReinquiry, parseAdditionalLeadSources } from "@/lib/lead-source-utils";
import {
  getLeadDisplayEmail,
  getLeadDisplayName,
  getLeadDisplayPhone,
  getLeadDisplayPincode,
  getLeadDisplaySource,
} from "@/lib/lead-display";
import { applyLostReasonToDetailPayload, readLostReasonFromDetail } from "@/lib/lead-lost-fields";
import { formatCrmDateTime } from "@/lib/date-time-format";
import { resolveEffectiveFollowUpDateRaw } from "@/lib/follow-up-date";
import { normalizeFloorPlanS3Key, pickFloorPlanPublicLink } from "@/lib/floor-plan";
import {
  clearFollowUpDateAliases,
} from "@/lib/lead-schedule-payload";

function pickStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

/** String or numeric field (phone, pincode, budget, id fragments). */
function pickScalar(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  }
  return "";
}

function pickBool(obj: Record<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "boolean") return v;
    if (typeof v === "string" && v.trim()) {
      const normalized = v.trim().toLowerCase();
      if (["true", "1", "yes"].includes(normalized)) return true;
      if (["false", "0", "no"].includes(normalized)) return false;
    }
  }
  return undefined;
}

function pickPersonNameFromNested(obj: Record<string, unknown> | null | undefined): string {
  if (!obj || typeof obj !== "object") return "";
  const o = obj as Record<string, unknown>;
  return pickStr(o, "name", "fullName", "displayName", "userName", "firstName");
}

/** Assignee / owner: flat string keys or nested user objects (common in Spring DTOs). */
function pickAssigneeDisplay(detail: Record<string, unknown>): string {
  const flat = pickStr(
    detail,
    "assignee",
    "assignedTo",
    "salesOwnerName",
    "ownerName",
    "salesRepName",
    "executiveName",
    "assignedToName",
    "salesExecutive",
    "rmName",
    "relationshipManager"
  );
  if (flat) return flat;

  for (const key of [
    "assignee",
    "assignedTo",
    "salesOwner",
    "owner",
    "assignedUser",
    "salesManager",
    "user",
    "relationshipManager",
  ]) {
    const v = detail[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "object" && v !== null) {
      const n = pickPersonNameFromNested(v as Record<string, unknown>);
      if (n) return n;
    }
  }
  return "";
}

function pickDesignerDisplay(detail: Record<string, unknown>): string {
  const flat = pickStr(
    detail,
    "designerName",
    "designer",
    "interiorDesignerName",
    "interiorDesigner",
    "designConsultant",
    "designConsultantName"
  );
  if (flat) return flat;
  const nested = detail.designer ?? detail.interiorDesigner;
  if (typeof nested === "object" && nested !== null) {
    const n = pickPersonNameFromNested(nested as Record<string, unknown>);
    if (n) return n;
  }
  return "";
}

function pickSalesManagerDisplay(detail: Record<string, unknown>): string {
  const flat = pickStr(
    detail,
    "salesManagerName",
    "sales_manager_name",
    "managerName",
    "manager_name",
    "reportingManagerName",
    "reporting_manager_name",
    "salesLeadName",
    "sales_lead_name",
  );
  if (flat) return flat;

  for (const key of [
    "salesManager",
    "manager",
    "reportingManager",
    "salesLead",
  ]) {
    const v = detail[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "object" && v !== null) {
      const n = pickPersonNameFromNested(v as Record<string, unknown>);
      if (n) return n;
    }
  }
  return "";
}

function pickNumStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined || v === null) continue;
    return String(v);
  }
  return "";
}

function stageObj(detail: Record<string, unknown>): Record<string, unknown> | null {
  const s = detail.stage;
  if (s && typeof s === "object" && !Array.isArray(s)) return s as Record<string, unknown>;
  return null;
}

function pickDetailScalar(detail: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = detail[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const df = detail.dynamicFields;
  if (df && typeof df === "object" && !Array.isArray(df)) {
    const d = df as Record<string, unknown>;
    for (const k of keys) {
      const v = d[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return "";
}

/** Read presales milestone from root, `stage`, `dynamicFields`, and snake_case aliases. */
export function readPresalesMilestoneFromDetail(detail: Record<string, unknown>): {
  stage: string;
  category: string;
  subStage: string;
} {
  const st = stageObj(detail);
  const stage =
    pickDetailScalar(detail, ["presalesMilestoneStage", "presales_milestone_stage"]) ||
    String(st?.presalesMilestoneStage ?? "").trim();
  const category =
    pickDetailScalar(detail, [
      "presalesMilestoneCategory",
      "presales_milestone_category",
      "presalesMilestoneStageCategory",
    ]) ||
    String(st?.presalesMilestoneCategory ?? st?.presalesMilestoneStageCategory ?? "").trim();
  const subStage =
    pickDetailScalar(detail, ["presalesMilestoneSubStage", "presales_milestone_sub_stage"]) ||
    String(st?.presalesMilestoneSubStage ?? "").trim();
  return { stage, category, subStage };
}

function applyPresalesMilestoneAliases(
  target: Record<string, unknown>,
  update: PresalesMilestoneUpdate,
): void {
  const stage = update.presalesMilestoneStage.trim();
  const category = update.presalesMilestoneCategory.trim();
  const subStage = update.presalesMilestoneSubStage.trim();

  target.presalesMilestoneStage = stage;
  target.presalesMilestoneCategory = category;
  target.presalesMilestoneSubStage = subStage;
  target.presales_milestone_stage = stage;
  target.presales_milestone_category = category;
  target.presales_milestone_sub_stage = subStage;
  target.presalesMilestoneStageCategory = category;

  const df = target.dynamicFields;
  const dfo =
    df && typeof df === "object" && !Array.isArray(df)
      ? { ...(df as Record<string, unknown>) }
      : {};
  if (stage) dfo.presalesMilestoneStage = stage;
  if (category) {
    dfo.presalesMilestoneCategory = category;
    dfo.presalesMilestoneStageCategory = category;
  }
  if (subStage) dfo.presalesMilestoneSubStage = subStage;
  target.dynamicFields = dfo;
}

function pickAdditionalLeadSourcesRaw(detail: Record<string, unknown>): string {
  const v = detail.additionalLeadSources ?? (
    detail.dynamicFields &&
      typeof detail.dynamicFields === "object" &&
      !Array.isArray(detail.dynamicFields)
      ? (detail.dynamicFields as Record<string, unknown>).additionalLeadSources
      : undefined
  );
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return JSON.stringify(v);
  return String(v);
}

function asJsonObjectString(value: string): Record<string, unknown> | null {
  const raw = value.trim();
  if (!raw.startsWith("{") || !raw.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

/** When backend nests interior/config under `propertyDetails` (object). */
function asPropertyDetailsObject(
  detail: Record<string, unknown>,
): Record<string, unknown> | null {
  const pd = detail.propertyDetails ?? detail.PropertyDetails;
  if (pd && typeof pd === "object" && !Array.isArray(pd)) {
    return pd as Record<string, unknown>;
  }
  if (typeof pd === "string") {
    return asJsonObjectString(pd);
  }
  return null;
}

/** Root `propertyDetails` and ads `dynamicFields.propertyDetails` (object or JSON string). */
function collectPropertyDetailsBags(detail: Record<string, unknown>): Record<string, unknown>[] {
  const bags: Record<string, unknown>[] = [];
  const add = (pd: unknown) => {
    if (pd && typeof pd === "object" && !Array.isArray(pd)) {
      bags.push(pd as Record<string, unknown>);
      return;
    }
    if (typeof pd === "string" && pd.trim()) {
      const parsed = asJsonObjectString(pd.trim());
      if (parsed) bags.push(parsed);
    }
  };

  add(detail.propertyDetails ?? detail.PropertyDetails);
  const df = detail.dynamicFields;
  if (df && typeof df === "object" && !Array.isArray(df)) {
    const dfo = df as Record<string, unknown>;
    add(dfo.propertyDetails ?? dfo.PropertyDetails);
  }
  return bags;
}

export function isUiPlaceholderToken(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "—" || trimmed === "-" || trimmed === "–";
}

function pickMeetingTypeFromDetail(detail: Record<string, unknown>): string {
  return pickStr(detail, "meetingType", "meeting_type", "meeting") || "";
}

function resolveDesignerNameForSave(
  leadDesignerName: string,
  base: Record<string, unknown>,
): string {
  const fromLead = leadDesignerName.trim();
  if (fromLead && !isUiPlaceholderToken(fromLead)) return fromLead;
  const fromBase = pickDesignerDisplay(base);
  if (fromBase) return fromBase;
  return fromLead;
}

export function pickConfigurationFromDetail(
  detail: Record<string, unknown>,
  leadType: CrmLeadType,
): string {
  const isBudgetLikeConfiguration = (value: string): boolean => {
    const v = value.trim().toLowerCase();
    if (!v) return false;
    return (
      v.includes("lakh") ||
      v.includes("lakhs") ||
      v.includes("crore") ||
      v.includes("cr") ||
      v.includes("onwards") ||
      v.includes("essential interiors") ||
      v.includes("standard interiors") ||
      /₹/.test(v) ||
      /\d+\s*-\s*\d+/.test(v)
    );
  };

  const firstValidConfiguration = (...values: string[]): string => {
    for (const value of values) {
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (isBudgetLikeConfiguration(trimmed)) continue;
      return trimmed;
    }
    return "";
  };

  /** Add Lead API stores configuration in `propertyType` (not `interior_setup`). */
  if (leadType === "addlead") {
    const fromRoot = pickStr(detail, "propertyType", "property_type");
    if (fromRoot) return fromRoot;
    const fromBag = asPropertyDetailsObject(detail);
    if (fromBag) {
      const fromNested = pickStr(fromBag, "propertyType", "property_type");
      if (fromNested) return fromNested;
    }
  }

  const flatPrimary = pickStr(
    detail,
    "configuration",
    "propertyConfiguration",
    "property_configuration",
    "propertyType",
    "property_type",
    "bhk",
    "unitType",
  );
  const flatFallback = pickStr(detail, "interior_setup", "interiorSetup");
  const flat = firstValidConfiguration(flatPrimary, flatFallback);
  if (flat) return flat;

  const fromBag = asPropertyDetailsObject(detail);
  if (fromBag) {
    const nestedPrimary = pickStr(
      fromBag,
      "configuration",
      "propertyConfiguration",
      "property_configuration",
      "propertyType",
      "property_type",
      "bhk",
      "unitType",
    );
    const nestedFallback = pickStr(fromBag, "interior_setup", "interiorSetup");
    const nested = firstValidConfiguration(nestedPrimary, nestedFallback);
    if (nested) return nested;
  }

  const df = detail.dynamicFields;
  if (df && typeof df === "object" && !Array.isArray(df)) {
    const dfo = df as Record<string, unknown>;
    const pdInDf = dfo.propertyDetails ?? dfo.PropertyDetails;
    const pdInDfObject =
      pdInDf && typeof pdInDf === "object" && !Array.isArray(pdInDf)
        ? (pdInDf as Record<string, unknown>)
        : typeof pdInDf === "string"
          ? asJsonObjectString(pdInDf)
          : null;
    if (pdInDfObject) {
      const innerPrimary = pickStr(
        pdInDfObject,
        "configuration",
        "propertyConfiguration",
        "property_configuration",
        "propertyType",
        "property_type",
        "bhk",
        "unitType",
      );
      const innerFallback = pickStr(pdInDfObject, "interior_setup", "interiorSetup");
      const inner = firstValidConfiguration(innerPrimary, innerFallback);
      if (inner) return inner;
    }
    const directDfPrimary = pickStr(
      dfo,
      "configuration",
      "propertyConfiguration",
      "property_configuration",
      "propertyType",
      "property_type",
      "bhk",
      "unitType",
    );
    const directDfFallback = pickStr(dfo, "interior_setup", "interiorSetup");
    const directDf = firstValidConfiguration(directDfPrimary, directDfFallback);
    if (directDf) return directDf;
  }

  /** `propertyDetails` stored as JSON string (common for Mlead after merged saves). */
  const pdStr = detail.propertyDetails;
  if (typeof pdStr === "string" && pdStr.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(pdStr) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const fromJsonPrimary = pickStr(
          parsed,
          "configuration",
          "propertyConfiguration",
          "property_configuration",
          "propertyType",
          "unitType",
          "property_type",
          "bhk",
        );
        const fromJsonFallback = pickStr(parsed, "interior_setup", "interiorSetup");
        const fromJson = firstValidConfiguration(fromJsonPrimary, fromJsonFallback);
        if (fromJson) return fromJson;
      }
    } catch {
      /* ignore */
    }
  }

  return "";
}

function normalizeCompareValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function isConfigurationLikePropertyDetails(
  noteLike: string,
  detail: Record<string, unknown>,
): boolean {
  const candidate = normalizeCompareValue(noteLike);
  if (!candidate) return false;
  const cfgCandidates = [
    pickStr(
      detail,
      "interior_setup",
      "interiorSetup",
      "configuration",
      "propertyConfiguration",
      "property_configuration",
      "bhk",
      "propertyType",
      "unitType",
      "property_type",
    ),
    (() => {
      const pd = detail.propertyDetails;
      if (pd && typeof pd === "object" && !Array.isArray(pd)) {
        return pickStr(
          pd as Record<string, unknown>,
          "interior_setup",
          "interiorSetup",
          "configuration",
          "propertyConfiguration",
          "property_configuration",
          "bhk",
          "propertyType",
          "unitType",
          "property_type",
        );
      }
      return "";
    })(),
  ]
    .map((v) => normalizeCompareValue(v))
    .filter(Boolean);
  return cfgCandidates.includes(candidate);
}

/** Property name / site from lead detail or nested `propertyDetails` JSON. */
export function pickPropertyLocationFromDetail(detail: Record<string, unknown>): string {
  const direct = pickStr(
    detail,
    "propertyLocation",
    "location",
    "address",
    "propertyAddress",
    "propertyName",
    "property_name",
  );
  if (direct) return direct;

  for (const bag of collectPropertyDetailsBags(detail)) {
    const fromBag = pickStr(
      bag,
      "propertyNameSite",
      "propertyName",
      "propertyLocation",
      "property_name",
      "site",
      "siteName",
    );
    if (fromBag) return fromBag;
  }
  return "";
}

/** Add Lead stores property name + notes in `propertyDetails` text (JSON when name is set). */
function serializeAddLeadPropertyDetails(lead: Lead): string {
  const notes = lead.propertyNotes.trim();
  const propertyName = lead.propertyLocation.trim();
  if (!notes && !propertyName) return "";
  if (!propertyName) return notes;
  const bag: Record<string, string> = { propertyNameSite: propertyName };
  if (notes) {
    bag.propertyNotes = notes;
    bag.property_detail = notes;
  }
  return JSON.stringify(bag);
}

/** Property notes: never treat config/interior values as notes. */
export function pickPropertyNotesFromDetail(
  detail: Record<string, unknown>,
  leadType: CrmLeadType,
): string {
  const direct = pickStr(
    detail,
    "propertyNotes",
    "property_detail",
    "notes",
  );
  if (direct) return direct;

  for (const bag of collectPropertyDetailsBags(detail)) {
    const extracted = pickStr(
      bag,
      "propertyNotes",
      "property_detail",
      "notes",
      "description",
      "details",
    );
    if (!extracted) continue;
    if (!isConfigurationLikePropertyDetails(extracted, detail)) return extracted;
  }

  const pd = detail.propertyDetails;
  if (typeof pd === "string" && pd.trim()) {
    const raw = pd.trim();
    if (!raw.startsWith("{")) {
      return isConfigurationLikePropertyDetails(raw, detail) ? "" : raw;
    }
  }

  const df = detail.dynamicFields;
  if (df && typeof df === "object" && !Array.isArray(df)) {
    const dfo = df as Record<string, unknown>;
    const dfPd = dfo.propertyDetails ?? dfo.PropertyDetails;
    if (typeof dfPd === "string" && dfPd.trim()) {
      const raw = dfPd.trim();
      if (!raw.startsWith("{")) {
        return isConfigurationLikePropertyDetails(raw, detail) ? "" : raw;
      }
    }
  }
  return "";
}

/**
 * Merge Lead configuration + notes into backend `propertyDetails` (object) for non–Add Lead entities.
 * Add Lead (`addlead`) uses `propertyDetails` as a **string** in Java; that path does not call this.
 */
function mergePropertyDetailsBlock(
  base: Record<string, unknown>,
  lead: Lead,
): Record<string, unknown> {
  const prev = base.propertyDetails;
  let bag: Record<string, unknown> = {};

  if (prev && typeof prev === "object" && !Array.isArray(prev)) {
    bag = { ...(prev as Record<string, unknown>) };
  } else if (typeof prev === "string" && prev.trim()) {
    const raw = prev.trim();
    if (raw.startsWith("{") && raw.endsWith("}")) {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          bag = { ...parsed };
        }
      } catch {
        bag = { propertyNotes: raw, property_detail: raw };
      }
    } else {
      bag = { propertyNotes: raw, property_detail: raw };
    }
  }

  const cfg = lead.configuration.trim();
  if (cfg) {
    bag.interiorSetup = cfg;
  }

  const existingNotes = pickStr(bag, "propertyNotes", "property_detail", "notes");
  const notes = lead.propertyNotes.trim();
  if (notes) {
    bag.propertyNotes = notes;
    bag.property_detail = notes;
  } else if (existingNotes) {
    bag.propertyNotes = existingNotes;
    bag.property_detail = existingNotes;
  } else {
    bag.propertyNotes = "";
    bag.property_detail = "";
  }

  const existingName = pickStr(
    bag,
    "propertyNameSite",
    "propertyName",
    "propertyLocation",
    "property_name",
  );
  const propertyName = lead.propertyLocation.trim();
  if (propertyName) {
    bag.propertyNameSite = propertyName;
    bag.propertyName = propertyName;
  } else if (existingName) {
    bag.propertyNameSite = existingName;
  }

  return bag;
}

/** Ads / dynamic payloads sometimes keep a parallel copy under `dynamicFields`. */
function mergeDynamicFieldsInterior(
  next: Record<string, unknown>,
  configuration: string,
): void {
  const cfg = configuration.trim();
  const df = next.dynamicFields;
  if (!df || typeof df !== "object" || Array.isArray(df)) return;
  const dfo = { ...(df as Record<string, unknown>) };
  const pdInDf = dfo.propertyDetails;
  if (pdInDf && typeof pdInDf === "object" && !Array.isArray(pdInDf)) {
    dfo.propertyDetails = {
      ...(pdInDf as Record<string, unknown>),
      interiorSetup: cfg,
    };
  } else {
    dfo.interiorSetup = cfg;
  }
  next.dynamicFields = dfo;
}

export function extractStage(detail: Record<string, unknown>) {
  const st = stageObj(detail);
  const substage =
    st?.substage && typeof st.substage === "object" && st.substage !== null
      ? (st.substage as { substage?: string | null }).substage
      : undefined;
  const ps = readPresalesMilestoneFromDetail(detail);
  return {
    milestoneStage: (st?.milestoneStage as string | null | undefined) ?? null,
    milestoneStageCategory: (st?.milestoneStageCategory as string | null | undefined) ?? null,
    milestoneSubStage: (st?.milestoneSubStage as string | null | undefined) ?? null,
    presalesMilestoneStage: ps.stage || null,
    presalesMilestoneCategory: ps.category || null,
    presalesMilestoneSubStage: ps.subStage || null,
    legacyStage: (st?.stage as string | null | undefined) ?? null,
    legacySubstage: substage ?? null,
  };
}

/** Map GET details JSON to UI Lead (best-effort across lead entity types). */
export function detailJsonToLead(detail: Record<string, unknown>, leadType: CrmLeadType): Lead {
  const st = extractStage(detail);
  const status =
    st.milestoneSubStage?.trim() ||
    st.legacySubstage?.trim() ||
    st.milestoneStage?.trim() ||
    pickStr(detail, "status", "leadStatus") ||
    "—";

  const name = getLeadDisplayName(detail);
  const customerId =
    pickStr(detail, "customerId", "crmId", "leadRef") ||
    (detail.id !== undefined && detail.id !== null ? `CRM-${detail.id}` : "—");
  const phone = getLeadDisplayPhone(detail);
  const createdRaw = pickStr(detail, "createdAt", "createdDate", "leadDate", "createdOn");
  const createdAt = createdRaw ? formatCrmDateTime(createdRaw) : "—";
  const firstCallAtRaw = pickStr(detail, "firstCallAt");
  const assignee = pickAssigneeDisplay(detail);

  const requirementsRaw = detail.requirements ?? detail.requirementList;
  let requirements: string[] = [];
  if (Array.isArray(requirementsRaw)) {
    requirements = requirementsRaw.map((x) => String(x)).filter(Boolean);
  } else if (typeof requirementsRaw === "string" && requirementsRaw.trim()) {
    requirements = requirementsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  }

  return {
    id: pickNumStr(detail, "id"),
    leadId: pickScalar(detail, "leadId", "leadRef", "leadCode", "customerId"),
    externalReferenceId: pickScalar(
      detail,
      "uniqueId",
      "lead_identifier",
      "leadIdentifier",
      "externalReferenceId",
      "external_reference_id",
    ),
    name,
    customerId,
    status,
    createdAt,
    firstCallAt: firstCallAtRaw || "",
    assignee: assignee || "—",
    designerName: pickDesignerDisplay(detail) || "—",
    designerEmail:
      pickStr(detail, "designerEmail", "designEmail", "interiorDesignerEmail", "designPreferenceEmail") ||
      (() => {
        const d = detail.designer ?? detail.interiorDesigner;
        if (d && typeof d === "object" && !Array.isArray(d)) {
          return pickStr(d as Record<string, unknown>, "email", "mail", "emailAddress");
        }
        return "";
      })(),
    email: getLeadDisplayEmail(detail),
    phone,
    altPhone:
      pickScalar(detail, "altPhoneNumber", "altPhone", "alternatePhone", "phone2", "secondaryPhone") ||
      "",
    pincode: getLeadDisplayPincode(detail),
    configuration: pickConfigurationFromDetail(detail, leadType),
    floorPlan:
      normalizeFloorPlanS3Key(
        pickStr(detail, "floorPlanS3Key", "floorPlanUrl", "floorPlan", "floorplan") || "",
      ),
    floorPlanPublicLink: pickFloorPlanPublicLink({
      publicUrl: pickStr(detail, "publicUrl", "floorPlanPublicLink"),
      floorPlanPublicLink: pickStr(detail, "floorPlanPublicLink"),
      floorPlanUrl: pickStr(detail, "floorPlanUrl", "floorPlan"),
    }),
    possessionDate:
      pickStr(detail, "possession", "possessionDate", "possession_date", "possessionTime") || "",
    propertyLocation: pickPropertyLocationFromDetail(detail) || pickStr(detail, "propertyLocation", "location", "address", "propertyAddress") || "",
    budget: pickScalar(detail, "budget", "budgetRange", "estimatedBudget", "leadBudget") || "",
    language: pickStr(detail, "languagePrefered", "language", "preferredLanguage") || "English",
    salesManagerName: pickSalesManagerDisplay(detail) || undefined,
    lostReason: readLostReasonFromDetail(detail) || "",
    quoteLink: pickStr(detail, "quoteLink", "quoteURL", "proposalLink") || "",
    designQaLink:
      pickStr(detail, "designQaLink", "design_qa_quiz_url", "designQaQuizUrl") || undefined,
    leadSource: getLeadDisplaySource({ ...detail, leadType }),
    additionalLeadSources: pickAdditionalLeadSourcesRaw(detail),
    additionalLeadSourcesList: parseAdditionalLeadSources(detail.additionalLeadSources),
    bookingType: pickStr(detail, "bookingType", "booking_type", "BookingType") || "",
    meetingType: pickStr(detail, "meetingType", "meeting_type", "meeting") || "",
    propertyNotes: pickPropertyNotesFromDetail(detail, leadType),
    requirements,
    meetingDate: pickStr(detail, "meetingDate", "siteVisitDate") || "",
    meetingVenue: pickStr(detail, "meetingVenue", "venue") || "",
    followUpDate:
      resolveEffectiveFollowUpDateRaw(
        pickStr(detail, "followUpDate", "nextFollowUp"),
        createdRaw,
        {
          isReinquiry: isCrmLeadReinquiry(detail),
          updatedRaw: pickStr(detail, "updatedAt", "updated_at", "updatedOn", "modifiedAt"),
        },
      ) || "",
    agentName: pickStr(detail, "agentName", "agent") || "",
    activities: [],
    leadType,
    verified: (() => {
      const v = detail.verified ?? detail.isVerified;
      if (typeof v === "boolean") return v;
      const vs = String(detail.verificationStatus ?? "").trim().toLowerCase();
      return vs === "verified" || vs === "true";
    })(),
    salesclouserfill: pickBool(
      detail,
      "salesclouserfill",
      "salesClosureFill",
      "sales_clouser_fill",
      "salesClosureSubmitted",
    ),
    paymentReceived: pickScalar(detail, "paymentReceived", "payment_received") || "",
    stageBlock: {
      milestoneStage: st.milestoneStage,
      milestoneStageCategory: st.milestoneStageCategory,
      milestoneSubStage: st.milestoneSubStage,
      presalesMilestoneStage: st.presalesMilestoneStage,
      presalesMilestoneCategory: st.presalesMilestoneCategory,
      presalesMilestoneSubStage: st.presalesMilestoneSubStage,
      stage: st.legacyStage ?? "Initial Stage",
      substage: { substage: st.legacySubstage ?? null },
    },
    branch: pickStr(detail, "experienceCenter", "experience_center", "branch", "branchName", "branch_name", "office", "officeName", "territory", "region") || undefined,
    previousAssignee: pickStr(detail, "previousAssignee", "previous_assignee") || undefined,
    inboundPayloadJson:
      pickStr(detail, "inboundPayloadJson", "inbound_payload_json", "inboundPayload") ||
      undefined,
    lastInboundMessage:
      pickStr(detail, "lastInboundMessage", "last_inbound_message") || undefined,
    msgUuid: pickStr(detail, "msgUuid", "msg_uuid") || undefined,
    msg91CustomerNumber:
      pickStr(detail, "msg91CustomerNumber", "msg91_customer_number") || undefined,
    msg91IntegratedNumber:
      pickStr(detail, "msg91IntegratedNumber", "msg91_integrated_number") || undefined,
    msg91Direction: pickStr(detail, "msg91Direction", "msg91_direction") || undefined,
    msg91ContentType:
      pickStr(detail, "msg91ContentType", "msg91_content_type") || undefined,
    msg91EventType: pickStr(detail, "msg91EventType", "msg91_event_type") || undefined,
  };
}

export type PresalesMilestoneUpdate = {
  presalesMilestoneStage: string;
  presalesMilestoneCategory: string;
  presalesMilestoneSubStage: string;
};

/** PUT presales milestone fields only — does not change sales `milestoneStage`. */
export function mergePresalesMilestoneIntoDetail(
  base: Record<string, unknown>,
  update: PresalesMilestoneUpdate,
  opts?: { omitSalesMilestones?: boolean },
): Record<string, unknown> {
  const next = { ...base };
  applyPresalesMilestoneAliases(next, update);

  const stage = update.presalesMilestoneStage.trim();
  const category = update.presalesMilestoneCategory.trim();
  const subStage = update.presalesMilestoneSubStage.trim();
  const prevStage = stageObj(next) ?? {};

  if (opts?.omitSalesMilestones) {
    next.stage = {
      presalesMilestoneStage: stage,
      presalesMilestoneCategory: category,
      presalesMilestoneSubStage: subStage,
      ...(prevStage.substage !== undefined ? { substage: prevStage.substage } : {}),
      ...(prevStage.stage !== undefined ? { stage: prevStage.stage } : {}),
    };
  } else {
    next.stage = {
      ...prevStage,
      presalesMilestoneStage: stage,
      presalesMilestoneCategory: category,
      presalesMilestoneSubStage: subStage,
    };
  }
  return next;
}

export type PresalesCompleteTaskPutFields = {
  followUpDate?: string;
  lostReason?: string;
  budget?: string;
  propertyNotes?: string;
  configuration?: string;
  bookingType?: string;
  possessionDate?: string;
  clearFollowUp?: boolean;
};

function applyPresalesCompleteTaskPutFields(
  body: Record<string, unknown>,
  fields: PresalesCompleteTaskPutFields,
): void {
  if (fields.budget !== undefined) body.budget = fields.budget.trim();
  if (fields.bookingType !== undefined) {
    const bookingType = fields.bookingType.trim();
    body.bookingType = bookingType;
    body.booking_type = bookingType;
  }
  if (fields.configuration !== undefined) {
    const cfg = fields.configuration.trim();
    body.propertyType = cfg;
    body.configuration = cfg;
    body.interiorSetup = cfg;
  }
  if (fields.propertyNotes !== undefined) {
    const notes = fields.propertyNotes.trim();
    body.propertyNotes = notes;
    body.property_detail = notes;
  }
  if (fields.possessionDate !== undefined) {
    const possession = fields.possessionDate.trim();
    body.possession = possession;
    body.possessionDate = possession;
  }
  if (fields.lostReason !== undefined) {
    applyLostReasonToDetailPayload(body, fields.lostReason);
  }
  if (fields.clearFollowUp) {
    clearFollowUpDateAliases(body);
  } else if (fields.followUpDate !== undefined) {
    body.followUpDate = fields.followUpDate;
    body.nextFollowUp = fields.followUpDate;
  }
}

/**
 * Milestone-only PUT for WhatsApp / walk-in — root + nested presales `stage` only.
 * See docs/WHATSAPP_PRESALES_MILESTONE_FRONTEND.md §4.
 */
export function buildMinimalPresalesMilestonePutBody(
  update: PresalesMilestoneUpdate,
  fields: PresalesCompleteTaskPutFields = {},
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  applyPresalesMilestoneAliases(body, update);
  body.stage = {
    presalesMilestoneStage: update.presalesMilestoneStage.trim(),
    presalesMilestoneCategory: update.presalesMilestoneCategory.trim(),
    presalesMilestoneSubStage: update.presalesMilestoneSubStage.trim(),
  };
  applyPresalesCompleteTaskPutFields(body, fields);
  return body;
}

/**
 * Presales Complete Task PUT — full GET body + presales milestone (non–WhatsApp types).
 */
export function buildPresalesCompleteTaskPutBody(
  base: Record<string, unknown>,
  update: PresalesMilestoneUpdate,
  fields: PresalesCompleteTaskPutFields = {},
): Record<string, unknown> {
  const body = mergePresalesMilestoneIntoDetail(base, update, { omitSalesMilestones: true });
  applyPresalesCompleteTaskPutFields(body, fields);
  return body;
}

/** Clear all floor-plan fields on PUT body (remove PDF/JPG/PNG from lead). */
export function mergeClearFloorPlanInDetail(
  base: Record<string, unknown>,
  lead: Lead,
): Record<string, unknown> {
  return mergeLeadIntoDetail(base, {
    ...lead,
    floorPlan: "",
    floorPlanPublicLink: undefined,
    floorPlanViewPath: undefined,
    floorPlanOpenPath: undefined,
  });
}

/** Merge UI Lead + existing GET body for PUT (preserves unknown backend fields). */
export function pickCustomerNameFromDetail(detail: Record<string, unknown>): string {
  return pickStr(
    detail,
    "name",
    "customerName",
    "fullName",
    "displayName",
    "userName",
    "firstName",
  );
}

export function applyCustomerNameToDetail(
  detail: Record<string, unknown>,
  name: string,
): Record<string, unknown> {
  return {
    ...detail,
    name,
    customerName: name,
    fullName: name,
  };
}

/** Merge UI Lead + existing GET body for PUT (preserves unknown backend fields). */
export function mergeLeadIntoDetail(base: Record<string, unknown>, lead: Lead): Record<string, unknown> {
  const mergedLt = asCrmLeadType(lead.leadType, "formlead");
  const next = { ...base };
  const resolvedConfiguration = lead.configuration.trim() || pickConfigurationFromDetail(base, mergedLt);
  const resolvedPropertyNotes = lead.propertyNotes.trim() || pickPropertyNotesFromDetail(base, mergedLt);
  const resolvedPropertyLocation =
    lead.propertyLocation.trim() || pickPropertyLocationFromDetail(base);
  const resolvedMeetingType = lead.meetingType.trim() || pickMeetingTypeFromDetail(base);
  const resolvedDesignerName = resolveDesignerNameForSave(lead.designerName, base);
  const leadForMerge: Lead = {
    ...lead,
    configuration: resolvedConfiguration,
    propertyNotes: resolvedPropertyNotes,
    propertyLocation: resolvedPropertyLocation,
    meetingType: resolvedMeetingType,
    designerName: resolvedDesignerName,
  };
  next.name = lead.name;
  next.customerName = lead.name;
  next.fullName = lead.name;
  next.email = lead.email;
  next.emailAddress = lead.email;
  next.mail = lead.email;
  next.phone = lead.phone;
  next.phoneNumber = lead.phone;
  next.mobile = lead.phone;
  next.altPhoneNumber = lead.altPhone;
  next.altPhone = lead.altPhone;
  next.propertyPincode = lead.pincode;
  next.pincode = lead.pincode;
  next.pinCode = lead.pincode;
  next.propertyPin = lead.pincode;
  next.zip = lead.pincode;
  next.budget = lead.budget;
  next.designerName = resolvedDesignerName;
  if (lead.designerEmail !== undefined) {
    const de = lead.designerEmail.trim();
    next.designerEmail = de;
    next.designEmail = de;
    next.designPreferenceEmail = de;
  }
  const prevDesigner = base.designer;
  if (typeof prevDesigner === "object" && prevDesigner !== null) {
    next.designer = {
      ...(prevDesigner as Record<string, unknown>),
      name: resolvedDesignerName,
      fullName: resolvedDesignerName,
      ...(lead.designerEmail?.trim()
        ? { email: lead.designerEmail.trim(), mail: lead.designerEmail.trim() }
        : {}),
    };
  }

  const prevAssignee = base.assignee;
  if (typeof prevAssignee === "object" && prevAssignee !== null) {
    const ao = prevAssignee as Record<string, unknown>;
    next.assignee = { ...ao, name: lead.assignee, fullName: lead.assignee };
  } else {
    next.assignee = lead.assignee;
  }
  next.assignedTo = lead.assignee;
  next.salesOwnerName = lead.assignee;
  next.ownerName = lead.assignee;
  next.leadSource = lead.leadSource;
  next.LeadSource = lead.leadSource;
  next.bookingType = lead.bookingType;
  next.booking_type = lead.bookingType;
  if (lead.additionalLeadSources !== undefined) {
    next.additionalLeadSources = lead.additionalLeadSources;
  }
  next.propertyNotes = resolvedPropertyNotes;
  next.property_detail = resolvedPropertyNotes;
  if (mergedLt === "addlead") {
    next.propertyDetails = serializeAddLeadPropertyDetails(leadForMerge);
  } else {
    next.propertyDetails = mergePropertyDetailsBlock(base, leadForMerge);
  }
  mergeDynamicFieldsInterior(next, resolvedConfiguration);
  next.followUpDate = lead.followUpDate;
  next.meetingDate = lead.meetingDate;
  next.meetingVenue = lead.meetingVenue;
  next.meetingType = resolvedMeetingType;
  next.agentName = lead.agentName;
  // UI `configuration` → root `propertyType` + Jackson `interiorSetup` (DB `interior_setup`).
  next.propertyType = resolvedConfiguration;
  next.configuration = resolvedConfiguration;
  next.propertyConfiguration = resolvedConfiguration;
  next.property_configuration = resolvedConfiguration;
  next.interiorSetup = resolvedConfiguration;
  next.interior_setup = resolvedConfiguration;
  if (mergedLt === "addlead") next.property_type = resolvedConfiguration;
  const floorPlanValue = lead.floorPlan.trim();
  const floorPlanPublic = lead.floorPlanPublicLink?.trim() ?? "";
  if (!floorPlanValue && !floorPlanPublic) {
    next.floorPlanUrl = null;
    next.floorPlan = null;
    next.floorPlanS3Key = null;
    next.floorPlanPublicLink = null;
    next.publicUrl = null;
  } else {
    next.floorPlanUrl = floorPlanValue || floorPlanPublic;
    next.floorPlan = floorPlanValue || floorPlanPublic;
    if (floorPlanPublic) {
      next.floorPlanPublicLink = floorPlanPublic;
      next.publicUrl = floorPlanPublic;
    }
  }
  next.possession = lead.possessionDate;
  next.possessionDate = lead.possessionDate;
  next.possession_date = lead.possessionDate;
  next.propertyLocation = resolvedPropertyLocation;
  next.language = lead.language;
  next.languagePrefered = lead.language;
  next.languagePreferred = lead.language;
  if (lead.quoteLink !== undefined) {
    next.quoteLink = lead.quoteLink;
  }
  applyLostReasonToDetailPayload(next, lead.lostReason);
  if (lead.requirements?.length) {
    next.requirements = lead.requirements;
  }

  const prevStage = (next.stage && typeof next.stage === "object" ? next.stage : {}) as Record<string, unknown>;
  const sb = lead.stageBlock;
  next.stage = {
    ...prevStage,
    milestoneStage: sb?.milestoneStage ?? prevStage.milestoneStage,
    milestoneStageCategory: sb?.milestoneStageCategory ?? prevStage.milestoneStageCategory,
    milestoneSubStage: sb?.milestoneSubStage ?? prevStage.milestoneSubStage,
    presalesMilestoneStage: sb?.presalesMilestoneStage ?? prevStage.presalesMilestoneStage,
    presalesMilestoneCategory:
      sb?.presalesMilestoneCategory ?? prevStage.presalesMilestoneCategory,
    presalesMilestoneSubStage: sb?.presalesMilestoneSubStage ?? prevStage.presalesMilestoneSubStage,
    stage: sb?.stage ?? prevStage.stage ?? "Initial Stage",
    substage: sb?.substage ?? prevStage.substage ?? { substage: null },
  };
  if (sb?.presalesMilestoneStage) {
    next.presalesMilestoneStage = sb.presalesMilestoneStage;
  }
  if (sb?.presalesMilestoneCategory) {
    next.presalesMilestoneCategory = sb.presalesMilestoneCategory;
  }
  if (sb?.presalesMilestoneSubStage) {
    next.presalesMilestoneSubStage = sb.presalesMilestoneSubStage;
  }

  return next;
}

/**
 * Legacy `saveSecondBoxFields()` — PUT same URL but only “additional” fields (no identity/stage merge).
 * Preserves `stage`, name, phone, email, assignee, designer from `base`.
 */
export function mergeSecondBoxIntoDetail(base: Record<string, unknown>, lead: Lead): Record<string, unknown> {
  const boxLt = asCrmLeadType(lead.leadType, "formlead");
  const next = { ...base };
  const resolvedConfiguration = lead.configuration.trim() || pickConfigurationFromDetail(base, boxLt);
  const resolvedPropertyNotes = lead.propertyNotes.trim() || pickPropertyNotesFromDetail(base, boxLt);
  const resolvedPropertyLocation =
    lead.propertyLocation.trim() || pickPropertyLocationFromDetail(base);
  const resolvedMeetingType = lead.meetingType.trim() || pickMeetingTypeFromDetail(base);
  const leadForMerge: Lead = {
    ...lead,
    configuration: resolvedConfiguration,
    propertyNotes: resolvedPropertyNotes,
    propertyLocation: resolvedPropertyLocation,
    meetingType: resolvedMeetingType,
  };
  next.budget = lead.budget;
  next.leadSource = lead.leadSource;
  next.LeadSource = lead.leadSource;
  next.bookingType = lead.bookingType;
  next.booking_type = lead.bookingType;
  if (lead.additionalLeadSources !== undefined) {
    next.additionalLeadSources = lead.additionalLeadSources;
  }
  next.propertyNotes = resolvedPropertyNotes;
  next.property_detail = resolvedPropertyNotes;
  if (boxLt === "addlead") {
    next.propertyDetails = serializeAddLeadPropertyDetails(leadForMerge);
  } else {
    next.propertyDetails = mergePropertyDetailsBlock(base, leadForMerge);
  }
  mergeDynamicFieldsInterior(next, resolvedConfiguration);
  next.followUpDate = lead.followUpDate;
  next.meetingDate = lead.meetingDate;
  next.meetingVenue = lead.meetingVenue;
  next.meetingType = resolvedMeetingType;
  next.agentName = lead.agentName;
  // UI `configuration` → root `propertyType` + Jackson `interiorSetup` (DB `interior_setup`).
  next.propertyType = resolvedConfiguration;
  next.configuration = resolvedConfiguration;
  next.propertyConfiguration = resolvedConfiguration;
  next.property_configuration = resolvedConfiguration;
  next.interiorSetup = resolvedConfiguration;
  next.interior_setup = resolvedConfiguration;
  next.language = lead.language;
  next.languagePrefered = lead.language;
  next.languagePreferred = lead.language;
  if (lead.quoteLink !== undefined) {
    next.quoteLink = lead.quoteLink;
  }
  if (lead.requirements?.length) {
    next.requirements = lead.requirements;
  }
  if (boxLt === "addlead") {
    next.property_type = resolvedConfiguration;
  }
  const floorPlanValue = lead.floorPlan.trim();
  const floorPlanPublic = lead.floorPlanPublicLink?.trim() ?? "";
  if (!floorPlanValue && !floorPlanPublic) {
    next.floorPlanUrl = null;
    next.floorPlan = null;
    next.floorPlanS3Key = null;
    next.floorPlanPublicLink = null;
    next.publicUrl = null;
  } else {
    next.floorPlanUrl = floorPlanValue || floorPlanPublic;
    next.floorPlan = floorPlanValue || floorPlanPublic;
    if (floorPlanPublic) {
      next.floorPlanPublicLink = floorPlanPublic;
      next.publicUrl = floorPlanPublic;
    }
  }
  next.possession = lead.possessionDate;
  next.possessionDate = lead.possessionDate;
  next.possession_date = lead.possessionDate;
  next.propertyLocation = resolvedPropertyLocation;
  next.propertyPincode = lead.pincode;
  next.pincode = lead.pincode;
  next.pinCode = lead.pincode;
  next.propertyPin = lead.pincode;
  next.zip = lead.pincode;
  return next;
}

function mapBackendActivityType(raw: string): ActivityType {
  const u = raw.toUpperCase().replace(/\s+/g, "_");
  if (u.includes("BOOKING_TOKEN")) return "status";
  if (u.includes("DESIGN_QA_SUBMITTED") || u.includes("DESIGNQA_SUBMITTED"))
    return "design_qa_submitted";
  if (u.includes("DESIGNQA_LINK") || u.includes("DESIGN_QA_LINK")) return "design_qa_invite";
  if (u.includes("ASSIGN")) return "assignment";
  if (u.includes("NOTE")) return "note";
  if (u.includes("CALL")) return "call";
  if (u.includes("STATUS") || u.includes("STAGE") || u.includes("FIELD")) return "status";
  if (u.includes("DESIGNQA") || u.includes("DESIGN_QA")) return "note";
  return "update";
}

function formatActivityTime(iso: string | undefined): string {
  if (!iso) return "—";
  const formatted = formatCrmDateTime(iso);
  return formatted === "—" ? iso : formatted;
}

export function mapActivitiesJson(rows: unknown): ActivityItem[] {
  const activityRows = Array.isArray(rows)
    ? rows
    : Array.isArray((rows as { content?: unknown[] } | null)?.content)
      ? ((rows as { content?: unknown[] }).content ?? [])
      : Array.isArray((rows as { data?: unknown[] } | null)?.data)
        ? ((rows as { data?: unknown[] }).data ?? [])
        : Array.isArray((rows as { items?: unknown[] } | null)?.items)
          ? ((rows as { items?: unknown[] }).items ?? [])
          : [];
  if (!activityRows.length) return [];

  const mapped = activityRows.map((row, i) => {
    const r = row as Record<string, unknown>;
    const id = r.id !== undefined && r.id !== null ? String(r.id) : `act-${i}`;
    const activityType = String(
      r.activityType ?? r.type ?? r.action ?? "update",
    );
    const description =
      pickStr(r, "description") ||
      [r.fieldName, r.oldValue, r.newValue]
        .filter((x) => x !== undefined && x !== null && String(x).trim())
        .join(" → ") ||
      "—";
    const oldV = r.oldValue != null ? String(r.oldValue) : "";
    const newV = r.newValue != null ? String(r.newValue) : "";
    const change =
      oldV || newV
        ? { old: oldV || "—", new: newV || "—" }
        : undefined;

    return {
      id,
      type: mapBackendActivityType(activityType),
      timestamp: formatActivityTime(pickStr(r, "createdAt", "timestamp")),
      createdAtIso: pickStr(r, "createdAt", "timestamp"),
      description,
      by: pickStr(r, "performedBy", "performedByName", "userName") || "—",
      note: pickStr(r, "note", "comments") || undefined,
      change,
    };
  });
  return mapped.sort((a, b) => {
    const bt = b.createdAtIso ? new Date(b.createdAtIso).getTime() : 0;
    const at = a.createdAtIso ? new Date(a.createdAtIso).getTime() : 0;
    return bt - at;
  });
}
