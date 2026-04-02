"use client";

import { useEffect, useState } from "react";
import type { Lead } from "@/lib/data";
import { getStoredLeadStatus, setStoredLeadStatus } from "@/lib/lead-status";
import TopBar from "./TopBar";
import LeadHeader from "./LeadHeader";
import StatsRow from "./StatsRow";
import Tabs, { type TabId } from "./Tabs";
import LeadInfoTab from "./LeadInfoTab";
import AssignmentsTab from "./AssignmentsTab";
import ActivityTimeline from "./ActivityTimeline";
import FooterActions from "./FooterActions";
import CompleteTaskModal from "./CompleteTaskModal";

export default function LeadDetailsClient({ lead }: { lead: Lead }) {
  const [activeTab, setActiveTab] = useState<TabId>("lead");
  const [completeTaskOpen, setCompleteTaskOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(lead.status);

  useEffect(() => {
    setCurrentStatus(getStoredLeadStatus(lead.id, lead.status));
  }, [lead.id, lead.status]);

  const leadWithCurrentStatus = {
    ...lead,
    status: currentStatus,
  };

  return (
    <main className="min-h-screen bg-white px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <TopBar />
        <LeadHeader lead={leadWithCurrentStatus} onCompleteTask={() => setCompleteTaskOpen(true)} />
        <StatsRow lead={leadWithCurrentStatus} />
        <Tabs active={activeTab} onChange={setActiveTab} />

        {activeTab === "lead" && <LeadInfoTab lead={leadWithCurrentStatus} />}
        {activeTab === "additional" && <LeadInfoTab lead={leadWithCurrentStatus} />}
        {activeTab === "assignments" && <AssignmentsTab lead={leadWithCurrentStatus} />}
        {activeTab === "activity" && <ActivityTimeline activities={lead.activities} />}
        <FooterActions />
      </div>
      <CompleteTaskModal
        lead={leadWithCurrentStatus}
        open={completeTaskOpen}
        onClose={() => setCompleteTaskOpen(false)}
        onSave={(nextStatus) => {
          setCurrentStatus(nextStatus);
          setStoredLeadStatus(lead.id, nextStatus);
          setCompleteTaskOpen(false);
        }}
      />
    </main>
  );
}
