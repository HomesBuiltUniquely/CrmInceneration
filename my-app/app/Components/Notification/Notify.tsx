"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 110"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
    >
      <circle cx="50" cy="10" r="8" fill="currentColor" />
      <path
        d="M50 18 C34 18 22 30 20 46 L16 72 Q15 80 22 80 L78 80 Q85 80 84 72 L80 46 C78 30 66 18 50 18 Z"
        fill="currentColor"
      />
      <rect x="30" y="78" width="40" height="6" rx="3" fill="currentColor" />
      <circle cx="50" cy="91" r="8" fill="currentColor" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-5 w-5", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-5 w-5", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  );
}

export type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  read: boolean;
  tag?: string;
};

type Props = {
  notifications?: NotificationItem[];
  onMarkAllRead?: () => void;
  onNotificationClick?: (id: string) => void;
};

type TabType = "all" | "leads" | "meetings" | "bookings";

function playNotificationSound() {
  try {
    const audioContext = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.3,
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (err) {
    console.warn("Could not play notification sound:", err);
  }
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "—";

  const diff = Date.now() - date.getTime();

  if (diff < 5_000) {
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function sortNotifications(items: NotificationItem[]): NotificationItem[] {
  return items.slice().sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });
}

function categorizeNotifications(items: NotificationItem[]) {
  const leads: NotificationItem[] = [];
  const meetings: NotificationItem[] = [];
  const bookings: NotificationItem[] = [];

  items.forEach((item) => {
    const tag = (item.tag || "").toLowerCase();
    if (tag === "lead") {
      leads.push(item);
    } else if (tag === "booking") {
      bookings.push(item);
    } else {
      meetings.push(item);
    }
  });

  return { leads, meetings, bookings };
}

function getBadgeStyle(tag?: string): {
  bg: string;
  text: string;
  border: string;
} {
  const normalized = (tag || "").toLowerCase();

  if (normalized.includes("cancel")) {
    return { bg: "bg-red-50", text: "text-red-600", border: "border-red-200" };
  }
  if (normalized.includes("success")) {
    return {
      bg: "bg-green-50",
      text: "text-green-600",
      border: "border-green-200",
    };
  }
  if (normalized.includes("booking")) {
    return {
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      border: "border-emerald-200",
    };
  }
  if (normalized.includes("token")) {
    return {
      bg: "bg-blue-50",
      text: "text-blue-600",
      border: "border-blue-200",
    };
  }
  if (normalized.includes("reschedule")) {
    return {
      bg: "bg-amber-50",
      text: "text-amber-600",
      border: "border-amber-200",
    };
  }
  if (normalized.includes("schedule")) {
    return {
      bg: "bg-indigo-50",
      text: "text-indigo-600",
      border: "border-indigo-200",
    };
  }

  return {
    bg: "bg-slate-50",
    text: "text-slate-600",
    border: "border-slate-200",
  };
}

export default function Notify({
  notifications = [],
  onMarkAllRead,
  onNotificationClick,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const { leads, meetings, bookings } = categorizeNotifications(notifications);
  const leadsUnread = leads.filter((n) => !n.read).length;
  const meetingsUnread = meetings.filter((n) => !n.read).length;
  const bookingsUnread = bookings.filter((n) => !n.read).length;

  const tabItems: Record<TabType, NotificationItem[]> = {
    all: notifications,
    leads,
    meetings,
    bookings,
  };

  let currentItems = tabItems[activeTab];
  const currentUnreadCount =
    activeTab === "all"
      ? unreadCount
      : activeTab === "leads"
        ? leadsUnread
        : activeTab === "meetings"
          ? meetingsUnread
          : bookingsUnread;

  const prevUnreadRef = useRef(unreadCount);
  const [ringing, setRinging] = useState(false);

  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setRinging(true);
      playNotificationSound();
      const t = setTimeout(() => setRinging(false), 700);
      return () => clearTimeout(t);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

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
  };

  const handleMarkCurrentRead = () => {
    const idsToMark = currentItems.filter((n) => !n.read).map((n) => n.id);
    idsToMark.forEach((id) => onNotificationClick?.(id));
  };

  const label = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <>
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

          {unreadCount > 0 && (
            <span
              aria-label={`${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
              className="pointer-events-none absolute -right-1.5 -top-1.5 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-md"
            >
              {label}
            </span>
          )}
        </button>
        {open && (
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            className="fixed right-6 top-[64px] z-[99999] w-[440px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.18)]"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3.5">
              <span className="text-[15px] font-bold text-slate-900">
                Notifications
              </span>
            </div>
            <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-4 py-2.5 overflow-x-auto">
              {(
                [
                  { key: "all",      label: "All",      count: unreadCount,    total: notifications.length },
                  { key: "leads",    label: "Leads",    count: leadsUnread,    total: leads.length },
                  { key: "meetings", label: "Meetings", count: meetingsUnread, total: meetings.length },
                  { key: "bookings", label: "Bookings", count: bookingsUnread, total: bookings.length },
                ] as { key: TabType; label: string; count: number; total: number }[]
              ).map(({ key, label: tabLabel, count, total }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition-all duration-150",
                    activeTab === key
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700",
                  )}
                >
                  <span>{tabLabel}</span>
                  <span
                    className={cn(
                      "flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                      activeTab === key
                        ? count > 0 ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-600"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {count > 0 ? count : total}
                  </span>
                </button>
              ))}
              {currentUnreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkCurrentRead}
                  className="ml-auto shrink-0 text-[11px] font-semibold text-blue-600 hover:underline whitespace-nowrap"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-[320px] overflow-y-auto bg-white">
              {currentItems.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  {activeTab === "bookings" ? (
                    <ReceiptIcon className="h-10 w-10 text-slate-200" />
                  ) : (
                    <CalendarIcon className="h-10 w-10 text-slate-200" />
                  )}
                  <p className="text-[13px] text-slate-400">
                    No {activeTab === "bookings" ? "booking" : activeTab === "leads" ? "lead" : activeTab === "meetings" ? "meeting" : ""}{" "}
                    notifications
                  </p>
                </div>
              ) : (
                <ul>
                  {sortNotifications(currentItems).map((item) => {
                    const badgeStyle = getBadgeStyle(item.tag);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleClick(item.id)}
                          className={cn(
                            "group flex w-full gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition-all duration-150 last:border-b-0",
                            !item.read
                              ? "bg-blue-50/40 hover:bg-blue-50/60"
                              : "hover:bg-slate-50",
                          )}
                        >
                          <span
                            className={cn(
                              "relative mt-1.5 h-2 w-2 shrink-0 rounded-full transition-all duration-200",
                              item.read ? "bg-transparent" : "bg-blue-600",
                            )}
                            aria-hidden="true"
                          >
                            {!item.read && (
                              <span className="absolute inset-0 animate-ping rounded-full bg-blue-600 opacity-75" />
                            )}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <span
                                className={cn(
                                  "text-[13px] leading-snug transition-colors",
                                  item.read
                                    ? "font-medium text-slate-600 group-hover:text-slate-900"
                                    : "font-semibold text-slate-900",
                                )}
                              >
                                {item.title}
                              </span>
                              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] text-slate-400">
                                <svg
                                  viewBox="0 0 16 16"
                                  className="h-3 w-3"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                >
                                  <circle cx="8" cy="8" r="6" />
                                  <path d="M8 4v4l2 2" />
                                </svg>
                                {relativeTime(item.timestamp)}
                              </span>
                            </div>

                            {item.description && (
                              <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                                {item.description}
                              </p>
                            )}

                            {item.tag && (
                              <span
                                className={cn(
                                  "mt-2 inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                                  badgeStyle.bg,
                                  badgeStyle.text,
                                  badgeStyle.border,
                                )}
                              >
                                {item.tag}
                              </span>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                            <svg
                              viewBox="0 0 16 16"
                              className="h-4 w-4 text-slate-400"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M6 4l4 4-4 4" />
                            </svg>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-slate-100 bg-white px-5 py-3 text-center">
              <span className="text-[11px] text-slate-400">
                {currentItems.length} notification
                {currentItems.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
