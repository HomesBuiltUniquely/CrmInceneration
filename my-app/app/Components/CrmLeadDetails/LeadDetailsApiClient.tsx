"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lead } from "@/lib/data";
import {
  getLeadActivities,
  getLeadDetail,
  postManualActivity,
  postQuoteSend,
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
import { createAppointment } from "@/lib/appointment-client";
import { crmLeadTypeToApiLabel } from "@/lib/crm-lead-type-label";
import { normalizeMilestoneSubStageForApi } from "@/lib/milestone-substage-map";
import {
  buildSalesClosureUrl,
  isCloserStageBookingDone,
} from "@/lib/sales-closure";
import { canPresalesVerifyLead } from "@/lib/lead-verify-role";
import { useGlobalNotifier } from "../Shared/GlobalNotifier";
import {
  buildEmailRequest,
  sendEmailNotification,
} from "@/lib/email-request-builder";

const emptyLead = (id: string, leadType: CrmLeadType): Lead => ({
  id,
  name: "—",
  customerId: "—",
  status: "—",
  createdAt: "—",
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
  source: string;
  name: string;
};

const SOURCE_LABELS: Record<CrmLeadType, string> = {
  formlead: "External/Form",
  glead: "Google Ads",
  mlead: "Meta Ads",
  addlead: "Add Lead",
  websitelead: "Website Lead",
};

function parseDateLoose(input: unknown): Date | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const raw = input.trim();
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const utcCandidate = new Date(`${raw}Z`);
  return Number.isNaN(utcCandidate.getTime()) ? null : utcCandidate;
}

function formatTimelineDate(input: string): string {
  const dt = parseDateLoose(input);
  if (!dt) return "Unknown date";
  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const year = dt.getFullYear();
  const hh = dt.getHours();
  const mm = String(dt.getMinutes()).padStart(2, "0");
  const ampm = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 || 12;
  return `${day}-${month}-${year} ${String(hour12).padStart(2, "0")}:${mm} ${ampm}`;
}

function timeAgo(input: string): string {
  const dt = parseDateLoose(input);
  if (!dt) return "some time ago";
  const diffMs = Date.now() - dt.getTime();
  const mins = Math.max(1, Math.floor(diffMs / (60 * 1000)));
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function buildTimelineLabel(entry: TimelineEntry): string {
  return `${timeAgo(entry.createdAt)} it came on ${formatTimelineDate(entry.createdAt)} in ${entry.source} as ${entry.name}`;
}

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
  const [verifySalesExecutiveId, setVerifySalesExecutiveId] = useState("");
  const [canVerifyRole, setCanVerifyRole] = useState(false);
  const [quoteSending, setQuoteSending] = useState(false);
  const [quoteSubject, setQuoteSubject] = useState(
    "Your quote from Hub Interior",
  );
  const [quoteBody, setQuoteBody] = useState("");
  const [createdTimelineOptions, setCreatedTimelineOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [createdTimelineLoading, setCreatedTimelineLoading] = useState(false);
  const [lead, setLead] = useState<Lead>(() =>
    emptyLead(leadId, validLeadType ? leadType : "formlead"),
  );
  const [baseDetail, setBaseDetail] = useState<Record<string, unknown>>({});
  const { notifySuccess, notifyError } = useGlobalNotifier();

  const load = useCallback(async () => {
    if (!isCrmLeadType(leadTypeParam)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const lt = leadTypeParam as CrmLeadType;
      const [detailJson, actJson] = await Promise.all([
        getLeadDetail(lt, leadId),
        getLeadActivities(lt, leadId),
      ]);
      setBaseDetail(detailJson);
      const mapped = detailJsonToLead(detailJson, lt);
      const activities = mapActivitiesJson(actJson);
      setLead({ ...mapped, id: leadId, activities });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load lead");
      setLead(emptyLead(leadId, leadTypeParam as CrmLeadType));
    } finally {
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

  useEffect(() => {
    setCanVerifyRole(canPresalesVerifyLead());
  }, []);

  const patchLead = useCallback((patch: Partial<Lead>) => {
    setLead((prev) => ({ ...prev, ...patch }));
  }, []);

  const loadCreatedTimeline = useCallback(
    async (detailJson: Record<string, unknown>, activitiesJson: unknown) => {
      if (!validLeadType) return;
      setCreatedTimelineLoading(true);
      const entries = new Map<string, TimelineEntry>();
      try {
        const currentCreatedAt =
          typeof detailJson.createdAt === "string" &&
          detailJson.createdAt.trim()
            ? detailJson.createdAt.trim()
            : "";
        if (currentCreatedAt) {
          entries.set(`${leadType}:${leadId}`, {
            key: `${leadType}:${leadId}`,
            createdAt: currentCreatedAt,
            source: SOURCE_LABELS[leadType],
            name:
              (typeof detailJson.name === "string" && detailJson.name.trim()) ||
              (typeof detailJson.fullName === "string" &&
                detailJson.fullName.trim()) ||
              lead.name ||
              "Unknown",
          });
        }

        const activityRows = Array.isArray(activitiesJson)
          ? activitiesJson
          : Array.isArray(
                (activitiesJson as { content?: unknown[] } | null)?.content,
              )
            ? ((activitiesJson as { content?: unknown[] }).content ?? [])
            : [];
        for (const row of activityRows) {
          const item = row as Record<string, unknown>;
          const type = String(item.activityType ?? "").toUpperCase();
          if (type !== "REINQUIRY_RECEIVED" && type !== "DUPLICATE_RECEIVED")
            continue;
          const createdAt =
            typeof item.createdAt === "string" ? item.createdAt.trim() : "";
          if (!createdAt) continue;
          const desc =
            typeof item.description === "string" ? item.description : "";
          entries.set(`${type}:${createdAt}:${desc}`, {
            key: `${type}:${createdAt}:${desc}`,
            createdAt,
            source: SOURCE_LABELS[leadType],
            name:
              (typeof detailJson.name === "string" && detailJson.name.trim()) ||
              (typeof detailJson.fullName === "string" &&
                detailJson.fullName.trim()) ||
              lead.name ||
              "Unknown",
          });
        }

        const queries = [
          typeof detailJson.phone === "string" ? detailJson.phone.trim() : "",
          typeof detailJson.phoneNumber === "string"
            ? detailJson.phoneNumber.trim()
            : "",
          typeof detailJson.email === "string" ? detailJson.email.trim() : "",
          typeof detailJson.name === "string" ? detailJson.name.trim() : "",
        ].filter(Boolean);
        const searchTerm = queries[0] || "";
        if (searchTerm) {
          const allTypes: CrmLeadType[] = [
            "formlead",
            "glead",
            "mlead",
            "addlead",
            "websitelead",
          ];
          const res = await Promise.all(
            allTypes.map(async (t) => {
              const q = new URLSearchParams({
                leadType: t,
                page: "0",
                size: "100",
                search: searchTerm,
              });
              const r = await fetch(`/api/crm/leads?${q.toString()}`, {
                cache: "no-store",
                credentials: "include",
              });
              if (!r.ok) return [];
              const json = (await r.json().catch(() => ({}))) as {
                content?: unknown[];
              };
              return Array.isArray(json.content) ? json.content : [];
            }),
          );
          for (let i = 0; i < allTypes.length; i++) {
            const t = allTypes[i];
            for (const raw of res[i]) {
              const row = raw as Record<string, unknown>;
              const id = String(row.id ?? "");
              if (!id || (id === leadId && t === leadType)) continue;
              const createdAt =
                typeof row.createdAt === "string" ? row.createdAt.trim() : "";
              if (!createdAt) continue;
              entries.set(`${t}:${id}`, {
                key: `${t}:${id}`,
                createdAt,
                source: SOURCE_LABELS[t],
                name:
                  (typeof row.name === "string" && row.name.trim()) ||
                  (typeof row.fullName === "string" && row.fullName.trim()) ||
                  "Unknown",
              });
            }
          }
        }
      } catch {
        // keep fallback and avoid page failure
      } finally {
        const sorted = [...entries.values()].sort((a, b) => {
          const bt = parseDateLoose(b.createdAt)?.getTime() ?? 0;
          const at = parseDateLoose(a.createdAt)?.getTime() ?? 0;
          return bt - at;
        });
        const options = sorted.length
          ? sorted.map((entry) => ({
              value: entry.key,
              label: buildTimelineLabel(entry),
            }))
          : [
              {
                value: "fallback",
                label: `${lead.createdAt} in ${SOURCE_LABELS[leadType]} as ${lead.name}`,
              },
            ];
        setCreatedTimelineOptions(options);
        setCreatedTimelineLoading(false);
      }
    },
    [lead.createdAt, lead.name, leadId, leadType, validLeadType],
  );

  useEffect(() => {
    if (!validLeadType) return;
    if (Object.keys(baseDetail).length === 0) return;
    const lt = leadTypeParam as CrmLeadType;
    void getLeadActivities(lt, leadId)
      .then((actJson) => loadCreatedTimeline(baseDetail, actJson))
      .catch(() => loadCreatedTimeline(baseDetail, []));
  }, [baseDetail, leadId, leadTypeParam, loadCreatedTimeline, validLeadType]);

  const salesClosureHref = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    if (!isCloserStageBookingDone(lead)) return undefined;
    return buildSalesClosureUrl({
      leadId,
      leadTypeLabel: crmLeadTypeToApiLabel(leadType),
      returnUrl: window.location.href,
    });
  }, [lead, leadId, leadType]);

  const handleSave = useCallback(async () => {
    if (!validLeadType) return;
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
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [baseDetail, lead, leadId, leadTypeParam, validLeadType]);

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
    } catch (e) {
      setSecondBoxError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingSecondBox(false);
    }
  }, [baseDetail, lead, leadId, leadTypeParam, validLeadType, notifySuccess]);

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
      await postVerifyLead(lt, leadId, payload);
      notifySuccess("Verification request sent.");
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

  const handlePhoneCallLog = useCallback(async () => {
    if (!validLeadType) return;
    const lt = leadTypeParam as CrmLeadType;
    const phone = lead.phone?.trim();
    if (!phone) return;
    await postManualActivity(lt, leadId, "CALL", `Outbound call to ${phone}`);
    await refreshActivities();
  }, [lead.phone, leadId, leadTypeParam, refreshActivities, validLeadType]);

  const handleCompleteTaskApi = useCallback(
    async (args: CompleteTaskApiPayload) => {
      if (!validLeadType) return;
      const lt = leadTypeParam as CrmLeadType;
      const persistedSubstage = normalizeMilestoneSubStageForApi(args.feedback);

      let followUpDate = args.nextCallDateLocal.trim() || lead.followUpDate;
      let designerName = lead.designerName;

      if (args.meetingAppointment) {
        const leadIdNum = Number(leadId);
        const appt = await createAppointment({
          designerName: args.meetingAppointment.designerName,
          date: args.meetingAppointment.date,
          slotId: args.meetingAppointment.slotId,
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
      }

      const nextStage = {
        milestoneStage: args.milestoneStage,
        milestoneStageCategory: args.milestoneStageCategory,
        milestoneSubStage: persistedSubstage,
        stage: lead.stageBlock?.stage ?? "Initial Stage",
        substage: { substage: persistedSubstage },
      };
      const leadForSave: Lead = {
        ...lead,
        followUpDate,
        designerName,
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
      await postManualActivity(lt, leadId, "NOTE", args.note);
      await refreshActivities();

      // Trigger email notification for this substage
      console.log(
        "[email] Attempting to send email for substage:",
        args.feedback,
      );
      console.log("[email] Lead email:", leadForSave.email);
      console.log("[email] Lead name:", leadForSave.name);

      const emailRequest = buildEmailRequest(leadForSave, args.feedback);
      console.log("[email] Email request built:", emailRequest);

      if (emailRequest) {
        console.log("[email] Sending email notification...");
        void sendEmailNotification(emailRequest)
          .then((result) => {
            console.log("[email] Response:", result);
            if (!result.success) {
              console.warn("[email notification]", result.message);
            } else {
              console.log("[email] Email sent successfully!");
            }
          })
          .catch((err) => {
            console.error("[email notification] Error:", err);
          });
      }

      // Additionally, when a meeting is scheduled/rescheduled, send a design-preference
      // email to the designer (if available). This copies the meeting payload but
      // targets the designer's email/name so backend can use the same meeting template
      // or a designer-facing template as configured server-side.
      const ms = persistedSubstage?.trim();
      if (ms === "Meeting Scheduled" || ms === "Meeting Rescheduled") {
        const designerEmail = leadForSave.designerEmail?.trim();
        if (designerEmail) {
          // Build a separate email request for the designer by using the same
          // builder but substituting the lead's email/name with the designer's.
          const designerLead = {
            ...leadForSave,
            email: designerEmail,
            name:
              leadForSave.designerName?.trim() ||
              leadForSave.name ||
              "Designer",
          } as Lead;

          const designerRequest = buildEmailRequest(
            designerLead,
            persistedSubstage || "Meeting Scheduled",
          );

          if (designerRequest) {
            console.log(
              "[email] Sending design-preference email to designer:",
              designerEmail,
            );
            void sendEmailNotification(designerRequest)
              .then((res) => {
                console.log("[email][designer] Response:", res);
                if (!res.success)
                  console.warn("[email][designer]", res.message);
              })
              .catch((err) => {
                console.error("[email][designer] Error:", err);
              });
          } else {
            console.log(
              "[email] Designer email not sent — builder returned null for designer request.",
            );
          }
        } else {
          console.log(
            "[email] No designer email available; skipping design-preference email.",
          );
        }
      }

      if (!emailRequest) {
        console.warn(
          "[email] No email request built - substage may not trigger emails or missing email",
        );
      }

      notifySuccess("Saved");
    },
    [baseDetail, lead, leadId, leadTypeParam, refreshActivities, validLeadType],
  );

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
          salesClosureHref={salesClosureHref}
          createdTimelineOptions={createdTimelineOptions}
          createdTimelineLoading={createdTimelineLoading}
        />
        <DesignQaPanel leadId={leadId} open={designQaOpen} />
        <StatsRow lead={lead} />
        <Tabs active={activeTab} onChange={setActiveTab} />

        {activeTab === "lead" && (
          <LeadInfoTab
            lead={lead}
            onLeadChange={patchLead}
            onLogCall={handlePhoneCallLog}
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
        {activeTab === "additional" && (
          <LeadInfoTab
            lead={lead}
            onLeadChange={patchLead}
            onLogCall={handlePhoneCallLog}
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
      {verifyModalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5 shadow-xl">
            <h3 className="text-[15px] font-semibold text-[var(--crm-text-primary)]">
              Verify Lead
            </h3>
            <p className="mt-1 text-[12px] text-[var(--crm-text-secondary)]">
              Pincode is mandatory. You can optionally provide Sales Executive
              ID for manual assignment.
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
                  Sales Executive ID (optional)
                </span>
                <input
                  value={verifySalesExecutiveId}
                  onChange={(e) => setVerifySalesExecutiveId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--crm-accent)]"
                  placeholder="e.g. 52"
                />
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
