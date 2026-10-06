"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CRM_ROLE_STORAGE_KEY,
  CRM_TOKEN_STORAGE_KEY,
  landingPathByRole,
} from "@/lib/auth/api";
import { tryConsumeHallwayHandoffFromUrl } from "@/lib/auth/hallway-handoff";
import { redirectToHallwayPortal } from "@/lib/auth/hallway-portal";

/**
 * CRM login form is hidden — auth is via Hallway.
 * Keep this route only to:
 * 1) consume rare `/login#payload=...` handoffs
 * 2) send everyone else to Hallway
 */
export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const landing = tryConsumeHallwayHandoffFromUrl();
    if (landing) {
      router.replace(landing);
      return;
    }

    const token = localStorage.getItem(CRM_TOKEN_STORAGE_KEY);
    if (token) {
      const role = localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
      router.replace(landingPathByRole(role));
      return;
    }

    redirectToHallwayPortal();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 text-sm text-gray-600">
      Redirecting to Hallway…
    </div>
  );
}
