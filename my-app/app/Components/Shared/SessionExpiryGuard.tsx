"use client";

import { useEffect } from "react";
import {
  CRM_TOKEN_STORAGE_KEY,
} from "@/lib/auth/api";
import {
  forceSessionExpiredLogout,
  installSessionExpiredFetchGuard,
  isStoredTokenExpired,
  validateStoredSessionOrLogout,
} from "@/lib/auth/session-expiry";

/**
 * Global 24h session guard:
 * - patches fetch for 401 SESSION_EXPIRED → Hallway login
 * - validates token on boot + tab focus
 */
export default function SessionExpiryGuard() {
  useEffect(() => {
    installSessionExpiredFetchGuard();

    const token = window.localStorage.getItem(CRM_TOKEN_STORAGE_KEY)?.trim();
    if (!token) return;

    if (isStoredTokenExpired()) {
      forceSessionExpiredLogout();
      return;
    }

    void validateStoredSessionOrLogout();

    const onFocus = () => {
      void validateStoredSessionOrLogout();
    };
    const onAuthExpired = () => {
      forceSessionExpiredLogout();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("crm:auth-expired", onAuthExpired);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("crm:auth-expired", onAuthExpired);
    };
  }, []);

  return null;
}
