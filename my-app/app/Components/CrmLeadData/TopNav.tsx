"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CRM_ROLE_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
  dashboardPathByRole,
  hasDashboardByRole,
} from "@/lib/auth/api";
import { readStoredCrmToken } from "@/lib/crm-client-auth";
import { loadNotifications } from "@/lib/notification-service";
import Notify, {
  type NotificationItem,
} from "@/app/Components/Notification/Notify";

// ── Read-state persistence ────────────────────────────────────────────────────
// Store a Set of notification IDs the user has already read in localStorage
// so that page reloads don't reset them back to "unread".

const READ_IDS_KEY = "crm_read_notification_ids";

function getReadIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(READ_IDS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>): void {
  try {
    window.localStorage.setItem(READ_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/** Merge server items with persisted read state */
function applyReadState(items: NotificationItem[]): NotificationItem[] {
  const readIds = getReadIds();
  if (readIds.size === 0) return items;
  return items.map((n) => (readIds.has(n.id) ? { ...n, read: true } : n));
}

// ─────────────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 text-[var(--crm-text-muted)]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M16.2 16.2 21 21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function TopNav({
  search,
  onSearchChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const router = useRouter();

  const [role] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Fetch live notifications once on mount, then rehydrate read state
  useEffect(() => {
    const token    = readStoredCrmToken();
    const username = window.localStorage.getItem(CRM_USER_NAME_STORAGE_KEY) ?? "";

    loadNotifications(token, role, username).then((items) => {
      setNotifications(applyReadState(items));
    });
  }, [role]);

  const searchActive = search.trim().length > 0;

  const handleDashboardClick = () => {
    if (!hasDashboardByRole(role)) return;
    router.push(dashboardPathByRole(role));
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      // Persist every ID as read
      const readIds = getReadIds();
      updated.forEach((n) => readIds.add(n.id));
      saveReadIds(readIds);
      return updated;
    });
  };

  const handleNotificationClick = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      // Persist this ID as read
      const readIds = getReadIds();
      readIds.add(id);
      saveReadIds(readIds);
      return updated;
    });
  };

  return (
    <div className="relative z-50 w-full border-b border-[var(--crm-border)] bg-[var(--crm-surface-elevated)]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3">

        {/* Left Side */}
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-3">

          {/* Left Side */}
          <div className="flex items-center gap-4">

            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--crm-sidebar-active)] shadow-[var(--crm-shadow-sm)]">
                <Image
                  src="/HowsCrmLogo.png"
                  alt="Hows CRM"
                  width={24}
                  height={24}
                />
              </div>

              <div className="text-[15px] font-semibold text-[var(--crm-text-primary)]">
                Hows CRM
              </div>
            </div>

            <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--crm-text-muted)]">

              {hasDashboardByRole(role) && (
                <>
                  <button
                    onClick={handleDashboardClick}
                    className="rounded-full bg-[var(--crm-accent-soft)] px-3 py-1 text-[12px] font-semibold text-[var(--crm-accent)] ring-1 ring-[var(--crm-accent-ring)]"
                  >
                    Dashboard
                  </button>

                  <span>/</span>
                </>
              )}

              <span className="rounded-full bg-[var(--crm-accent-soft)] px-3 py-1 text-[12px] font-semibold text-[var(--crm-accent)] ring-1 ring-[var(--crm-accent-ring)]">
                Lead Management
              </span>

            </div>

          </div>

          {/* Right Side */}
          <div className="ml-auto flex items-center gap-4">

            <div
              className={`flex w-[420px] items-center gap-2 rounded-xl px-3 py-2 transition-colors ${
                searchActive
                  ? "bg-[var(--crm-accent-soft)] ring-2 ring-[var(--crm-accent)]"
                  : "bg-[var(--crm-surface-subtle)] ring-1 ring-[var(--crm-border)]"
              }`}
            >
              <SearchIcon />

              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search leads, tasks, owners..."
                className="w-full bg-transparent text-[12px] font-medium text-[var(--crm-text-secondary)] placeholder:text-[var(--crm-text-muted)] focus:outline-none"
              />

              {searchActive && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--crm-accent)]"
                >
                  Clear
                </button>
              )}
            </div>

            <button className="rounded-xl bg-[var(--crm-accent)] px-4 py-2 text-[12px] font-semibold text-white shadow-[var(--crm-shadow-sm)] transition hover:brightness-110 active:scale-95">
              + Add New Lead
            </button>

            {/* Notification */}
            <div className="relative overflow-visible z-[999999]">
              <Notify
                notifications={notifications}
                onMarkAllRead={handleMarkAllRead}
                onNotificationClick={handleNotificationClick}
              />
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
