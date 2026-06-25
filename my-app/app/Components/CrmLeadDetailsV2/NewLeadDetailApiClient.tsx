"use client";

import LeadDetailsApiClient from "@/app/Components/CrmLeadDetails/LeadDetailsApiClient";

type Props = {
  leadType: string;
  leadId: string;
};

/** API-backed V2 lead detail — reuses old CRM orchestration with new UI shell. */
export default function NewLeadDetailApiClient({ leadType, leadId }: Props) {
  return <LeadDetailsApiClient leadType={leadType} leadId={leadId} uiVariant="v2" />;
}
