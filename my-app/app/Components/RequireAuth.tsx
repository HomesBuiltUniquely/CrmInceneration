"use client";

import { CRM_TOKEN_STORAGE_KEY } from "@/lib/auth/api";
import {
  assertPresalesCanUseSession,
  clearCrmSession,
  presalesInactiveLoginMessage,
} from "@/lib/presales-auth-gate";
import { useLayoutEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
};

export default function RequireAuth({ children }: Props) {
  const [allowed, setAllowed] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  useLayoutEffect(() => {
    const token = localStorage.getItem(CRM_TOKEN_STORAGE_KEY);
    if (!token) {
      window.location.replace(`${window.location.origin}/login`);
      return;
    }

    let cancelled = false;

    const verify = async () => {
      const gate = await assertPresalesCanUseSession(token);
      if (cancelled) return;
      if (!gate.allowed) {
        clearCrmSession();
        setBlockedMessage(gate.message ?? presalesInactiveLoginMessage());
        window.location.replace(
          `${window.location.origin}/login?inactive=presales`,
        );
        return;
      }
      setAllowed(true);
    };

    void verify();

    const onPresalesStatusChanged = () => {
      void verify();
    };
    window.addEventListener(
      "crm:presales-executive-status-changed",
      onPresalesStatusChanged as EventListener,
    );

    return () => {
      cancelled = true;
      window.removeEventListener(
        "crm:presales-executive-status-changed",
        onPresalesStatusChanged as EventListener,
      );
    };
  }, []);

  if (blockedMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-600 text-sm px-4 text-center">
        {blockedMessage}
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-600 text-sm">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
