"use client";

import { CRM_TOKEN_STORAGE_KEY, landingPathByRole, CRM_ROLE_STORAGE_KEY } from "@/lib/auth/api";
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

    // If role landing differs from current path (e.g. presales landed on /Leads), correct it.
    const role = localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
    const expected = landingPathByRole(role);
    if (
      role &&
      expected &&
      expected !== window.location.pathname &&
      (expected === "/presales-leads" || window.location.pathname === "/presales-leads")
    ) {
      window.location.replace(`${window.location.origin}${expected}`);
      return;
    }

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
