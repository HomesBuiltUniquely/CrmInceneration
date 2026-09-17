"use client";

import { useLayoutEffect, useState } from "react";
import Header from "./Components/CrmDashboard/Header";
import RequireAuth from "./Components/RequireAuth";
import {
  CRM_ROLE_STORAGE_KEY,
  CRM_TOKEN_STORAGE_KEY,
  landingPathByRole,
  normalizeRole,
} from "@/lib/auth/api";

/**
 * CRM sales dashboard (`/`). Sales executives land on My Leads — no dashboard access.
 */
export default function Home() {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const token = localStorage.getItem(CRM_TOKEN_STORAGE_KEY);
    if (!token) {
      window.location.replace(`${window.location.origin}/login`);
      return;
    }
    const role = normalizeRole(localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "");
    const landingPath = landingPathByRole(role);
    if (landingPath !== "/") {
      window.location.replace(`${window.location.origin}${landingPath}`);
      return;
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 text-sm text-gray-600">
        Loading…
      </div>
    );
  }

  return (
    <RequireAuth>
      <main>
        <div className="xl:bg-gray-100">
          <Header />
        </div>
      </main>
    </RequireAuth>
  );
}
