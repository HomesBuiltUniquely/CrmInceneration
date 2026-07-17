"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ConfigurationScopeFloorPlan from "./ConfigurationScopeFloorPlan";
import ReferenceViewModal from "./ReferenceViewModal";
import { RequiredAsterisk, REQUIRED_FIELD_HINTS } from "./RequiredFieldHint";
import { useGlobalNotifier } from "@/app/Components/Shared/GlobalNotifier";
import { CRM_USER_NAME_STORAGE_KEY } from "@/lib/auth/api";
import { notifyConfigurationScopeUpdated } from "@/lib/configuration-scope-events";
import {
  validateConfigurationScopeForMeeting,
  type ConfigurationScopeValidationIssue,
} from "@/lib/configuration-scope-validation";
import { BOOKING_TYPE_OPTIONS, CONFIGURATION_OPTIONS } from "@/lib/data";
import {
  createDefaultSelectedRoom,
  createDefaultRequirements,
  defaultRoomIcon,
  deleteConfigurationScopeReference,
  DEFAULT_ROOM_CATALOG,
  fetchReferenceContentBlob,
  getConfigurationScopeReferences,
  getConfigurationScopeRequirements,
  mergeRequirementDefaults,
  miscAddOnOptions,
  putConfigurationScopeAestheticNotes,
  putConfigurationScopeRequirements,
  joinProjectUnderstanding,
  splitProjectUnderstanding,
  TIMELINE_EXPECTATION_OPTIONS,
  toPutRequirementsBody,
  REFERENCE_ACCEPT,
  REFERENCE_MAX_FILES,
  referenceDisplayName,
  referenceViewUrlToProxy,
  uploadConfigurationScopeReference,
  validateReferenceFile,
  type ConfigurationScopeReference,
  type ConfigurationScopeRequirements,
  type ScopeSelectedRoom,
} from "@/lib/configuration-scope-client";
import { seedPropertyNameFromLead } from "@/lib/lead-discovery-field-sync";
import { syncCrmLeadToDesignModule } from "@/lib/design-module-phase-sync";
import { detailJsonToLead, mergeLeadIntoDetail } from "@/lib/lead-detail-mapper";
import { bookingTypeDisplay, resolveLeadDisplayIdentifier } from "@/lib/lead-detail-v2-display";
import { resolveBudgetLuxuryFocus } from "@/lib/lead-budget-display";
import {
  buildBudgetInvestmentDisplay,
  buildQuotationInvestmentDisplay,
} from "@/lib/lead-investment-display";
import {
  fetchQuoteOptionsForLeadDetail,
  pickLatestQuoteOption,
  refreshQuoteOptionDetails,
} from "@/lib/lead-quote-options";
import {
  LEAD_QUOTE_SELECTION_EVENT,
  readLeadQuoteSelection,
} from "@/lib/lead-quote-selection";
import {
  DEFAULT_CONFIGURATION_SCOPE_FRONTEND_PREFS,
  type FinancialSensitivity,
  type FinancingPreference,
  readConfigurationScopeFrontendPrefs,
  writeConfigurationScopeFrontendPrefs,
  type ClosureProbability,
  type ConfigurationScopeFrontendPrefs,
} from "@/lib/configuration-scope-frontend-prefs";
import { getLeadDetail, getLeadFloorPlanMeta, putLeadDetail, uploadLeadFloorPlan } from "@/lib/lead-details-client";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import type { LeadQuoteOption } from "@/lib/crm-quote-links";
import type { CrmLeadType } from "@/lib/leads-filter";

type Props = {
  leadType: string;
  leadId: string;
  /** When set (e.g. opened inside lead-detail overlay), close instead of navigating away. */
  onClose?: () => void;
  /** Called after a successful Finalize when returning to Schedule Hub Meeting (immediate, no celebration). */
  onSavedAndClose?: () => void;
  /** Softer page chrome when embedded in a fullscreen overlay. */
  embedded?: boolean;
  /** Highlight every missing required field (e.g. redirected from Meeting Scheduled). */
  highlightMissing?: boolean;
};

type ScopeSectionId =
  | "basic-understanding"
  | "requirements"
  | "reference-inspiration"
  | "budget-alignment"
  | "internal-notes";

const scopeNavItems: {
  id: ScopeSectionId;
  label: string;
  status?: "done" | "detailed";
  icon: "understanding" | "requirements" | "reference" | "budget" | "notes";
}[] = [
  { id: "basic-understanding", label: "Basic Understanding", status: "done", icon: "understanding" },
  { id: "requirements", label: "Requirements", status: "detailed", icon: "requirements" },
  { id: "reference-inspiration", label: "Reference & Inspiration", icon: "reference" },
  { id: "budget-alignment", label: "Budget Alignment", icon: "budget" },
  { id: "internal-notes", label: "Internal Notes", icon: "notes" },
];

function formatScopeLastSaved(iso: string | null | undefined): string {
  if (!iso?.trim()) return "Not saved yet";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Recently";
  const time = parsed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const isToday = parsed.toDateString() === new Date().toDateString();
  if (isToday) return `Today at ${time}`;
  return `${parsed.toLocaleDateString()} at ${time}`;
}

function latestIsoTimestamp(...values: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestMs = -1;
  for (const value of values) {
    if (!value?.trim()) continue;
    const ms = new Date(value).getTime();
    if (!Number.isNaN(ms) && ms > bestMs) {
      bestMs = ms;
      best = value;
    }
  }
  return best;
}

const SCOPE_FIELD_HINT =
  "border-[#f0d4a8] bg-[#fffaf3] ring-1 ring-[#f5e2c4] focus:border-[#e8b86d] focus:ring-[#f5e2c4]";

function FieldHintText({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-[12px] font-medium leading-snug text-[#9a6b2f]">{message}</p>
  );
}

/** Soft guide styles for missing required fields (gentle, not alarming). */
const SCOPE_HINT_BANNER =
  "rounded-xl border border-[#f0d9b5] bg-gradient-to-br from-[#fff9f0] to-[#fff5e8] px-4 py-3.5 text-[13px] text-[#7a5530] shadow-sm";
const SCOPE_HINT_PANEL = "border-[#e8c48a] bg-[#fff8ee]";
const SCOPE_HINT_RING = "rounded-md ring-1 ring-[#f0d4a8]";
const SCOPE_HINT_ROOM = "border-[#e8c48a] ring-1 ring-[#f5e2c4]";

/** Shared medium hover motion for Configuration Scope interactive elements. */
const SCOPE_TRANSITION = "transition-all duration-200 ease-out";
const SCOPE_BTN_PRIMARY = `${SCOPE_TRANSITION} hover:-translate-y-0.5 hover:bg-[#14c653] hover:shadow-md active:scale-[0.98]`;
const SCOPE_BTN_SECONDARY = `${SCOPE_TRANSITION} hover:-translate-y-0.5 hover:border-[#111827] hover:bg-[#f9fafb] hover:shadow-md active:scale-[0.98]`;
const SCOPE_BTN_DARK = `${SCOPE_TRANSITION} hover:-translate-y-0.5 hover:bg-[#1e293b] hover:shadow-md active:scale-[0.98]`;
const SCOPE_BTN_GHOST = `${SCOPE_TRANSITION} hover:-translate-y-0.5 hover:border-[#9ca3af] hover:bg-[#f9fafb] hover:shadow-sm active:scale-[0.98]`;
const SCOPE_BTN_DANGER_ICON = `${SCOPE_TRANSITION} rounded-md p-1 hover:scale-110 hover:bg-[#fee2e2] hover:text-[#dc2626] active:scale-95`;
const SCOPE_BTN_DELETE_BADGE = `${SCOPE_TRANSITION} hover:scale-110 hover:bg-[#dc2626] hover:shadow-md active:scale-95`;
const SCOPE_ROOM_SELECTED = `${SCOPE_TRANSITION} hover:border-[#16c956] hover:bg-[#e8fff1] hover:shadow-sm active:scale-[0.99]`;
const SCOPE_ROOM_UNSELECTED = `${SCOPE_TRANSITION} hover:border-[#bbf7d0] hover:bg-[#f9fdfb] hover:shadow-sm active:scale-[0.99]`;
const SCOPE_UNIT_ACTIVE = `${SCOPE_TRANSITION} hover:bg-[#14c653] hover:shadow-sm active:scale-95`;
const SCOPE_UNIT_IDLE = `${SCOPE_TRANSITION} hover:border-[#bbf7d0] hover:bg-[#f0fdf4] hover:text-[#059669] active:scale-95`;
const SCOPE_TILE_ADD = `${SCOPE_TRANSITION} hover:border-[#bbf7d0] hover:bg-[#ecfdf5] hover:text-[#059669] hover:shadow-sm active:scale-[0.98]`;
const SCOPE_UPLOAD_ZONE = `${SCOPE_TRANSITION} hover:-translate-y-0.5 hover:border-[#1ed760] hover:bg-[#f2fff8] hover:shadow-md`;
const SCOPE_CHIP = `${SCOPE_TRANSITION} hover:border-[#bbf7d0] hover:bg-[#f9fdfb] hover:shadow-sm`;
const SCOPE_INPUT = `${SCOPE_TRANSITION} hover:border-[#c5e8d4] focus:border-[#1ed760] focus:outline-none focus:ring-2 focus:ring-[#1ed760]/20`;
const SCOPE_NAV_IDLE = `${SCOPE_TRANSITION} hover:-translate-y-0.5 hover:border-[#e5e7eb] hover:bg-[#f9fafb] hover:shadow-md active:scale-[0.99]`;
const SCOPE_BTN_ADD_PLUS = `${SCOPE_TRANSITION} inline-flex shrink-0 items-center justify-center rounded-md border border-[#d1d5db] bg-white text-[#059669] hover:-translate-y-0.5 hover:border-[#1ed760] hover:bg-[#ecfdf5] hover:text-[#047857] hover:shadow-md active:scale-95`;

function ScopePlusIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ScopeAddPlusButton({
  onClick,
  ariaLabel,
  disabled = false,
  size = "md",
}: {
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
  size?: "md" | "sm";
}) {
  const sizeClass = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`${SCOPE_BTN_ADD_PLUS} ${sizeClass} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-[#d1d5db] disabled:hover:bg-white disabled:hover:text-[#059669] disabled:hover:shadow-none`}
    >
      <ScopePlusIcon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </button>
  );
}

