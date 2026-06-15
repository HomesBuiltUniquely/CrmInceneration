"use client";

import { useEffect, useState } from "react";
import type { Lead } from "@/lib/data";
import { getStoredLeadStatus, setStoredLeadStatus } from "@/lib/lead-status";
import TopBar from "./TopBar";
import LeadDetailsPageShell from "./LeadDetailsPageShell";
import LeadDetailsHero from "./LeadDetailsHero";
import LeadDetailsSidebar from "./LeadDetailsSidebar";
import ActivityHistoryModal from "./ActivityHistoryModal";
import AssignmentsTab from "./AssignmentsTab";
import LeadPhasesPanel from "./LeadPhasesPanel";
import LeadInfoTab from "./LeadInfoTab";
import FooterActions from "./FooterActions";
import CompleteTaskModal from "./CompleteTaskModal";

export default function LeadDetailsClient({ lead }: { lead: Lead }) {
  const [completeTaskOpen, setCompleteTaskOpen] = useState(false);
  const [activityHistoryOpen, setActivityHistoryOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(lead.status);

  useEffect(() => {
    setCurrentStatus(getStoredLeadStatus(lead.id, lead.status));
  }, [lead.id, lead.status]);

  const leadWithCurrentStatus = {
    ...lead,
    status: currentStatus,
  };

  return (
    <>
      <LeadDetailsPageShell
        topBar={<TopBar />}
        hero={
          <LeadDetailsHero
            lead={leadWithCurrentStatus}
            onCompleteTask={() => setCompleteTaskOpen(true)}
          />
        }
        sidebar={
          <LeadDetailsSidebar
            lead={leadWithCurrentStatus}
            onOpenActivityHistory={() => setActivityHistoryOpen(true)}
          />
        }
        phases={
          <LeadPhasesPanel
            lead={leadWithCurrentStatus}
            formContent={<LeadInfoTab lead={leadWithCurrentStatus} />}
            assignmentsContent={<AssignmentsTab lead={leadWithCurrentStatus} />}
          />
        }
        footer={<FooterActions />}
      />
      <ActivityHistoryModal
        activities={leadWithCurrentStatus.activities}
        open={activityHistoryOpen}
        onClose={() => setActivityHistoryOpen(false)}
      />
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
    </>
  );
}
