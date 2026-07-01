"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FieldLabel, Input, Select, Textarea } from "@/app/Components/CrmLeadDetails/ui";
import FloorPlanUpload from "@/app/Components/CrmLeadDetails/FloorPlanUpload";
import DesignPreferencesWithModal from "./DesignPreferencesWithModal";
import ActivityHistoryWithConnector, {
  type ActivityHistoryHandle,
} from "./ActivityHistoryWithConnector";
import DealControlSidebar from "./DealControlSidebar";
import DataCompletenessMeter from "./DataCompletenessMeter";
import {
  V2_BTN_AMBER,
  V2_BTN_DONE,
  V2_BTN_DROPDOWN,
  V2_BTN_GHOST_ICON,
  V2_BTN_ICON,
  V2_BTN_LIST_ITEM,
  V2_BTN_PRIMARY,
  V2_BTN_SECONDARY,
  V2_BTN_VIOLET,
  V2_INPUT,
  V2_CARD_LINK,
  V2_LINK_TEXT,
} from "./lead-detail-v2-motion";
import { useLeadDetailV2 } from "./LeadDetailV2Context";
import { useGlobalNotifier } from "@/app/Components/Shared/GlobalNotifier";
import {
  createDefaultRequirements,
  getConfigurationScopeRequirements,
  mergeRequirementDefaults,
  putConfigurationScopeRequirements,
  toPutRequirementsBody,
  type ConfigurationScopeRequirements,
} from "@/lib/configuration-scope-client";
import { resolveMeetingTypeForLead } from "@/lib/appointment-client";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import { BUDGET_OPTIONS, BOOKING_TYPE_OPTIONS, LANGUAGE_OPTIONS } from "@/lib/data";
import { formatLeadSourceLabel } from "@/lib/lead-source-utils";
import {
  bookingTypeDisplay,
  meetingTypeDisplay,
  resolveLeadDetailUiPhase,
  resolveLeadDisplayIdentifier,
  resolvePhaseAccessState,
  type LeadDetailUiPhaseId,
  type PhaseAccessState,
} from "@/lib/lead-detail-v2-display";
import { resolveLeadPhoneDisplayForRole } from "@/lib/lead-display";
import { formatCrmDateTime } from "@/lib/date-time-format";
import type { CrmLeadType } from "@/lib/leads-filter";
import type { ActivityItem, Lead } from "@/lib/data";

type DiscoveryPhaseDraft = Pick<
  Lead,
  "propertyLocation" | "budget" | "language" | "configuration" | "propertyNotes" | "bookingType"
>;

function readDiscoveryPhaseDraft(lead: Lead): DiscoveryPhaseDraft {
  return {
    propertyLocation: lead.propertyLocation ?? "",
    budget: lead.budget ?? "",
    language: lead.language ?? "",
    configuration: lead.configuration ?? "",
    propertyNotes: lead.propertyNotes ?? "",
    bookingType: lead.bookingType ?? "",
  };
}

function discoveryPhaseDraftsEqual(a: DiscoveryPhaseDraft, b: DiscoveryPhaseDraft): boolean {
  return (
    a.propertyLocation === b.propertyLocation &&
    a.budget === b.budget &&
    a.language === b.language &&
    a.configuration === b.configuration &&
    a.propertyNotes === b.propertyNotes &&
    a.bookingType === b.bookingType
  );
}

type Props = {
  leadType: string;
  leadId: string;
};

type PhaseItem = {
  id: LeadDetailUiPhaseId;
  title: string;
};

const phaseItems: PhaseItem[] = [
  { id: "discovery", title: "1. Discovery Phase" },
  { id: "connection", title: "2. Connection Phase" },
  { id: "experience", title: "3. Experience Phase" },
  { id: "decision", title: "4. Decision Phase" },
];

