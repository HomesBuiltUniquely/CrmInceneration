"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { NotificationItem } from "@/app/Components/Notification/Notify";
import { isCrmInboxV2Client } from "@/lib/crm-inbox-v2";
import {
  fetchCrmInboxNotifications,
  markCrmInboxRead,
  markCrmInboxReadAll,
} from "@/lib/crm-inbox-client";

const POLL_MS = 20_000;

type CrmNotificationContextValue = {
  enabled: boolean;
  notifications: NotificationItem[];
  refreshInbox: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
};

const CrmNotificationContext = createContext<CrmNotificationContextValue | null>(null);

export function useCrmNotifications(): CrmNotificationContextValue {
  const ctx = useContext(CrmNotificationContext);
  if (!ctx) {
    return {
      enabled: false,
      notifications: [],
      refreshInbox: async () => {},
      markRead: async () => {},
      markAllRead: async () => {},
      setNotifications: () => {},
    };
  }
  return ctx;
}

export function CrmNotificationProvider({ children }: { children: ReactNode }) {
  const enabled = isCrmInboxV2Client();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const refreshInFlight = useRef(false);

  const refreshInbox = useCallback(async () => {
    if (!enabled || refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const items = await fetchCrmInboxNotifications();
      setNotifications(items);
    } finally {
      refreshInFlight.current = false;
    }
  }, [enabled]);

  const markRead = useCallback(
    async (id: string) => {
      if (!enabled) return;
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      await markCrmInboxRead(id);
    },
    [enabled],
  );

  const markAllRead = useCallback(async () => {
    if (!enabled) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await markCrmInboxReadAll();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refreshInbox();
  }, [enabled, refreshInbox]);

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/crm/inbox/stream");
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as { type?: string; reason?: string };
          if (data.type === "inbox_updated" && data.reason !== "read" && data.reason !== "read-all") {
            void refreshInbox();
          }
          if (data.type === "inbox_updated" && !data.reason) {
            void refreshInbox();
          }
        } catch {
          void refreshInbox();
        }
      };
    } catch {
      /* EventSource unsupported */
    }

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void refreshInbox();
    }, POLL_MS);

    return () => {
      clearInterval(poll);
      es?.close();
    };
  }, [enabled, refreshInbox]);

  return (
    <CrmNotificationContext.Provider
      value={{
        enabled,
        notifications,
        refreshInbox,
        markRead,
        markAllRead,
        setNotifications,
      }}
    >
      {children}
    </CrmNotificationContext.Provider>
  );
}