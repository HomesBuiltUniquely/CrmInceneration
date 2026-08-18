"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CRM_ROLE_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
} from "@/lib/auth/api";
import { readStoredCrmToken } from "@/lib/crm-client-auth";
import { asCrmLeadType } from "@/lib/leads-filter";
import { loadNotifications } from "@/lib/notification-service";
import {
  buildAppBreadcrumb,
  isLeadsListPath,
} from "@/lib/app-header-breadcrumb";
import Notify, {
  type NotificationItem,
} from "@/app/Components/Notification/Notify";
import ModuleSwitcher from "@/app/Components/Shared/ModuleSwitcher";
import { useActiveModule } from "@/app/Components/Shared/ActiveModuleContext";
import { useSmoothRouter } from "@/lib/use-smooth-router";

const READ_IDS_KEY = "crm_read_notification_ids";
const DELETED_IDS_KEY = "crm_deleted_notification_ids";
const NOTIFICATION_POLL_INTERVAL = 30000;

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

function getDeletedIds(username: string): Set<string> {
  try {
    const key = `${DELETED_IDS_KEY}_${username}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDeletedIds(ids: Set<string>, username: string): void {
  try {
    const key = `${DELETED_IDS_KEY}_${username}`;
    window.localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {}
}

function applyReadState(items: NotificationItem[], username: string): NotificationItem[] {
  const readIds = getReadIds(username);
  if (readIds.size === 0) return items;
  return items.map((n) => (readIds.has(n.id) ? { ...n, read: true } : n));
}

function applyDeletedState(items: NotificationItem[], username: string): NotificationItem[] {
  const deletedIds = getDeletedIds(username);
  if (deletedIds.size === 0) return items;
  return items.filter((n) => !deletedIds.has(n.id));
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[var(--crm-text-muted)]" fill="none">
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M16.2 16.2 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

type AppTopBarProps = {
  search?: string;
  onSearchChange?: (value: string) => void;
  pageLabelOverride?: string;
};

export default function AppTopBar({
  search = "",
  onSearchChange,
  pageLabelOverride,
}: AppTopBarProps) {
  const router = useSmoothRouter();
  const pathname = usePathname();
  const { activeModuleId } = useActiveModule();

  const [role] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
  });

  const [username] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(CRM_USER_NAME_STORAGE_KEY) ?? "";
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [previousNotificationIds, setPreviousNotificationIds] = useState<Set<string>>(new Set());
  const [bellRinging, setBellRinging] = useState(false);

  const breadcrumb = useMemo(
    () => buildAppBreadcrumb(pathname, activeModuleId, pageLabelOverride),
    [activeModuleId, pageLabelOverride, pathname],
  );

  const [modulePrefix, pageLabel] = useMemo(() => {
    const splitAt = breadcrumb.indexOf(" > ");
    if (splitAt === -1) return [breadcrumb, ""];
    return [breadcrumb.slice(0, splitAt), breadcrumb.slice(splitAt + 3)];
  }, [breadcrumb]);

  const showSearch = isLeadsListPath(pathname) && onSearchChange !== undefined;
  const searchActive = search.trim().length > 0;

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch {
      /* ignore */
    }
  };

  const fetchNotifications = async () => {
    const token = readStoredCrmToken();
    if (!token) return;

    const items = await loadNotifications(token, role, username);
    const withDeletedFilter = applyDeletedState(items, username);
    const withReadState = applyReadState(withDeletedFilter, username);

    const currentIds = new Set(withReadState.map((n) => n.id));
    const newNotifications = withReadState.filter(
      (n) => !previousNotificationIds.has(n.id) && !n.read,
    );

    if (previousNotificationIds.size > 0 && newNotifications.length > 0) {
      playNotificationSound();
      setBellRinging(true);
      setTimeout(() => setBellRinging(false), 700);
    }

    setPreviousNotificationIds(currentIds);
    setNotifications(withReadState);
  };

  useEffect(() => {
    fetchNotifications();
  }, [role, username]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    intervalId = setInterval(() => {
      if (document.visibilityState === "visible") fetchNotifications();
    }, NOTIFICATION_POLL_INTERVAL);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchNotifications();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [role, username, previousNotificationIds]);

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
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      const readIds = getReadIds(username);
      readIds.add(id);
      saveReadIds(readIds, username);
      return updated;
    });
  };

  const handleNotificationNavigate = async (item: NotificationItem) => {
    const { leadIdentifier } = item;
    if (!leadIdentifier) return;

    try {
      const qs = new URLSearchParams();
      qs.set("mergeAll", "1");
      qs.set("search", leadIdentifier.trim());
      qs.set("page", "0");
      qs.set("size", "50");

      const res = await fetch(`/api/crm/leads?${qs.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;

      const payload = await res.json().catch(() => ({} as any));
      const rows = Array.isArray(payload.content)
        ? payload.content
        : Array.isArray(payload)
          ? payload
          : [];
      const needle = leadIdentifier.trim().toUpperCase();

      const found = rows.find((lead: Record<string, any>) => {
        const li = String(
          lead.leadIdentifier ?? lead.lead_identifier ?? lead.leadId ?? lead.uniqueId ?? "",
        )
          .trim()
          .toUpperCase();
        return li && li === needle;
      });

      if (!found) return;

      let numericLeadId = "";
      if (found.id !== undefined && found.id !== null) numericLeadId = String(found.id);
      else if (found.leadId !== undefined && found.leadId !== null) numericLeadId = String(found.leadId);
      else if ((found as any).hubLeadId !== undefined && (found as any).hubLeadId !== null) {
        numericLeadId = String((found as any).hubLeadId);
      }

      if (!numericLeadId) return;

      const rawLeadType = String(found.leadType ?? found.type ?? "").trim() || undefined;
      const leadType = asCrmLeadType(rawLeadType, "formlead");
      router.push(`/Leads/${leadType}/${numericLeadId}`);
    } catch {
      /* ignore */
    }
  };

  const handleClearAll = (tabType: "all" | "leads" | "meetings" | "bookings") => {
    const tabName =
      tabType === "all"
        ? "all"
        : tabType === "leads"
          ? "lead"
          : tabType === "meetings"
            ? "meeting"
            : "booking";
    if (!confirm(`Are you sure you want to clear all ${tabName} notifications? This cannot be undone.`)) {
      return;
    }

    setNotifications((prev) => {
      const deletedIds = getDeletedIds(username);

      if (tabType === "all") {
        prev.forEach((n) => deletedIds.add(n.id));
        saveDeletedIds(deletedIds, username);
        window.localStorage.removeItem(`${READ_IDS_KEY}_${username}`);
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
          deletedIds.add(n.id);
        }
      });

      saveDeletedIds(deletedIds, username);
      const readIds = getReadIds(username);
      idsToRemove.forEach((id) => readIds.delete(id));
      saveReadIds(readIds, username);
      return prev.filter((n) => !idsToRemove.has(n.id));
    });
  };

  return (
    <div
      className="relative z-50 w-full border-b border-[var(--crm-border)] bg-[var(--crm-surface-elevated)]"
      data-app-topbar="true"
    >
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-6">
        <nav
          aria-label="Breadcrumb"
          className="flex shrink-0 items-center font-sans text-[13px] tracking-[0.02em]"
        >
          <span className="font-semibold text-black">{modulePrefix}</span>
          {pageLabel ? (
            <>
              <span className="mx-1.5 font-semibold text-black">&gt;</span>
              <span
                key={pageLabel}
                aria-current="page"
                className="app-breadcrumb-active inline-flex items-center gap-1.5 rounded-lg bg-[var(--crm-accent-soft)] px-2.5 py-1 ring-1 ring-[var(--crm-accent-ring)]"
              >
                <span
                  aria-hidden
                  className="app-breadcrumb-active-dot h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--crm-accent)]"
                />
                <span className="text-[13px] font-bold leading-none text-[var(--crm-accent-strong)]">
                  {pageLabel}
                </span>
              </span>
            </>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {showSearch ? (
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
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search leads, tasks, owners..."
                className="w-full bg-transparent text-[12px] font-medium text-[var(--crm-text-secondary)] placeholder:text-[var(--crm-text-muted)] focus:outline-none"
              />
              {searchActive ? (
                <button
                  type="button"
                  onClick={() => onSearchChange?.("")}
                  className="rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--crm-accent)]"
                >
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}

          <ModuleSwitcher />

          <div className="relative z-[999999] overflow-visible">
            <Notify
              notifications={notifications}
              onMarkAllRead={handleMarkAllRead}
              onNotificationClick={handleNotificationClick}
              onNotificationNavigate={handleNotificationNavigate}
              onClearAll={handleClearAll}
              bellRinging={bellRinging}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
