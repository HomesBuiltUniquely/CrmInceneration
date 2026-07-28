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

function getReadIds(username: string): Set<string> {
  try {
    const key = `${READ_IDS_KEY}_${username}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>, username: string): void {
  try {
    const key = `${READ_IDS_KEY}_${username}`;
    window.localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {}
}

function applyReadState(
  items: NotificationItem[],
  username: string,
): NotificationItem[] {
  const readIds = getReadIds(username);
  console.log(
    `[applyReadState] User: ${username}, Read IDs from localStorage:`,
    Array.from(readIds),
  );
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

  const [username] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(CRM_USER_NAME_STORAGE_KEY) ?? "";
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const token = readStoredCrmToken();

    console.log(`[TopNav] Loading notifications for user: ${username}`);

    loadNotifications(token, role, username).then((items) => {
      console.log(
        `[TopNav] Received ${items.length} notifications from server`,
      );
      const withReadState = applyReadState(items, username);
      const readCount = withReadState.filter((n) => n.read).length;
      console.log(
        `[TopNav] After applying read state: ${readCount} read, ${items.length - readCount} unread`,
      );
      setNotifications(withReadState);
    });
  }, [role, username]);

  const searchActive = search.trim().length > 0;

  const handleDashboardClick = () => {
    if (!hasDashboardByRole(role)) return;
    router.push(dashboardPathByRole(role));
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      const readIds = getReadIds(username);
      updated.forEach((n) => readIds.add(n.id));
      saveReadIds(readIds, username);
      return updated;
    });
  };

  const handleNotificationClick = (id: string) => {
    console.log(
      `[TopNav] Marking notification ${id} as read for user: ${username}`,
    );
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      const readIds = getReadIds(username);
      readIds.add(id);
      saveReadIds(readIds, username);
      console.log(
        `[TopNav] Saved read IDs to localStorage:`,
        Array.from(readIds),
      );
      return updated;
    });
  };

  const handleClearAll = (
    tabType: "all" | "leads" | "meetings" | "bookings",
  ) => {
    const tabName =
      tabType === "all"
        ? "all"
        : tabType === "leads"
          ? "lead"
          : tabType === "meetings"
            ? "meeting"
            : "booking";
    if (
      confirm(
        `Are you sure you want to clear all ${tabName} notifications? This cannot be undone.`,
      )
    ) {
      setNotifications((prev) => {
        if (tabType === "all") {
          const key = `${READ_IDS_KEY}_${username}`;
          window.localStorage.removeItem(key);
          return [];
        }

        const idsToRemove = new Set<string>();

        prev.forEach((n) => {
          const tag = (n.tag || "").toLowerCase();
          const shouldRemove =
            (tabType === "meetings" && tag !== "booking" && tag !== "lead") ||
            (tabType === "bookings" && tag === "booking") ||
            (tabType === "leads" && tag === "lead");

          if (shouldRemove) {
            idsToRemove.add(n.id);
          }
        });

        const readIds = getReadIds(username);
        idsToRemove.forEach((id) => readIds.delete(id));
        saveReadIds(readIds, username);

        return prev.filter((n) => !idsToRemove.has(n.id));
      });
    }
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
                onClearAll={handleClearAll}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
