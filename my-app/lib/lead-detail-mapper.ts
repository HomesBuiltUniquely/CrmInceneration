import type { CrmLeadType } from "@/lib/leads-filter";
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
    configuration: pickStr(detail, "configuration", "bhk", "propertyType", "unitType") || "",
    floorPlan: pickStr(detail, "floorPlan", "floorplan") || "",
    possessionDate: pickStr(detail, "possessionDate", "possession", "possessionTime") || "",
    propertyLocation: pickStr(detail, "propertyLocation", "location", "address", "propertyAddress") || "",
    budget: pickScalar(detail, "budget", "budgetRange", "estimatedBudget", "leadBudget") || "",
    language: pickStr(detail, "languagePrefered", "language", "preferredLanguage") || "English",
    lostReason: readLostReasonFromDetail(detail) || "",
    quoteLink: pickStr(detail, "quoteLink", "quoteURL", "proposalLink") || "",
    leadSource: getLeadDisplaySource({ ...detail, leadType }),
    additionalLeadSources: pickAdditionalLeadSourcesRaw(detail),
    additionalLeadSourcesList: parseAdditionalLeadSources(detail.additionalLeadSources),
    meetingType: pickStr(detail, "meetingType", "meeting") || "",
    propertyNotes: pickStr(detail, "propertyNotes", "propertyDetails", "notes") || "",
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
  next.propertyDetails = lead.propertyNotes;
  next.followUpDate = lead.followUpDate;
  next.meetingDate = lead.meetingDate;
  next.meetingVenue = lead.meetingVenue;
  next.meetingType = lead.meetingType;
  next.agentName = lead.agentName;
  next.configuration = lead.configuration;
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
  const next = { ...base };
  next.budget = lead.budget;
  next.leadSource = lead.leadSource;
  next.LeadSource = lead.leadSource;
  if (lead.additionalLeadSources !== undefined) {
    next.additionalLeadSources = lead.additionalLeadSources;
  }
  next.propertyNotes = lead.propertyNotes;
  next.propertyDetails = lead.propertyNotes;
  next.followUpDate = lead.followUpDate;
  next.meetingDate = lead.meetingDate;
  next.meetingVenue = lead.meetingVenue;
  next.meetingType = lead.meetingType;
  next.agentName = lead.agentName;
  next.language = lead.language;
  next.languagePrefered = lead.language;
  next.languagePreferred = lead.language;
  if (lead.quoteLink !== undefined) {
    next.quoteLink = lead.quoteLink;
  }
  if (lead.requirements?.length) {
    next.requirements = lead.requirements;
  }
  next.configuration = lead.configuration;
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
  const u = raw.toUpperCase();
  if (u.includes("ASSIGN")) return "assignment";
  if (u.includes("NOTE")) return "note";
  if (u.includes("CALL")) return "call";
  if (u.includes("STATUS") || u.includes("STAGE") || u.includes("FIELD")) return "status";
  return "update";
}

function formatActivityTime(iso: string | undefined): string {
  if (!iso) return "—";
  const formatted = formatCrmDateTime(iso);
  return formatted === "—" ? iso : formatted;
}

export function mapActivitiesJson(rows: unknown): ActivityItem[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row, i) => {
    const r = row as Record<string, unknown>;
    const id = r.id !== undefined && r.id !== null ? String(r.id) : `act-${i}`;
    const activityType = String(r.activityType ?? r.type ?? "update");
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
}
