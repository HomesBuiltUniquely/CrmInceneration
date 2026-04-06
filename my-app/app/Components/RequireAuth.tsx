"use client";

import { CRM_TOKEN_STORAGE_KEY } from "@/lib/auth/api";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
};

export default function RequireAuth({ children }: Props) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(CRM_TOKEN_STORAGE_KEY);
    if (!token) {
      router.replace("/login");
      return;
    }
    setAllowed(true);
  }, [router]);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-600 text-sm">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
