import { asCrmLeadType, type CrmLeadType } from "@/lib/leads-filter";
import type { ActivityItem, ActivityType, Lead } from "@/lib/data";
import { parseAdditionalLeadSources } from "@/lib/lead-source-utils";
import {
  getLeadDisplayEmail,
  getLeadDisplayName,
  getLeadDisplayPhone,
  getLeadDisplayPincode,
  getLeadDisplaySource,
} from "@/lib/lead-display";
import { applyLostReasonToDetailPayload, readLostReasonFromDetail } from "@/lib/lead-lost-fields";
import { formatCrmDateTime } from "@/lib/date-time-format";

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

function pickConfigurationFromDetail(
  detail: Record<string, unknown>,
  leadType: CrmLeadType,
): string {
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

  const flat = pickStr(
    detail,
    "interior_setup",
    "interiorSetup",
    "configuration",
    "propertyConfiguration",
    "property_configuration",
    "bhk",
    "propertyType",
    "unitType",
  );
  if (flat) return flat;

  const fromBag = asPropertyDetailsObject(detail);
  if (fromBag) {
    const nested = pickStr(
      fromBag,
      "interior_setup",
      "interiorSetup",
      "configuration",
      "propertyConfiguration",
      "property_configuration",
      "bhk",
      "propertyType",
      "unitType",
    );
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
      const inner = pickStr(
        pdInDfObject,
        "interior_setup",
        "interiorSetup",
        "configuration",
        "propertyConfiguration",
        "property_configuration",
        "propertyType",
      );
      if (inner) return inner;
    }
    const directDf = pickStr(
      dfo,
      "interior_setup",
      "interiorSetup",
      "configuration",
      "propertyConfiguration",
      "property_configuration",
    );
    if (directDf) return directDf;
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

/** Property notes: never treat config/interior values as notes. */
function pickPropertyNotesFromDetail(
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

  const pd = detail.propertyDetails;
  if (typeof pd === "string" && pd.trim()) {
    const raw = pd.trim();
    // Some APIs send `propertyDetails` as a JSON string object
    // like {"propertyNotes":"...","interiorSetup":"..."}.
    // In that case, read only note-like keys instead of showing the full JSON blob.
    if (raw.startsWith("{") && raw.endsWith("}")) {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const extracted = pickStr(
          parsed,
          "propertyNotes",
          "property_detail",
          "notes",
          "description",
          "details",
        );
        if (!extracted) return "";
        return isConfigurationLikePropertyDetails(extracted, detail)
          ? ""
          : extracted;
      } catch {
        return isConfigurationLikePropertyDetails(raw, detail) ? "" : raw;
      }
    }
    // For non-JSON strings, keep this fallback only for legacy lead types.
    if (leadType === "addlead" || leadType === "mlead") {
      return isConfigurationLikePropertyDetails(raw, detail) ? "" : raw;
    }
    return "";
  }
  if (pd && typeof pd === "object" && !Array.isArray(pd)) {
    const o = pd as Record<string, unknown>;
    const picked =
      pickStr(
        o,
        "propertyNotes",
        "property_detail",
        "notes",
        "description",
        "details",
      ) || "";
    return isConfigurationLikePropertyDetails(picked, detail) ? "" : picked;
  }
  return "";
}

export function extractStage(detail: Record<string, unknown>) {
  const st = stageObj(detail);
  const substage =
    st?.substage && typeof st.substage === "object" && st.substage !== null
      ? (st.substage as { substage?: string | null }).substage
      : undefined;
  return {
    milestoneStage: (st?.milestoneStage as string | null | undefined) ?? null,
    milestoneStageCategory: (st?.milestoneStageCategory as string | null | undefined) ?? null,
    milestoneSubStage: (st?.milestoneSubStage as string | null | undefined) ?? null,
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
    floorPlan: pickStr(detail, "floorPlan", "floorplan") || "",
    possessionDate: pickStr(detail, "possessionDate", "possession", "possessionTime") || "",
    propertyLocation: pickStr(detail, "propertyLocation", "location", "address", "propertyAddress") || "",
    budget: pickScalar(detail, "budget", "budgetRange", "estimatedBudget", "leadBudget") || "",
    language: pickStr(detail, "languagePrefered", "language", "preferredLanguage") || "English",
    lostReason: readLostReasonFromDetail(detail) || "",
    quoteLink: pickStr(detail, "quoteLink", "quoteURL", "proposalLink") || "",
    designQaLink:
      pickStr(detail, "designQaLink", "design_qa_quiz_url", "designQaQuizUrl") || undefined,
    leadSource: getLeadDisplaySource({ ...detail, leadType }),
    additionalLeadSources: pickAdditionalLeadSourcesRaw(detail),
    additionalLeadSourcesList: parseAdditionalLeadSources(detail.additionalLeadSources),
    meetingType: pickStr(detail, "meetingType", "meeting") || "",
    propertyNotes: pickPropertyNotesFromDetail(detail, leadType),
    requirements,
    meetingDate: pickStr(detail, "meetingDate", "siteVisitDate") || "",
    meetingVenue: pickStr(detail, "meetingVenue", "venue") || "",
    followUpDate: pickStr(detail, "followUpDate", "nextFollowUp") || "",
    agentName: pickStr(detail, "agentName", "agent") || "",
    activities: [],
    leadType,
    stageBlock: {
      milestoneStage: st.milestoneStage,
      milestoneStageCategory: st.milestoneStageCategory,
      milestoneSubStage: st.milestoneSubStage,
      stage: st.legacyStage ?? "Initial Stage",
      substage: { substage: st.legacySubstage ?? null },
    },
  };
}

