"use client";

import {
  CRM_TOKEN_STORAGE_KEY,
  getMe,
  unwrapAuthUserPayload,
} from "@/lib/auth/api";
import {
  assertPresalesCanUseSession,
  clearCrmSession,
} from "@/lib/presales-auth-gate";
import { useLayoutEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
};

async function verifySession(): Promise<boolean> {
  const token = localStorage.getItem(CRM_TOKEN_STORAGE_KEY);
  if (!token) return false;
  try {
    const me = await getMe(token);
    await assertPresalesCanUseSession(
      token,
      unwrapAuthUserPayload(me as Record<string, unknown>),
    );
    return true;
  } catch {
    clearCrmSession();
    return false;
  }
}

export default function RequireAuth({ children }: Props) {
  const [allowed, setAllowed] = useState(false);

  useLayoutEffect(() => {
    let cancelled = false;

    const runGate = () => {
      void verifySession().then((ok) => {
        if (cancelled) return;
        if (!ok) {
          window.location.replace(`${window.location.origin}/login?inactive=presales`);
          return;
        }
        setAllowed(true);
      });
    };

    runGate();

    const onStatusChanged = () => {
      void verifySession().then((ok) => {
        if (cancelled) return;
        if (!ok) {
          window.location.replace(`${window.location.origin}/login?inactive=presales`);
        }
      });
    };

    window.addEventListener("crm:presales-executive-status-changed", onStatusChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("crm:presales-executive-status-changed", onStatusChanged);
    };
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
