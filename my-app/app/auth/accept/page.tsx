"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CRM_ROLE_STORAGE_KEY,
  CRM_TOKEN_STORAGE_KEY,
  landingPathByRole,
} from "@/lib/auth/api";
import { tryConsumeHallwayHandoffFromUrl } from "@/lib/auth/hallway-handoff";

/**
 * Preferred Hallway → CRM handoff entry (same pattern as Design Module).
 * Hallway opens: `{CRM_FRONTEND}/auth/accept#payload=<urlencoded JSON>`
 *
 * Also works if bootstrap already applied `#payload=` before React:
 * then we just route by stored role.
 */
export default function AuthAcceptPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Accepting session…");

  useEffect(() => {
    const landingFromHash = tryConsumeHallwayHandoffFromUrl();
    const token = localStorage.getItem(CRM_TOKEN_STORAGE_KEY);
    const role = localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";

    if (!token) {
      setMessage("Missing session. Redirecting to login…");
      window.location.replace(`${window.location.origin}/login`);
      return;
    }

    const path = landingFromHash || landingPathByRole(role);
    setMessage("Opening CRM…");
    router.replace(path);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-600 text-sm">
      {message}
    </div>
  );
}