/** Merge UI Lead + existing GET body for PUT (preserves unknown backend fields). */
export function mergeLeadIntoDetail(base: Record<string, unknown>, lead: Lead): Record<string, unknown> {
  const mergedLt = asCrmLeadType(lead.leadType, "formlead");
  const next = { ...base };
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
  next.designerName = lead.designerName;
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
      name: lead.designerName,
      fullName: lead.designerName,
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
  if (lead.additionalLeadSources !== undefined) {
    next.additionalLeadSources = lead.additionalLeadSources;
  }
  next.propertyNotes = lead.propertyNotes;
  next.property_detail = lead.propertyNotes;
  next.propertyDetails = lead.propertyNotes.trim();
  next.followUpDate = lead.followUpDate;
  next.meetingDate = lead.meetingDate;
  next.meetingVenue = lead.meetingVenue;
  next.meetingType = lead.meetingType;
  next.agentName = lead.agentName;
  // Backend-confirmed mapping: UI `configuration` -> root `propertyType` (+ `interiorSetup`).
  next.propertyType = lead.configuration;
  next.configuration = lead.configuration;
  next.propertyConfiguration = lead.configuration;
  next.property_configuration = lead.configuration;
  next.interiorSetup = lead.configuration;
  next.interior_setup = lead.configuration;
  if (mergedLt === "addlead") next.property_type = lead.configuration;
  next.floorPlan = lead.floorPlan;
  next.possessionDate = lead.possessionDate;
  next.propertyLocation = lead.propertyLocation;
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
    stage: sb?.stage ?? prevStage.stage ?? "Initial Stage",
    substage: sb?.substage ?? prevStage.substage ?? { substage: null },
  };

  return next;
}

/**
 * Legacy `saveSecondBoxFields()` — PUT same URL but only “additional” fields (no identity/stage merge).
 * Preserves `stage`, name, phone, email, assignee, designer from `base`.
 */
export function mergeSecondBoxIntoDetail(base: Record<string, unknown>, lead: Lead): Record<string, unknown> {
  const boxLt = asCrmLeadType(lead.leadType, "formlead");
  const next = { ...base };
  next.budget = lead.budget;
  next.leadSource = lead.leadSource;
  next.LeadSource = lead.leadSource;
  if (lead.additionalLeadSources !== undefined) {
    next.additionalLeadSources = lead.additionalLeadSources;
  }
  next.propertyNotes = lead.propertyNotes;
  next.property_detail = lead.propertyNotes;
  next.propertyDetails = lead.propertyNotes.trim();
  next.followUpDate = lead.followUpDate;
  next.meetingDate = lead.meetingDate;
  next.meetingVenue = lead.meetingVenue;
  next.meetingType = lead.meetingType;
  next.agentName = lead.agentName;
  // Backend-confirmed mapping: UI `configuration` -> root `propertyType` (+ `interiorSetup`).
  next.propertyType = lead.configuration;
  next.configuration = lead.configuration;
  next.propertyConfiguration = lead.configuration;
  next.property_configuration = lead.configuration;
  next.interiorSetup = lead.configuration;
  next.interior_setup = lead.configuration;
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
    next.property_type = lead.configuration;
  }
  next.floorPlan = lead.floorPlan;
  next.possessionDate = lead.possessionDate;
  next.propertyLocation = lead.propertyLocation;
  next.propertyPincode = lead.pincode;
  next.pincode = lead.pincode;
  next.pinCode = lead.pincode;
  next.propertyPin = lead.pincode;
  next.zip = lead.pincode;
  return next;
}

function mapBackendActivityType(raw: string): ActivityType {
  const u = raw.toUpperCase().replace(/\s+/g, "_");
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
