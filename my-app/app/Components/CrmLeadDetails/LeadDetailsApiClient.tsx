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
import CompleteTaskModal, { type CompleteTaskApiPayload } from "./CompleteTaskModal";
import { createAppointment } from "@/lib/appointment-client";
import { crmLeadTypeToApiLabel } from "@/lib/crm-lead-type-label";
import { normalizeMilestoneSubStageForApi } from "@/lib/milestone-substage-map";
import { buildSalesClosureUrl, isCloserStageBookingDone } from "@/lib/sales-closure";
import { canPresalesVerifyLead } from "@/lib/lead-verify-role";

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
  const [loading, setLoading] = useState(validLeadType);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [secondBoxError, setSecondBoxError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingSecondBox, setSavingSecondBox] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [canVerifyRole, setCanVerifyRole] = useState(false);
  const [quoteSending, setQuoteSending] = useState(false);
  const [quoteSubject, setQuoteSubject] = useState("Your quote from Hub Interior");
  const [quoteBody, setQuoteBody] = useState("");
  const [lead, setLead] = useState<Lead>(() => emptyLead(leadId, validLeadType ? leadType : "formlead"));
  const [baseDetail, setBaseDetail] = useState<Record<string, unknown>>({});

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
      setLead((prev) => ({ ...mapped, id: leadId, activities: prev.activities }));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [baseDetail, lead, leadId, leadTypeParam, validLeadType]);

  const handleSaveSecondBox = useCallback(async () => {
    if (!validLeadType) return;
    const lt = leadTypeParam as CrmLeadType;
    setSavingSecondBox(true);
    setSecondBoxError(null);
    try {
      const body = mergeSecondBoxIntoDetail(baseDetail, lead);
      const updated = await putLeadDetail(lt, leadId, body);
      setBaseDetail(updated);
      const mapped = detailJsonToLead(updated, lt);
      setLead((prev) => ({ ...mapped, id: leadId, activities: prev.activities }));
      setToast({ kind: "success", message: "Additional info saved." });
      window.setTimeout(() => setToast(null), 3500);
    } catch (e) {
      setSecondBoxError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingSecondBox(false);
    }
  }, [baseDetail, lead, leadId, leadTypeParam, validLeadType]);

  const handleVerify = useCallback(async () => {
    if (!validLeadType) return;
    const lt = leadTypeParam as CrmLeadType;
    setVerifying(true);
    try {
      await postVerifyLead(lt, leadId, {});
      setToast({ kind: "success", message: "Verification request sent." });
      window.setTimeout(() => setToast(null), 4000);
      await load();
    } catch (e) {
      setToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Verify failed",
      });
      window.setTimeout(() => setToast(null), 6000);
    } finally {
      setVerifying(false);
    }
  }, [leadId, leadTypeParam, load, validLeadType]);

  const handleSendQuote = useCallback(async () => {
    if (!validLeadType) return;
    const lt = leadTypeParam as CrmLeadType;
    const link = lead.quoteLink?.trim();
    if (!link) {
      setToast({ kind: "error", message: "Add a quote link on the lead before sending." });
      window.setTimeout(() => setToast(null), 5000);
      return;
    }
    if (!lead.email?.trim()) {
      setToast({ kind: "error", message: "Lead email is required to send a quote." });
      window.setTimeout(() => setToast(null), 5000);
      return;
    }
    setQuoteSending(true);
    try {
      const fd = new FormData();
      fd.append("quoteLink", link);
      fd.append("toEmail", lead.email.trim());
      fd.append("subject", quoteSubject.trim() || "Quote");
      fd.append("body", quoteBody.trim() || "Please find your quote linked below.");
      fd.append("leadId", String(leadId));
      fd.append("leadType", crmLeadTypeToApiLabel(lt));
      const res = (await postQuoteSend(fd)) as { success?: boolean; message?: string };
      const ok = res && typeof res === "object" && res.success !== false;
      setToast({
        kind: ok ? "success" : "error",
        message:
          typeof res === "object" && res !== null && typeof res.message === "string"
            ? res.message
            : ok
              ? "Quote sent."
              : "Quote send failed",
      });
      window.setTimeout(() => setToast(null), 5000);
    } catch (e) {
      setToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Quote send failed",
      });
      window.setTimeout(() => setToast(null), 6000);
    } finally {
      setQuoteSending(false);
    }
  }, [lead.email, lead.quoteLink, leadId, leadTypeParam, quoteBody, quoteSubject, validLeadType]);

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
        lostReason: args.lostReason?.trim() ? args.lostReason.trim() : lead.lostReason,
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
      setToast({ kind: "success", message: "Saved" });
      window.setTimeout(() => setToast(null), 4000);
    },
    [baseDetail, lead, leadId, leadTypeParam, refreshActivities, validLeadType]
  );

  if (!validLeadType) {
    return (
      <main className="min-h-screen bg-[var(--crm-app-bg)] p-8">
        <p className="text-rose-600">
          Unknown lead source. Use /Leads/formlead/123 (or glead, mlead, addlead,
          websitelead).
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
      {toast ? (
        <div
          className={`fixed right-4 top-4 z-[60] max-w-[min(420px,calc(100vw-2rem))] rounded-xl border px-4 py-3 text-[13px] shadow-[var(--crm-shadow-md)] ${
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/90 dark:text-emerald-100"
              : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/90 dark:text-rose-100"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      ) : null}
      <div className="mx-auto max-w-[1440px]">
        <TopBar />
        <LeadHeader
          lead={lead}
          onCompleteTask={() => setCompleteTaskOpen(true)}
          salesClosureHref={salesClosureHref}
        />
        <DesignQaPanel leadId={leadId} />
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
          <LeadInfoTab lead={lead} onLeadChange={patchLead} onLogCall={handlePhoneCallLog} />
        )}
        {activeTab === "assignments" && <AssignmentsTab lead={lead} onLeadChange={patchLead} />}
        {activeTab === "activity" && <ActivityTimeline activities={lead.activities} />}
        {saveError ? <p className="mt-2 text-[12px] text-rose-600">{saveError}</p> : null}
        {secondBoxError ? <p className="mt-2 text-[12px] text-rose-600">{secondBoxError}</p> : null}
        <FooterActions
          onSave={handleSave}
          saving={saving}
          onSaveSecondBox={handleSaveSecondBox}
          savingSecondBox={savingSecondBox}
          onVerify={canVerifyRole ? handleVerify : undefined}
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
    </main>
  );
}
