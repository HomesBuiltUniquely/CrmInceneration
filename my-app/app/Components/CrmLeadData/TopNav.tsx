"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CRM_ROLE_STORAGE_KEY,
  dashboardPathByRole,
  hasDashboardByRole,
} from "@/lib/auth/api";
import Notify, {
  type NotificationItem,
} from "@/app/Components/Notification/Notify";

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

const DEMO_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "1",
    title: "New lead assigned to you",
    description: "Ananya Sharma - Walk-in Lead",
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    read: false,
    tag: "Lead",
  },
  {
    id: "2",
    title: "Meeting scheduled",
    description: "Tomorrow at 10:00 AM",
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    read: false,
    tag: "Meeting",
  },
  {
    id: "3",
    title: "Follow-up reminder",
    description: "Call Priya Kapoor today",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    read: true,
    tag: "Reminder",
  },
];

export default function TopNav({
  search,
  onSearchChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const router = useRouter();

  const [role] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
  });

  const [notifications, setNotifications] =
    useState<NotificationItem[]>(DEMO_NOTIFICATIONS);

  const searchActive = search.trim().length > 0;

  const handleDashboardClick = () => {
    if (!hasDashboardByRole(role)) return;
    router.push(dashboardPathByRole(role));
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        read: true,
      }))
    );
  };

  const handleNotificationClick = (id: string) => {
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              read: true,
            }
          : item
      )
    );
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
        