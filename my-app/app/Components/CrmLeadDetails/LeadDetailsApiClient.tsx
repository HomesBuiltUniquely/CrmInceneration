"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lead } from "@/lib/data";
import { getLeadActivities, getLeadDetail, postManualActivity, putLeadDetail } from "@/lib/lead-details-client";
import { detailJsonToLead, mapActivitiesJson, mergeLeadIntoDetail } from "@/lib/lead-detail-mapper";
import type { CrmLeadType } from "@/lib/leads-filter";
import { isCrmLeadType } from "@/lib/crm-lead-endpoints";
import TopBar from "./TopBar";
import LeadHeader from "./LeadHeader";
import StatsRow from "./StatsRow";
import Tabs, { type TabId } from "./Tabs";
import LeadInfoTab from "./LeadInfoTab";
import AssignmentsTab from "./AssignmentsTab";
import ActivityTimeline from "./ActivityTimeline";
import FooterActions from "./FooterActions";
import CompleteTaskModal from "./CompleteTaskModal";

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
  const [saving, setSaving] = useState(false);
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

  const patchLead = useCallback((patch: Partial<Lead>) => {
    setLead((prev) => ({ ...prev, ...patch }));
  }, []);

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

  const handleCompleteTaskApi = useCallback(
    async (args: {
      feedback: string;
      milestoneStage: string;
      milestoneStageCategory: string;
      note: string;
      nextCallDateLocal: string;
    }) => {
      if (!validLeadType) return;
      const lt = leadTypeParam as CrmLeadType;
      const nextStage = {
        milestoneStage: args.milestoneStage,
        milestoneStageCategory: args.milestoneStageCategory,
        milestoneSubStage: args.feedback,
        stage: lead.stageBlock?.stage ?? "Initial Stage",
        substage: lead.stageBlock?.substage ?? { substage: "Fresh Leads" },
      };
      const leadForSave: Lead = {
        ...lead,
        followUpDate: args.nextCallDateLocal,
        status: args.feedback,
        stageBlock: nextStage,
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
    },
    [baseDetail, lead, leadId, leadTypeParam, refreshActivities, validLeadType]
  );

  if (!validLeadType) {
    return (
      <main className="min-h-screen bg-white p-8">
        <p className="text-rose-600">Unknown lead source. Use /Leads/formlead/123 (or glead, mlead, addlead, websitelead).</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-4 py-12 text-center text-slate-600">
        Loading lead…
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-white px-4 py-8">
        <p className="text-rose-600">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <TopBar />
        <LeadHeader lead={lead} onCompleteTask={() => setCompleteTaskOpen(true)} />
        <StatsRow lead={lead} />
        <Tabs active={activeTab} onChange={setActiveTab} />

        {activeTab === "lead" && <LeadInfoTab lead={lead} onLeadChange={patchLead} />}
        {activeTab === "additional" && <LeadInfoTab lead={lead} onLeadChange={patchLead} />}
        {activeTab === "assignments" && <AssignmentsTab lead={lead} onLeadChange={patchLead} />}
        {activeTab === "activity" && <ActivityTimeline activities={lead.activities} />}
        {saveError ? <p className="mt-2 text-[12px] text-rose-600">{saveError}</p> : null}
        <FooterActions onSave={handleSave} saving={saving} />
      </div>
      <CompleteTaskModal
        lead={lead}
        open={completeTaskOpen}
        onClose={() => setCompleteTaskOpen(false)}
        onApiComplete={handleCompleteTaskApi}
      />
    </main>
  );
}
