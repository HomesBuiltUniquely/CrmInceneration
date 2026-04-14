"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type NoticeKind = "success" | "error" | "info";

type Notice = {
  id: number;
  kind: NoticeKind;
  message: string;
};

type NotifyInput = {
  kind: NoticeKind;
  message: string;
  durationMs?: number;
};

type GlobalNotifierValue = {
  notify: (input: NotifyInput) => void;
  notifySuccess: (message: string, durationMs?: number) => void;
  notifyError: (message: string, durationMs?: number) => void;
  notifyInfo: (message: string, durationMs?: number) => void;
};

const GlobalNotifierContext = createContext<GlobalNotifierValue | null>(null);

export function GlobalNotifierProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timerRef = useRef<number | null>(null);
  const idRef = useRef(1);

  const dismiss = useCallback(() => {
    setNotice(null);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const notify = useCallback(
    ({ kind, message, durationMs = 3200 }: NotifyInput) => {
      if (!message.trim()) return;
      const id = idRef.current++;
      setNotice({ id, kind, message: message.trim() });
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        setNotice((prev) => (prev?.id === id ? null : prev));
        timerRef.current = null;
      }, durationMs);
    },
    []
  );

  const value = useMemo<GlobalNotifierValue>(
    () => ({
      notify,
      notifySuccess: (message, durationMs) => notify({ kind: "success", message, durationMs }),
      notifyError: (message, durationMs) => notify({ kind: "error", message, durationMs }),
      notifyInfo: (message, durationMs) => notify({ kind: "info", message, durationMs }),
    }),
    [notify]
  );

  return (
    <GlobalNotifierContext.Provider value={value}>
      {children}
      {notice ? (
        <div className="pointer-events-none fixed left-1/2 top-5 z-[120] w-full -translate-x-1/2 px-3 sm:top-6">
          <div
            className={`pointer-events-auto mx-auto w-full max-w-[420px] rounded-lg border px-3 py-2 shadow-[0_12px_26px_rgba(0,0,0,0.24)] backdrop-blur-[2px] ${
              notice.kind === "success"
                ? "border-emerald-300 bg-gradient-to-r from-emerald-50 via-emerald-50 to-green-100 text-emerald-900 shadow-[0_10px_22px_rgba(16,185,129,0.16)]"
                : notice.kind === "info"
                  ? "border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 text-amber-900 shadow-[0_10px_22px_rgba(245,158,11,0.18)]"
                  : "border-rose-300 bg-gradient-to-r from-rose-50 via-red-50 to-orange-50 text-rose-900 shadow-[0_10px_22px_rgba(244,63,94,0.16)]"
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[14px] font-bold leading-none ${
                  notice.kind === "success"
                    ? "bg-emerald-500 text-white"
                    : notice.kind === "info"
                      ? "bg-amber-500 text-white"
                      : "bg-rose-500 text-white"
                }`}
              >
                {notice.kind === "success" ? "✓" : notice.kind === "info" ? "i" : "⦸"}
              </span>
              <span className="flex-1 text-left text-[13px] font-semibold leading-5 tracking-[-0.01em] sm:text-[14px]">
                {notice.message}
              </span>
              <button
                type="button"
                onClick={dismiss}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-[17px] font-semibold transition ${
                  notice.kind === "success"
                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                    : notice.kind === "info"
                      ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                      : "bg-rose-100 text-rose-800 hover:bg-rose-200"
                }`}
                aria-label="Close notification"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </GlobalNotifierContext.Provider>
  );
}

export function useGlobalNotifier() {
  const ctx = useContext(GlobalNotifierContext);
  if (!ctx) {
    throw new Error("useGlobalNotifier must be used inside GlobalNotifierProvider");
  }
  return ctx;
}
