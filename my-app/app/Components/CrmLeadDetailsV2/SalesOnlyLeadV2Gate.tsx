"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CRM_ROLE_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";
import {
  buildLeadDetailPath,
  readLeadDetailWorkspaceFromBrowser,
} from "@/lib/crm-workspace";
import { canUseNewLeadDetailUi } from "@/lib/roleUtils";

type Props = {
  leadType: string;
  leadId: string;
  children: ReactNode;
};

/** Blocks presales workspace / roles from sales-only V2 sub-routes. */
export default function SalesOnlyLeadV2Gate({ leadType, leadId, children }: Props) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const role = normalizeRole(window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "");
    const workspace = readLeadDetailWorkspaceFromBrowser();
    const canUseV2 = canUseNewLeadDetailUi(role, workspace);
    if (!canUseV2) {
      router.replace(buildLeadDetailPath(leadType, leadId, workspace));
      return;
    }
    setAllowed(true);
  }, [leadId, leadType, router]);

  if (allowed !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--crm-app-bg)] text-sm text-[var(--crm-text-muted)]">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
