"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// Inline filled bell — no external dependency needed
function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 110"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
    >
      {/* Hanger circle */}
      <circle cx="50" cy="10" r="8" fill="currentColor" />
      {/* Bell body */}
      <path
        d="M50 18 C34 18 22 30 20 46 L16 72 Q15 80 22 80 L78 80 Q85 80 84 72 L80 46 C78 30 66 18 50 18 Z"
        fill="currentColor"
      />
      {/* Base bar */}
      <rect x="30" y="78" width="40" height="6" rx="3" fill="currentColor" />
      {/* Clapper */}
      <circle cx="50" cy="91" r="8" fill="currentColor" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  /** ISO timestamp string */
  timestamp: string;
  read: boolean;
  /** Optional tag e.g. "Lead", "Meeting", "Reminder" */
  tag?: string;
};

type Props = {
  notifications?: NotificationItem[];
  onMarkAllRead?: () => void;
  onNotificationClick?: (id: string) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "—";

  const diff = Date.now() - date.getTime();

  // Future or within 5 seconds — show formatted date instead of "just now"
  // (handles cases where the server sends a future meeting_date as timestamp)
  if (diff < 5_000) {
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  // Older than 30 days — show a readable date
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Unread items first (newest → oldest), then read items (newest → oldest) */
function sortNotifications(items: NotificationItem[]): NotificationItem[] {
  const unread = items
    .filter((n) => !n.read)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  const read = items
    .filter((n) => n.read)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  return [...unread, ...read];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Notify({
  notifications = [],
  onMarkAllRead,
  onNotificationClick,
}: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Track previous unread count to trigger ring animation on new notifications
  const prevUnreadRef = useRef(unreadCount);
  const [ringing, setRinging] = useState(false);

  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setRinging(true);
      const t = setTimeout(() => setRinging(false), 700);
      return () => clearTimeout(t);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) === false &&
        buttonRef.current?.contains(e.target as Node) === false
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleClick = (id: string) => {
    onNotificationClick?.(id);
    setOpen(false);
  };

  const label = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <>
      {/* Bell ring keyframes injected once */}
      <style>{`
        @keyframes bell-ring {
          0%   { transform: rotate(0deg); }
          15%  { transform: rotate(18deg); }
          30%  { transform: rotate(-16deg); }
          45%  { transform: rotate(12deg); }
          60%  { transform: rotate(-10deg); }
          75%  { transform: rotate(6deg); }
          90%  { transform: rotate(-4deg); }
          100% { transform: rotate(0deg); }
        }
        .bell-ring {
          animation: bell-ring 0.7s ease-in-out;
          transform-origin: top center;
        }
      `}</style>

      <div className="relative">
        {/* ── Bell button ── matches nav surface, subtle border */}
        <button
          ref={buttonRef}
          type="button"
          aria-label="Notifications"
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-150",
            open
              ? "border-[var(--crm-accent-ring)] bg-[var(--crm-accent-soft)] text-[var(--crm-accent)]"
              : "border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] text-[var(--crm-text-secondary)] hover:bg-[var(--crm-surface-elevated)] hover:text-[var(--crm-text-primary)]",
          )}
        >
          {/* Bell icon — rings when new notification arrives */}
          <span
            className={cn(
              "inline-flex items-center justify-center",
              ringing && "bell-ring",
            )}
          >
            <BellIcon
              className={cn(
                "h-8 w-8",
                open ? "text-[var(--crm-accent)]" : "text-black",
              )}
            />
          </span>

          {/* Badge — inside the button, top-right corner, no overflow outside the nav */}
          {unreadCount > 0 && (
            <span
              aria-label={`${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
              className="pointer-events-none absolute -right-1.5 -top-1.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-md"
            >
              {label}
            </span>
          )}
        </button>

        {/* ── Dropdown panel — fixed to viewport right edge so it never clips ── */}
        {open && (
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            className="fixed right-6 top-[64px] z-[99999] w-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.18)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] font-bold text-slate-900">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="text-[12px] font-semibold text-[var(--crm-accent)] hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[440px] overflow-y-auto bg-white">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <BellIcon className="h-10 w-10 text-slate-200" />
                  <p className="text-[13px] text-slate-400">
                    You&apos;re all caught up!
                  </p>
                </div>
              ) : (
                <ul>
                  {sortNotifications(notifications).map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleClick(item.id)}
                        className={cn(
                          "flex w-full gap-3.5 border-b border-slate-100 px-5 py-4 text-left transition-colors last:border-b-0 hover:bg-slate-50",
                          !item.read && "bg-blue-50/70",
                        )}
                      >
                        {/* Unread dot */}
                        <span
                          className={cn(
                            "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                            item.read
                              ? "bg-transparent"
                              : "bg-[var(--crm-accent)]",
                          )}
                          aria-hidden="true"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <span
                              className={cn(
                                "text-[13.5px] leading-snug",
                                item.read
                                  ? "font-medium text-slate-600"
                                  : "font-semibold text-slate-900",
                              )}
                            >
                              {item.title}
                            </span>
                            <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-slate-400">
                              {relativeTime(item.timestamp)}
                            </span>
                          </div>

                          {item.description && (
                            <p className="mt-1 text-[12px] text-slate-500">
                              {item.description}
                            </p>
                          )}

                          {item.tag && (
                            <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                              {item.tag}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-slate-100 bg-white px-5 py-3 text-center">
                <span className="text-[11px] text-slate-400">
                  {notifications.length} notification
                  {notifications.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