export default function NewLeadDetailPage({ leadType, leadId }: Props) {
  const { lead } = useLeadDetailV2();
  const activityPanelRef = useRef<ActivityHistoryHandle>(null);
  const currentPhaseId = resolveLeadDetailUiPhase(lead);

  const openActivityPanel = useCallback(() => {
    activityPanelRef.current?.openPanel();
  }, []);

  return (
    <main className="min-h-screen bg-[#eef1f5] px-3 py-4 font-sans md:px-4">
      <div className="mx-auto max-w-[1480px]">
        <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
          <DealControlSidebar onActivityClick={openActivityPanel} />
          <section className="rounded-xl border border-[#e1e6ed] bg-[#f3f5f8] p-3">
            <LeadDetailHeader />
            <div className="mt-3 grid gap-3 lg:grid-cols-[270px_minmax(0,1fr)]">
              <aside className="space-y-3">
                <div id="deal-overview" className="scroll-mt-24">
                  <LeadProfileCard />
                </div>
                <FamilyContactCard />
                <div id="deal-activity" className="scroll-mt-24">
                  <ActivityHistoryWithConnector
                    ref={activityPanelRef}
                    activities={lead.activities as ActivityItem[]}
                  />
                </div>
              </aside>

              <section className="space-y-3">
                {phaseItems.map((phase) => {
                  const accessState = resolvePhaseAccessState(currentPhaseId, phase.id);
                  if (phase.id === "discovery") {
                    return (
                      <div key={phase.id} id="deal-property" className="scroll-mt-24">
                        <DiscoveryPhaseCard accessState={accessState} />
                      </div>
                    );
                  }
                  if (phase.id === "connection") {
                    return (
                      <div key={phase.id} id="deal-connection" className="scroll-mt-24">
                        <ConnectionPhaseCard accessState={accessState} />
                      </div>
                    );
                  }
                  if (phase.id === "experience") {
                    return (
                      <ExperiencePhaseCard
                        key={phase.id}
                        leadType={leadType}
                        leadId={leadId}
                        accessState={accessState}
                      />
                    );
                  }
                  if (phase.id === "decision") {
                    return (
                      <div key={phase.id} id="deal-blockers" className="scroll-mt-24">
                        <DecisionPhaseCard accessState={accessState} />
                      </div>
                    );
                  }
                  return null;
                })}
              </section>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function LeadDetailHeader() {
  const {
    leadType,
    leadId,
    lead,
    createdTimelineOptions,
    createdTimelineLoading,
    selectedTimelineValue,
    onCreatedTimelineChange,
    canStageRollback,
    onOpenStageRollback,
    onCompleteTask,
    completeTaskDisabled,
    onPhoneCall,
    onMarkAsWon,
    showMarkAsWon,
    followUpDateDisplay,
    milestoneStageLabel,
    milestoneCategoryLabel,
    milestoneSubLabel,
  } = useLeadDetailV2();
  const [timelineOpen, setTimelineOpen] = useState(false);
  const timelineWrapRef = useRef<HTMLDivElement | null>(null);
  const selectedTimeline =
    createdTimelineOptions.find((x) => x.value === selectedTimelineValue) ?? null;
  const leadComeCount = createdTimelineOptions.length;

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!timelineWrapRef.current?.contains(event.target as Node)) {
        setTimelineOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const headerFollowUpDate =
    followUpDateDisplay && followUpDateDisplay !== "Not scheduled"
      ? followUpDateDisplay
      : formatCrmDateTime(lead.followUpDate);

  const handleHeaderPhoneCall = useCallback(() => {
    void (async () => {
      try {
        await onPhoneCall?.();
      } catch {
        /* still open dialer */
      }
      const n = (lead.phone ?? "").replace(/\s+/g, "");
      if (n) window.location.href = `tel:${n}`;
    })();
  }, [lead.phone, onPhoneCall]);

  return (
    <div className="py-4 lg:py-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_440px] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center justify-center rounded-[4px] border border-[#f4a525] bg-[#fff9ef] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.09em] text-[#f4a525]">
              Priority Lead
            </span>
            <LeadSourceBadge
              primary={formatLeadSourceLabel(lead.leadSource)}
              extras={lead.additionalLeadSourcesList}
            />
          </div>

          <p className="mt-1 text-[40px] font-bold leading-tight tracking-[-0.01em] text-[#0f1729]">
            Lead Information
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CreatedMetaChip createdAt={lead.createdAt} />
            <span className="inline-flex items-center rounded-full border border-[#e2e8f0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#64748b]">
              Lead came {leadComeCount} times
            </span>
          </div>

          <div className="mt-2 grid max-w-[520px] grid-cols-3 gap-2">
            <InfoPill title="Stage" value={milestoneStageLabel || "—"} compact />
            <InfoPill title="Category" value={milestoneCategoryLabel || "—"} compact />
            <InfoPill title="Sub-Stage" value={milestoneSubLabel || "—"} compact />
          </div>

          <div className="mt-3 max-w-[560px]">
            <DataCompletenessMeter />
          </div>
        </div>

        <div className="w-full lg:mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            {canStageRollback ? (
              <button
                type="button"
                onClick={onOpenStageRollback}
                className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] border border-[#fcd34d] bg-[#fffbeb] px-3.5 text-[12px] font-bold uppercase tracking-wide text-[#92400e] ${V2_BTN_AMBER}`}
              >
                <span aria-hidden>↩</span>
                Stage Rollback
              </button>
            ) : null}
          </div>

          <div className="w-full rounded-[8px] border border-[#dde3ec] bg-[#f4f7fb] px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#9aa7bb]">Next Follow Up</p>
            <div className="mt-2 flex min-h-[42px] w-full items-center gap-3 rounded-[6px] border border-[#d8dfeb] bg-[#fdfefe] px-3 py-2 sm:px-4">
              <span
                className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-extrabold leading-tight tracking-[-0.01em] text-[#1f2a3c] sm:text-[17px]"
                title={headerFollowUpDate}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-[14px] w-[14px] shrink-0 text-[#35d977]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span className="truncate">{headerFollowUpDate}</span>
              </span>

              <div className="h-[22px] w-px shrink-0 bg-[#dfe5ee]" aria-hidden="true" />

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  aria-label="Call"
                  disabled={!lead.phone?.trim()}
                  onClick={handleHeaderPhoneCall}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#f1f4f8] text-[#6f7d90] disabled:cursor-not-allowed disabled:opacity-50 ${V2_BTN_ICON}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-[16px] w-[16px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.8.62 2.66a2 2 0 0 1-.45 2.11L8 9.92a16 16 0 0 0 6.08 6.08l1.43-1.28a2 2 0 0 1 2.11-.45c.86.29 1.76.5 2.66.62A2 2 0 0 1 22 16.92z" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Message"
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#f1f4f8] text-[#6f7d90] ${V2_BTN_ICON}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-[16px] w-[16px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Schedule"
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-[4px] bg-[#f1f4f8] text-[#6f7d90] ${V2_BTN_ICON}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-[16px] w-[16px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div
            className={`mt-2.5 grid gap-2.5 ${showMarkAsWon ? "grid-cols-2" : "grid-cols-1"}`}
          >
            {showMarkAsWon ? (
              <button
                type="button"
                onClick={onMarkAsWon}
                className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] bg-[#1dde63] text-[12px] font-bold uppercase tracking-wide text-[#05220f] ${V2_BTN_PRIMARY}`}
              >
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#0f9d3d] text-[10px] leading-none text-[#0f9d3d]">
                  ✓
                </span>
                Mark As Won
              </button>
            ) : null}
            <button
              type="button"
              onClick={onCompleteTask}
              disabled={completeTaskDisabled}
              className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-[6px] border border-[#d6dce6] bg-white text-[12px] font-bold uppercase tracking-wide text-[#111827] disabled:cursor-not-allowed disabled:opacity-60 ${V2_BTN_SECONDARY}`}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#7d8998] text-[10px] leading-none text-[#7d8998]">
                ⊙
              </span>
              Complete Task
            </button>
          </div>

          <div className="mt-2.5 w-full" ref={timelineWrapRef}>
            <button
              type="button"
              className={`inline-flex w-full items-center justify-between gap-2 rounded-[8px] border border-[#d6dce6] bg-[#f8fafc] px-3 py-2 text-left text-[12px] font-semibold text-[#334155] outline-none focus:border-[#94a3b8] focus:ring-2 focus:ring-[#e2e8f0] disabled:cursor-not-allowed disabled:opacity-60 ${V2_BTN_DROPDOWN}`}
              aria-haspopup="listbox"
              aria-expanded={timelineOpen}
              aria-label="Lead come history"
              title={selectedTimeline?.fullLabel}
              disabled={createdTimelineLoading || createdTimelineOptions.length === 0}
              onClick={() => setTimelineOpen((v) => !v)}
            >
              <span className="truncate">
                {selectedTimeline?.label ?? "Lead created timeline"}
              </span>
              <span aria-hidden className="shrink-0 text-[10px] text-[#94a3b8]">
                {timelineOpen ? "▲" : "▼"}
              </span>
            </button>
            {timelineOpen ? (
              <div
                role="listbox"
                className="mt-1 max-h-56 w-full overflow-y-auto rounded-[8px] border border-[#e2e8f0] bg-white p-1 shadow-lg"
              >
                {createdTimelineOptions.map((item) => {
                  const isSelected = item.value === selectedTimelineValue;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`block w-full rounded-[6px] px-2.5 py-2 text-left text-[12px] ${
                        isSelected
                          ? "bg-[#e8fbf0] font-semibold text-[#0f8f3d]"
                          : `text-[#475569] ${V2_BTN_LIST_ITEM}`
                      }`}
                      title={item.fullLabel}
                      onClick={() => {
                        onCreatedTimelineChange(item.value);
                        setTimelineOpen(false);
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadSourceBadge({ primary, extras }: { primary: string; extras?: string[] }) {
  const label = primary || extras?.[0] || "External Lead";
  return (
    <span className="inline-flex items-center rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#1d4ed8]">
      {label}
    </span>
  );
}

function CreatedMetaChip({ createdAt }: { createdAt: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bae6fd] bg-[#f0f9ff] px-2.5 py-1 text-[11px] font-semibold text-[#0369a1]">
      <span aria-hidden>🕐</span>
      <span>Created {createdAt}</span>
    </span>
  );
}

function familyContactRoleStorageKey(leadId: string): string {
  return `crm-family-contact-role:${leadId.trim()}`;
}

function readFamilyContactRole(leadId: string): string {
  if (typeof window === "undefined") return "";
  return (sessionStorage.getItem(familyContactRoleStorageKey(leadId)) ?? "").trim();
}

function persistFamilyContactRole(leadId: string, role: string): void {
  if (typeof window === "undefined") return;
  const key = familyContactRoleStorageKey(leadId);
  const value = role.trim();
  if (!value) sessionStorage.removeItem(key);
  else sessionStorage.setItem(key, value);
}

type FamilyContactDraft = {
  name: string;
  role: string;
  phone: string;
};

function readFamilyContactDraft(
  requirements: ConfigurationScopeRequirements | null,
  lead: Lead,
  role: string,
): FamilyContactDraft {
  return {
    name: requirements?.familyContactName?.trim() ?? "",
    role,
    phone:
      requirements?.familyContactPhone?.trim() ||
      lead.altPhone?.trim() ||
      "",
  };
}

function familyContactDraftsEqual(a: FamilyContactDraft, b: FamilyContactDraft): boolean {
  return a.name === b.name && a.role === b.role && a.phone === b.phone;
}

function FamilyContactCard() {
  const {
    leadType,
    leadId,
    lead,
    shouldMaskLeadPhone,
    canEditLeadPhoneEmail,
  } = useLeadDetailV2();
  const { notifyError, notifySuccess } = useGlobalNotifier();
  const validLeadType = isCrmLeadType(leadType) ? (leadType as CrmLeadType) : null;

  const [editing, setEditing] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<FamilyContactDraft | null>(null);
  const [draft, setDraft] = useState<FamilyContactDraft>({ name: "", role: "", phone: "" });
  const [requirements, setRequirements] = useState<ConfigurationScopeRequirements | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!validLeadType) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const data = await getConfigurationScopeRequirements(validLeadType, leadId);
        if (cancelled) return;
        setRequirements(mergeRequirementDefaults(data).requirements);
      } catch {
        if (!cancelled) {
          setRequirements(mergeRequirementDefaults(createDefaultRequirements()).requirements);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [leadId, validLeadType]);

  useEffect(() => {
    const role = readFamilyContactRole(leadId);
    setDraft(readFamilyContactDraft(requirements, lead, role));
  }, [lead, leadId, requirements]);

  const isDirty =
    editing && editSnapshot !== null && !familyContactDraftsEqual(draft, editSnapshot);

  const startEditing = () => {
    setEditSnapshot({ ...draft });
    setEditing(true);
  };

  const exitEditing = () => {
    setEditSnapshot(null);
    setEditing(false);
  };

  const handleCancel = () => {
    if (editSnapshot) setDraft(editSnapshot);
    exitEditing();
  };

  const handleSave = async () => {
    if (!validLeadType || !requirements) {
      notifyError("Family contact is still loading.");
      return;
    }
    if (!isDirty) {
      exitEditing();
      return;
    }

    setSaving(true);
    try {
      const nextRequirements: ConfigurationScopeRequirements = {
        ...requirements,
        familyContactName: draft.name.trim() || null,
        familyContactPhone: draft.phone.trim() || null,
      };
      const saved = await putConfigurationScopeRequirements(
        validLeadType,
        leadId,
        toPutRequirementsBody(nextRequirements),
      );
      setRequirements(saved);
      persistFamilyContactRole(leadId, draft.role);
      notifySuccess("Family contact saved.");
      exitEditing();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Could not save family contact.");
    } finally {
      setSaving(false);
    }
  };

  const displayName = draft.name.trim() || "—";
  const displayRole = draft.role.trim() || "—";
  const displayPhone = editing
    ? draft.phone
    : resolveLeadPhoneDisplayForRole(draft.phone, shouldMaskLeadPhone);

  return (
    <article className="rounded-xl border border-[#e0e5ec] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">Family Contact</p>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                aria-label="Cancel editing family contact"
                className={`inline-flex h-7 w-7 items-center justify-center text-[#6b7280] disabled:cursor-not-allowed disabled:opacity-60 ${V2_BTN_GHOST_ICON}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              {isDirty ? (
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className={`inline-flex h-7 items-center justify-center rounded-md border border-[#111827] bg-white px-3 text-[11px] font-semibold text-[#111827] disabled:cursor-not-allowed disabled:opacity-60 ${V2_BTN_DONE}`}
                >
                  {saving ? "Saving..." : "Done"}
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              disabled={loading || !canEditLeadPhoneEmail}
              aria-label="Update family contact"
              className={`inline-flex h-7 w-7 items-center justify-center text-[#6b7280] disabled:cursor-not-allowed disabled:opacity-60 ${V2_BTN_GHOST_ICON}`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <div>
            <FieldLabel>Name</FieldLabel>
            <Input
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ananya Sharma"
              className={`mt-1 ${V2_INPUT}`}
            />
          </div>
          <div>
            <FieldLabel>Relationship</FieldLabel>
            <Input
              value={draft.role}
              onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}
              placeholder="Spouse"
              className={`mt-1 ${V2_INPUT}`}
            />
          </div>
          <div>
            <FieldLabel>Phone</FieldLabel>
            <Input
              value={draft.phone}
              onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="+91 98765 43210"
              className={`mt-1 ${V2_INPUT}`}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#f3f4f6] text-[#9ca3af]">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <p className="text-[15px] font-bold text-[#111827]">{displayName}</p>
              <p className="text-[12px] text-[#9ca3af]">{displayRole}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">Phone</p>
            <p className="mt-1 inline-flex items-center gap-2 text-[14px] font-medium text-[#374151]">
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 text-[#6b7280]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.8.62 2.66a2 2 0 0 1-.45 2.11L8 9.92a16 16 0 0 0 6.08 6.08l1.43-1.28a2 2 0 0 1 2.11-.45c.86.29 1.76.5 2.66.62A2 2 0 0 1 22 16.92z" />
              </svg>
              {displayPhone}
            </p>
          </div>
        </>
      )}
    </article>
  );
}

function DecisionPhaseCard({ accessState }: { accessState: PhaseAccessState }) {
  const { lead, leadType, leadId } = useLeadDetailV2();
  const isLocked = accessState === "locked";
  const validLeadType = isCrmLeadType(leadType) ? (leadType as CrmLeadType) : null;
  const [expectedTimeline, setExpectedTimeline] = useState("");
  const [timelineLoading, setTimelineLoading] = useState(true);

  useEffect(() => {
    if (!validLeadType) {
      setTimelineLoading(false);
      return;
    }

    let cancelled = false;
    setTimelineLoading(true);

    void (async () => {
      try {
        const data = await getConfigurationScopeRequirements(validLeadType, leadId);
        if (cancelled) return;
        setExpectedTimeline(data.expectedTimeline?.trim() ?? "");
      } catch {
        if (!cancelled) setExpectedTimeline("");
      } finally {
        if (!cancelled) setTimelineLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [leadId, validLeadType]);

  const salesPersonName = lead.assignee?.trim() || "—";
  const timelineDisplay = timelineLoading ? "Loading…" : expectedTimeline || "Not set";

  return (
    <PhaseCardShell accessState={accessState}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] bg-[#d4f5e2]">
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m14.5 4.5-9 9" />
              <path d="m3 21 5.5-5.5" />
              <path d="m16 3 5 5" />
              <path d="m12 7 5 5" />
            </svg>
          </div>
          <h2 className="text-[22px] font-bold leading-none tracking-[-0.015em] text-[#101828]">
            4. Decision Phase
          </h2>
        </div>
        {isLocked ? <PhaseLockIcon /> : accessState === "completed" ? <PhaseDoneIcon /> : null}
      </div>

      <PhaseAccessGate locked={isLocked}>
        <div className="grid gap-4 sm:grid-cols-3">
          <LockedField label="Final Budget" />
          <DecisionReadField label="Decision Maker" value={salesPersonName} />
          <DecisionReadField label="Timeline" value={timelineDisplay} />
        </div>
      </PhaseAccessGate>
    </PhaseCardShell>
  );
}

function DecisionReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <PhaseFieldLabel>{label}</PhaseFieldLabel>
      <div className="flex min-h-[42px] items-center rounded-lg border border-[#e4e8ef] bg-[#fafbfc] px-3 py-2.5">
        <span className="text-[14px] font-medium leading-snug text-[#1f2937]">{value}</span>
      </div>
    </div>
  );
}

function LockedField({ label }: { label: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#b0b8c4]">{label}</p>
      <p className="mt-1 text-[13px] font-semibold uppercase tracking-wide text-[#c4cad4]">Locked</p>
    </div>
  );
}

function LeadProfileCard() {
  const {
    lead,
    leadId,
    canEditLeadPhoneEmail,
    shouldMaskLeadPhone,
    onLeadContactSave,
    leadContactSaving,
  } = useLeadDetailV2();
  const { notifyError } = useGlobalNotifier();
  const [editingContact, setEditingContact] = useState(false);
  const [contactDraft, setContactDraft] = useState({ phone: "", email: "" });
  const pincodeValue = lead.pincode?.trim() || "—";
  const possessionDateRaw = lead.possessionDate?.trim() ?? "";
  const possessionDateFormatted = formatCrmDateTime(lead.possessionDate);
  const possessionDisplay = possessionDateRaw
    ? possessionDateFormatted !== "—"
      ? possessionDateFormatted
      : possessionDateRaw
    : "Not set";
  const designerName = lead.designerName?.trim() || "—";
  const phoneDisplay = resolveLeadPhoneDisplayForRole(lead.phone ?? "", shouldMaskLeadPhone);

  const startContactEdit = () => {
    setContactDraft({ phone: lead.phone ?? "", email: lead.email ?? "" });
    setEditingContact(true);
  };

  const cancelContactEdit = () => {
    setEditingContact(false);
    setContactDraft({ phone: lead.phone ?? "", email: lead.email ?? "" });
  };

  const saveContactEdit = async () => {
    const patch = {
      phone: contactDraft.phone.trim(),
      email: contactDraft.email.trim(),
    };
    try {
      await onLeadContactSave(patch);
      setEditingContact(false);
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Could not save contact details.");
    }
  };

  return (
    <article className="rounded-xl border border-[#e0e5ec] bg-white p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#d9e0ea]" />
        <div className="min-w-0 flex-1">
          <p className="text-[20px] font-extrabold leading-tight text-[#111827]">{lead.name || "—"}</p>
          <p className="mt-0.5 text-[11px] text-[#9ca3af]">
            ID: #
            {resolveLeadDisplayIdentifier(
              {
                externalReferenceId: lead.externalReferenceId,
                leadId: lead.leadId,
                customerId: lead.customerId,
              },
              leadId,
            )}
          </p>
        </div>
        {canEditLeadPhoneEmail ? (
          <div className="flex items-center gap-2">
            {editingContact ? (
              <>
                <button
                  type="button"
                  onClick={cancelContactEdit}
                  disabled={leadContactSaving}
                  aria-label="Cancel contact edit"
                  className={`inline-flex h-7 w-7 items-center justify-center text-[#6b7280] disabled:opacity-60 ${V2_BTN_GHOST_ICON}`}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => void saveContactEdit()}
                  disabled={leadContactSaving}
                  className={`inline-flex h-7 items-center justify-center rounded-md border border-[#111827] bg-white px-3 text-[11px] font-semibold text-[#111827] disabled:opacity-60 ${V2_BTN_DONE}`}
                >
                  {leadContactSaving ? "Saving..." : "Done"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={startContactEdit}
                aria-label="Update phone and email"
                className={`inline-flex h-7 w-7 items-center justify-center text-[#6b7280] ${V2_BTN_GHOST_ICON}`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        {editingContact ? (
          <>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">Phone</p>
              <Input
                value={contactDraft.phone}
                onChange={(e) => setContactDraft((prev) => ({ ...prev, phone: e.target.value }))}
                className={`mt-1 ${V2_INPUT}`}
              />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">Email</p>
              <Input
                type="email"
                value={contactDraft.email}
                onChange={(e) => setContactDraft((prev) => ({ ...prev, email: e.target.value }))}
                className={`mt-1 ${V2_INPUT}`}
              />
            </div>
          </>
        ) : (
          <>
            <ProfileField label="Phone" value={phoneDisplay} />
            <ProfileField label="Email" value={lead.email || "—"} />
          </>
        )}
        <ProfileField label="Pincode" value={pincodeValue} />
        <ProfilePillField label="Lead Source" value={formatLeadSourceLabel(lead.leadSource)} />
        <ProfilePillField label="Possession Date" value={possessionDisplay} />
      </div>

      <div className="my-4 border-t border-[#e5e7eb]" />

      <div className="space-y-3">
        <RelatedContact
          label="CRM"
          name={lead.assignee || "—"}
          avatar={
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#d9e0ea]" />
          }
        />
        <RelatedContact
          label="Designer"
          name={designerName}
          avatar={
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-[#9ca3af]">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          }
        />
      </div>
    </article>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">{label}</p>
      <p className="mt-1 text-[14px] font-medium leading-snug text-[#1f2937]">{value}</p>
    </div>
  );
}

function ProfilePillField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">{label}</p>
      <span className="mt-1 inline-flex rounded-full bg-[#f3f4f6] px-3 py-1 text-[13px] font-semibold text-[#374151]">
        {value}
      </span>
    </div>
  );
}

function RelatedContact({
  label,
  name,
  avatar,
}: {
  label: string;
  name: string;
  avatar: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {avatar}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9ca3af]">{label}</p>
        <p className="mt-0.5 text-[14px] font-bold text-[#111827]">{name}</p>
      </div>
    </div>
  );
}

function ExperiencePhaseContent({
  leadType,
  leadId,
  disabled = false,
}: {
  leadType: string;
  leadId: string;
  disabled?: boolean;
}) {
  const {
    lead,
    canShowGetQuote,
    onGetQuote,
    quoteFetching,
    quoteSending,
    quoteLinkPersisting,
    quoteLinkPersistError,
    onSendQuote,
    onRetrySaveQuoteLink,
  } = useLeadDetailV2();
  const canInteract = !disabled;
  const quoteLinkValue = lead.quoteLink?.trim() || "";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-stretch">
      <section className="rounded-xl border border-[#e8ecf1] bg-[#fafbfc] p-4">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#8b97a8]">
          Scope of Work
        </p>
        <div id="deal-scope-of-work" className="scroll-mt-24">
          <Link
            href={`/Leads/${leadType}/${leadId}/configuration-scope`}
            className={`group flex h-[148px] w-full flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed border-[#c8d0db] bg-white text-[12px] font-bold uppercase tracking-wide text-[#8a96a8] ${V2_CARD_LINK}`}
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e5e7eb] bg-[#f9fafb] text-[#8a96a8] transition-all duration-200 group-hover:border-[#bbf7d0] group-hover:bg-[#ecfdf5] group-hover:text-[#059669]">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 transition-transform duration-200 group-hover:scale-110"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </span>
            <span className="inline-flex items-center gap-1.5">
              Configure Scope
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </span>
          </Link>
        </div>
      </section>

      <section
        id="deal-experience-quote"
        className="flex flex-col rounded-xl border border-[#e8ecf1] border-l-[3px] border-l-[#7c3aed] bg-[#f8fafc] p-4 scroll-mt-24"
      >
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#8b97a8]">
          Quote &amp; Proposal
        </p>

        {canShowGetQuote ? (
          <button
            type="button"
            onClick={onGetQuote}
            disabled={!canInteract || quoteFetching}
            className={`mb-4 inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-lg border border-[#c4b5fd] bg-[#f5f3ff] text-[12px] font-bold uppercase tracking-wide text-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-60 ${V2_BTN_VIOLET}`}
          >
            <span aria-hidden>🔎</span>
            {quoteFetching ? "Getting Quote…" : "Get Quote"}
          </button>
        ) : null}

        <div>
          <PhaseFieldLabel>Quote Link</PhaseFieldLabel>
          {quoteLinkValue ? (
            <Input
              value={quoteLinkValue}
              readOnly
              className="h-[42px] rounded-lg border-[#e4e8ef] bg-white px-3 text-[12px] text-[#374151]"
            />
          ) : (
            <div className="flex h-[42px] items-center rounded-lg border border-[#e4e8ef] bg-white px-3">
              <span className="text-[11px] font-normal italic text-[#9ca3af]">Not generated yet</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={!canInteract || quoteSending || quoteLinkPersisting || !quoteLinkValue}
            onClick={() => void onSendQuote()}
            className={`inline-flex h-[42px] flex-1 items-center justify-center rounded-lg bg-[#1dde63] text-[12px] font-bold uppercase tracking-wide text-[#05220f] disabled:cursor-not-allowed disabled:opacity-60 ${V2_BTN_PRIMARY}`}
          >
            {quoteSending ? "Sending…" : "Send Quote"}
          </button>
        </div>

        {quoteLinkPersisting ? (
          <p className="mt-2 text-[11px] text-[#9ca3af]">Saving quote link…</p>
        ) : null}
        {quoteLinkPersistError ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#dc2626]">
            <span>{quoteLinkPersistError}</span>
            {onRetrySaveQuoteLink ? (
              <button
                type="button"
                disabled={!canInteract}
                onClick={() => void onRetrySaveQuoteLink()}
                className={`font-semibold underline ${V2_LINK_TEXT}`}
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : null}

        <p className="mt-auto pt-4 text-[11px] leading-relaxed text-[#9ca3af]">
          {canShowGetQuote
            ? "Fetch the quote after a successful meeting, then send it to the customer."
            : "Quote tools unlock after meeting is marked successful in Complete Task."}
        </p>
      </section>
    </div>
  );
}

function ExperiencePhaseCard({
  leadType,
  leadId,
  accessState,
}: {
  leadType: string;
  leadId: string;
  accessState: PhaseAccessState;
}) {
  const isLocked = accessState === "locked";

  return (
    <PhaseCardShell accessState={accessState} rounded="xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-block h-[22px] w-[22px] shrink-0 rounded-[5px] bg-[#d4f5e2]`}
          />
          <h2 className="text-[22px] font-bold leading-none tracking-[-0.015em] text-[#101828]">
            3. Experience Phase
          </h2>
        </div>
        {isLocked ? <PhaseLockIcon /> : accessState === "completed" ? <PhaseDoneIcon /> : null}
      </div>

      <PhaseAccessGate locked={isLocked}>
        <ExperiencePhaseContent disabled={isLocked} leadType={leadType} leadId={leadId} />
      </PhaseAccessGate>
    </PhaseCardShell>
  );
}

function PhaseCardShell({
  accessState,
  rounded = "lg",
  children,
}: {
  accessState: PhaseAccessState;
  rounded?: "lg" | "xl";
  children: ReactNode;
}) {
  const radius = rounded === "xl" ? "rounded-xl" : "rounded-lg";
  const isCurrent = accessState === "current";
  const isLocked = accessState === "locked";

  if (isCurrent) {
    return (
      <article className={`relative ${radius} border-2 border-[#2ee06a] bg-white px-4 pb-4 pt-7`}>
        <span className="absolute -top-3 left-4 rounded-full bg-[#2ee06a] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#0f1729]">
          Current Phase
        </span>
        {children}
      </article>
    );
  }

  if (isLocked) {
    return (
      <article className={`${radius} border border-[#e4e8ef] bg-white p-4`}>{children}</article>
    );
  }

  return (
    <article className={`${radius} border border-[#e4e8ef] bg-white p-4`}>{children}</article>
  );
}

function PhaseLockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-[#c4cad4]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function PhaseDoneIcon() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1ed760] text-[12px] font-bold text-white">
      ✓
    </span>
  );
}

/** Shows full phase content but blocks interaction when the phase is not yet unlocked. */
function PhaseAccessGate({ locked, children }: { locked: boolean; children: ReactNode }) {
  if (!locked) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none">{children}</div>
      <div
        className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/55"
        aria-hidden="true"
      >
        <div className="flex max-w-[90%] items-center gap-2.5 rounded-full border border-[#dce2ea] bg-white px-4 py-2 shadow-sm">
          <PhaseLockIcon />
          <span className="text-[12px] font-semibold text-[#6b7280]">
            Complete previous phases to unlock
          </span>
        </div>
      </div>
    </div>
  );
}

function ConnectionReadField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div>
      <PhaseFieldLabel>{label}</PhaseFieldLabel>
      <div className="flex min-h-[42px] items-center gap-2.5 rounded-lg border border-[#e4e8ef] bg-white px-3 py-2.5">
        <span className="shrink-0 text-[#6b7280]">{icon}</span>
        <span className="text-[14px] font-medium leading-snug text-[#1f2937]">{value}</span>
      </div>
    </div>
  );
}

function DiscoveryPhaseCard({ accessState }: { accessState: PhaseAccessState }) {
  const [editing, setEditing] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<DiscoveryPhaseDraft | null>(null);
  const { lead, connectionPhaseSaving, onConnectionPhaseSave, onLeadPatch } = useLeadDetailV2();
  const { notifyError } = useGlobalNotifier();
  const isLocked = accessState === "locked";
  const canEdit = !isLocked;

  const currentDraft = readDiscoveryPhaseDraft(lead);
  const isDirty =
    editing && editSnapshot !== null && !discoveryPhaseDraftsEqual(currentDraft, editSnapshot);

  const startEditing = () => {
    setEditSnapshot(readDiscoveryPhaseDraft(lead));
    setEditing(true);
  };

  const exitEditing = () => {
    setEditSnapshot(null);
    setEditing(false);
  };

  const handleCancel = () => {
    if (editSnapshot) onLeadPatch(editSnapshot);
    exitEditing();
  };

  const handleSave = async () => {
    if (!isDirty) {
      exitEditing();
      return;
    }
    try {
      await onConnectionPhaseSave();
      exitEditing();
    } catch (e) {
      notifyError(e instanceof Error ? e.message : "Could not save discovery phase.");
    }
  };

  return (
    <PhaseCardShell accessState={accessState}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-block h-[22px] w-[22px] shrink-0 rounded-[5px] bg-[#d4f5e2]`}
          />
          <h2 className="text-[22px] font-bold leading-none tracking-[-0.015em] text-[#101828]">
            1. Discovery Phase
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            editing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={connectionPhaseSaving}
                  aria-label="Cancel editing"
                  className={`inline-flex h-7 w-7 items-center justify-center text-[#6b7280] disabled:cursor-not-allowed disabled:opacity-60 ${V2_BTN_GHOST_ICON}`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
                {isDirty ? (
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={connectionPhaseSaving}
                    className={`inline-flex h-7 items-center justify-center rounded-md border border-[#111827] bg-white px-3 text-[11px] font-semibold text-[#111827] disabled:cursor-not-allowed disabled:opacity-60 ${V2_BTN_DONE}`}
                  >
                    {connectionPhaseSaving ? "Saving..." : "Done"}
                  </button>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                onClick={startEditing}
                aria-label="Update discovery phase"
                className={`inline-flex h-7 w-7 items-center justify-center text-[#6b7280] ${V2_BTN_GHOST_ICON}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )
          ) : (
            <PhaseLockIcon />
          )}
          {!isLocked && accessState === "completed" ? <PhaseDoneIcon /> : null}
        </div>
      </div>
      <PhaseAccessGate locked={isLocked}>
        <DiscoveryPhaseContent editing={editing && canEdit} />
      </PhaseAccessGate>
    </PhaseCardShell>
  );
}

function DiscoveryPhaseContent({ editing }: { editing: boolean }) {
  const { lead, onLeadPatch } = useLeadDetailV2();
  const normalizedBudget = lead.budget?.trim() ?? "";
  const budgetOptions =
    normalizedBudget && !BUDGET_OPTIONS.includes(normalizedBudget)
      ? [normalizedBudget, ...BUDGET_OPTIONS]
      : BUDGET_OPTIONS;
  const isAdsLead = lead.leadType === "glead" || lead.leadType === "mlead";

  return (
    <div className="grid gap-x-10 gap-y-5 lg:grid-cols-2">
      <div className="space-y-5">
        <div>
          <PhaseFieldLabel>Property Name</PhaseFieldLabel>
          {editing ? (
            <Input
              placeholder="Property name / site"
              value={lead.propertyLocation ?? ""}
              onChange={(e) => onLeadPatch({ propertyLocation: e.target.value })}
              className={V2_INPUT}
            />
          ) : (
            <ValuePill
              icon={
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 21h18" />
                  <path d="M5 21V7l8-4v18" />
                  <path d="M19 21V11l-6-4" />
                </svg>
              }
            >
              {lead.propertyLocation || "—"}
            </ValuePill>
          )}
        </div>

        <div>
          <PhaseFieldLabel>Budget Range</PhaseFieldLabel>
          {editing ? (
            <Select
              value={lead.budget ?? ""}
              onChange={(e) => onLeadPatch({ budget: e.target.value })}
              className={V2_INPUT}
            >
              <option value="">Select Budget</option>
              {budgetOptions.map((budget) => (
                <option key={budget} value={budget}>
                  {budget}
                </option>
              ))}
            </Select>
          ) : (
            <ValuePill variant="green">{lead.budget || "—"}</ValuePill>
          )}
        </div>

        <div>
          <PhaseFieldLabel>Language Preferred</PhaseFieldLabel>
          {editing ? (
            <Select
              value={lead.language ?? ""}
              onChange={(e) => onLeadPatch({ language: e.target.value })}
              className={V2_INPUT}
            >
              {LANGUAGE_OPTIONS.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </Select>
          ) : (
            <ValuePill
              icon={
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              }
            >
              {lead.language || "—"}
            </ValuePill>
          )}
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <PhaseFieldLabel>Configuration</PhaseFieldLabel>
          {editing ? (
            <>
              <Input
                placeholder={isAdsLead ? "e.g. 2 BHK — add here if not from the ad" : "e.g. 2 BHK"}
                value={lead.configuration ?? ""}
                onChange={(e) => onLeadPatch({ configuration: e.target.value })}
                className={V2_INPUT}
              />
              {isAdsLead && !(lead.configuration ?? "").trim() ? (
                <p className="mt-1.5 text-[11px] text-[#9ca3af]">
                  Not provided by the ad form — enter configuration and click Done to save.
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <ValuePill>{lead.configuration || "—"}</ValuePill>
            </div>
          )}
        </div>

        <div>
          <PhaseFieldLabel>Type</PhaseFieldLabel>
          {editing ? (
            <Select
              value={lead.bookingType ?? ""}
              onChange={(e) => onLeadPatch({ bookingType: e.target.value })}
              className={V2_INPUT}
            >
              <option value="">Select Type</option>
              {BOOKING_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {bookingTypeDisplay(option)}
                </option>
              ))}
            </Select>
          ) : (
            <ValuePill>{bookingTypeDisplay(lead.bookingType ?? "")}</ValuePill>
          )}
        </div>

        <div>
          <PhaseFieldLabel>Property Notes</PhaseFieldLabel>
          {editing ? (
            <Textarea
              placeholder="Add extra property notes..."
              value={lead.propertyNotes ?? ""}
              onChange={(e) => onLeadPatch({ propertyNotes: e.target.value })}
              className={V2_INPUT}
            />
          ) : (
            <ValuePill
              icon={
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              }
            >
              {lead.propertyNotes || "—"}
            </ValuePill>
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectionPhaseCard({ accessState }: { accessState: PhaseAccessState }) {
  const isLocked = accessState === "locked";

  return (
    <PhaseCardShell accessState={accessState}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-block h-[22px] w-[22px] shrink-0 rounded-[5px] bg-[#d4f5e2]`}
          />
          <h2 className="text-[22px] font-bold leading-none tracking-[-0.015em] text-[#101828]">
            2. Connection Phase
          </h2>
        </div>
        {isLocked ? <PhaseLockIcon /> : accessState === "completed" ? <PhaseDoneIcon /> : null}
      </div>
      <PhaseAccessGate locked={isLocked}>
        <ConnectionPhaseContent disabled={isLocked} />
      </PhaseAccessGate>
    </PhaseCardShell>
  );
}

function ConnectionPhaseContent({ disabled = false }: { disabled?: boolean }) {
  const {
    lead,
    leadId,
    onFloorPlanUpload,
    onFloorPlanRemove,
    onFloorPlanMissing,
    floorPlanUploading,
    meetingDateDisplay,
    designQaLink,
    apiDesignQaLink,
    onDesignQaLinkCopied,
  } = useLeadDetailV2();
  const designQaLeadId = lead.leadId?.trim() || "";
  const canInteract = !disabled;
  const designQaValue = apiDesignQaLink || designQaLink || "";
  const [appointmentMeetingType, setAppointmentMeetingType] = useState("");

  useEffect(() => {
    let cancelled = false;
    void resolveMeetingTypeForLead(leadId, { designerName: lead.designerName }).then((meetingType) => {
      if (cancelled) return;
      setAppointmentMeetingType(meetingType ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [leadId, lead.designerName, lead.meetingType, lead.meetingDate, lead.followUpDate]);

  const resolvedMeetingType = lead.meetingType?.trim() || appointmentMeetingType;

  const calendarIcon = (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );

  const meetingTypeIcon = (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-stretch">
      <section className="rounded-xl border border-[#e8ecf1] bg-[#fafbfc] p-4">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#8b97a8]">
          Documents &amp; Design
        </p>

        <div id="deal-connection-floor-plan" className="scroll-mt-24">
          <div className="mb-2 flex items-center justify-between gap-2">
            <PhaseFieldLabel className="mb-0">Floor Plan</PhaseFieldLabel>
            <div className="flex flex-wrap gap-1">
              <FloorPlanFileTypeBadge label="PDF" />
              <FloorPlanFileTypeBadge label="JPG" />
              <FloorPlanFileTypeBadge label="PNG" />
            </div>
          </div>
          <FloorPlanUpload
            hasFloorPlan={Boolean(lead.floorPlan?.trim())}
            viewHref={lead.floorPlanViewPath ?? ""}
            openHref={lead.floorPlanOpenPath ?? ""}
            canUpload={canInteract}
            compact
            hideHeader
            uploading={floorPlanUploading}
            onFileSelect={(file) => void onFloorPlanUpload(file)}
            onRemove={onFloorPlanRemove ? () => void onFloorPlanRemove() : undefined}
            onFloorPlanMissing={onFloorPlanMissing}
          />
        </div>

        <div className="mt-4 border-t border-[#e8ecf1] pt-4">
          <DesignPreferencesWithModal leadId={designQaLeadId} />
        </div>
      </section>

      <section className="flex flex-col rounded-xl border border-[#e8ecf1] border-l-[3px] border-l-[#1ed760] bg-[#f8fafc] p-4">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#8b97a8]">
          Meeting &amp; Links
        </p>

        <div className="space-y-4">
          <ConnectionReadField
            label="Meeting Date"
            icon={calendarIcon}
            value={meetingDateDisplay || "Not scheduled"}
          />
          <ConnectionReadField
            label="Meeting Type"
            icon={meetingTypeIcon}
            value={meetingTypeDisplay(resolvedMeetingType)}
          />
          <DesignQaLinkField
            value={designQaValue}
            onCopied={onDesignQaLinkCopied}
            disabled={disabled}
          />
        </div>

        <p className="mt-auto pt-4 text-[11px] leading-relaxed text-[#9ca3af]">
          Meeting details are updated from Complete Task. Design QA link is synced from CRM.
        </p>
      </section>
    </div>
  );
}

function DesignQaLinkField({
  value,
  onCopied,
  disabled = false,
}: {
  value: string;
  onCopied?: (link: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const displayValue = value.trim() || "Not available yet";

  return (
    <div>
      <FieldLabel>
        Design QA Link
        <span className="ml-1.5 font-normal normal-case text-[var(--crm-text-muted)]">
          (read-only, from CRM)
        </span>
      </FieldLabel>
      <div className="mt-1.5 flex items-center gap-1.5">
        <Input
          value={displayValue}
          readOnly
          className="h-[42px] min-w-0 flex-1 rounded-lg border-[#e4e8ef] bg-white px-3 text-[12px] text-[#374151]"
        />
        <button
          type="button"
          aria-label="Copy Design QA Link"
          disabled={disabled || !value.trim()}
          className={`inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-[#e4e8ef] bg-white text-[var(--crm-text-primary)] disabled:cursor-not-allowed disabled:opacity-45 ${V2_BTN_ICON}`}
          onClick={() => {
            if (!value.trim()) return;
            void navigator.clipboard.writeText(value).then(() => {
              void onCopied?.(value);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 fill-none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <rect x="4" y="4" width="11" height="11" rx="2" />
          </svg>
        </button>
      </div>
      {copied ? (
        <p className="mt-1 text-[11px] font-medium text-[#059669]">Design QA Link copied</p>
      ) : null}
    </div>
  );
}

function PhaseFieldLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const margin = className.includes("mb-") ? "" : "mb-1.5";
  return (
    <p
      className={`${margin} text-[10px] font-bold uppercase tracking-[0.1em] text-[#8b97a8] ${className}`.trim()}
    >
      {children}
    </p>
  );
}

function FloorPlanFileTypeBadge({ label }: { label: string }) {
  return (
    <span className="rounded-md border border-[#dce2ea] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8b97a8]">
      {label}
    </span>
  );
}

function ValuePill({
  children,
  icon,
  variant = "default",
}: {
  children: ReactNode;
  icon?: ReactNode;
  variant?: "default" | "green";
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[14px] font-bold text-[#1a2432] ${
        variant === "green"
          ? "bg-[#e8fbf0] text-[#0f8f3d]"
          : "bg-[#f0f3f7]"
      }`}
    >
      {icon ? <span className="text-[#4a5568]">{icon}</span> : null}
      {children}
    </span>
  );
}

function InfoPill({
  title,
  value,
  wide = false,
  compact = false,
}: {
  title: string;
  value: string;
  wide?: boolean;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="min-w-0 rounded-[8px] border border-[#dce2ea] bg-[#f8fafc] px-2.5 py-1.5">
        <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-[#8f9bad]">
          {title}
        </p>
        <p
          className="mt-0.5 truncate text-[13px] font-bold uppercase leading-tight tracking-[-0.01em] text-[#121926]"
          title={value}
        >
          {value}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[8px] border border-[#dce2ea] bg-[#f8fafc] px-3 py-1.5 ${
        wide ? "min-w-[180px]" : "min-w-[108px]"
      }`}
    >
      <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#8f9bad]">{title}</p>
      <p className="mt-1 text-[17px] font-semibold uppercase leading-tight tracking-[-0.01em] text-[#121926]">
        {value}
      </p>
    </div>
  );
}
