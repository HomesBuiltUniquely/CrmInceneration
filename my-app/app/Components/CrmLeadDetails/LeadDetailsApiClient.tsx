"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lead } from "@/lib/data";
import {
  getLeadActivities,
  getLeadDetail,
  postManualActivity,
  postQuoteSend,
  postStageRollback,
  postVerifyLead,
  putLeadDetail,
} from "@/lib/lead-details-client";
import {
  detailJsonToLead,
  mapActivitiesJson,
  mergeLeadIntoDetail,
  mergeSecondBoxIntoDetail,
} from "@/lib/lead-detail-mapper";
import type { CrmLeadType } from "@/lib/leads-filter";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import TopBar from "./TopBar";
import LeadHeader from "./LeadHeader";
import DesignQaPanel from "./DesignQaPanel";
import StatsRow from "./StatsRow";
import Tabs, { type TabId } from "./Tabs";
import LeadInfoTab from "./LeadInfoTab";
import AssignmentsTab from "./AssignmentsTab";
import ActivityTimeline from "./ActivityTimeline";
import FooterActions from "./FooterActions";
import CompleteTaskModal, {
  type CompleteTaskApiPayload,
} from "./CompleteTaskModal";
import {
  createAppointment,
  type CreateAppointmentResponse,
} from "@/lib/appointment-client";
import { crmLeadTypeToApiLabel } from "@/lib/crm-lead-type-label";
import { validateDiscoveryToConnectionTransition } from "@/lib/discovery-to-connection-validation";
import { normalizeMilestoneSubStageForApi } from "@/lib/milestone-substage-map";
import {
  buildSalesClosureUrl,
  canAccessClosedLeadHeaderActions,
  isCloserStageBookingDone,
  maybeOpenSalesClosureOnWon,
} from "@/lib/sales-closure";
import { useGlobalNotifier } from "../Shared/GlobalNotifier";
import { normalizeLeadTypeLabel } from "@/lib/lead-source-utils";
import {
  CRM_ROLE_STORAGE_KEY,
  CRM_TOKEN_STORAGE_KEY,
  getAuthApiBaseUrl,
  getMe,
  getRoleFromUser,
  getSalesExecEndpointForVerify,
  normalizeRole,
  unwrapAuthUserPayload,
} from "@/lib/auth/api";
import {
  buildEmailRequest,
  sendEmailNotification,
} from "@/lib/email-request-builder";
import { formatCrmDateTime, parseCrmDateTime } from "@/lib/date-time-format";
import { fetchCrmPipeline } from "@/lib/crm-pipeline";
import type { CrmNestedStage } from "@/types/crm-pipeline";

type SalesExecutiveOption = {
  id: number;
  fullName?: string;
  username?: string;
  active?: boolean;
};

function salesExecutiveLabel(u: SalesExecutiveOption): string {
  return (u.fullName ?? u.username ?? `User ${u.id}`).trim();
}

async function fetchSalesExecutivesForPicker(
  token: string,
): Promise<SalesExecutiveOption[]> {
  const header = {
    Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
  };
  const res = await fetch(
    `${getAuthApiBaseUrl()}${getSalesExecEndpointForVerify()}`,
    { cache: "no-store", headers: header },
  );
  if (!res.ok) {
    throw new Error(`SALES_EXEC_FETCH_FAILED:${res.status}`);
  }
  const data = (await res.json()) as SalesExecutiveOption[];
  if (!Array.isArray(data)) return [];
  return data
    .filter((u) => u.active !== false)
    .sort((a, b) =>
      salesExecutiveLabel(a).localeCompare(salesExecutiveLabel(b), undefined, {
        sensitivity: "base",
      }),
    );
}

const emptyLead = (id: string, leadType: CrmLeadType): Lead => ({
  id,
  leadId: "",
  name: "—",
  customerId: "—",
  status: "—",
  createdAt: "—",
  firstCallAt: "",
  assignee: "—",
  designerName: "—",
  email: "",
  phone: "",
  altPhone: "",
  pincode: "",
  configuration: "",
  floorPlan: "",
  possessionDate: "",
  propertyLocation: "",
  budget: "",
  language: "English",
  leadSource: leadType,
  meetingType: "",
  propertyNotes: "",
  requirements: [],
  meetingDate: "",
  meetingVenue: "",
  followUpDate: "",
  agentName: "",
  activities: [],
  leadType,
  additionalLeadSources: "",
  additionalLeadSourcesList: [],
  lostReason: "",
  quoteLink: "",
  designerEmail: "",
});

type TimelineEntry = {
  key: string;
  createdAt: string;
  sourceType: string;
  name: string;
  leadType: CrmLeadType;
  leadId: string;
};
function pickCityForExternalIntake(
  lead: Lead,
  baseDetail: Record<string, unknown>,
): string {
  const dynamicFields =
    baseDetail.dynamicFields &&
    typeof baseDetail.dynamicFields === "object" &&
    !Array.isArray(baseDetail.dynamicFields)
      ? (baseDetail.dynamicFields as Record<string, unknown>)
      : {};

  const directCityCandidates = [
    baseDetail.city,
    baseDetail.City,
    baseDetail.locationCity,
    baseDetail.propertyCity,
    dynamicFields.city,
    dynamicFields.City,
    dynamicFields.locationCity,
    dynamicFields.propertyCity,
  ];

  for (const candidate of directCityCandidates) {
    if (typeof candidate === "string" && candidate.trim())
      return candidate.trim();
  }

  const location = lead.propertyLocation?.trim() ?? "";
  if (!location) return "";
  const parts = location
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : location;
}

function parseBudgetForExternalIntake(rawBudget: string): number | string {
  const cleaned = rawBudget.trim();
  if (!cleaned) return "";
  const numeric = Number(cleaned.replace(/,/g, ""));
  if (Number.isFinite(numeric)) return numeric;
  return cleaned;
}

/** Hub `external-intake` schedule fields — IANA tz per API contract. */
const EXTERNAL_INTAKE_DEFAULT_TZ =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_EXTERNAL_INTAKE_SCHEDULE_TIMEZONE?.trim()) ||
  "Asia/Kolkata";

function normalizeExternalIntakeAppointmentDate(
  raw: string,
  timeZone: string,
): string {
  const t = raw.trim();
  if (!t) return "";
  const ymd = t.match(/^(\d{4}-\d{2}-\d{2})/);
  if (ymd) return ymd[1]!;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone });
}