export default function NewConfigurationScopePage({
  leadType,
  leadId,
  onClose,
  onSavedAndClose,
  embedded = false,
  highlightMissing = false,
}: Props) {
  const router = useRouter();
  const [activeSectionId, setActiveSectionId] = useState<ScopeSectionId>("basic-understanding");
  const [baseDetail, setBaseDetail] = useState<Record<string, unknown> | null>(null);
  const [bookingType, setBookingType] = useState("");
  const [leadConfiguration, setLeadConfiguration] = useState("");
  const [bookingTypeLoading, setBookingTypeLoading] = useState(true);
  const [floorPlanS3Key, setFloorPlanS3Key] = useState("");
  const [floorPlanPublicLink, setFloorPlanPublicLink] = useState("");
  const [floorPlanViewPath, setFloorPlanViewPath] = useState("");
  const [floorPlanOpenPath, setFloorPlanOpenPath] = useState("");
  const [floorPlanUploading, setFloorPlanUploading] = useState(false);
  const [showMissingFieldHints, setShowMissingFieldHints] = useState(highlightMissing);
  const [showFinalizeCelebration, setShowFinalizeCelebration] = useState(false);
  const [requirements, setRequirements] = useState<ConfigurationScopeRequirements | null>(
    () => mergeRequirementDefaults(createDefaultRequirements()).requirements,
  );
  const [requirementsLoading, setRequirementsLoading] = useState(true);
  const [requirementsSaving, setRequirementsSaving] = useState(false);
  const [references, setReferences] = useState<ConfigurationScopeReference[]>([]);
  const [aestheticNotes, setAestheticNotes] = useState("");
  const [referencesLoading, setReferencesLoading] = useState(true);
  const [referenceUploading, setReferenceUploading] = useState(false);
  const [aestheticNotesSaving, setAestheticNotesSaving] = useState(false);
  const [referencesUpdatedAt, setReferencesUpdatedAt] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [quoteInvestmentLoading, setQuoteInvestmentLoading] = useState(true);
  const [activeQuote, setActiveQuote] = useState<LeadQuoteOption | null>(null);
  const [activeQuoteSelectedInBooking, setActiveQuoteSelectedInBooking] = useState(false);
  const [frontendPrefs, setFrontendPrefs] = useState<ConfigurationScopeFrontendPrefs>(
    () => DEFAULT_CONFIGURATION_SCOPE_FRONTEND_PREFS,
  );
  const requirementsDirtyRef = useRef(false);
  const aestheticNotesDirtyRef = useRef(false);
  const requirementsSaveInFlightRef = useRef(false);
  const { notifyError, notifySuccess } = useGlobalNotifier();

  const validLeadType = useMemo<CrmLeadType | null>(
    () => (isCrmLeadType(leadType) ? leadType : null),
    [leadType],
  );

  useEffect(() => {
    if (!validLeadType) return;
    setFrontendPrefs(readConfigurationScopeFrontendPrefs(validLeadType, leadId));
  }, [leadId, validLeadType]);

  const patchFrontendPrefs = useCallback(
    (patch: Partial<ConfigurationScopeFrontendPrefs>) => {
      if (!validLeadType) return;
      setFrontendPrefs((prev) => ({ ...prev, ...patch }));
    },
    [validLeadType],
  );

  useEffect(() => {
    if (!validLeadType) {
      setBookingTypeLoading(false);
      return;
    }

    let cancelled = false;
    setBookingTypeLoading(true);

    void (async () => {
      try {
        const detailJson = await getLeadDetail(validLeadType, leadId);
        if (cancelled) return;
        setBaseDetail(detailJson);
        const leadSnapshot = detailJsonToLead(detailJson, validLeadType);
        setBookingType(leadSnapshot.bookingType ?? "");
        setLeadConfiguration(leadSnapshot.configuration ?? "");

        const meta = await getLeadFloorPlanMeta(validLeadType, leadId);
        if (cancelled) return;
        if (meta) {
          setFloorPlanS3Key(meta.s3Key);
          setFloorPlanPublicLink(meta.publicLink ?? "");
          setFloorPlanViewPath(meta.viewPath);
          setFloorPlanOpenPath(meta.openPath);
        } else {
          setFloorPlanS3Key("");
          setFloorPlanPublicLink("");
          setFloorPlanViewPath("");
          setFloorPlanOpenPath("");
        }

        let reqData: ConfigurationScopeRequirements;
        try {
          reqData = await getConfigurationScopeRequirements(validLeadType, leadId);
        } catch {
          reqData = createDefaultRequirements();
        }

        const refData = await getConfigurationScopeReferences(validLeadType, leadId).catch(
          () => ({ references: [], aestheticNotes: "", updatedAt: null }),
        );
        if (cancelled) return;

        const { requirements: mergedReq, needsPersist: defaultsNeedPersist } =
          mergeRequirementDefaults(reqData);
        const seeded = seedPropertyNameFromLead(
          mergedReq,
          leadSnapshot.propertyLocation,
        );
        const requirementsToUse = seeded.requirements;
        let needsPersist = defaultsNeedPersist || seeded.changed;
        requirementsDirtyRef.current = false;

        if (needsPersist) {
          try {
            const saved = await putConfigurationScopeRequirements(
              validLeadType,
              leadId,
              toPutRequirementsBody(requirementsToUse),
            );
            if (cancelled) return;
            setRequirements(saved);
            if (saved.bookingType) setBookingType(saved.bookingType);
          } catch {
            if (!cancelled) {
              setRequirements(requirementsToUse);
              if (requirementsToUse.bookingType) setBookingType(requirementsToUse.bookingType);
            }
          }
        } else {
          setRequirements(requirementsToUse);
          if (requirementsToUse.bookingType) {
            setBookingType(requirementsToUse.bookingType);
          }
        }

        setReferences(refData.references);
        setAestheticNotes(refData.aestheticNotes ?? "");
        setReferencesUpdatedAt(refData.updatedAt ?? null);
        aestheticNotesDirtyRef.current = false;
      } catch {
        if (!cancelled) {
          setBaseDetail(null);
          setBookingType("");
          const { requirements: fallbackReq } = mergeRequirementDefaults(
            createDefaultRequirements(),
          );
          setRequirements(fallbackReq);
          setReferences([]);
          setAestheticNotes("");
        }
      } finally {
        if (!cancelled) {
          setBookingTypeLoading(false);
          setRequirementsLoading(false);
          setReferencesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [leadId, validLeadType]);

  const handleFloorPlanUpload = useCallback(
    async (file: File) => {
      if (!validLeadType) return;
      setFloorPlanUploading(true);
      try {
        const state = await uploadLeadFloorPlan(validLeadType, leadId, file);
        setFloorPlanS3Key(state.s3Key);
        setFloorPlanPublicLink(state.publicLink ?? "");
        setFloorPlanViewPath(state.viewPath);
        setFloorPlanOpenPath(state.openPath);
        notifySuccess("Floor plan uploaded.");
      } catch (e) {
        notifyError(e instanceof Error ? e.message : "Floor plan upload failed.");
        throw e;
      } finally {
        setFloorPlanUploading(false);
      }
    },
    [leadId, notifyError, notifySuccess, validLeadType],
  );

  const patchRequirements = useCallback((patch: (prev: ConfigurationScopeRequirements) => ConfigurationScopeRequirements) => {
    requirementsDirtyRef.current = true;
    setRequirements((prev) =>
      patch(prev ?? mergeRequirementDefaults(createDefaultRequirements()).requirements),
    );
  }, []);

  const handleBookingTypeChange = useCallback(
    (nextBookingType: string) => {
      if (requirementsLoading) return;
      setBookingType(nextBookingType);
      patchRequirements((prev) => ({
        ...prev,
        bookingType: nextBookingType.trim() || null,
      }));
    },
    [patchRequirements, requirementsLoading],
  );

  const saveRequirements = useCallback(
    async (payload?: ConfigurationScopeRequirements, isRetry = false): Promise<boolean> => {
      const toSave = payload ?? requirements;
      if (!validLeadType || !toSave || requirementsSaveInFlightRef.current) return false;

      requirementsSaveInFlightRef.current = true;
      setRequirementsSaving(true);
      try {
        const saved = await putConfigurationScopeRequirements(
          validLeadType,
          leadId,
          toPutRequirementsBody(toSave),
        );
        requirementsDirtyRef.current = false;
        setRequirements(saved);
        if (saved.bookingType) setBookingType(saved.bookingType);

        // Keep Design Module View in sync when config scope is saved (not only on meeting schedule)
        if (baseDetail) {
          const leadSnapshot = detailJsonToLead(baseDetail, validLeadType);
          void syncCrmLeadToDesignModule({
            leadType: validLeadType,
            leadId,
            lead: {
              ...leadSnapshot,
              floorPlanPublicLink:
                floorPlanPublicLink || leadSnapshot.floorPlanPublicLink,
              bookingType: saved.bookingType || leadSnapshot.bookingType,
              configuration: leadConfiguration || leadSnapshot.configuration,
            },
            baseDetail,
            designerName: leadSnapshot.designerName,
            schedule: leadSnapshot.meetingDate?.trim()
              ? {
                  appointmentDate: leadSnapshot.meetingDate.trim(),
                  scheduleTimezone: "Asia/Kolkata",
                }
              : undefined,
          }).catch((err) => {
            console.error("Design Module sync after config scope save failed:", err);
          });
        }

        return true;
      } catch (e) {
        const err = e as Error & { status?: number };
        const message = err.message || "Unable to save requirement scope.";
        if (err.status === 409 && !isRetry) {
          try {
            const fresh = await getConfigurationScopeRequirements(validLeadType, leadId);
            const merged: ConfigurationScopeRequirements = {
              ...fresh,
              selectedRooms: toSave.selectedRooms,
              availableRoomCatalog: toSave.availableRoomCatalog,
              miscAddOns: toSave.miscAddOns,
              kitchenLayout: toSave.kitchenLayout,
              materialFinish: toSave.materialFinish,
              familyContactName: toSave.familyContactName,
              familyContactRelationship: toSave.familyContactRelationship,
              familyContactPhone: toSave.familyContactPhone,
              bookingType: toSave.bookingType,
              projectUnderstanding: toSave.projectUnderstanding,
              designStylePreference: toSave.designStylePreference,
              expectedTimeline: toSave.expectedTimeline,
              internalExecutiveNotes: toSave.internalExecutiveNotes,
              salesRiskNotes: toSave.salesRiskNotes,
              designHandoffNotes: toSave.designHandoffNotes,
            };
            requirementsSaveInFlightRef.current = false;
            setRequirementsSaving(false);
            return saveRequirements(merged, true);
          } catch {
            notifyError(message);
          }
        } else {
          notifyError(message);
        }
        return false;
      } finally {
        requirementsSaveInFlightRef.current = false;
        setRequirementsSaving(false);
      }
    },
    [
      baseDetail,
      floorPlanPublicLink,
      leadConfiguration,
      leadId,
      notifyError,
      requirements,
      validLeadType,
    ],
  );

  const handleReferenceUpload = useCallback(
    async (file: File) => {
      if (!validLeadType) return;
      if (references.length >= REFERENCE_MAX_FILES) {
        notifyError(`Maximum ${REFERENCE_MAX_FILES} reference files per lead.`);
        return;
      }
      const validationError = validateReferenceFile(file);
      if (validationError) {
        notifyError(validationError);
        return;
      }
      setReferenceUploading(true);
      try {
        const data = await uploadConfigurationScopeReference(validLeadType, leadId, file);
        setReferences(data.references);
        setAestheticNotes(data.aestheticNotes ?? aestheticNotes);
        notifySuccess("Reference uploaded.");
      } catch (e) {
        notifyError(e instanceof Error ? e.message : "Reference upload failed.");
        throw e;
      } finally {
        setReferenceUploading(false);
      }
    },
    [aestheticNotes, leadId, notifyError, notifySuccess, references.length, validLeadType],
  );

  const handleReferenceDelete = useCallback(
    async (referenceId: string) => {
      if (!validLeadType) return;
      try {
        const data = await deleteConfigurationScopeReference(validLeadType, leadId, referenceId);
        setReferences(data.references);
        notifySuccess("Reference removed.");
      } catch (e) {
        notifyError(e instanceof Error ? e.message : "Unable to delete reference.");
      }
    },
    [leadId, notifyError, notifySuccess, validLeadType],
  );

  const saveAestheticNotes = useCallback(
    async (force = false): Promise<boolean> => {
      if (!validLeadType || aestheticNotesSaving) return false;
      if (!force && !aestheticNotesDirtyRef.current) return true;

      setAestheticNotesSaving(true);
      try {
        const data = await putConfigurationScopeAestheticNotes(
          validLeadType,
          leadId,
          aestheticNotes,
        );
        aestheticNotesDirtyRef.current = false;
        setReferences(data.references);
        setAestheticNotes(data.aestheticNotes ?? aestheticNotes);
        setReferencesUpdatedAt(data.updatedAt ?? null);
        return true;
      } catch (e) {
        notifyError(e instanceof Error ? e.message : "Unable to save aesthetic notes.");
        return false;
      } finally {
        setAestheticNotesSaving(false);
      }
    },
    [aestheticNotes, aestheticNotesSaving, leadId, notifyError, validLeadType],
  );

  const viewerName = useMemo(() => {
    if (typeof window === "undefined") return "";
    return (window.localStorage.getItem(CRM_USER_NAME_STORAGE_KEY) ?? "").trim();
  }, []);

  const lastSavedAt = useMemo(
    () => latestIsoTimestamp(requirements?.updatedAt, referencesUpdatedAt),
    [referencesUpdatedAt, requirements?.updatedAt],
  );

  const lastSavedBy = requirements?.updatedBy?.trim() || viewerName || "Sales Lead";

  const flushAllSaves = useCallback(async (): Promise<boolean> => {
    if (!validLeadType || !requirements) {
      notifyError("Configuration scope is still loading.");
      return false;
    }
    const requirementsOk = await saveRequirements(requirements);
    const notesOk = await saveAestheticNotes(true);
    return requirementsOk && notesOk;
  }, [notifyError, requirements, saveAestheticNotes, saveRequirements, validLeadType]);

  const handlePrintPdf = useCallback(() => {
    window.print();
  }, []);

  const hasFloorPlanUploaded = Boolean(
    floorPlanS3Key.trim() || floorPlanPublicLink.trim() || floorPlanViewPath.trim(),
  );

  const validationIssues = useMemo((): ConfigurationScopeValidationIssue[] => {
    if (!requirements) return [];
    return validateConfigurationScopeForMeeting({
      requirements,
      configuration: leadConfiguration,
      bookingType,
      hasFloorPlan: hasFloorPlanUploaded,
    });
  }, [bookingType, floorPlanPublicLink, floorPlanS3Key, floorPlanViewPath, hasFloorPlanUploaded, leadConfiguration, requirements]);

  const fieldErrorMessage = useMemo(() => {
    const map = new Map<string, string>();
    for (const issue of validationIssues) {
      if (!map.has(issue.key)) map.set(issue.key, issue.message);
    }
    return map;
  }, [validationIssues]);

  useEffect(() => {
    if (highlightMissing) {
      setShowMissingFieldHints(true);
    }
  }, [highlightMissing]);

  useEffect(() => {
    // Quietly clear the soft guide once nothing is missing (no celebration here).
    if (showMissingFieldHints && !requirementsLoading && validationIssues.length === 0) {
      setShowMissingFieldHints(false);
    }
  }, [requirementsLoading, showMissingFieldHints, validationIssues.length]);

  useEffect(() => {
    if (!showMissingFieldHints || validationIssues.length === 0 || requirementsLoading) return;
    const firstSection = validationIssues[0]?.sectionId ?? "basic-understanding";
    const timer = window.setTimeout(() => {
      document.getElementById(firstSection)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [requirementsLoading, showMissingFieldHints, validationIssues]);

  const finishAfterCelebration = useCallback(() => {
    setShowFinalizeCelebration(false);
    notifySuccess("Configuration scope saved.");
    if (onSavedAndClose) {
      onSavedAndClose();
    } else if (onClose) {
      onClose();
    } else if (validLeadType) {
      router.push(`/Leads/${validLeadType}/${leadId}`);
    }
  }, [leadId, notifySuccess, onClose, onSavedAndClose, router, validLeadType]);

  const handleFinalizeSubmit = useCallback(async () => {
    if (!validLeadType || finalizing || showFinalizeCelebration) return;
    if (!requirements) {
      notifyError("Configuration scope is still loading.");
      return;
    }
    const issues = validateConfigurationScopeForMeeting({
      requirements,
      configuration: leadConfiguration,
      bookingType,
      hasFloorPlan: hasFloorPlanUploaded,
    });
    if (issues.length > 0) {
      setShowMissingFieldHints(true);
      notifyError(
        issues[0]?.message ?? "A few details still need a moment of your care.",
      );
      document.getElementById(issues[0]?.sectionId ?? "basic-understanding")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    setFinalizing(true);
    try {
      const ok = await flushAllSaves();
      if (!ok) return;
      if (baseDetail && validLeadType) {
        const leadSnapshot = detailJsonToLead(baseDetail, validLeadType);
        const nextConfiguration = leadConfiguration.trim();
        const currentConfiguration = (leadSnapshot.configuration ?? "").trim();
        if (nextConfiguration && nextConfiguration !== currentConfiguration) {
          const leadForSave = { ...leadSnapshot, configuration: nextConfiguration };
          const body = mergeLeadIntoDetail(baseDetail, leadForSave);
          const updated = await putLeadDetail(validLeadType, leadId, body);
          setBaseDetail(updated);
        }
      }
      writeConfigurationScopeFrontendPrefs(validLeadType, leadId, frontendPrefs);
      notifyConfigurationScopeUpdated();

      // Final push to Design after full config scope finalize
      if (baseDetail) {
        const leadSnapshot = detailJsonToLead(baseDetail, validLeadType);
        void syncCrmLeadToDesignModule({
          leadType: validLeadType,
          leadId,
          lead: {
            ...leadSnapshot,
            floorPlanPublicLink:
              floorPlanPublicLink || leadSnapshot.floorPlanPublicLink,
            bookingType: requirements.bookingType || leadSnapshot.bookingType,
            configuration: leadConfiguration || leadSnapshot.configuration,
          },
          baseDetail,
          designerName: leadSnapshot.designerName,
          schedule: leadSnapshot.meetingDate?.trim()
            ? {
                appointmentDate: leadSnapshot.meetingDate.trim(),
                scheduleTimezone: "Asia/Kolkata",
              }
            : undefined,
        }).catch((err) => {
          console.error("Design Module sync after config scope finalize failed:", err);
        });
      }

      // Meeting gate: reopen Schedule Hub Meeting immediately on save (no celebration delay).
      if (onSavedAndClose) {
        notifySuccess("Configuration scope saved.");
        onSavedAndClose();
        return;
      }

      setShowFinalizeCelebration(true);
    } finally {
      setFinalizing(false);
    }
  }, [
    baseDetail,
    bookingType,
    finalizing,
    floorPlanPublicLink,
    flushAllSaves,
    frontendPrefs,
    hasFloorPlanUploaded,
    leadConfiguration,
    leadId,
    notifyError,
    notifySuccess,
    onClose,
    onSavedAndClose,
    requirements,
    showFinalizeCelebration,
    validLeadType,
  ]);

  useEffect(() => {
    if (!showFinalizeCelebration) return;
    const timer = window.setTimeout(() => {
      finishAfterCelebration();
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [finishAfterCelebration, showFinalizeCelebration]);

  const basicUnderstandingFields = useMemo(
    () => ({
      propertyNameSite: requirements?.propertyName?.trim() ?? "",
      familySizeDetails: splitProjectUnderstanding(requirements?.projectUnderstanding)
        .familySizeDetails,
    }),
    [requirements?.propertyName, requirements?.projectUnderstanding],
  );

  const scopeFieldsDisabled = requirementsLoading || requirementsSaving;

  const floorPlanProps = {
    leadType,
    leadId,
    floorPlanS3Key,
    floorPlanPublicLink,
    floorPlanViewPath,
    floorPlanOpenPath,
    floorPlanUploading,
    onFloorPlanUpload: handleFloorPlanUpload,
    onFloorPlanError: notifyError,
  };

  const leadBudget = useMemo(() => {
    if (!baseDetail || !validLeadType) return "";
    return detailJsonToLead(baseDetail, validLeadType).budget ?? "";
  }, [baseDetail, validLeadType]);

  const loadQuoteInvestment = useCallback(async () => {
    if (!validLeadType || !baseDetail) {
      setActiveQuote(null);
      setActiveQuoteSelectedInBooking(false);
      setQuoteInvestmentLoading(false);
      return;
    }

    setQuoteInvestmentLoading(true);
    try {
      const { options } = await fetchQuoteOptionsForLeadDetail(baseDetail, leadId);
      const stored = readLeadQuoteSelection(validLeadType, leadId);
      let quote: LeadQuoteOption | null = null;
      let selectedInBooking = false;

      if (stored) {
        quote =
          options.find(
            (option) =>
              option.id === stored.quoteId ||
              option.quoteId === stored.quoteId,
          ) ?? null;
        selectedInBooking = stored.selectedInBookingDone;
      }

      if (!quote) {
        quote = pickLatestQuoteOption(options);
        selectedInBooking = false;
      }

      if (quote) {
        quote = await refreshQuoteOptionDetails(quote);
      }

      setActiveQuote(quote);
      setActiveQuoteSelectedInBooking(selectedInBooking);
    } catch {
      setActiveQuote(null);
      setActiveQuoteSelectedInBooking(false);
    } finally {
      setQuoteInvestmentLoading(false);
    }
  }, [baseDetail, leadId, validLeadType]);

  useEffect(() => {
    void loadQuoteInvestment();
  }, [loadQuoteInvestment]);

  useEffect(() => {
    if (!validLeadType) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ leadType: string; leadId: string }>).detail;
      if (detail?.leadType !== validLeadType || detail?.leadId !== leadId) return;
      void loadQuoteInvestment();
    };
    window.addEventListener(LEAD_QUOTE_SELECTION_EVENT, handler);
    return () => window.removeEventListener(LEAD_QUOTE_SELECTION_EVENT, handler);
  }, [leadId, loadQuoteInvestment, validLeadType]);

  const investmentDisplay = useMemo(() => {
    if (activeQuote) {
      const configuration =
        activeQuote.configuration?.trim() || leadConfiguration.trim();
      return buildQuotationInvestmentDisplay(activeQuote, configuration, {
        selectedInBookingDone: activeQuoteSelectedInBooking,
      });
    }
    return buildBudgetInvestmentDisplay(leadBudget, leadConfiguration);
  }, [
    activeQuote,
    activeQuoteSelectedInBooking,
    leadBudget,
    leadConfiguration,
  ]);

  const leadDisplayIdentifier = useMemo(() => {
    if (baseDetail && validLeadType) {
      const lead = detailJsonToLead(baseDetail, validLeadType);
      return resolveLeadDisplayIdentifier(
        {
          externalReferenceId: lead.externalReferenceId,
          leadId: lead.leadId,
          leadIdentifier: requirements?.leadIdentifier,
          customerId: lead.customerId,
        },
        leadId,
      );
    }
    return resolveLeadDisplayIdentifier(
      { leadIdentifier: requirements?.leadIdentifier },
      leadId,
    );
  }, [baseDetail, leadId, requirements?.leadIdentifier, validLeadType]);

  const scrollToSection = useCallback((sectionId: ScopeSectionId) => {
    setActiveSectionId(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const sectionElements = scopeNavItems
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (!sectionElements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        const topEntry = visibleEntries[0];
        if (topEntry?.target.id) {
          setActiveSectionId(topEntry.target.id as ScopeSectionId);
        }
      },
      {
        rootMargin: "-12% 0px -55% 0px",
        threshold: [0.15, 0.35, 0.55, 0.75],
      },
    );

    sectionElements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <main
      className={`configuration-scope-page bg-[#f3f5f7] px-4 py-6 font-sans md:px-6 ${
        embedded ? "min-h-0" : "min-h-screen"
      }`}
    >
      <style>{`
        @keyframes scopeCelebrate {
          0% { opacity: 0; transform: translateY(14px) scale(0.9); }
          15% { opacity: 1; transform: translateY(0) scale(1.05); }
          55% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-8px) scale(0.98); }
        }
        @keyframes scopeConfettiPop {
          0% { opacity: 0; transform: scale(0.6) rotate(-8deg); }
          30% { opacity: 1; transform: scale(1.15) rotate(4deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        .scope-celebrate-card {
          animation: scopeCelebrate 2s ease-out forwards;
        }
        .scope-celebrate-emoji {
          animation: scopeConfettiPop 0.55s ease-out both;
        }
      `}</style>
      <div className="mx-auto grid max-w-[1320px] gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside
          data-print-hide
          className="sticky top-6 flex h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)] w-full flex-col self-start overflow-hidden rounded-xl border border-[#dfe5ec] bg-white"
        >
          <div className="flex min-h-0 flex-1 flex-col px-4 py-4 lg:py-5">
            <div className="shrink-0">
              <h2 className="text-[22px] font-extrabold leading-tight text-[#101828]">Scope Sections</h2>
              <p className="mt-1 text-[12px] font-semibold text-[#9ca3af]">7 Total Sections</p>
              <p className="mt-1 text-[11px] font-semibold text-[#9ca3af]">
                ID: #{leadDisplayIdentifier}
              </p>
            </div>

            <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
              {scopeNavItems.map((item, idx) => {
                const isActive = activeSectionId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => scrollToSection(item.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={`group relative flex w-full items-center gap-3.5 overflow-hidden rounded-lg border px-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10b981] ${
                        isActive
                          ? "border-[#e5e7eb] bg-[#f3f4f6] shadow-sm"
                          : `border-transparent bg-white ${SCOPE_NAV_IDLE}`
                      }`}
                    >
                      {isActive ? (
                        <div className="absolute top-0 right-0 h-full w-1 bg-[#f97316]" aria-hidden="true" />
                      ) : null}
                      <ScopeNavIcon type={item.icon} active={isActive} />
                      <span
                        className={`min-w-0 flex-1 text-[13px] font-semibold ${
                          isActive ? "text-[#111827]" : "text-[#374151]"
                        }`}
                      >
                        {idx + 1}. {item.label}
                      </span>
                      {item.status === "done" ? (
                        <span className="shrink-0 rounded bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#16a34a]">
                          Done
                        </span>
                      ) : null}
                      {item.status === "detailed" ? (
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#ea580c]">
                          Detailed
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 shrink-0 space-y-4 border-t border-[#eef1f5] pt-4">
              <div className="relative overflow-hidden rounded-xl bg-[#0f1b38] p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#94a3b8]">Conversion Chance</p>
                <p className="mt-1 text-[28px] font-bold leading-none text-white">High</p>
                <svg
                  viewBox="0 0 80 40"
                  className="absolute right-2 bottom-2 h-10 w-20 text-[#1e293b]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 32 20 22 36 26 52 14 68 8" />
                </svg>
              </div>

              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#d2dae5] bg-white px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#374151] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#a7f3d0] hover:bg-[#ecfdf5] hover:text-[#059669] hover:shadow-md active:scale-[0.98]"
                >
                  Back To Lead Details
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M19 12H5" />
                    <path d="m12 19-7-7 7-7" />
                  </svg>
                </button>
              ) : (
                <Link
                  href={`/Leads/${leadType}/${leadId}`}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#d2dae5] bg-white px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#374151] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#a7f3d0] hover:bg-[#ecfdf5] hover:text-[#059669] hover:shadow-md active:scale-[0.98]"
                >
                  Back To Lead Details
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M19 12H5" />
                    <path d="m12 19-7-7 7-7" />
                  </svg>
                </Link>
              )}
            </div>
          </div>
        </aside>

        <section className="configuration-scope-print-root space-y-4">
          <div className="configuration-scope-print-header mb-2 hidden">
            <h1 className="text-[22px] font-extrabold text-[#101828]">Configuration Scope</h1>
            <p className="mt-1 text-[13px] text-[#6b7280]">
              ID: #{leadDisplayIdentifier}
            </p>
          </div>
          {showMissingFieldHints && validationIssues.length > 0 ? (
            <div role="status" className={SCOPE_HINT_BANNER}>
              <p className="font-semibold text-[#8a5a28]">
                You’re almost there — a few gentle details and we’re ready to schedule
              </p>
              <p className="mt-1 text-[12px] text-[#9a6b2f]">
                Hover any soft amber field or the red * for a friendly reminder. Take your time.
              </p>
              <ul className="mt-2.5 space-y-1.5 border-t border-[#f0d9b5] pt-2.5">
                {validationIssues.map((issue) => (
                  <li
                    key={issue.key}
                    className="flex gap-2 text-[12px] leading-snug text-[#7a5530]"
                  >
                    <span className="mt-0.5 shrink-0 text-[#d4a35c]" aria-hidden="true">
                      ○
                    </span>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {showFinalizeCelebration ? (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center bg-[#0f172a]/30 backdrop-blur-[3px]"
            >
              <div className="scope-celebrate-card rounded-2xl border border-[#bbf7d0] bg-white px-9 py-7 text-center shadow-2xl">
                <p className="scope-celebrate-emoji text-[34px] leading-none" aria-hidden="true">
                  🎉
                </p>
                <p className="mt-2.5 text-[19px] font-extrabold tracking-tight text-[#0f8f3d]">
                  Scope locked in — you owned this!
                </p>
                <p className="mt-1.5 max-w-[280px] text-[13px] font-medium leading-snug text-[#4b5563]">
                  Next up: schedule the Hub Meeting and keep this deal moving.
                </p>
              </div>
            </div>
          ) : null}
          <div id="basic-understanding" className="scroll-mt-24">
            <BasicUnderstandingSection
              propertyNameSite={basicUnderstandingFields.propertyNameSite}
              familySizeDetails={basicUnderstandingFields.familySizeDetails}
              configuration={leadConfiguration}
              bookingType={bookingType}
              expectedTimeline={requirements?.expectedTimeline ?? ""}
              bookingTypeLoading={bookingTypeLoading}
              disabled={scopeFieldsDisabled}
              fieldErrors={
                showMissingFieldHints
                  ? {
                      propertyName: fieldErrorMessage.get("propertyName"),
                      configuration: fieldErrorMessage.get("configuration"),
                      bookingType: fieldErrorMessage.get("bookingType"),
                      expectedTimeline: fieldErrorMessage.get("expectedTimeline"),
                    }
                  : undefined
              }
              onPropertyNameSiteChange={(value) => {
                patchRequirements((prev) => ({
                  ...prev,
                  propertyName: value.trim() || null,
                }));
              }}
              onFamilySizeDetailsChange={(value) => {
                patchRequirements((prev) => {
                  const { propertyNameSite } = splitProjectUnderstanding(
                    prev.projectUnderstanding,
                  );
                  return {
                    ...prev,
                    projectUnderstanding: joinProjectUnderstanding(
                      propertyNameSite,
                      value,
                    ),
                  };
                });
              }}
              onBookingTypeChange={handleBookingTypeChange}
              onConfigurationChange={setLeadConfiguration}
              onExpectedTimelineChange={(value) => {
                patchRequirements((prev) => ({
                  ...prev,
                  expectedTimeline: value.trim() || null,
                }));
              }}
              wfhSetup={frontendPrefs.wfhSetup}
              petFriendly={frontendPrefs.petFriendly}
              onWfhSetupChange={(checked) => patchFrontendPrefs({ wfhSetup: checked })}
              onPetFriendlyChange={(checked) => patchFrontendPrefs({ petFriendly: checked })}
            />
          </div>
          <div id="requirements" className="scroll-mt-24">
            <RequirementScopeSection
              {...floorPlanProps}
              requirements={requirements}
              loading={requirementsLoading}
              saving={requirementsSaving}
              onPatchRequirements={patchRequirements}
              showFieldErrors={showMissingFieldHints}
              fieldErrors={
                showMissingFieldHints
                  ? {
                      rooms: fieldErrorMessage.get("rooms"),
                      roomsExtra: fieldErrorMessage.get("roomsExtra"),
                      floorPlan: fieldErrorMessage.get("floorPlan"),
                      byRoom: fieldErrorMessage,
                    }
                  : undefined
              }
            />
          </div>
          <div id="reference-inspiration" className="scroll-mt-24">
            <ReferenceInspirationSection
              leadType={validLeadType}
              leadId={leadId}
              references={references}
              loading={referencesLoading}
              uploading={referenceUploading}
              aestheticNotes={aestheticNotes}
              aestheticNotesSaving={aestheticNotesSaving}
              onAestheticNotesChange={(value) => {
                aestheticNotesDirtyRef.current = true;
                setAestheticNotes(value);
              }}
              onUpload={handleReferenceUpload}
              onDelete={handleReferenceDelete}
            />
          </div>
          <div id="budget-alignment" className="scroll-mt-24">
            <FinancialGuardrailsSection
              investmentLabel={investmentDisplay.investmentLabel}
              investmentSubtitle={investmentDisplay.subtitle}
              luxuryFocus={investmentDisplay.luxuryFocus}
              loading={bookingTypeLoading || quoteInvestmentLoading}
              sensitivity={frontendPrefs.financialSensitivity}
              financing={frontendPrefs.financingPreference}
              onSensitivityChange={(value) =>
                patchFrontendPrefs({ financialSensitivity: value })
              }
              onFinancingChange={(value) =>
                patchFrontendPrefs({ financingPreference: value })
              }
            />
          </div>
          <div id="internal-notes" className="scroll-mt-24">
            <InternalExecutiveNotesSection
              personalityType={requirements?.designStylePreference ?? ""}
              competition={requirements?.salesRiskNotes ?? ""}
              executiveSummary={requirements?.designHandoffNotes ?? ""}
              internalNotes={requirements?.internalExecutiveNotes ?? ""}
              disabled={scopeFieldsDisabled}
              lastSavedLabel={formatScopeLastSaved(lastSavedAt)}
              generatedByName={lastSavedBy}
              onPersonalityChange={(value) => {
                patchRequirements((prev) => ({
                  ...prev,
                  designStylePreference: value.trim() || null,
                }));
              }}
              onCompetitionChange={(value) => {
                patchRequirements((prev) => ({
                  ...prev,
                  salesRiskNotes: value.trim() || null,
                }));
              }}
              onExecutiveSummaryChange={(value) => {
                patchRequirements((prev) => ({
                  ...prev,
                  designHandoffNotes: value.trim() || null,
                }));
              }}
              onInternalNotesChange={(value) => {
                patchRequirements((prev) => ({
                  ...prev,
                  internalExecutiveNotes: value.length > 0 ? value : null,
                }));
              }}
              closureProbability={frontendPrefs.closureProbability}
              onClosureProbabilityChange={(value) =>
                patchFrontendPrefs({ closureProbability: value })
              }
              onPrintPdf={handlePrintPdf}
              onFinalizeSubmit={() => void handleFinalizeSubmit()}
              finalizing={finalizing}
              saving={requirementsSaving || aestheticNotesSaving}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function ScopeNavIcon({
  type,
  active = false,
}: {
  type: "understanding" | "requirements" | "reference" | "budget" | "notes";
  active?: boolean;
}) {
  const className = `h-4 w-4 shrink-0 transition-colors duration-200 ${
    active ? "text-[#059669]" : "text-[#6b7280] group-hover:text-[#374151]"
  }`;

  if (type === "understanding") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    );
  }
  if (type === "requirements") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    );
  }
  if (type === "reference") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    );
  }
  if (type === "budget") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function FinancialGuardrailsSection({
  investmentLabel,
  investmentSubtitle,
  luxuryFocus,
  loading,
  sensitivity,
  financing,
  onSensitivityChange,
  onFinancingChange,
}: {
  investmentLabel: string;
  investmentSubtitle: string;
  luxuryFocus: ReturnType<typeof resolveBudgetLuxuryFocus>;
  loading: boolean;
  sensitivity: FinancialSensitivity;
  financing: FinancingPreference;
  onSensitivityChange: (value: FinancialSensitivity) => void;
  onFinancingChange: (value: FinancingPreference) => void;
}) {
  return (
    <article className="rounded-xl border border-[#dfe5ec] bg-white p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#1ed760] text-white">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="2" />
            <path d="M6 10h.01M18 14h.01" />
          </svg>
        </span>
        <h3 className="text-[20px] font-extrabold text-[#101828]">4. Financial Guardrails</h3>
      </div>

      <div className="rounded-xl bg-[#0f1b38] p-5 text-white">
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4ade80]">Total Investment Range</p>
            <p className="mt-1 text-[42px] font-bold leading-none tracking-tight">
              {loading ? "…" : investmentLabel}
            </p>
            <p className="mt-2 text-[13px] text-[#c5d4f3]">{loading ? "Loading investment details…" : investmentSubtitle}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[#1a2644] px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#7b8db5]">Sensitivity</p>
                <div className="relative mt-1.5">
                  <select
                    value={sensitivity}
                    onChange={(e) => onSensitivityChange(e.target.value as FinancialSensitivity)}
                    className="h-[34px] w-full appearance-none rounded-md border border-[#31466f] bg-[#233256] px-2.5 pr-7 text-[13px] font-semibold text-white outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#9bb2e3]">▾</span>
                </div>
              </div>
              <div className="rounded-lg bg-[#1a2644] px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#7b8db5]">Financing</p>
                <div className="relative mt-1.5">
                  <select
                    value={financing}
                    onChange={(e) => onFinancingChange(e.target.value as FinancingPreference)}
                    className="h-[34px] w-full appearance-none rounded-md border border-[#31466f] bg-[#233256] px-2.5 pr-7 text-[13px] font-semibold text-white outline-none"
                  >
                    <option value="self_funded">Self Funded</option>
                    <option value="looking_for_emi">Looking For EMI</option>
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#9bb2e3]">▾</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.08em] text-[#9bb2e3]">
              <span>Value Focus</span>
              <span>Luxury Focus</span>
            </div>
            <div className="relative mt-2 h-1.5 rounded-full bg-[#2a3a5c]">
              <div
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1ed760] transition-all duration-500"
                style={{ left: loading ? "50%" : `${luxuryFocus.percent}%` }}
                aria-hidden="true"
              />
            </div>
            <p className="mt-3 text-[12px] italic text-[#c5d4f3]">
              {loading ? "Loading budget alignment…" : luxuryFocus.note}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function InternalExecutiveNotesSection({
  personalityType,
  competition,
  executiveSummary,
  internalNotes,
  disabled,
  lastSavedLabel,
  generatedByName,
  onPersonalityChange,
  onCompetitionChange,
  onExecutiveSummaryChange,
  onInternalNotesChange,
  closureProbability,
  onClosureProbabilityChange,
  onPrintPdf,
  onFinalizeSubmit,
  finalizing,
  saving,
}: {
  personalityType: string;
  competition: string;
  executiveSummary: string;
  internalNotes: string;
  disabled: boolean;
  lastSavedLabel: string;
  generatedByName: string;
  onPersonalityChange: (value: string) => void;
  onCompetitionChange: (value: string) => void;
  onExecutiveSummaryChange: (value: string) => void;
  onInternalNotesChange: (value: string) => void;
  closureProbability: ClosureProbability | null;
  onClosureProbabilityChange: (value: ClosureProbability) => void;
  onPrintPdf: () => void;
  onFinalizeSubmit: () => void;
  finalizing: boolean;
  saving: boolean;
}) {
  return (
    <article className="rounded-xl border border-[#dfe5ec] bg-white p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#1f2937] text-white">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </span>
        <h3 className="text-[20px] font-extrabold text-[#101828]">5. Internal Executive Notes</h3>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <FormLabel>Personality Type</FormLabel>
          <div className="relative mt-1.5">
            <select
              value={personalityType}
              disabled={disabled}
              onChange={(e) => onPersonalityChange(e.target.value)}
              className={`h-[42px] w-full appearance-none rounded-md border border-[#dfe5ec] bg-white px-3 text-[13px] font-medium text-[#374151] outline-none disabled:cursor-wait disabled:opacity-60 ${SCOPE_INPUT}`}
            >
              <option value="">Select personality</option>
              <option value="Analytical (Data Driven)">Analytical (Data Driven)</option>
              <option value="Visual (Mood Board Driven)">Visual (Mood Board Driven)</option>
              <option value="Pragmatic (Value Focused)">Pragmatic (Value Focused)</option>
              <option value="Luxury (Premium Focused)">Luxury (Premium Focused)</option>
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">▾</span>
          </div>
        </div>
        <div>
          <FormLabel>Closure Probability</FormLabel>
          <ClosureProbabilityToggle
            value={closureProbability}
            disabled={disabled}
            onChange={onClosureProbabilityChange}
          />
        </div>
        <div>
          <FormLabel>Competition</FormLabel>
          <input
            value={competition}
            disabled={disabled}
            onChange={(e) => onCompetitionChange(e.target.value)}
            placeholder="Livspace, HomeLane etc."
            className={`mt-1.5 h-[42px] w-full rounded-md border border-[#dfe5ec] bg-white px-3 text-[13px] text-[#374151] outline-none disabled:cursor-wait disabled:opacity-60 ${SCOPE_INPUT}`}
          />
        </div>
      </div>

      <div className="mt-4">
        <FormLabel>Executive Summary for Designer</FormLabel>
        <textarea
          value={executiveSummary}
          disabled={disabled}
          onChange={(e) => onExecutiveSummaryChange(e.target.value)}
          placeholder="Add specific notes about quirky requirements, negotiation hooks, or technical constraints..."
          className={`mt-1.5 min-h-[120px] w-full resize-y rounded-md border border-[#e4e8ef] bg-white px-3 py-2.5 text-[13px] text-[#374151] outline-none disabled:cursor-wait disabled:opacity-60 ${SCOPE_INPUT}`}
        />
      </div>

      <div className="mt-4">
        <FormLabel>Special Requirement / Offer Notes</FormLabel>
        <textarea
          value={internalNotes}
          disabled={disabled}
          onChange={(e) => onInternalNotesChange(e.target.value)}
          placeholder="Add special requirements, offer commitments, pricing exceptions, or handoff cautions..."
          className={`mt-1.5 min-h-[80px] w-full resize-y rounded-md border border-[#e4e8ef] bg-white px-3 py-2.5 text-[13px] text-[#374151] outline-none disabled:cursor-wait disabled:opacity-60 ${SCOPE_INPUT}`}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-[#e5e7eb] pt-4">
        <div>
          <p className="text-[13px] font-bold text-[#111827]">Last saved: {lastSavedLabel}</p>
          <p className="mt-0.5 text-[11px] text-[#9ca3af]">
            Generated by Sales Lead: {generatedByName}
          </p>
        </div>
        <div className="configuration-scope-print-actions flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPrintPdf}
            disabled={finalizing}
            className={`rounded-md border border-[#111827] bg-white px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#111827] disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none ${SCOPE_BTN_SECONDARY}`}
          >
            Print PDF
          </button>
          <button
            type="button"
            onClick={onFinalizeSubmit}
            disabled={finalizing || saving}
            className={`rounded-md bg-[#1ed760] px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[#05220f] disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none ${SCOPE_BTN_PRIMARY}`}
          >
            {finalizing ? "Saving…" : "Finalize & Submit"}
          </button>
        </div>
      </div>
    </article>
  );
}

function ReferenceInspirationSection({
  leadType,
  leadId,
  references,
  loading,
  uploading,
  aestheticNotes,
  aestheticNotesSaving,
  onAestheticNotesChange,
  onUpload,
  onDelete,
}: {
  leadType: CrmLeadType | null;
  leadId: string;
  references: ConfigurationScopeReference[];
  loading: boolean;
  uploading: boolean;
  aestheticNotes: string;
  aestheticNotesSaving: boolean;
  onAestheticNotesChange: (value: string) => void;
  onUpload: (file: File) => void | Promise<void>;
  onDelete: (referenceId: string) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { notifyError } = useGlobalNotifier();

  const openPicker = () => {
    if (!uploading && !loading) inputRef.current?.click();
  };

  const processFiles = async (files: FileList | File[] | null) => {
    if (!files?.length || uploading || loading) return;
    for (const file of Array.from(files)) {
      try {
        await onUpload(file);
      } catch {
        break;
      }
    }
  };

  return (
    <article className="rounded-xl border border-[#dfe5ec] bg-white p-4">
      <div className="mb-1 flex items-center gap-2.5">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#1ed760] text-white">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </span>
        <h3 className="text-[20px] font-extrabold text-[#101828]">3. Reference &amp; Inspiration</h3>
      </div>
      <p className="mb-4 text-[13px] text-[#9ca3af]">
        Upload customer reference images, sketches, or style inspiration.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={REFERENCE_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => void processFiles(e.target.files)}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void processFiles(e.dataTransfer.files);
        }}
        className={`group rounded-xl border border-dashed border-[#cfd6e0] bg-[#fafbfc] px-6 py-10 text-center ${
          uploading || loading ? "cursor-wait opacity-60" : `cursor-pointer ${SCOPE_UPLOAD_ZONE}`
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`mx-auto mb-4 h-10 w-10 text-[#4b7cff] ${SCOPE_TRANSITION} group-hover:scale-110 group-hover:text-[#059669]`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-[15px] font-bold text-[#111827]">
          {uploading ? "Uploading…" : "Click or Drag images here to upload"}
        </p>
        <p className="mt-1 text-[12px] text-[#9ca3af]">Support for JPG, PNG, PDF (Max 10MB per file)</p>
        <button
          type="button"
          disabled={uploading || loading}
          onClick={(e) => {
            e.stopPropagation();
            openPicker();
          }}
          className={`mt-5 rounded-md bg-[#0f172a] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none ${SCOPE_BTN_DARK}`}
        >
          Browse Files
        </button>
      </div>

      <div className="mt-5">
        <FormLabel>Reference Gallery</FormLabel>
        {loading ? (
          <p className="mt-2 text-[13px] text-[#9ca3af]">Loading references…</p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-3">
            {references.map((ref) => (
              <ReferenceGalleryTile
                key={ref.id}
                leadType={leadType}
                leadId={leadId}
                reference={ref}
                onDelete={() => void onDelete(ref.id)}
                onError={notifyError}
              />
            ))}
            {references.length < REFERENCE_MAX_FILES ? (
              <button
                type="button"
                aria-label="Add reference image"
                disabled={uploading}
                onClick={openPicker}
                className={`flex min-h-[100px] items-center justify-center rounded-lg border border-[#e4e8ef] bg-[#f3f4f6] text-[28px] font-light text-[#9ca3af] disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0 ${SCOPE_TILE_ADD}`}
              >
                +
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-5">
        <FormLabel>Additional Aesthetic Notes</FormLabel>
        <textarea
          value={aestheticNotes}
          disabled={loading || aestheticNotesSaving}
          onChange={(e) => onAestheticNotesChange(e.target.value)}
          placeholder="Mention specific details about lighting, textures, or mood from these references..."
          className={`mt-1.5 min-h-[100px] w-full resize-y rounded-md border border-[#e4e8ef] bg-white px-3 py-2.5 text-[13px] text-[#374151] outline-none disabled:cursor-wait disabled:opacity-60 ${SCOPE_INPUT}`}
        />
        {aestheticNotesSaving ? (
          <p className="mt-1 text-[11px] text-[#9ca3af]">Saving notes…</p>
        ) : null}
      </div>
    </article>
  );
}

function ReferenceGalleryTile({
  leadType,
  leadId,
  reference,
  onDelete,
  onError,
}: {
  leadType: CrmLeadType | null;
  leadId: string;
  reference: ConfigurationScopeReference;
  onDelete: () => void;
  onError: (message: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const blobUrlRef = useRef("");

  const label = referenceDisplayName(reference);
  const isPdf =
    reference.mimeType === "application/pdf" ||
    label.toLowerCase().endsWith(".pdf");

  const contentPath =
    leadType != null
      ? referenceViewUrlToProxy(reference.viewUrl, leadType, leadId, reference.id)
      : "";

  useEffect(() => {
    if (!leadType) return;
    let cancelled = false;

    void fetchReferenceContentBlob(contentPath)
      .then(({ blob }) => {
        if (cancelled) return;
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setPreviewUrl(url);
      })
      .catch((e) => {
        if (!cancelled) {
          onError(e instanceof Error ? e.message : "Unable to load reference preview.");
        }
      });

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = "";
      }
    };
  }, [contentPath, leadId, leadType, onError, reference.id, reference.viewUrl]);

  const openPreview = () => {
    if (!contentPath) return;
    setViewOpen(true);
  };

  return (
    <>
      <div
        className={`group relative min-h-[100px] overflow-hidden rounded-lg border border-[#e4e8ef] bg-[#f3f4f6] ${SCOPE_TRANSITION} hover:border-[#bbf7d0] hover:shadow-md`}
      >
        <button
          type="button"
          onClick={openPreview}
          disabled={!contentPath}
          className="flex h-full min-h-[100px] w-full cursor-pointer flex-col items-stretch text-left disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`View ${label}`}
        >
          {previewUrl && !isPdf ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={label} className="h-full min-h-[100px] w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[100px] w-full items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-8 w-8 text-[#c4cad4]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}
          <span className="absolute bottom-2 left-2 max-w-[calc(100%-2.5rem)] truncate rounded bg-white/95 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#111827] shadow-sm">
            {label}
          </span>
        </button>
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={`absolute right-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white ${SCOPE_BTN_DELETE_BADGE}`}
        >
          ×
        </button>
      </div>

      <ReferenceViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title={label}
        viewHref={contentPath}
        previewUrl={previewUrl}
        isPdf={isPdf}
      />
    </>
  );
}

function RequirementScopeSection({
  leadType,
  leadId,
  floorPlanS3Key,
  floorPlanPublicLink,
  floorPlanViewPath,
  floorPlanOpenPath,
  floorPlanUploading,
  onFloorPlanUpload,
  onFloorPlanError,
  requirements,
  loading,
  saving,
  onPatchRequirements,
  showFieldErrors = false,
  fieldErrors,
}: {
  leadType: string;
  leadId: string;
  floorPlanS3Key: string;
  floorPlanPublicLink: string;
  floorPlanViewPath: string;
  floorPlanOpenPath: string;
  floorPlanUploading: boolean;
  onFloorPlanUpload: (file: File) => void | Promise<void>;
  onFloorPlanError: (message: string) => void;
  requirements: ConfigurationScopeRequirements | null;
  loading: boolean;
  saving: boolean;
  onPatchRequirements: (
    patch: (prev: ConfigurationScopeRequirements) => ConfigurationScopeRequirements,
  ) => void;
  showFieldErrors?: boolean;
  fieldErrors?: {
    rooms?: string;
    roomsExtra?: string;
    floorPlan?: string;
    byRoom?: Map<string, string>;
  };
}) {
  const [newRoomName, setNewRoomName] = useState("");
  const catalog =
    requirements?.availableRoomCatalog?.length
      ? requirements.availableRoomCatalog
      : [...DEFAULT_ROOM_CATALOG];
  const selectedRooms = requirements?.selectedRooms ?? [];
  const selectedNames = new Set(
    selectedRooms.map((room) => room.roomName.trim().toLowerCase()),
  );

  const toggleRoom = (roomName: string) => {
    const key = roomName.trim().toLowerCase();
    onPatchRequirements((prev) => {
      const exists = prev.selectedRooms.some(
        (room) => room.roomName.trim().toLowerCase() === key,
      );
      if (exists) {
        return {
          ...prev,
          selectedRooms: prev.selectedRooms.filter(
            (room) => room.roomName.trim().toLowerCase() !== key,
          ),
        };
      }
      const nextRoom = createDefaultSelectedRoom(roomName, prev.selectedRooms.length);
      return {
        ...prev,
        selectedRooms: [...prev.selectedRooms, nextRoom],
      };
    });
  };

  const addCatalogRoom = () => {
    const trimmed = newRoomName.trim();
    if (!trimmed) return;
    onPatchRequirements((prev) => {
      const catalogSet = new Set(prev.availableRoomCatalog);
      catalogSet.add(trimmed);
      const exists = prev.selectedRooms.some(
        (room) => room.roomName.trim().toLowerCase() === trimmed.toLowerCase(),
      );
      const selectedRooms = exists
        ? prev.selectedRooms
        : [...prev.selectedRooms, createDefaultSelectedRoom(trimmed, prev.selectedRooms.length)];
      return {
        ...prev,
        availableRoomCatalog: Array.from(catalogSet),
        selectedRooms,
      };
    });
    setNewRoomName("");
  };

  const updateRoom = (roomId: string, patch: Partial<ScopeSelectedRoom>) => {
    onPatchRequirements((prev) => ({
      ...prev,
      selectedRooms: prev.selectedRooms.map((room) =>
        room.id === roomId ? { ...room, ...patch } : room,
      ),
    }));
  };

  const removeRoom = (room: ScopeSelectedRoom) => {
    const key = room.roomName.trim().toLowerCase();
    onPatchRequirements((prev) => ({
      ...prev,
      selectedRooms: prev.selectedRooms.filter(
        (entry) => entry.roomName.trim().toLowerCase() !== key,
      ),
      availableRoomCatalog: prev.availableRoomCatalog.filter(
        (name) => name.trim().toLowerCase() !== key,
      ),
    }));
  };

  const toggleMiscAddOn = (item: string) => {
    onPatchRequirements((prev) => {
      const selected = new Set(prev.miscAddOns);
      if (selected.has(item)) selected.delete(item);
      else selected.add(item);
      return { ...prev, miscAddOns: Array.from(selected) };
    });
  };

  return (
    <article className="rounded-xl border border-[#dfe5ec] bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#1ed760] text-white">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </span>
          <h3 className="text-[20px] font-extrabold text-[#101828]">2. Requirement Scope</h3>
        </div>
        {saving ? (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
            Saving…
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="text-[13px] text-[#9ca3af]">Loading requirement scope…</p>
      ) : (
        <div className="rounded-lg border border-[#e4e8ef] p-4">
          <FormLabel>Spaces to be Designed</FormLabel>
          {showFieldErrors && (fieldErrors?.rooms || fieldErrors?.roomsExtra) ? (
            <div className={`mt-2 px-3 py-2 text-[12px] font-medium text-[#9a6b2f] ${SCOPE_HINT_BANNER}`}>
              {fieldErrors.roomsExtra || fieldErrors.rooms}
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">Available Rooms</p>
              <div className="space-y-2">
                {catalog.map((roomName) => {
                  const selected = selectedNames.has(roomName.trim().toLowerCase());
                  return (
                    <button
                      key={roomName}
                      type="button"
                      onClick={() => toggleRoom(roomName)}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-[13px] font-semibold ${
                        selected
                          ? `border-[#1ed760] bg-[#f2fff8] text-[#0f8f3d] ${SCOPE_ROOM_SELECTED}`
                          : `border-[#e4e8ef] bg-white text-[#4b5563] ${SCOPE_ROOM_UNSELECTED}`
                      }`}
                    >
                      {roomName}
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                          selected
                            ? "bg-[#1ed760] text-white"
                            : "border border-[#d1d5db] bg-white text-[#9ca3af]"
                        }`}
                      >
                        {selected ? "✓" : "+"}
                      </span>
                    </button>
                  );
                })}
                <div className="flex items-center gap-2">
                  <input
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCatalogRoom();
                      }
                    }}
                    placeholder="New room name"
                    className={`min-w-0 flex-1 rounded-md border border-dashed border-[#d1d5db] bg-white px-3 py-2 text-[13px] text-[#374151] outline-none ${SCOPE_INPUT}`}
                  />
                  <ScopeAddPlusButton onClick={addCatalogRoom} ariaLabel="Add new room" />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
                Configuring Selected Spaces ({selectedRooms.length})
              </p>
              {selectedRooms.length === 0 ? (
                <p className="text-[13px] text-[#9ca3af]">Select rooms from the catalog to configure units and notes.</p>
              ) : (
                <div className="space-y-4">
                  {selectedRooms.map((room) => {
                    const roomKey = room.id || room.roomName;
                    return (
                    <RoomConfigCard
                      key={room.id}
                      room={room}
                      unitsError={fieldErrors?.byRoom?.get(`roomUnits:${roomKey}`)}
                      notesError={fieldErrors?.byRoom?.get(`roomNotes:${roomKey}`)}
                      onUpdate={(patch) => updateRoom(room.id, patch)}
                      onRemove={() => removeRoom(room)}
                    />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <ScopeExtrasSection
            leadType={leadType}
            leadId={leadId}
            floorPlanS3Key={floorPlanS3Key}
            floorPlanPublicLink={floorPlanPublicLink}
            floorPlanViewPath={floorPlanViewPath}
            floorPlanOpenPath={floorPlanOpenPath}
            floorPlanUploading={floorPlanUploading}
            onFloorPlanUpload={onFloorPlanUpload}
            onFloorPlanError={onFloorPlanError}
            floorPlanError={showFieldErrors ? fieldErrors?.floorPlan : undefined}
            miscAddOns={requirements?.miscAddOns ?? []}
            kitchenLayout={requirements?.kitchenLayout ?? ""}
            materialFinish={requirements?.materialFinish ?? ""}
            onMiscAddOnToggle={toggleMiscAddOn}
            onKitchenLayoutChange={(value) =>
              onPatchRequirements((prev) => ({ ...prev, kitchenLayout: value || null }))
            }
            onMaterialFinishChange={(value) =>
              onPatchRequirements((prev) => ({ ...prev, materialFinish: value || null }))
            }
          />
        </div>
      )}
    </article>
  );
}

function ScopeExtrasSection({
  leadType,
  leadId,
  floorPlanS3Key,
  floorPlanPublicLink,
  floorPlanViewPath,
  floorPlanOpenPath,
  floorPlanUploading,
  onFloorPlanUpload,
  onFloorPlanError,
  floorPlanError,
  miscAddOns,
  kitchenLayout,
  materialFinish,
  onMiscAddOnToggle,
  onKitchenLayoutChange,
  onMaterialFinishChange,
}: {
  leadType: string;
  leadId: string;
  floorPlanS3Key: string;
  floorPlanPublicLink: string;
  floorPlanViewPath: string;
  floorPlanOpenPath: string;
  floorPlanUploading: boolean;
  onFloorPlanUpload: (file: File) => void | Promise<void>;
  onFloorPlanError: (message: string) => void;
  floorPlanError?: string;
  miscAddOns: string[];
  kitchenLayout: string;
  materialFinish: string;
  onMiscAddOnToggle: (item: string) => void;
  onKitchenLayoutChange: (value: string) => void;
  onMaterialFinishChange: (value: string) => void;
}) {
  const addOnOptions = miscAddOnOptions([], miscAddOns);
  const selectedAddOns = new Set(miscAddOns);

  return (
    <>
      <div className="mt-5 rounded-lg border border-dashed border-[#cfd6e0] bg-[#fafbfc] p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#e8f0f8] text-[#6b8aad]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="5" r="1.5" />
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="19" cy="5" r="1.5" />
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </span>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#374151]">Miscellaneous Add-ons</p>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {addOnOptions.map((item) => {
            const checked = selectedAddOns.has(item);
            return (
              <label
                key={item}
                className={`flex min-h-[42px] cursor-pointer items-center justify-between rounded-md border border-[#e4e8ef] bg-white px-3 py-2 text-[13px] font-medium text-[#374151] ${SCOPE_CHIP}`}
              >
                {item}
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onMiscAddOnToggle(item)}
                  className="sr-only"
                />
                <span
                  className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] border ${
                    checked ? "border-[#1ed760] bg-[#1ed760] text-[10px] text-white" : "border-[#d1d5db] bg-white"
                  }`}
                >
                  {checked ? "✓" : ""}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className={`mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr] ${floorPlanError ? `p-2 ${SCOPE_HINT_RING}` : ""}`}>
        <div>
          <FormLabel required requiredHint={REQUIRED_FIELD_HINTS.floorPlan}>
            Floor Plan
          </FormLabel>
          <div className="mt-1.5">
          <ConfigurationScopeFloorPlan
            leadType={leadType}
            leadId={leadId}
            floorPlanS3Key={floorPlanS3Key}
            floorPlanPublicLink={floorPlanPublicLink}
            floorPlanViewPath={floorPlanViewPath}
            floorPlanOpenPath={floorPlanOpenPath}
            uploading={floorPlanUploading}
            onUpload={onFloorPlanUpload}
            onError={onFloorPlanError}
          />
          </div>
          <FieldHintText message={floorPlanError} />
        </div>

        <div className="flex flex-col justify-center gap-4">
          <div>
            <FormLabel>Kitchen Layout</FormLabel>
            <input
              value={kitchenLayout}
              onChange={(e) => onKitchenLayoutChange(e.target.value)}
              placeholder="e.g. L-Shaped with Island"
              className={`mt-1.5 h-[42px] w-full rounded-md border border-[#dfe5ec] bg-white px-3 text-[14px] font-medium text-[#374151] outline-none ${SCOPE_INPUT}`}
            />
          </div>
          <div>
            <FormLabel>Material Finish</FormLabel>
            <input
              value={materialFinish}
              onChange={(e) => onMaterialFinishChange(e.target.value)}
              placeholder="e.g. High Gloss Acrylic"
              className={`mt-1.5 h-[42px] w-full rounded-md border border-[#dfe5ec] bg-white px-3 text-[14px] font-medium text-[#374151] outline-none ${SCOPE_INPUT}`}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function RoomConfigCard({
  room,
  onUpdate,
  onRemove,
  unitsError,
  notesError,
}: {
  room: ScopeSelectedRoom;
  onUpdate: (patch: Partial<ScopeSelectedRoom>) => void;
  onRemove: () => void;
  unitsError?: string;
  notesError?: string;
}) {
  const [newUnitLabel, setNewUnitLabel] = useState("");

  const toggleUnit = (label: string) => {
    onUpdate({
      units: room.units.map((unit) =>
        unit.label === label ? { ...unit, selected: !unit.selected } : unit,
      ),
    });
  };

  const addUnit = () => {
    const trimmed = newUnitLabel.trim();
    if (!trimmed) return;
    if (room.units.some((unit) => unit.label.toLowerCase() === trimmed.toLowerCase())) {
      setNewUnitLabel("");
      return;
    }
    onUpdate({
      units: [...room.units, { label: trimmed, selected: true }],
    });
    setNewUnitLabel("");
  };

  const roomHasError = Boolean(unitsError || notesError);

  return (
    <div
      className={`rounded-lg border bg-[#f6fff9] p-4 ${
        roomHasError ? SCOPE_HINT_ROOM : "border-[#b8f0cc]"
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#1ed760] text-[11px] font-bold text-white">
            {room.iconLabel || defaultRoomIcon(room.roomName)}
          </span>
          <p className="text-[13px] font-bold uppercase tracking-wide text-[#111827]">{room.roomName}</p>
        </div>
        <button type="button" aria-label={`Remove ${room.roomName}`} onClick={onRemove} className={`text-[#ef4444] ${SCOPE_BTN_DANGER_ICON}`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div>
          <FormLabel required requiredHint={REQUIRED_FIELD_HINTS.roomUnits}>
            Units Required (min. 2)
          </FormLabel>
          <div className={`mt-2 flex flex-wrap gap-2 ${unitsError ? `p-1 ${SCOPE_HINT_RING}` : ""}`}>
            {room.units.map((unit) => (
              <button
                key={unit.label}
                type="button"
                onClick={() => toggleUnit(unit.label)}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${
                  unit.selected
                    ? `bg-[#1ed760] text-[#05220f] ${SCOPE_UNIT_ACTIVE}`
                    : `border border-[#e4e8ef] bg-white text-[#6b7280] ${SCOPE_UNIT_IDLE}`
                }`}
              >
                {unit.label}
              </button>
            ))}
            <span className={`inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#d1d5db] bg-white py-1 pl-2 pr-1 ${SCOPE_CHIP}`}>
              <input
                value={newUnitLabel}
                onChange={(e) => setNewUnitLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addUnit();
                  }
                }}
                placeholder="Add unit"
                className="w-20 bg-transparent text-[12px] text-[#374151] outline-none"
              />
              <ScopeAddPlusButton onClick={addUnit} ariaLabel="Add unit" size="sm" />
            </span>
          </div>
          <FieldHintText message={unitsError} />
        </div>
        <div>
          <FormLabel>False Ceiling</FormLabel>
          <button
            type="button"
            onClick={() =>
              onUpdate({ falseCeilingRequired: !Boolean(room.falseCeilingRequired) })
            }
            className={`mt-2 flex w-full cursor-pointer items-center gap-2 rounded-md border border-[#e4e8ef] bg-white px-3 py-2 text-left ${SCOPE_CHIP}`}
            aria-pressed={Boolean(room.falseCeilingRequired)}
          >
            <span
              className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${
                room.falseCeilingRequired
                  ? "border-[#1ed760] bg-[#1ed760] text-[10px] text-white"
                  : "border-[#d1d5db] bg-white"
              }`}
              aria-hidden="true"
            >
              {room.falseCeilingRequired ? "✓" : ""}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9ca3af]">
              Required
            </span>
          </button>
        </div>
      </div>

      <div className="mt-4">
        <FormLabel required requiredHint={REQUIRED_FIELD_HINTS.roomNotes}>
          Specific Room Notes
        </FormLabel>
        <textarea
          value={room.notes ?? ""}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          placeholder="e.g. Minimalist vibe, warm lighting..."
          className={`mt-1 min-h-[72px] w-full rounded-md border bg-white px-3 py-2 text-[13px] text-[#374151] outline-none ${
            notesError ? SCOPE_FIELD_HINT : `border-[#e4e8ef] ${SCOPE_INPUT}`
          }`}
        />
        <FieldHintText message={notesError} />
      </div>
    </div>
  );
}

function BasicUnderstandingSection({
  propertyNameSite,
  familySizeDetails,
  configuration,
  bookingType,
  expectedTimeline,
  bookingTypeLoading,
  disabled,
  fieldErrors,
  onPropertyNameSiteChange,
  onFamilySizeDetailsChange,
  onBookingTypeChange,
  onConfigurationChange,
  onExpectedTimelineChange,
  wfhSetup,
  petFriendly,
  onWfhSetupChange,
  onPetFriendlyChange,
}: {
  propertyNameSite: string;
  familySizeDetails: string;
  configuration: string;
  bookingType: string;
  expectedTimeline: string;
  bookingTypeLoading: boolean;
  disabled: boolean;
  fieldErrors?: {
    propertyName?: string;
    configuration?: string;
    bookingType?: string;
    expectedTimeline?: string;
  };
  onPropertyNameSiteChange: (value: string) => void;
  onFamilySizeDetailsChange: (value: string) => void;
  onBookingTypeChange: (value: string) => void;
  onConfigurationChange: (value: string) => void;
  onExpectedTimelineChange: (value: string) => void;
  wfhSetup: boolean;
  petFriendly: boolean;
  onWfhSetupChange: (checked: boolean) => void;
  onPetFriendlyChange: (checked: boolean) => void;
}) {
  return (
    <article className="rounded-xl border border-[#dfe5ec] bg-white p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#1ed760] text-[12px] font-bold text-white">
          i
        </span>
        <h3 className="text-[20px] font-extrabold text-[#101828]">1. Basic Understanding</h3>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#e4e8ef]">
        <div className="grid lg:grid-cols-[1fr_220px]">
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div className="md:col-span-1">
              <FormLabel required requiredHint={REQUIRED_FIELD_HINTS.propertyName}>
                Property Name / Site
              </FormLabel>
              <input
                value={propertyNameSite}
                disabled={disabled}
                onChange={(e) => onPropertyNameSiteChange(e.target.value)}
                placeholder="Sharma Heights, Block C"
                className={`mt-1 w-full rounded-md border bg-white px-3 py-2 text-[14px] text-[#374151] outline-none disabled:cursor-wait disabled:opacity-60 ${
                  fieldErrors?.propertyName ? SCOPE_FIELD_HINT : `border-[#dfe5ec] ${SCOPE_INPUT}`
                }`}
              />
              <FieldHintText message={fieldErrors?.propertyName} />
            </div>
            <div className="md:col-span-1">
              <FormLabel>Family Size &amp; Details</FormLabel>
              <input
                value={familySizeDetails}
                disabled={disabled}
                onChange={(e) => onFamilySizeDetailsChange(e.target.value)}
                placeholder="e.g. 2 Adults, 1 Child, 1 Pet"
                className={`mt-1 w-full rounded-md border border-[#dfe5ec] bg-white px-3 py-2 text-[14px] text-[#374151] outline-none disabled:cursor-wait disabled:opacity-60 ${SCOPE_INPUT}`}
              />
            </div>
            <div>
              <FormLabel required requiredHint={REQUIRED_FIELD_HINTS.bhkType}>
                BHK Type
              </FormLabel>
              <div className="relative mt-1">
                <select
                  disabled={disabled}
                  value={configuration || ""}
                  onChange={(e) => onConfigurationChange(e.target.value)}
                  className={`w-full appearance-none rounded-md border px-3 py-2 text-[14px] text-[#374151] outline-none ${
                    fieldErrors?.configuration
                      ? SCOPE_FIELD_HINT
                      : "border-[#dfe5ec] bg-[#f9fafb]"
                  }`}
                >
                  <option value="">Select BHK Type</option>
                  {CONFIGURATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  {configuration &&
                  !CONFIGURATION_OPTIONS.includes(
                    configuration as (typeof CONFIGURATION_OPTIONS)[number],
                  ) ? (
                    <option value={configuration}>{configuration}</option>
                  ) : null}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">▾</span>
              </div>
              <FieldHintText message={fieldErrors?.configuration} />
            </div>
            <div>
              <FormLabel required requiredHint={REQUIRED_FIELD_HINTS.scopeBookingType}>
                Type
              </FormLabel>
              <div className="relative mt-1">
                <select
                  value={bookingType}
                  disabled={bookingTypeLoading || disabled}
                  onChange={(e) => onBookingTypeChange(e.target.value)}
                  className={`w-full appearance-none rounded-md border px-3 py-2 text-[14px] text-[#374151] outline-none disabled:cursor-wait disabled:opacity-60 ${
                    fieldErrors?.bookingType ? SCOPE_FIELD_HINT : `border-[#dfe5ec] bg-white ${SCOPE_INPUT}`
                  }`}
                >
                  <option value="">{bookingTypeLoading ? "Loading…" : "Select Type"}</option>
                  {BOOKING_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {bookingTypeDisplay(option)}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">▾</span>
              </div>
              <FieldHintText message={fieldErrors?.bookingType} />
            </div>
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <CheckboxField
                label="WFH Setup"
                checked={wfhSetup}
                disabled={disabled}
                onChange={onWfhSetupChange}
              />
              <CheckboxField
                label="Pet Friendly"
                checked={petFriendly}
                disabled={disabled}
                onChange={onPetFriendlyChange}
              />
            </div>
          </div>

          <div
            className={`border-l-2 p-4 ${
              fieldErrors?.expectedTimeline
                ? SCOPE_HINT_PANEL
                : "border-[#1ed760] bg-[#f5f7fa]"
            }`}
          >
            <FormLabel required requiredHint={REQUIRED_FIELD_HINTS.expectedTimeline}>
              Timeline Expectation
            </FormLabel>
            <div className="mt-3 space-y-3">
              {TIMELINE_EXPECTATION_OPTIONS.map((option) => (
                <RadioOption
                  key={option.value}
                  label={option.label}
                  selected={expectedTimeline === option.value}
                  disabled={disabled}
                  onSelect={() => onExpectedTimelineChange(option.value)}
                />
              ))}
            </div>
            <FieldHintText message={fieldErrors?.expectedTimeline} />
          </div>
        </div>
      </div>
    </article>
  );
}

function FormLabel({
  children,
  required = false,
  requiredHint,
}: {
  children: ReactNode;
  required?: boolean;
  requiredHint?: string;
}) {
  return (
    <p className="inline-flex items-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">
      {children}
      {required && requiredHint ? <RequiredAsterisk message={requiredHint} /> : null}
    </p>
  );
}

function CheckboxField({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label
      className={`inline-flex items-center gap-2 rounded-md border border-[#e4e8ef] bg-white px-3 py-2 ${
        disabled ? "cursor-not-allowed opacity-60" : `cursor-pointer ${SCOPE_CHIP}`
      }`}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9ca3af]">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="sr-only"
      />
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded-[3px] border ${
          checked ? "border-[#1ed760] bg-[#1ed760] text-[10px] text-white" : "border-[#d1d5db] bg-white"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
    </label>
  );
}

const CLOSURE_PROBABILITY_OPTIONS: { value: ClosureProbability; label: string }[] = [
  { value: "hot", label: "Hot" },
  { value: "warm", label: "Warm" },
  { value: "cold", label: "Cold" },
];

function ClosureProbabilityToggle({
  value,
  disabled = false,
  onChange,
}: {
  value: ClosureProbability | null;
  disabled?: boolean;
  onChange: (value: ClosureProbability) => void;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {CLOSURE_PROBABILITY_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-4 py-2 text-[11px] font-bold uppercase tracking-wide transition ${
              selected
                ? "bg-[#1ed760] text-[#05220f]"
                : "border border-[#e4e8ef] bg-white text-[#9ca3af] hover:border-[#bbf7d0] hover:bg-[#f9fdfb]"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function RadioOption({
  label,
  selected,
  disabled = false,
  onSelect,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  return (
    <label
      className={`flex items-center gap-2 rounded-md px-1 py-0.5 ${disabled ? "cursor-not-allowed opacity-60" : `cursor-pointer ${SCOPE_TRANSITION} hover:bg-[#f0fdf4]`}`}
    >
      <input
        type="radio"
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect?.()}
        className="sr-only"
      />
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full border-2 ${
          selected ? "border-[#1ed760]" : "border-[#d1d5db]"
        }`}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-[#1ed760]" /> : null}
      </span>
      <span className="text-[13px] font-medium text-[#374151]">{label}</span>
    </label>
  );
}
