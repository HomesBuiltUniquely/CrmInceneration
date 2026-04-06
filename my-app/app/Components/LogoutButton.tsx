"use client";

import { CRM_TOKEN_STORAGE_KEY, logout as apiLogout } from "@/lib/auth/api";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  className?: string;
};

export default function LogoutButton({ className = "" }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    try {
      const token = localStorage.getItem(CRM_TOKEN_STORAGE_KEY);
      if (token) {
        await apiLogout(token);
      }
    } finally {
      localStorage.removeItem(CRM_TOKEN_STORAGE_KEY);
      router.replace("/login");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className={`rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {busy ? "Signing out…" : "Log out"}
    </button>
  );
}