function formatExternalIntakeSlotRange(
  startIso: string | undefined,
  endIso: string | undefined,
  timeZone: string,
): string {
  const sIn = startIso?.trim();
  const eIn = endIso?.trim();
  if (!sIn || !eIn) return "";
  const s = new Date(sIn);
  const e = new Date(eIn);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${fmt.format(s)} – ${fmt.format(e)}`;
}

function buildExternalIntakeScheduleFromAppointment(args: {
  meetingDate: string;
  appt: CreateAppointmentResponse;
  designerName?: string;
}): {
  appointmentDate: string;
  appointmentSlot: string;
  scheduleTimezone: string;
  designerName: string;
} {
  const scheduleTimezone = EXTERNAL_INTAKE_DEFAULT_TZ;
  const appointmentDate =
    normalizeExternalIntakeAppointmentDate(
      args.meetingDate,
      scheduleTimezone,
    ) ||
    normalizeExternalIntakeAppointmentDate(
      args.appt.startTime ?? args.appt.date ?? "",
      scheduleTimezone,
    );
  const appointmentSlot =
    args.appt.slotDisplayName?.trim() ||
    formatExternalIntakeSlotRange(
      args.appt.startTime,
      args.appt.endTime,
      scheduleTimezone,
    );
  const designerName = args.designerName?.trim() ?? "";
  return { appointmentDate, appointmentSlot, scheduleTimezone, designerName };
}

async function postExternalIntakeLead(args: {
  lead: Lead;
  baseDetail: Record<string, unknown>;
  authUser?: Record<string, unknown> | null;
  /** When set (e.g. after scheduling), forwarded to Hub external-intake. */
  schedule?: {
    appointmentDate: string;
    appointmentSlot: string;
    scheduleTimezone: string;
    designerName?: string;
  };
}): Promise<void> {
  const pickText = (value: unknown): string => {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
  };
  const normalizeOptionalPersonField = (value: string): string => {
    const v = value.trim();
    if (!v) return "";
    if (/^[-–—]+$/.test(v)) return "";
    const token = v.toLowerCase().replace(/[\s._\-–—/]+/g, "");
    if (
      !token ||
      token === "na" ||
      token === "none" ||
      token === "null" ||
      token === "undefined" ||
      token === "notassigned" ||
      token === "unassigned" ||
      token === "unknown"
    ) {
      return "";
    }
    return v;
  };
  const pickUserLikeName = (value: unknown): string => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    const row = value as Record<string, unknown>;
    return (
      pickText(row.fullName) ||
      pickText(row.name) ||
      pickText(row.displayName) ||
      pickText(row.username)
    );
  };
  const pickUserLikeEmail = (value: unknown): string => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";
    const row = value as Record<string, unknown>;
    return (
      pickText(row.email) ||
      pickText(row.mail) ||
      pickText(row.emailAddress) ||
      pickText(row.workEmail)
    );
  };
  const isLikelyEmail = (value: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const normalizeExternalLeadId = (value: string): string => {
    const compactHyphen = value.replace(/\s*-\s*/g, "-");
    const noSpaces = compactHyphen.replace(/\s+/g, "");
    return noSpaces.trim().toUpperCase();
  };

  const idCandidates: Array<{ source: string; value: string }> = [
    { source: "baseDetail.externalLeadId", value: pickText(args.baseDetail.externalLeadId) },
    { source: "baseDetail.leadId", value: pickText(args.baseDetail.leadId) },
    { source: "baseDetail.id", value: pickText(args.baseDetail.id) },
    { source: "baseDetail.customerId", value: pickText(args.baseDetail.customerId) },
  ];
  const chosen = idCandidates.find((c) => c.value);
  const externalLeadId = chosen ? normalizeExternalLeadId(chosen.value) : "";
  const payload: Record<string, unknown> = {
    projectName:
      pickText(args.baseDetail.fullName) ||
      pickText(args.baseDetail.customerName) ||
      pickText(args.baseDetail.name),
    contactNo:
      pickText(args.baseDetail.phone) ||
      pickText(args.baseDetail.phoneNumber) ||
      pickText(args.baseDetail.mobile),
    clientEmail:
      pickText(args.baseDetail.email) ||
      pickText(args.baseDetail.emailAddress) ||
      pickText(args.baseDetail.mail),
    externalLeadId,
    sourceProject: "crm-inceneration",
    designerName: "",
    salesExecutive: "",
    salesExecutiveEmail: "",
  };
  const resolvedDesignerName = normalizeOptionalPersonField(
    pickText(args.schedule?.designerName) ||
      pickText(args.lead.designerName) ||
      pickText(args.baseDetail.designerName) ||
      pickText(args.baseDetail.designer) ||
      pickUserLikeName(args.baseDetail.designer) ||
      pickUserLikeName(args.baseDetail.interiorDesigner),
  );
  payload.designerName = resolvedDesignerName;
  const salesExecutive = normalizeOptionalPersonField(
    pickText(args.lead.assignee) ||
    pickText(args.baseDetail.assignedTo) ||
    pickText(args.baseDetail.assignee) ||
    pickText(args.baseDetail.salesOwnerName) ||
    pickText(args.baseDetail.ownerName) ||
    pickUserLikeName(args.baseDetail.assignee) ||
    pickUserLikeName(args.baseDetail.assignedTo) ||
    pickUserLikeName(args.baseDetail.salesOwner) ||
    pickUserLikeName(args.baseDetail.owner) ||
    pickUserLikeName(args.baseDetail.salesExecutive) ||
    pickText(args.authUser?.fullName) ||
    pickText(args.authUser?.name) ||
    pickText(args.authUser?.username),
  );
  payload.salesExecutive = salesExecutive;
  const salesExecutiveEmailCandidate = normalizeOptionalPersonField(
    pickText((args.baseDetail.assignee as Record<string, unknown> | undefined)?.email) ||
    pickText((args.baseDetail.assignedTo as Record<string, unknown> | undefined)?.email) ||
    pickText((args.baseDetail.salesOwner as Record<string, unknown> | undefined)?.email) ||
    pickText((args.baseDetail.owner as Record<string, unknown> | undefined)?.email) ||
    pickUserLikeEmail(args.baseDetail.assignee) ||
    pickUserLikeEmail(args.baseDetail.assignedTo) ||
    pickUserLikeEmail(args.baseDetail.salesOwner) ||
    pickUserLikeEmail(args.baseDetail.owner) ||
    pickUserLikeEmail(args.baseDetail.salesExecutive) ||
    pickText(args.authUser?.email) ||
    pickText(args.authUser?.mail) ||
    pickText(args.authUser?.emailAddress) ||
    pickText(args.authUser?.workEmail),
  );
  payload.salesExecutiveEmail =
    salesExecutiveEmailCandidate && isLikelyEmail(salesExecutiveEmailCandidate)
      ? salesExecutiveEmailCandidate
      : "";

  if (args.schedule) {
    const {
      appointmentDate,
      appointmentSlot,
      scheduleTimezone,
      designerName,
    } = args.schedule;
    if (appointmentDate) payload.appointmentDate = appointmentDate;
    if (appointmentSlot) payload.appointmentSlot = appointmentSlot;
    if (scheduleTimezone) payload.scheduleTimezone = scheduleTimezone;
    const scheduleDesignerName = normalizeOptionalPersonField(designerName?.trim() || "");
    if (scheduleDesignerName) payload.designerName = scheduleDesignerName;
  }

  if (!payload.externalLeadId) {
    console.warn(
      "Skipping external intake: no externalLeadId found.",
      {
        idCandidates,
        customerId: args.baseDetail.customerId ?? null,
        baseDetailKeys: Object.keys(args.baseDetail),
      },
    );
    return;
  }

  console.info("External intake id mapping", {
    selectedSource: chosen?.source ?? null,
    externalLeadId: payload.externalLeadId,
    hasDesignerName: Boolean(
      typeof payload.designerName === "string" && payload.designerName.trim(),
    ),
    hasSalesExecutive: Boolean(
      typeof payload.salesExecutive === "string" && payload.salesExecutive.trim(),
    ),
    hasSalesExecutiveEmail: Boolean(
      typeof payload.salesExecutiveEmail === "string" &&
        payload.salesExecutiveEmail.trim(),
    ),
  });

  const res = await fetch("/api/crm/external-intake", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(
      `External intake failed (${res.status})${msg ? `: ${msg}` : ""}`,
    );
  }
} 

const SOURCE_LABELS: Record<CrmLeadType, string> = {
  formlead: "External Lead",
  glead: "Google Ads",
  mlead: "Meta Ads",
  addlead: "Add Lead",
  websitelead: "Website Lead",
};

function parseDateLoose(input: unknown): Date | null {
  return parseCrmDateTime(input);
}

function formatTimelineDate(input: string): string {
  const formatted = formatCrmDateTime(input);
  return formatted === "—" ? "Unknown date" : formatted;
}

function relativeDayText(input: string): string {
  const dt = parseDateLoose(input);
  if (!dt) return "some day";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const diffDays = Math.floor(
    (today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
}

function buildTimelineLabel(entry: TimelineEntry): string {
  return `${relativeDayText(entry.createdAt)} it came on ${formatTimelineDate(entry.createdAt)} in ${entry.sourceType} as ${entry.name}`;
}

function parseSourceTypeFromDescription(description: unknown): string | null {
  if (typeof description !== "string") return null;
  const text = description.trim();
  if (!text) return null;
  const match = text.match(/\breceived\s+from\s+(.+?)(?:\s+as\s+|$)/i);
  if (!match?.[1]) return null;
  const parsed = match[1].trim().replace(/[.,;:]$/, "");
  return parsed ? normalizeLeadTypeLabel(parsed) : null;
}

function parseNameFromDescription(description: unknown): string | null {
  if (typeof description !== "string") return null;
  const text = description.trim();
  if (!text) return null;
  const match = text.match(/\bfor\s+(.+?)(?:[.!,;:]|$)/i);
  if (!match?.[1]) return null;
  const parsed = match[1].trim().replace(/[.,;:]$/, "");
  return parsed || null;
}

function truncateLabel(label: string, max = 80): string {
  if (label.length <= max) return label;
  return `${label.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function isClosedWonBookingDone(stageBlock: Lead["stageBlock"] | undefined): boolean {
  return (
    (stageBlock?.milestoneStage ?? "").trim() === "Closed" &&
    (stageBlock?.milestoneStageCategory ?? "").trim() === "Closed Won" &&
    (stageBlock?.milestoneSubStage ?? "").trim() === "Booking Done (Booking)"
  );
}

function readTextValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function readNumberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mapMilestoneValidationError(error: unknown): string {
  const fallback = "Booking Done is allowed only under Closed Won.";
  const text = error instanceof Error ? error.message.trim() : "";
  if (!text) return fallback;
  const lower = text.toLowerCase();
  if (!lower.includes("400") && !lower.includes("bad request")) return text;
  if (lower.includes("booking") || lower.includes("closed won")) {
    return "Please choose Closed -> Closed Won before selecting Booking Done.";
  }
  return fallback;
}

const SALES_CLOSURE_PENDING_KEY = "crm_sales_closure_pending_booking_done";

type PendingSalesClosureState = {
  leadId: string;
  leadType: CrmLeadType;
  previousStage: Lead["stageBlock"];
};

export default function LeadDetailsApiClient({
  leadType: leadTypeParam,
  leadId,
}: {
  leadType: string;
  leadId: string;
}) {
  const validLeadType = isCrmLeadType(leadTypeParam);
  const leadType = leadTypeParam as CrmLeadType;

  const [activeTab, setActiveTab] = useState<TabId>("lead");
  const [completeTaskOpen, setCompleteTaskOpen] = useState(false);
  const [designQaOpen, setDesignQaOpen] = useState(false);
  const [loading, setLoading] = useState(validLeadType);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [secondBoxError, setSecondBoxError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingSecondBox, setSavingSecondBox] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyPincode, setVerifyPincode] = useState("");
  /** Selected sales executive user id as string; empty = do not send assignment. */
  const [verifySalesExecutiveId, setVerifySalesExecutiveId] = useState("");
  const [salesExecutiveOptions, setSalesExecutiveOptions] = useState<
    SalesExecutiveOption[]
  >([]);
  const [salesExecutivesLoading, setSalesExecutivesLoading] = useState(false);
  const [salesExecutivesError, setSalesExecutivesError] = useState<
    string | null
  >(null);
  const [canVerifyRole, setCanVerifyRole] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackBusy, setRollbackBusy] = useState(false);
  const [rollbackError, setRollbackError] = useState("");
  const [rollbackStages, setRollbackStages] = useState<CrmNestedStage[]>([]);
  const [rollbackStage, setRollbackStage] = useState("");
  const [rollbackCategory, setRollbackCategory] = useState("");
  const [rollbackSubStage, setRollbackSubStage] = useState("");
  const [rollbackReason, setRollbackReason] = useState("");
  const [quoteSending, setQuoteSending] = useState(false);
  const [quoteSubject, setQuoteSubject] = useState(
    "Your quote from Hub Interior",
  );
  const [quoteBody, setQuoteBody] = useState("");
  const [createdTimelineOptions, setCreatedTimelineOptions] = useState<
    Array<{
      value: string;
      label: string;
      fullLabel: string;
      leadType: CrmLeadType;
      leadId: string;
    }>
  >([]);
  const [createdTimelineLoading, setCreatedTimelineLoading] = useState(false);
  const [selectedTimelineValue, setSelectedTimelineValue] = useState("");
  const [lead, setLead] = useState<Lead>(() =>
    emptyLead(leadId, validLeadType ? leadType : "formlead"),
  );
  const [baseDetail, setBaseDetail] = useState<Record<string, unknown>>({});
  const [closureReturnHandled, setClosureReturnHandled] = useState(false);
  const { notifySuccess, notifyError, notifyInfo } = useGlobalNotifier();

  const loadCreatedTimeline = useCallback(
    async (detailJson: Record<string, unknown>, activitiesJson: unknown) => {
      await buildCreatedTimeline(detailJson, activitiesJson);
    },
    [leadId, leadType, validLeadType],
  );

  const load = useCallback(async () => {
    if (!isCrmLeadType(leadTypeParam)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const lt = leadTypeParam as CrmLeadType;
      const detailJson = await getLeadDetail(lt, leadId);
      setBaseDetail(detailJson);
      const mapped = detailJsonToLead(detailJson, lt);
      setLead((prev) => ({ ...mapped, id: leadId, activities: prev.activities }));
      setLoading(false);
      void getLeadActivities(lt, leadId)
        .then((actJson) => {
          const activities = mapActivitiesJson(actJson);
          setLead((prev) => ({ ...prev, activities }));
          return loadCreatedTimeline(detailJson, actJson);
        })
        .catch(() => loadCreatedTimeline(detailJson, []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load lead");
      setLead(emptyLead(leadId, leadTypeParam as CrmLeadType));
      setLoading(false);
    }
  }, [leadId, leadTypeParam]);

  useEffect(() => {
    if (!validLeadType) {
      setLoading(false);
      return;
    }
    void load();
  }, [load, validLeadType]);

  const [salesClosureAuthUser, setSalesClosureAuthUser] = useState<
    Record<string, unknown> | null
  >(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const roleKey = normalizeRole(
      window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "",
    );
    setCanVerifyRole(roleKey === "PRESALES_EXECUTIVE");
    setIsSuperAdmin(roleKey === "SUPER_ADMIN");
  }, []);

  useEffect(() => {
    if (!salesClosureAuthUser) return;
    const roleKey = normalizeRole(getRoleFromUser(salesClosureAuthUser));
    setCanVerifyRole(roleKey === "PRESALES_EXECUTIVE");
    setIsSuperAdmin(roleKey === "SUPER_ADMIN");
  }, [salesClosureAuthUser]);

  useEffect(() => {
    if (!validLeadType || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(CRM_TOKEN_STORAGE_KEY) ?? "";
    const token = raw.trim();
    if (!token) {
      setSalesClosureAuthUser(null);
      return;
    }
    let cancelled = false;
    void getMe(token.startsWith("Bearer ") ? token : `Bearer ${token}`)
      .then((data) => {
        if (!cancelled) setSalesClosureAuthUser(unwrapAuthUserPayload(data));
      })
      .catch(() => {
        if (!cancelled) setSalesClosureAuthUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [validLeadType]);

  useEffect(() => {
    if (!verifyModalOpen) return;
    let cancelled = false;
    const token =
      typeof window !== "undefined"
        ? (window.localStorage.getItem(CRM_TOKEN_STORAGE_KEY) ?? "")
        : "";
    if (!token.trim()) {
      setSalesExecutiveOptions([]);
      setSalesExecutivesError("You don't have access to this resource.");
      return;
    }
    setSalesExecutivesLoading(true);
    setSalesExecutivesError(null);
    void fetchSalesExecutivesForPicker(token)
      .then((list) => {
        if (!cancelled) {
          setSalesExecutiveOptions(list);
          setSalesExecutivesError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setSalesExecutiveOptions([]);
          const msg = e instanceof Error ? e.message : "";
          if (msg.includes("SALES_EXEC_FETCH_FAILED:403")) {
            setSalesExecutivesError("You don't have access to this resource.");
            console.warn("Sales executive picker permission denied (403).");
          } else {
            setSalesExecutivesError(
              "Could not load the list. You can still verify with pincode only.",
            );
          }
        }
      })
      .finally(() => {
        if (!cancelled) setSalesExecutivesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [verifyModalOpen]);

  const patchLead = useCallback((patch: Partial<Lead>) => {
    setLead((prev) => ({ ...prev, ...patch }));
  }, []);

  async function buildCreatedTimeline(
    detailJson: Record<string, unknown>,
    activitiesJson: unknown,
  ) {
    if (!validLeadType) return;
    setCreatedTimelineLoading(true);
    const entries: TimelineEntry[] = [];
    let fallbackCreatedAt = "";
    let fallbackName = "Unknown";
    try {
      const currentCreatedAt =
        typeof detailJson.createdAt === "string" && detailJson.createdAt.trim()
          ? detailJson.createdAt.trim()
          : "";
      const currentName =
        (typeof detailJson.name === "string" && detailJson.name.trim()) ||
        (typeof detailJson.fullName === "string" && detailJson.fullName.trim()) ||
        (
          (detailJson.dynamicFields as Record<string, unknown> | undefined)
            ?.customerName as string | undefined
        )?.trim() ||
        "" ||
        "Unknown";

      fallbackCreatedAt = currentCreatedAt;
      fallbackName = currentName;

      if (currentCreatedAt) {
        entries.push({
          key: `original:${leadType}:${leadId}:${currentCreatedAt}`,
          createdAt: currentCreatedAt,
          sourceType: SOURCE_LABELS[leadType],
          name: currentName,
          leadType,
          leadId,
        });
      }

      const activityRows = Array.isArray(activitiesJson)
        ? activitiesJson
        : Array.isArray((activitiesJson as { content?: unknown[] } | null)?.content)
          ? ((activitiesJson as { content?: unknown[] }).content ?? [])
          : [];

      for (let idx = 0; idx < activityRows.length; idx++) {
        const row = activityRows[idx];
        const item = row as Record<string, unknown>;
        const type = String(item.activityType ?? "").toUpperCase();
        if (type !== "REINQUIRY_RECEIVED" && type !== "DUPLICATE_RECEIVED")
          continue;

        const createdAt =
          typeof item.createdAt === "string" ? item.createdAt.trim() : "";
        if (!createdAt) continue;

        const sourceType =
          parseSourceTypeFromDescription(item.description) ??
          SOURCE_LABELS[leadType];
        const name = parseNameFromDescription(item.description) ?? currentName;
        entries.push({
          key: `${type}:${createdAt}:${idx}`,
          createdAt,
          sourceType,
          name,
          leadType,
          leadId,
        });
      }
    } catch {
      // keep fallback and avoid page failure
    } finally {
      const dedup = new Map<string, TimelineEntry>();
      for (const entry of entries) {
        const dedupKey = `${entry.createdAt}|${entry.sourceType.toLowerCase()}|${entry.name.toLowerCase()}`;
        if (!dedup.has(dedupKey)) dedup.set(dedupKey, entry);
      }
      const sorted = [...dedup.values()].sort((a, b) => {
        const bt = parseDateLoose(b.createdAt)?.getTime() ?? 0;
        const at = parseDateLoose(a.createdAt)?.getTime() ?? 0;
        return bt - at;
      });
      const options = sorted.length
        ? sorted.map((entry) => ({
            value: entry.key,
            fullLabel: buildTimelineLabel(entry),
            label: truncateLabel(buildTimelineLabel(entry)),
            leadType: entry.leadType,
            leadId: entry.leadId,
          }))
        : [
            {
              value: `fallback:${leadType}:${leadId}`,
              fullLabel: `${relativeDayText(fallbackCreatedAt)} it came on ${formatTimelineDate(
                fallbackCreatedAt,
              )} in ${SOURCE_LABELS[leadType]} as ${fallbackName}`,
              label: truncateLabel(
                `${relativeDayText(fallbackCreatedAt)} it came on ${formatTimelineDate(fallbackCreatedAt)} in ${
                  SOURCE_LABELS[leadType]
                } as ${fallbackName}`,
              ),
              leadType,
              leadId,
            },
          ];
      setCreatedTimelineOptions(options);
      setSelectedTimelineValue(options[0]?.value ?? "");
      setCreatedTimelineLoading(false);
    }
  }

  useEffect(() => {
    if (!rollbackOpen) return;
    let cancelled = false;
    setRollbackError("");
    setRollbackReason("");
    setRollbackStage(lead.stageBlock?.milestoneStage?.trim() ?? "");
    setRollbackCategory(lead.stageBlock?.milestoneStageCategory?.trim() ?? "");
    setRollbackSubStage(lead.stageBlock?.milestoneSubStage?.trim() ?? "");
    void fetchCrmPipeline({ nested: true })
      .then((pipeline) => {
        if (cancelled) return;
        setRollbackStages(pipeline.nested ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setRollbackStages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [
    lead.stageBlock?.milestoneStage,
    lead.stageBlock?.milestoneStageCategory,
    lead.stageBlock?.milestoneSubStage,
    rollbackOpen,
  ]);

  const rollbackCategories = useMemo(() => {
    const selected = rollbackStages.find(
      (stage) => stage.stage.trim() === rollbackStage.trim(),
    );
    return selected?.categories ?? [];
  }, [rollbackStage, rollbackStages]);

  const rollbackSubStages = useMemo(() => {
    const selected = rollbackCategories.find(
      (cat) => cat.stageCategory.trim() === rollbackCategory.trim(),
    );
    return selected?.subStages ?? [];
  }, [rollbackCategories, rollbackCategory]);

  useEffect(() => {
    if (!rollbackStage.trim()) {
      setRollbackCategory("");
      setRollbackSubStage("");
      return;
    }
    if (
      rollbackCategory.trim() &&
      rollbackCategories.every(
        (cat) => cat.stageCategory.trim() !== rollbackCategory.trim(),
      )
    ) {
      setRollbackCategory("");
      setRollbackSubStage("");
    }
  }, [rollbackCategories, rollbackCategory, rollbackStage]);

  useEffect(() => {
    if (!rollbackCategory.trim()) {
      setRollbackSubStage("");
      return;
    }
    if (
      rollbackSubStage.trim() &&
      !rollbackSubStages.some((sub) => sub.trim() === rollbackSubStage.trim())
    ) {
      setRollbackSubStage("");
    }
  }, [rollbackCategory, rollbackSubStage, rollbackSubStages]);

  const viewerRoleKey = useMemo(() => {
    if (salesClosureAuthUser) {
      return normalizeRole(getRoleFromUser(salesClosureAuthUser));
    }
    if (typeof window !== "undefined") {
      return normalizeRole(
        window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "",
      );
    }
    return "";
  }, [salesClosureAuthUser]);

  const canClosedLeadHeader = useMemo(
    () => canAccessClosedLeadHeaderActions(viewerRoleKey),
    [viewerRoleKey],
  );

  const salesClosureHref = useMemo(() => {
    if (!canClosedLeadHeader) return undefined;
    if (typeof window === "undefined") return undefined;
    if (!isCloserStageBookingDone(lead)) return undefined;
    return buildSalesClosureUrl({
      leadId,
      leadTypeLabel: crmLeadTypeToApiLabel(leadType),
      returnUrl: window.location.href,
      lead,
      authUser: salesClosureAuthUser,
    });
  }, [canClosedLeadHeader, lead, leadId, leadType, salesClosureAuthUser]);

  const buildStrictSalesClosureUrl = useCallback(() => {
    const currentLeadId = lead.leadId?.trim() || leadId;
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set("salesClosureReturned", "1");
    return buildSalesClosureUrl({
      leadId: currentLeadId,
      leadTypeLabel: crmLeadTypeToApiLabel(leadType),
      returnUrl: returnUrl.toString(),
      lead,
      authUser: salesClosureAuthUser,
    });
  }, [lead, leadId, leadType, salesClosureAuthUser]);

  const redirectToStrictSalesClosure = useCallback(
    (previousStage: Lead["stageBlock"]) => {
      if (!canClosedLeadHeader) {
        notifyError(
          "Sales closure is not available for Admin or Sales Admin. Use a sales role to complete closure.",
        );
        return;
      }
      const payload: PendingSalesClosureState = {
        leadId,
        leadType,
        previousStage,
      };
      window.sessionStorage.setItem(SALES_CLOSURE_PENDING_KEY, JSON.stringify(payload));
      window.location.href = buildStrictSalesClosureUrl();
    },
    [buildStrictSalesClosureUrl, canClosedLeadHeader, leadId, leadType, notifyError],
  );

  useEffect(() => {
    if (!validLeadType || loading || closureReturnHandled) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const returned = params.get("salesClosureReturned") === "1";
    if (!returned) return;
    setClosureReturnHandled(true);

    const completedRaw = (params.get("salesClosureCompleted") ?? "").toLowerCase();
    const completed =
      completedRaw === "1" || completedRaw === "true" || completedRaw === "yes";
    const pendingRaw = window.sessionStorage.getItem(SALES_CLOSURE_PENDING_KEY);
    const clearReturnParams = () => {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("salesClosureReturned");
      cleanUrl.searchParams.delete("salesClosureCompleted");
      window.history.replaceState({}, "", cleanUrl.toString());
    };
    if (!pendingRaw) {
      clearReturnParams();
      return;
    }

    let pending: PendingSalesClosureState | null = null;
    try {
      pending = JSON.parse(pendingRaw) as PendingSalesClosureState;
    } catch {
      window.sessionStorage.removeItem(SALES_CLOSURE_PENDING_KEY);
      clearReturnParams();
      return;
    }
    if (!pending || pending.leadId !== leadId || pending.leadType !== leadType) {
      clearReturnParams();
      return;
    }

    if (completed) {
      window.sessionStorage.removeItem(SALES_CLOSURE_PENDING_KEY);
      notifySuccess("Sales Closure completed. Lead remains in Booking Done.");
      clearReturnParams();
      return;
    }

    const previousStage = pending.previousStage;
    if (!previousStage) {
      window.sessionStorage.removeItem(SALES_CLOSURE_PENDING_KEY);
      notifyError("Lead moved back because Sales Closure is pending.");
      clearReturnParams();
      return;
    }

    const lt = leadTypeParam as CrmLeadType;
    const revertedLead: Lead = {
      ...lead,
      stageBlock: previousStage,
      status: previousStage.milestoneSubStage?.trim() || lead.status,
    };
    const revertBody = mergeLeadIntoDetail(baseDetail, revertedLead);
    void putLeadDetail(lt, leadId, revertBody)
      .then((updated) => {
        setBaseDetail(updated);
        setLead((prev) => ({
          ...detailJsonToLead(updated, lt),
          id: leadId,
          activities: prev.activities,
        }));
        notifyError("Lead moved back because Sales Closure is pending.");
      })
      .catch(() => {
        notifyError("Please complete Sales Closure form to keep this lead in Booking Done.");
      })
      .finally(() => {
        window.sessionStorage.removeItem(SALES_CLOSURE_PENDING_KEY);
        clearReturnParams();
      });
  }, [
    baseDetail,
    closureReturnHandled,
    lead,
    leadId,
    leadType,
    leadTypeParam,
    loading,
    notifyError,
    notifySuccess,
    validLeadType,
  ]);

  const refreshActivities = useCallback(async () => {
    if (!validLeadType) return;
    const lt = leadTypeParam as CrmLeadType;
    try {
      const actJson = await getLeadActivities(lt, leadId);
      setLead((prev) => ({ ...prev, activities: mapActivitiesJson(actJson) }));
    } catch {
      /* ignore */
    }
  }, [leadId, leadTypeParam, validLeadType]);

  const refreshLeadAfterSalesClosure = useCallback(() => {
    notifyInfo("Refreshing latest lead updates...");
    void load();
    void refreshActivities();
  }, [load, notifyInfo, refreshActivities]);

  const maybeOpenSalesClosureAfterWon = useCallback(
    (statusCandidates: unknown[]) => {
      if (typeof window === "undefined") return;
      maybeOpenSalesClosureOnWon({
        statusCandidates,
        currentUser: salesClosureAuthUser,
        openUrl: buildSalesClosureUrl({
          leadId: lead.leadId?.trim() || leadId,
          leadTypeLabel: crmLeadTypeToApiLabel(leadType),
          returnUrl: window.location.href,
          lead,
          authUser: salesClosureAuthUser,
        }),
        onReturnRefresh: refreshLeadAfterSalesClosure,
      });
    },
    [
      lead,
      leadId,
      leadType,
      refreshLeadAfterSalesClosure,
      salesClosureAuthUser,
    ],
  );

  const handleSave = useCallback(async () => {
    if (!validLeadType) return;
    if (!leadId.trim()) {
      setSaveError("Lead ID is required.");
      return;
    }
    if (!lead.stageBlock?.milestoneStage?.trim()) {
      setSaveError("Please select a milestone stage.");
      return;
    }
    if (!lead.stageBlock?.milestoneStageCategory?.trim()) {
      setSaveError("Please select a milestone category.");
      return;
    }
    if (!lead.stageBlock?.milestoneSubStage?.trim()) {
      setSaveError("Please select a milestone sub-stage.");
      return;
    }
    const bookingAmountCandidate = readNumberValue(
      baseDetail.bookingAmount ?? baseDetail.booking_value,
    );
    if (bookingAmountCandidate !== null && bookingAmountCandidate <= 0) {
      setSaveError("Booking amount must be greater than 0.");
      return;
    }

    const previousLead = lead;
    if (isClosedWonBookingDone(previousLead.stageBlock)) {
      if (!canClosedLeadHeader) {
        notifyError(
          "Sales closure is not available for Admin or Sales Admin accounts.",
        );
        return;
      }
      notifyError("Please complete Sales Closure form to keep this lead in Booking Done.");
      redirectToStrictSalesClosure(previousLead.stageBlock);
      return;
    }
    const lt = leadTypeParam as CrmLeadType;
    setSaving(true);
    setSaveError(null);
    try {
      const body = mergeLeadIntoDetail(baseDetail, lead);
      const updated = await putLeadDetail(lt, leadId, body);
      setBaseDetail(updated);
      const mapped = detailJsonToLead(updated, lt);
      setLead((prev) => ({
        ...mapped,
        id: leadId,
        activities: prev.activities,
      }));
      maybeOpenSalesClosureAfterWon([
        lead.status,
        lead.stageBlock?.milestoneStage,
        lead.stageBlock?.milestoneSubStage,
        body.status,
        (body.stageBlock as Record<string, unknown> | undefined)?.milestoneStage,
        (body.stageBlock as Record<string, unknown> | undefined)?.milestoneSubStage,
        updated.status,
        updated.milestoneStage,
        updated.milestoneSubStage,
      ]);
    } catch (e) {
      setLead(previousLead);
      setSaveError(mapMilestoneValidationError(e));
    } finally {
      setSaving(false);
    }
  }, [
    baseDetail,
    lead,
    leadId,
    leadTypeParam,
    maybeOpenSalesClosureAfterWon,
    canClosedLeadHeader,
    notifyError,
    redirectToStrictSalesClosure,
    validLeadType,
  ]);

  const handleOpenVerify = useCallback(() => {
    setVerifyPincode((lead.pincode ?? "").trim());
    setVerifySalesExecutiveId("");
    setVerifyModalOpen(true);
  }, [lead.pincode]);

  const handleSaveSecondBox = useCallback(async () => {
    if (!validLeadType) return;
    const lt = leadTypeParam as CrmLeadType;
    setSavingSecondBox(true);
    setSecondBoxError(null);
    try {
      const body = mergeLeadIntoDetail(baseDetail, lead);
      const updated = await putLeadDetail(lt, leadId, body);
      setBaseDetail(updated);
      const mapped = detailJsonToLead(updated, lt);
      setLead((prev) => ({
        ...mapped,
        id: leadId,
        activities: prev.activities,
      }));
      notifySuccess("Additional info saved.");
      maybeOpenSalesClosureAfterWon([
        lead.status,
        lead.stageBlock?.milestoneStage,
        lead.stageBlock?.milestoneSubStage,
        body.status,
        (body.stageBlock as Record<string, unknown> | undefined)?.milestoneStage,
        (body.stageBlock as Record<string, unknown> | undefined)?.milestoneSubStage,
        updated.status,
        updated.milestoneStage,
        updated.milestoneSubStage,
      ]);
    } catch (e) {
      setSecondBoxError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingSecondBox(false);
    }
  }, [
    baseDetail,
    lead,
    leadId,
    leadTypeParam,
    maybeOpenSalesClosureAfterWon,
    validLeadType,
    notifySuccess,
  ]);

  const handleVerify = useCallback(async () => {
    if (!validLeadType) return;
    const pincode = verifyPincode.trim();
    if (!pincode) {
      notifyError("Pincode is required to verify this lead.");
      return;
    }

    const payload: Record<string, unknown> = { pincode };
    const salesExecutiveId = Number(verifySalesExecutiveId);
    if (Number.isFinite(salesExecutiveId) && salesExecutiveId > 0) {
      payload.salesExecutiveId = salesExecutiveId;
    }

    const lt = leadTypeParam as CrmLeadType;
    setVerifying(true);
    try {
      const raw = await postVerifyLead(lt, leadId, payload);
      const resObj =
        raw && typeof raw === "object" && !Array.isArray(raw)
          ? (raw as Record<string, unknown>)
          : null;
      const baseMsg =
        resObj && typeof resObj.message === "string" && resObj.message.trim()
          ? resObj.message.trim()
          : "Lead verified successfully.";
      const assigned =
        resObj && typeof resObj.assignedTo === "string" && resObj.assignedTo.trim()
          ? ` Assigned to ${String(resObj.assignedTo).trim()}.`
          : "";
      notifySuccess(`${baseMsg}${assigned}`);
      setVerifyModalOpen(false);
      await load();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Verify failed");
    } finally {
      setVerifying(false);
    }
  }, [
    leadId,
    leadTypeParam,
    load,
    notifyError,
    notifySuccess,
    validLeadType,
    verifyPincode,
    verifySalesExecutiveId,
  ]);

  const handleSendQuote = useCallback(async () => {
    if (!validLeadType) return;
    const lt = leadTypeParam as CrmLeadType;
    const link = lead.quoteLink?.trim();
    if (!link) {
      notifyError("Add a quote link on the lead before sending.");
      return;
    }
    if (!lead.email?.trim()) {
      notifyError("Lead email is required to send a quote.");
      return;
    }
    setQuoteSending(true);
    try {
      const fd = new FormData();
      fd.append("quoteLink", link);
      fd.append("toEmail", lead.email.trim());
      fd.append("subject", quoteSubject.trim() || "Quote");
      fd.append(
        "body",
        quoteBody.trim() || "Please find your quote linked below.",
      );
      fd.append("leadId", String(leadId));
      fd.append("leadType", crmLeadTypeToApiLabel(lt));
      const res = (await postQuoteSend(fd)) as {
        success?: boolean;
        message?: string;
      };
      const ok = res && typeof res === "object" && res.success !== false;
      const message =
        typeof res === "object" &&
        res !== null &&
        typeof res.message === "string"
          ? res.message
          : ok
            ? "Quote sent."
            : "Quote send failed";
      if (ok) notifySuccess(message);
      else notifyError(message);
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Quote send failed");
    } finally {
      setQuoteSending(false);
    }
  }, [
    lead.email,
    lead.quoteLink,
    leadId,
    leadTypeParam,
    quoteBody,
    quoteSubject,
    validLeadType,
  ]);

  const handleStageRollback = useCallback(async () => {
    if (!validLeadType || !isSuperAdmin) return;
    const toMilestoneStage = rollbackStage.trim();
    const toMilestoneStageCategory = rollbackCategory.trim();
    const toMilestoneSubStage = rollbackSubStage.trim();
    const reason = rollbackReason.trim();
    const currentStage = lead.stageBlock?.milestoneStage?.trim() ?? "";
    const currentCategory =
      lead.stageBlock?.milestoneStageCategory?.trim() ?? "";
    const currentSubStage = lead.stageBlock?.milestoneSubStage?.trim() ?? "";

    if (
      !toMilestoneStage ||
      !toMilestoneStageCategory ||
      !toMilestoneSubStage
    ) {
      setRollbackError("Select stage, category, and sub-stage.");
      return;
    }
    if (reason.length < 5) {
      setRollbackError("Reason is required (minimum 5 characters).");
      return;
    }
    if (
      currentStage === toMilestoneStage &&
      currentCategory === toMilestoneStageCategory &&
      currentSubStage === toMilestoneSubStage
    ) {
      setRollbackError(
        "Target milestone must be different from current milestone.",
      );
      return;
    }

    setRollbackBusy(true);
    setRollbackError("");
    try {
      await postStageRollback(leadTypeParam as CrmLeadType, leadId, {
        toMilestoneStage,
        toMilestoneStageCategory,
        toMilestoneSubStage,
        reason,
      });
      notifySuccess("Stage rollback completed.");
      setRollbackOpen(false);
      await load();
      await refreshActivities();
    } catch (e) {
      setRollbackError(
        e instanceof Error ? e.message : "Stage rollback failed.",
      );
    } finally {
      setRollbackBusy(false);
    }
  }, [
    isSuperAdmin,
    lead.stageBlock?.milestoneStage,
    lead.stageBlock?.milestoneStageCategory,
    lead.stageBlock?.milestoneSubStage,
    leadId,
    leadTypeParam,
    load,
    notifySuccess,
    refreshActivities,
    rollbackCategory,
    rollbackReason,
    rollbackStage,
    rollbackSubStage,
    validLeadType,
  ]);

  const handlePhoneCallLog = useCallback(async () => {
    if (!validLeadType) return;
    const lt = leadTypeParam as CrmLeadType;
    const phone = lead.phone?.trim();
    if (!phone) return;
    await postManualActivity(lt, leadId, "CALL", `Outbound call to ${phone}`);
    await refreshActivities();
  }, [lead.phone, leadId, leadTypeParam, refreshActivities, validLeadType]);

  const handleDesignQaLinkCopied = useCallback(
    async (link: string) => {
      if (!validLeadType) return;
      const lt = leadTypeParam as CrmLeadType;
      await postManualActivity(lt, leadId, "NOTE", `Design QA Link copied: ${link}`);
      await refreshActivities();
    },
    [leadId, leadTypeParam, refreshActivities, validLeadType],
  );

  const handleCompleteTaskApi = async (args: CompleteTaskApiPayload) => {
      if (!validLeadType) return;
      if (!leadId.trim()) {
        throw new Error("Lead ID is required.");
      }
      if (!args.milestoneStage.trim()) {
        throw new Error("Please select a milestone stage.");
      }
      if (!args.milestoneStageCategory.trim()) {
        throw new Error("Please select a milestone category.");
      }
      if (!args.feedback.trim()) {
        throw new Error("Please select a milestone sub-stage.");
      }
      const discoveryGate = validateDiscoveryToConnectionTransition(lead, {
        milestoneStage: args.milestoneStage.trim(),
        milestoneStageCategory: args.milestoneStageCategory.trim(),
        feedback: args.feedback.trim(),
      });
      if (!discoveryGate.valid) {
        throw new Error(discoveryGate.message);
      }
      const bookingAmountCandidate = readNumberValue(
        baseDetail.bookingAmount ?? baseDetail.booking_value,
      );
      if (bookingAmountCandidate !== null && bookingAmountCandidate <= 0) {
        throw new Error("Booking amount must be greater than 0.");
      }
      try {
        const lt = leadTypeParam as CrmLeadType;
        const isFreshLeadStage =
          args.milestoneStage.trim().toLowerCase() === "fresh lead";
        const persistedSubstage = isFreshLeadStage
          ? ""
          : normalizeMilestoneSubStageForApi(args.feedback);
        const persistedCategory = isFreshLeadStage
          ? ""
          : args.milestoneStageCategory;

        let followUpDate = args.nextCallDateLocal.trim() || lead.followUpDate;
        let designerName = lead.designerName;
        let meetingDate = lead.meetingDate;

        if (args.meetingAppointment) {
          const leadIdNum = Number(leadId);
          const appt = await createAppointment({
            designerName: args.meetingAppointment.designerName,
            date: args.meetingAppointment.date,
            slotId: args.meetingAppointment.slotId,
            meetingType: args.meetingAppointment.meetingType,
            description: `Meeting with ${crmLeadTypeToApiLabel(lt)} - Lead ID: ${leadIdNum}`,
            leadType: crmLeadTypeToApiLabel(lt),
            leadId: leadIdNum,
          });
          if (typeof appt.startTime === "string" && appt.startTime.trim()) {
            followUpDate = appt.startTime;
          } else if (typeof appt.endTime === "string" && appt.endTime.trim()) {
            followUpDate = appt.endTime;
          }
          designerName = args.meetingAppointment.designerName;
          const schedule = buildExternalIntakeScheduleFromAppointment({
            meetingDate: args.meetingAppointment.date,
            appt,
            designerName: args.meetingAppointment.designerName,
          });
          void postExternalIntakeLead({
            lead,
            baseDetail,
            authUser: salesClosureAuthUser,
            schedule:
              schedule.appointmentDate ||
              schedule.appointmentSlot ||
              schedule.designerName
                ? schedule
                : undefined,
          }).catch((e) => {
            console.error(
              "External intake API call failed after meeting schedule:",
              e,
            );
          });
        }

        const nextStage = {
          milestoneStage: args.milestoneStage,
          milestoneStageCategory: persistedCategory,
          milestoneSubStage: persistedSubstage,
          stage: lead.stageBlock?.stage ?? "Initial Stage",
          substage: { substage: persistedSubstage || null },
        };
        if (isClosedWonBookingDone(nextStage)) {
          if (!canClosedLeadHeader) {
            throw new Error(
              "Admin and Sales Admin cannot move a lead to Booking Done under Closed Won (sales closure is restricted).",
            );
          }
          const activityText =
            args.note.trim() ||
            "Milestone: Closed → Closed Won → Booking Done (pending Sales Closure).";
          void postManualActivity(lt, leadId, "NOTE", activityText).catch(() => {
            /* non-blocking before redirect */
          });
          notifyInfo("Opening Sales Closure — complete the form to confirm Booking Done.");
          redirectToStrictSalesClosure(lead.stageBlock);
          return;
        }
        const leadForSave: Lead = {
          ...lead,
          followUpDate,
          designerName,
          meetingType: args.meetingAppointment?.meetingType ?? lead.meetingType,
          status: persistedSubstage,
          stageBlock: nextStage,
          lostReason: args.lostReason?.trim()
            ? args.lostReason.trim()
            : lead.lostReason,
        };
        const body = mergeLeadIntoDetail(baseDetail, leadForSave);
        const updated = await putLeadDetail(lt, leadId, body);
        setBaseDetail(updated);
        setLead((prev) => ({
          ...detailJsonToLead(updated, lt),
          id: leadId,
          activities: prev.activities,
          stageBlock: nextStage,
        }));
        notifySuccess("Saved");
        maybeOpenSalesClosureAfterWon([
          args.feedback,
          args.milestoneStage,
          args.milestoneStageCategory,
          persistedSubstage,
          nextStage.milestoneStage,
          nextStage.milestoneSubStage,
          body.status,
          (body.stageBlock as Record<string, unknown> | undefined)?.milestoneStage,
          (body.stageBlock as Record<string, unknown> | undefined)?.milestoneSubStage,
          updated.status,
          updated.milestoneStage,
          updated.milestoneSubStage,
        ]);
        void postManualActivity(lt, leadId, "NOTE", args.note).catch(() => {
          /* keep save fast even if note activity fails */
        });

        const emailPayload = buildEmailRequest(leadForSave, persistedSubstage);
        if (emailPayload) {
          void sendEmailNotification(emailPayload).then((emailResult) => {
            if (!emailResult.success) {
              notifyError(`Email warning: ${emailResult.message}`);
            }
          });
        }
        void refreshActivities();
      } catch (e) {
        throw new Error(mapMilestoneValidationError(e));
      }
  };

  const handleCallClosed = () => {
    if (!canClosedLeadHeader) return;
    void handleCompleteTaskApi({
      feedback: "Booking Done (Booking)",
      milestoneStage: "Closed",
      milestoneStageCategory: "Closed Won",
      note: "Closed (Won) — quick path to Booking Done / Sales Closure (same as Complete Task).",
      nextCallDateLocal: (lead.followUpDate ?? "").trim(),
    }).catch((e) => {
      notifyError(
        e instanceof Error ? e.message : "Closed (Won) could not continue.",
      );
    });
  };

  if (!validLeadType) {
    return (
      <main className="min-h-screen bg-[var(--crm-app-bg)] p-8">
        <p className="text-rose-600">
          Unknown lead source. Use /Leads/formlead/123 (or glead, mlead,
          addlead, websitelead).
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--crm-app-bg)] px-4 py-12 text-center text-[var(--crm-text-muted)]">
        Loading lead…
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[var(--crm-app-bg)] px-4 py-8">
        <p className="text-rose-600">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--crm-app-bg)] px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <TopBar
          designQaOpen={designQaOpen}
          onToggleDesignQa={() => setDesignQaOpen((v) => !v)}
        />
        <LeadHeader
          lead={lead}
          onCompleteTask={() => setCompleteTaskOpen(true)}
          onCallClosed={canClosedLeadHeader ? handleCallClosed : undefined}
          showCallClosed={
            canClosedLeadHeader && !isClosedWonBookingDone(lead.stageBlock)
          }
          canStageRollback={isSuperAdmin}
          onOpenStageRollback={() => setRollbackOpen(true)}
          salesClosureHref={canClosedLeadHeader ? salesClosureHref : null}
          createdTimelineOptions={createdTimelineOptions}
          createdTimelineLoading={createdTimelineLoading}
          createdTimelineValue={selectedTimelineValue}
          onCreatedTimelineChange={(selected) => {
            if (!selected) return;
            setSelectedTimelineValue(selected);
            const chosen = createdTimelineOptions.find(
              (opt) => opt.value === selected,
            );
            if (!chosen) return;
            const { leadType: nextLeadType, leadId: nextLeadId } = chosen;
            if (nextLeadType === leadType && nextLeadId === leadId) return;
            window.location.href = `/Leads/${nextLeadType}/${nextLeadId}`;
          }}
        />
        <DesignQaPanel leadId={lead.leadId?.trim() || ""} open={designQaOpen} />
        <StatsRow lead={lead} />
        <Tabs active={activeTab} onChange={setActiveTab} />

        {activeTab === "lead" && (
          <LeadInfoTab
            lead={lead}
            onLeadChange={patchLead}
            onAdditionalInfoSave={handleSaveSecondBox}
            onLogCall={handlePhoneCallLog}
            onDesignQaLinkCopied={handleDesignQaLinkCopied}
            quoteExtras={{
              subject: quoteSubject,
              body: quoteBody,
              onSubjectChange: setQuoteSubject,
              onBodyChange: setQuoteBody,
              onSendQuote: handleSendQuote,
              quoteSending,
            }}
          />
        )}
        {activeTab === "assignments" && (
          <AssignmentsTab lead={lead} onLeadChange={patchLead} />
        )}
        {activeTab === "activity" && (
          <ActivityTimeline activities={lead.activities} />
        )}
        {saveError ? (
          <p className="mt-2 text-[12px] text-rose-600">{saveError}</p>
        ) : null}
        {secondBoxError ? (
          <p className="mt-2 text-[12px] text-rose-600">{secondBoxError}</p>
        ) : null}
        <FooterActions
          onSave={handleSave}
          saving={saving}
          onVerify={canVerifyRole ? handleOpenVerify : undefined}
          verifying={verifying}
        />
      </div>
      <CompleteTaskModal
        lead={lead}
        open={completeTaskOpen}
        onClose={() => setCompleteTaskOpen(false)}
        onApiComplete={handleCompleteTaskApi}
        onPhoneCall={handlePhoneCallLog}
        quoteInline={{
          quoteLink: lead.quoteLink ?? "",
          onQuoteLinkChange: (v) => patchLead({ quoteLink: v }),
          subject: quoteSubject,
          onSubjectChange: setQuoteSubject,
          body: quoteBody,
          onBodyChange: setQuoteBody,
          onSend: handleSendQuote,
          sending: quoteSending,
        }}
      />
      {rollbackOpen ? (
        <div className="fixed inset-0 z-[82] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5 shadow-xl">
            <h3 className="text-[15px] font-semibold text-[var(--crm-text-primary)]">
              Stage Rollback (Super Admin)
            </h3>
            <p className="mt-1 text-[12px] text-[var(--crm-text-secondary)]">
              Move lead back to a previous milestone with mandatory reason.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[12px] font-medium text-[var(--crm-text-secondary)]">
                  Stage *
                </span>
                <select
                  value={rollbackStage}
                  onChange={(e) => setRollbackStage(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--crm-accent)]"
                  disabled={rollbackBusy}
                >
                  <option value="">Select stage</option>
                  {rollbackStages.map((stage) => (
                    <option key={stage.stage} value={stage.stage}>
                      {stage.stage}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-[var(--crm-text-secondary)]">
                  Stage category *
                </span>
                <select
                  value={rollbackCategory}
                  onChange={(e) => setRollbackCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--crm-accent)]"
                  disabled={rollbackBusy || !rollbackStage.trim()}
                >
                  <option value="">Select category</option>
                  {rollbackCategories.map((category) => (
                    <option
                      key={category.stageCategory}
                      value={category.stageCategory}
                    >
                      {category.stageCategory}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-[var(--crm-text-secondary)]">
                  Sub-stage *
                </span>
                <select
                  value={rollbackSubStage}
                  onChange={(e) => setRollbackSubStage(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--crm-accent)]"
                  disabled={rollbackBusy || !rollbackCategory.trim()}
                >
                  <option value="">Select sub-stage</option>
                  {rollbackSubStages.map((subStage) => (
                    <option key={subStage} value={subStage}>
                      {subStage}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-[var(--crm-text-secondary)]">
                  Reason * (min 5 chars)
                </span>
                <textarea
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  className="mt-1 min-h-[82px] w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--crm-accent)]"
                  placeholder="Explain why rollback is required..."
                  disabled={rollbackBusy}
                />
              </label>
              {rollbackError ? (
                <p className="text-[12px] text-rose-600">{rollbackError}</p>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[var(--crm-border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--crm-text-secondary)]"
                onClick={() => setRollbackOpen(false)}
                disabled={rollbackBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-[var(--crm-accent)] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
                onClick={() => void handleStageRollback()}
                disabled={rollbackBusy}
              >
                {rollbackBusy ? "Submitting..." : "Rollback Stage"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {verifyModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5 shadow-xl">
            <h3 className="text-[15px] font-semibold text-[var(--crm-text-primary)]">
              Verify Lead
            </h3>
            <p className="mt-1 text-[12px] text-[var(--crm-text-secondary)]">
              Pincode is mandatory. Optionally assign a sales executive by name
              when verifying this lead.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[12px] font-medium text-[var(--crm-text-secondary)]">
                  Pincode *
                </span>
                <input
                  value={verifyPincode}
                  onChange={(e) => setVerifyPincode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--crm-accent)]"
                  placeholder="Enter pincode"
                />
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-[var(--crm-text-secondary)]">
                  Sales Executive (optional)
                </span>
                <div className="relative mt-1">
                  <select
                    value={verifySalesExecutiveId}
                    onChange={(e) => setVerifySalesExecutiveId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2 pr-9 text-[13px] outline-none focus:border-[var(--crm-accent)]"
                    disabled={salesExecutivesLoading}
                  >
                    <option value="">— No assignment —</option>
                    {salesExecutiveOptions.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {salesExecutiveLabel(u)}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[var(--crm-text-muted)]">
                    ▾
                  </span>
                </div>
                {salesExecutivesLoading ? (
                  <span className="mt-1 block text-[11px] text-[var(--crm-text-muted)]">
                    Loading sales executives…
                  </span>
                ) : salesExecutivesError ? (
                  <span className="mt-1 block text-[11px] text-amber-700">
                    {salesExecutivesError}
                  </span>
                ) : salesExecutiveOptions.length === 0 ? (
                  <span className="mt-1 block text-[11px] text-amber-700">
                    Could not load the list. You can still verify with pincode
                    only.
                  </span>
                ) : null}
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[var(--crm-border)] px-3 py-1.5 text-[12px] font-semibold text-[var(--crm-text-secondary)]"
                onClick={() => setVerifyModalOpen(false)}
                disabled={verifying}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-[var(--crm-accent)] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
                onClick={() => void handleVerify()}
                disabled={verifying}
              >
                {verifying ? "Verifying..." : "Verify"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
