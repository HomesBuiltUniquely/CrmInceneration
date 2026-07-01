"use client";

import { useEffect, useState } from "react";
import LeadDetailsApiClient from "@/app/Components/CrmLeadDetails/LeadDetailsApiClient";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";
import { readLeadDetailWorkspaceFromBrowser } from "@/lib/crm-workspace";
import { canUseNewLeadDetailUi } from "@/lib/roleUtils";

type Props = {
  leadType: string;
  leadId: string;
};

/** API-backed lead detail — V2 on sales workspace; legacy on presales workspace/roles. */
export default function NewLeadDetailApiClient({ leadType, leadId }: Props) {
  const [uiVariant, setUiVariant] = useState<"legacy" | "v2" | null>(null);

  useEffect(() => {
    const role = normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "");
    const workspace = readLeadDetailWorkspaceFromBrowser();
    setUiVariant(canUseNewLeadDetailUi(role, workspace) ? "v2" : "legacy");
  }, []);

  if (uiVariant === null) {
    return (
      <main className="min-h-screen bg-[var(--crm-app-bg)] px-4 py-8 text-sm text-[var(--crm-text-muted)]">
        Loading lead…
      </main>
    );
  }

  return <LeadDetailsApiClient leadType={leadType} leadId={leadId} uiVariant={uiVariant} />;
}
