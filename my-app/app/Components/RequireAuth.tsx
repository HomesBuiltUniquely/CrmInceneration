"use client";

import { CRM_TOKEN_STORAGE_KEY } from "@/lib/auth/api";
import { tryConsumeHallwayHandoffFromUrl } from "@/lib/auth/hallway-handoff";
import { useLayoutEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
};

export default function RequireAuth({ children }: Props) {
  const [allowed, setAllowed] = useState(false);

  useLayoutEffect(() => {
    // Safety net if Hallway opened /Leads#payload=... and bootstrap missed it.
    const landing = tryConsumeHallwayHandoffFromUrl();
    if (landing && landing !== window.location.pathname) {
      window.location.replace(`${window.location.origin}${landing}`);
      return;
    }

    const token = localStorage.getItem(CRM_TOKEN_STORAGE_KEY);
    if (!token) {
      // Hard navigation — client router-only redirects can leave the gate stuck on “Loading…” in automation.
      window.location.replace(`${window.location.origin}/login`);
      return;
    }

    // Do NOT force landingPathByRole here — admins/sales must be able to open
    // /presales-leads via the module switcher without being bounced back to /Leads.

    setAllowed(true);
  }, []);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-600 text-sm">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
