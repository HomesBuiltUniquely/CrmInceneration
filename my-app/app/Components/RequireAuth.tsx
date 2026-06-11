"use client";

import { CRM_TOKEN_STORAGE_KEY } from "@/lib/auth/api";
import { useLayoutEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
};

export default function RequireAuth({ children }: Props) {
  const [allowed, setAllowed] = useState(false);

  useLayoutEffect(() => {
    const token = localStorage.getItem(CRM_TOKEN_STORAGE_KEY);
    if (!token) {
      // Hard navigation — client router-only redirects can leave the gate stuck on “Loading…” in automation.
      window.location.replace(`${window.location.origin}/login`);
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
