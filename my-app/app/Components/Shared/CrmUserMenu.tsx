"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CRM_ROLE_STORAGE_KEY,
  CRM_TOKEN_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
  logout as apiLogout,
} from "@/lib/auth/api";
import { cn } from "@/lib/cn";
import ThemeToggle from "./ThemeToggle";

type CrmUserMenuProps = {
  profileName?: string;
  profileRole?: string;
  profileInitials?: string;
};

function normalizeRole(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "PRE_SALES") return "PRESALES_EXECUTIVE";
  if (normalized === "PRE_SALES_MANAGER") return "PRESALES_MANAGER";
  return normalized;
}

function roleDisplayName(role: string): string {
  const r = normalizeRole(role);
  if (r === "SUPER_ADMIN") return "Super Admin";
  if (r === "ADMIN") return "Admin";
  if (r === "SALES_ADMIN") return "Sales Admin";
  if (r === "SALES_MANAGER") return "Sales Manager";
  if (r === "SALES_EXECUTIVE") return "Sales Executive";
  if (r === "PRESALES_MANAGER") return "Presales Manager";
  if (r === "PRESALES_EXECUTIVE") return "Presales Executive";
  if (r === "TERRITORY_DESIGN_MANAGER") return "Territory Design Manager";
  if (r === "DESIGN_MANAGER") return "Design Manager";
  if (r === "DESIGNER") return "Designer";
  return role.replace(/_/g, " ");
}

export default function CrmUserMenu({
  profileName = "User",
  profileRole = "USER",
  profileInitials = "U",
}: CrmUserMenuProps) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [currentName, setCurrentName] = useState(profileName);
  const [currentRole, setCurrentRole] = useState(profileRole);
  const [currentInitials, setCurrentInitials] = useState(profileInitials);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedName = window.localStorage.getItem(CRM_USER_NAME_STORAGE_KEY)?.trim();
    const storedRole = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY)?.trim();
    const roleName = roleDisplayName(storedRole || profileRole);
    const useRoleAsName =
      !storedName || normalizeRole(storedName) === "ADMIN" || normalizeRole(storedName) === "USER";
    const nextName = useRoleAsName && roleName ? roleName : storedName || profileName;
    const nextRole = storedRole || profileRole;
    const nextInitials =
      nextName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("") || profileInitials;

    setCurrentName(nextName);
    setCurrentRole(nextRole);
    setCurrentInitials(nextInitials);
  }, [profileInitials, profileName, profileRole]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const handleLogoutClick = async () => {
    setLogoutBusy(true);
    try {
      const token = window.localStorage.getItem(CRM_TOKEN_STORAGE_KEY);
      if (token) {
        await apiLogout(token);
      }
    } finally {
      window.localStorage.removeItem(CRM_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(CRM_ROLE_STORAGE_KEY);
      window.localStorage.removeItem(CRM_USER_NAME_STORAGE_KEY);
      router.replace("/login");
      setLogoutBusy(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label="Open account menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full border-0 bg-[var(--crm-accent-soft)] text-[0.74rem] font-bold text-[var(--crm-accent)] outline-none transition-all duration-200 ease-out",
          open
            ? "scale-105 shadow-[0_4px_16px_rgba(37,99,235,0.22)] ring-2 ring-[var(--crm-accent-ring)]"
            : "hover:scale-105 hover:-translate-y-0.5 hover:bg-[var(--crm-accent-soft)] hover:shadow-[0_4px_14px_rgba(37,99,235,0.18)] hover:brightness-105 active:scale-95",
        )}
      >
        {currentInitials}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(92vw,280px)] overflow-hidden rounded-[18px] border border-[var(--crm-border)] bg-[var(--crm-surface-elevated)] shadow-[var(--crm-shadow-lg)]">
          <div className="border-b border-[var(--crm-border)] px-4 py-3">
            <div className="truncate text-[14px] font-bold text-[var(--crm-text-primary)]">{currentName}</div>
            <div className="truncate text-[11px] uppercase tracking-[0.08em] text-[var(--crm-text-muted)]">
              {currentRole.replace(/_/g, " ")}
            </div>
          </div>

          <div className="space-y-2 p-3">
            <ThemeToggle className="h-10 w-full justify-center rounded-xl border-[var(--crm-border)] px-0 py-0" compact />
            <button
              type="button"
              onClick={handleLogoutClick}
              disabled={logoutBusy}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--crm-danger)] px-3 text-[0.82rem] font-semibold text-white shadow-[var(--crm-shadow-sm)] transition-transform duration-200 hover:-translate-y-px hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {logoutBusy ? "Signing out..." : "Logout"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
